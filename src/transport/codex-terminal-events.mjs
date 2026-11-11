// Source-scoped, process-local observation of Codex App Server terminal
// notifications. This is NOT a credential, signed host attestation, QA
// receipt, chat transport, or an authorization to dispatch another prompt.
const ID = /^[A-Za-z0-9:_-]{1,128}$/;
const FINAL = new Set(['completed', 'failed', 'interrupted']);
const validId = value => typeof value === 'string' && ID.test(value);
const keyFor = (threadId, turnId) => threadId + '\0' + turnId;

export class CodexTerminalEvents {
  #events = new Map();
  #limit;
  #saturated = false;

  constructor({limit = 128} = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1024)
      throw new Error('INVALID_TERMINAL_EVENT_LIMIT');
    this.#limit = limit;
  }

  // Only pass notifications directly from this process's owned Codex
  // App Server stdout callback. In particular, do not expose observe() as
  // a public MCP capability accepting caller/model/browser messages.
  observe(notification) {
    if (notification?.method !== 'turn/completed') return false;
    const threadId = notification.params?.threadId;
    const turnId = notification.params?.turn?.id;
    const status = notification.params?.turn?.status;
    if (!validId(threadId) || !validId(turnId)) return false;
    const key = keyFor(threadId, turnId);
    const existing = this.#events.get(key);
    if (existing) {
      if (existing.status !== status || !FINAL.has(status)) existing.conflicting = true;
      return false;
    }
    if (this.#events.size >= this.#limit) {
      this.#saturated = true;
      return false;
    }
    // A malformed terminal notification with a valid turn identity must
    // poison that turn, not silently become a query-only completion.
    this.#events.set(key, {status, conflicting: !FINAL.has(status)});
    return FINAL.has(status);
  }

  // A notification can arrive before turn/start's RPC response. A matching
  // query of the same turn is therefore required before a positive claim.
  correlate({threadId, turnId, queriedStatus} = {}) {
    if (!validId(threadId) || !validId(turnId) ||
        !FINAL.has(queriedStatus))
      return {status: 'UNKNOWN', reason: 'INVALID_TURN_QUERY'};
    const event = this.#events.get(keyFor(threadId, turnId));
    if (!event) return this.#saturated
      ? {status: 'CONFLICT', reason: 'TERMINAL_EVENT_CAPACITY_EXCEEDED'}
      : {status: 'NOT_OBSERVED', reason: 'NO_MATCHING_TERMINAL_NOTIFICATION'};
    if (event.conflicting || event.status !== queriedStatus)
      return {status: 'CONFLICT', reason: 'TERMINAL_EVENT_QUERY_MISMATCH'};
    if (event.status !== 'completed')
      return {status: 'NON_SUCCESS', reason: 'TERMINAL_EVENT_NOT_SUCCESSFUL'};
    return {status: 'CORRELATED', reason: 'MATCHING_TERMINAL_NOTIFICATION',
      source: 'CODEX_APP_SERVER_NOTIFICATION', threadId, turnId,
      turnStatus: 'completed', hostAttested: false, qa: 'NOT_EXECUTED',
      nextPromptAllowed: false};
  }
}
