import {createHash} from 'node:crypto';

// Event receipts are process/transport observations, NOT independently verified
// QA and NOT native permission grants. A trusted host must attest their source.
const ID = /^[A-Za-z0-9:_-]{1,128}$/;
const ADAPTER = /^[a-z][a-z0-9._-]{1,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const STATUS = new Set([
  'TURN_ACCEPTED', 'TURN_RUNNING', 'TOOL_APPROVAL_REQUIRED',
  'TURN_COMPLETED', 'TURN_FAILED', 'TURN_CANCELLED', 'OUTCOME_UNKNOWN',
  'WORKER_DISCONNECTED'
]);
const TERMINAL = new Set(['TURN_COMPLETED','TURN_FAILED','TURN_CANCELLED']);
const RECEIPT_FIELDS = [
  'receiptVersion','goalId','taskId','dispatchId','profileId','adapterId',
  'sessionId','turnId','hostGeneration','scopeHash','sourceSha'
];
// Every host-side receipt lookup must compare the locked identity, not just
// a caller-controlled dispatch ID.
const EXPECTED_RECEIPT_FIELDS = [
  'goalId','taskId','dispatchId','profileId','adapterId','hostGeneration',
  'scopeHash','sourceSha'
];
const EVENT_FIELDS = [
  'eventVersion','dispatchId','adapterId','sessionId','turnId','hostGeneration',
  'sequence','state','providerEvent','payloadDigest'
];
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Object.getPrototypeOf(x) === Object.prototype;
const exact = (value, fields) => record(value) &&
  Object.keys(value).length === fields.length && fields.every(k=>Object.hasOwn(value,k));
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function normalizeAgentTurnReceipt(raw, expected) {
  if (!exact(raw, RECEIPT_FIELDS) || raw.receiptVersion !== 1 ||
      ![raw.goalId,raw.taskId,raw.dispatchId,raw.sessionId,raw.turnId,raw.hostGeneration].every(x=>
        typeof x === 'string' && ID.test(x)) ||
      ![raw.profileId,raw.adapterId].every(x => typeof x === 'string' && ADAPTER.test(x)) ||
      !SHA256.test(raw.scopeHash ?? '') || !COMMIT.test(raw.sourceSha ?? ''))
    throw new Error('INVALID_AGENT_RECEIPT');
  if (!record(expected) ||
      EXPECTED_RECEIPT_FIELDS.some(k => !Object.hasOwn(expected,k)) ||
      Object.keys(expected).some(k => !RECEIPT_FIELDS.includes(k) || raw[k] !== expected[k]))
    throw new Error('AGENT_RECEIPT_SCOPE_MISMATCH');
  return Object.freeze(Object.fromEntries(RECEIPT_FIELDS.map(k=>[k,raw[k]])));
}

export function normalizeAgentEvent(raw, receipt) {
  const r = normalizeAgentTurnReceipt(receipt, receipt);
  if (!exact(raw,EVENT_FIELDS) || raw.eventVersion !== 1 ||
      !Number.isSafeInteger(raw.sequence) || raw.sequence < 1 ||
      !STATUS.has(raw.state) ||
      typeof raw.providerEvent !== 'string' ||
      raw.providerEvent.length < 1 || raw.providerEvent.length > 100 ||
      !/^[A-Za-z0-9._/-]+$/.test(raw.providerEvent) ||
      !SHA256.test(raw.payloadDigest ?? '') ||
      ['dispatchId','adapterId','sessionId','turnId','hostGeneration']
        .some(k=>raw[k]!==r[k]))
    throw new Error('AGENT_EVENT_SCOPE_OR_SCHEMA_MISMATCH');
  return Object.freeze(Object.fromEntries(EVENT_FIELDS.map(k=>[k,raw[k]])));
}

export class AgentEventCursor {
  #receipt;
  #sequence = 0;
  #terminal = false;
  #reconcileRequired = false;
  #verifyHostEvent;
  #inFlight = false;
  constructor({receipt, expected, verifyHostEvent}={}) {
    this.#receipt = normalizeAgentTurnReceipt(receipt, expected);
    if (typeof verifyHostEvent !== 'function')
      throw new Error('TRUSTED_EVENT_VERIFIER_REQUIRED');
    this.#verifyHostEvent = verifyHostEvent;
  }
  get nextSequence() { return this.#sequence + 1; }
  async observe(raw) {
    // Async verification must not let concurrent callbacks race the same
    // sequence and both enter the durable reconciliation path.
    if (this.#inFlight)
      return Object.freeze({status:'RECONCILE_REQUIRED',reason:'AGENT_EVENT_IN_FLIGHT',nextPromptAllowed:false});
    this.#inFlight = true;
    try {
      const event = normalizeAgentEvent(raw,this.#receipt);
      if (this.#reconcileRequired)
        return Object.freeze({status:'RECONCILE_REQUIRED',reason:'AGENT_OUTCOME_UNKNOWN',nextPromptAllowed:false});
      if (this.#terminal || event.sequence !== this.#sequence + 1)
        return Object.freeze({status:'RECONCILE_REQUIRED',reason:'AGENT_EVENT_ORDER_OR_REPLAY',nextPromptAllowed:false});
      const hash = digest(event);
      let proof;
      try { proof = await this.#verifyHostEvent({event,receipt:this.#receipt,eventDigest:hash}); }
      catch { return Object.freeze({status:'RECONCILE_REQUIRED',reason:'AGENT_EVENT_NOT_ATTESTED',nextPromptAllowed:false}); }
      if (proof?.source !== 'TRUSTED_HOST' || proof?.transportVerified !== true ||
          proof?.eventDigest !== hash || proof?.scopeHash !== this.#receipt.scopeHash ||
          proof?.dispatchId !== this.#receipt.dispatchId)
        return Object.freeze({status:'RECONCILE_REQUIRED',reason:'AGENT_EVENT_NOT_ATTESTED',nextPromptAllowed:false});
      this.#sequence = event.sequence;
      if (TERMINAL.has(event.state)) this.#terminal = true;
      const uncertain = ['OUTCOME_UNKNOWN','WORKER_DISCONNECTED'].includes(event.state);
      if (uncertain) this.#reconcileRequired = true;
      return Object.freeze({status:uncertain?'RECONCILE_REQUIRED':'HOST_OBSERVED',
        reason:uncertain?'AGENT_OUTCOME_UNKNOWN':undefined,state:event.state,
        receipt:this.#receipt,sequence:event.sequence,
        // A verified turn is not an independent QA receipt.
        qa:'NOT_EXECUTED',nextPromptAllowed:false});
    } finally {this.#inFlight = false;}
  }
}
