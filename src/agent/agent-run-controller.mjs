import {createHash} from 'node:crypto';
import {AgentBackendRegistry} from './agent-backend-registry.mjs';
import {fingerprintAgentProfile} from './agent-contract.mjs';
import {normalizeAgentTurnReceipt} from './agent-events.mjs';
import {fingerprintAgentGoalScopeV2} from './goal-scope-v2.mjs';

// An opt-in v2 composition seam: no MCP tool, native consent, or model dispatch
// is activated by this module. The native host must inject all callbacks.
// The pre-existing PromptOutbox is the ONLY durable owner of reservations and
// provider receipts; it is deliberately not replaced or forked.
const ID = /^[A-Za-z0-9:_-]{1,128}$/;
const SHA = /^[a-f0-9]{64}$/;
const valid = x => typeof x === 'string' && ID.test(x);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hold = reason => Object.freeze({status:'RECONCILE_REQUIRED',reason,qa:'NOT_EXECUTED',nextPromptAllowed:false});
const fail = reason => Object.freeze({status:'BLOCKED',reason,qa:'NOT_EXECUTED',nextPromptAllowed:false});
const safe = result => Object.freeze({...result,qa:'NOT_EXECUTED',nextPromptAllowed:false});

export class AgentRunControllerV2 {
  #registry;
  #host;
  #outboxFor;
  constructor({registry,host,outboxFor}={}) {
    if (!(registry instanceof AgentBackendRegistry) ||
        !host || ['verifyApprovedScope','verifySession','attestTurnReceipt',
          'attestObservation','authorizeCancel','assertDispatchAllowed',
          'reconcileReservedDispatch'].some(name =>
          typeof host[name] !== 'function') || typeof outboxFor !== 'function')
      throw Error('TRUSTED_AGENT_RUN_HOST_REQUIRED');
    this.#registry = registry;
    this.#host = host;
    this.#outboxFor = outboxFor;
  }
  async #resolve(input) {
    if (![input?.goalId,input?.workspaceId,input?.taskId].every(valid))
      throw Error('INVALID_AGENT_RUN_IDENTITY');
    const scope = input.scope;
    const scopeHash = fingerprintAgentGoalScopeV2(scope);
    // Source-only stage: no alternate worker gets WRITE until independently
    // enforced native OS sandbox and host QA gates exist.
    if (scope.coding !== null) throw Error('AGENT_V2_WRITE_DISABLED');
    const profileId = scope.workerProfile.profileId;
    const resolved = this.#registry.resolve(profileId,'readOnlyIsolation');
    if (fingerprintAgentProfile(resolved.profile) !== fingerprintAgentProfile(scope.workerProfile))
      throw Error('AGENT_PROFILE_SCOPE_CHANGED');
    for (const capability of ['openSession','submitTurn','observeTurn'])
      this.#registry.resolve(profileId,capability);
    const context = {goalId:input.goalId,workspaceId:input.workspaceId,
      taskId:input.taskId,scopeHash,profileId,adapterId:resolved.profile.adapterId,
      sourceSha:scope.baseSha};
    const approval = await this.#host.verifyApprovedScope({context,scope});
    if (approval?.source !== 'TRUSTED_HOST' || approval?.approved !== true ||
        Object.keys(context).some(key=>approval[key] !== context[key]))
      throw Error('AGENT_SCOPE_NOT_APPROVED');
    // The caller cannot probe or start a worker before the native host has
    // attested the exact immutable goal/profile binding.
    const readiness = await resolved.backend.probe(scopeHash);
    if (readiness?.ready !== true)
      throw Error('AGENT_BACKEND_UNAVAILABLE');
    const outbox = await this.#outboxFor(context);
    if (!outbox || ['read','reserve','transaction','reconcile'].some(k=>
      typeof outbox[k] !== 'function'))
      throw Error('TRUSTED_AGENT_OUTBOX_REQUIRED');
    return {context,scope,backend:resolved.backend,outbox};
  }
  async #sessionBound(state,sessionId) {
    if (!valid(sessionId)) throw Error('AGENT_SESSION_NOT_CONFIRMED');
    const proof = await this.#host.verifySession({context:state.context,sessionId});
    if (proof?.source !== 'TRUSTED_HOST' || proof?.verified !== true ||
        proof?.sessionId !== sessionId || proof?.scopeHash !== state.context.scopeHash ||
        proof?.profileId !== state.context.profileId || !valid(proof.hostGeneration))
      throw Error('AGENT_SESSION_NOT_ATTESTED');
    return proof.hostGeneration;
  }
  async #restoreSession(state,receipt) {
    this.#registry.resolve(state.context.profileId,'resumeSession');
    const resumed=await state.backend.resumeSession({
      sessionId:receipt.sessionId,scopeHash:receipt.scopeHash,
      readOnly:true,cwd:state.scope.cwd});
    if(resumed?.sessionId!==receipt.sessionId)
      throw Error('AGENT_SESSION_RECONCILE_REQUIRED');
    await this.#sessionBound(state,receipt.sessionId);
  }
  async start(input) {
    const state = await this.#resolve(input);
    const prompt = input.prompt;
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000)
      throw Error('INVALID_AGENT_PROMPT');
    // This is an early optimization, not the authoritative capacity gate.
    // The atomic PromptOutbox.reserve below still decides whether dispatch
    // is allowed if another agent races this read.
    const prior = await state.outbox.read();
    if (prior.items.some(item=>item.workspaceId===state.context.workspaceId &&
      item.taskId===state.context.taskId))
      return hold('AGENT_DISPATCH_ALREADY_RESERVED');
    await this.#host.assertDispatchAllowed({context:state.context,scope:state.scope});
    const opened = await state.backend.openSession({cwd:state.scope.cwd,
      goalId:state.context.goalId,taskId:state.context.taskId,readOnly:true,
      scopeHash:state.context.scopeHash});
    const sessionId = opened?.sessionId;
    const hostGeneration = await this.#sessionBound(state,sessionId);
    const reserve = await state.outbox.reserve({
      workspaceId:state.context.workspaceId,sessionId,taskId:state.context.taskId,
      contextRevision:0,prompt,promptLimit:Math.min(2,state.scope.limits.maxTurnsPerTask),
      singleDispatchPerTask:true,maxConcurrent:2
    });
    if (!reserve.reserved) return hold(reserve.reason ?? 'AGENT_DISPATCH_ALREADY_RESERVED');
    const dispatchId = reserve.promptId;
    // The reservation is durable BEFORE calling the worker. Any exception or
    // lost response after this point is ambiguous. Never retry submitTurn.
    try {
      await this.#host.assertDispatchAllowed({context:state.context,scope:state.scope,
        dispatchId});
      const provider = await state.backend.submitTurn({sessionId,dispatchId,
        prompt,scopeHash:state.context.scopeHash,goalId:state.context.goalId,
        taskId:state.context.taskId,readOnly:true});
      const raw = {receiptVersion:1,...state.context,dispatchId,sessionId,
        turnId:provider?.turnId,hostGeneration};
      // workspaceId isn't a receipt field; only approved receipt keys pass.
      const {workspaceId:_ignored,...receiptInput} = raw;
      const receipt = normalizeAgentTurnReceipt(receiptInput,receiptInput);
      const proof = await this.#host.attestTurnReceipt({context:state.context,receipt,
        receiptDigest:digest(receipt)});
      if (proof?.source !== 'TRUSTED_HOST' || proof?.verified !== true ||
          proof?.receiptDigest !== digest(receipt) ||
          proof?.dispatchId !== receipt.dispatchId ||
          proof?.scopeHash !== receipt.scopeHash)
        return hold('AGENT_DISPATCH_RECEIPT_UNVERIFIED');
      await state.outbox.transaction(data=>{
        const item = data.items.find(x=>x.workspaceId===state.context.workspaceId &&
          x.promptId===dispatchId);
        if (!item || item.state !== 'RESERVED' || item.sessionId !== sessionId ||
            item.taskId !== state.context.taskId)
          throw Error('AGENT_OUTBOX_RESERVATION_CHANGED');
        item.state='ACKNOWLEDGED';
        item.responseHandle=receipt.turnId;
        item.agentReceipt=receipt;
      });
      return safe({status:'ACKNOWLEDGED',receipt});
    } catch {
      return hold('AGENT_DISPATCH_OUTCOME_UNKNOWN');
    }
  }
  // Operator/native-host recovery for an ambiguously delivered v2 turn.
  // This NEVER calls submitTurn. The authoritative outbox reservation and
  // exact original promptHash must be matched before it can be acknowledged.
  async reconcileReserved(input) {
    const state=await this.#resolve(input);
    const {items}=await state.outbox.read();
    const matches=items.filter(item=>item.workspaceId===state.context.workspaceId &&
      item.taskId===state.context.taskId);
    if(matches.length!==1)return hold('AGENT_RESERVED_DISPATCH_NOT_UNIQUE');
    const item=matches[0];
    if(item.state!=='RESERVED'||!valid(item.sessionId)||
       !valid(item.promptId)||!SHA.test(item.promptHash??''))
      return hold('AGENT_RESERVED_DISPATCH_NOT_RECOVERABLE');
    let proof;
    try {proof=await this.#host.reconcileReservedDispatch({
      context:state.context,dispatchId:item.promptId,
      sessionId:item.sessionId,promptHash:item.promptHash});}
    catch {return hold('AGENT_RESERVED_DISPATCH_UNVERIFIED');}
    if(proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
       proof?.dispatchId!==item.promptId||proof?.sessionId!==item.sessionId||
       proof?.promptHash!==item.promptHash||
       proof?.scopeHash!==state.context.scopeHash||
       proof?.profileId!==state.context.profileId||
       !valid(proof.turnId)||!valid(proof.hostGeneration))
      return hold('AGENT_RESERVED_DISPATCH_UNVERIFIED');
    let receipt;
    try{receipt=normalizeAgentTurnReceipt({receiptVersion:1,
      goalId:state.context.goalId,taskId:state.context.taskId,
      dispatchId:item.promptId,profileId:state.context.profileId,
      adapterId:state.context.adapterId,sessionId:item.sessionId,
      turnId:proof.turnId,hostGeneration:proof.hostGeneration,
      scopeHash:state.context.scopeHash,sourceSha:state.context.sourceSha},
      {goalId:state.context.goalId,taskId:state.context.taskId,
       dispatchId:item.promptId,profileId:state.context.profileId,
       adapterId:state.context.adapterId,scopeHash:state.context.scopeHash,
       sourceSha:state.context.sourceSha,hostGeneration:proof.hostGeneration});}
    catch{return hold('AGENT_RESERVED_DISPATCH_UNVERIFIED');}
    const receiptDigest=digest(receipt);
    let attested;
    try{attested=await this.#host.attestTurnReceipt({context:state.context,
      receipt,receiptDigest});}
    catch{return hold('AGENT_RESERVED_RECEIPT_NOT_ATTESTED');}
    if(attested?.source!=='TRUSTED_HOST'||attested?.verified!==true||
       attested?.receiptDigest!==receiptDigest||
       attested?.scopeHash!==receipt.scopeHash||
       attested?.dispatchId!==receipt.dispatchId)
      return hold('AGENT_RESERVED_RECEIPT_NOT_ATTESTED');
    try{await state.outbox.transaction(data=>{
      const stored=data.items.find(value=>value.workspaceId===state.context.workspaceId&&
        value.taskId===state.context.taskId&&value.promptId===item.promptId);
      if(!stored||stored.state!=='RESERVED'||
         stored.sessionId!==item.sessionId||stored.promptHash!==item.promptHash)
        throw Error('AGENT_OUTBOX_RECOVERY_CONFLICT');
      stored.state='ACKNOWLEDGED';
      stored.responseHandle=receipt.turnId;
      stored.agentReceipt=receipt;
    });}
    catch{return hold('AGENT_RESERVED_OUTBOX_CONFLICT');}
    return safe({status:'ACKNOWLEDGED',receipt,recovered:true});
  }
  async #pending(input) {
    const state = await this.#resolve(input);
    const read = await state.outbox.read();
    const matches = read.items.filter(x => x.workspaceId===state.context.workspaceId &&
      x.taskId===state.context.taskId);
    if (matches.length !== 1) return {state,hold:hold('AGENT_OUTBOX_PENDING_NOT_UNIQUE')};
    const item=matches[0];
    if (!['ACKNOWLEDGED','RESPONSE_VERIFIED'].includes(item.state) ||
        !item.agentReceipt)
      return {state,hold:hold('AGENT_UNACKNOWLEDGED_SEND')};
    const expected = {...state.context,dispatchId:item.promptId,
      sessionId:item.sessionId,turnId:item.responseHandle,
      hostGeneration:item.agentReceipt.hostGeneration};
    const {workspaceId:_ignored,...validExpected}=expected;
    let receipt;
    try{receipt=normalizeAgentTurnReceipt(item.agentReceipt,validExpected);}
    catch{return {state,hold:hold('AGENT_STORED_RECEIPT_CONFLICT')};}
    const proof=await this.#host.attestTurnReceipt({context:state.context,
      receipt,receiptDigest:digest(receipt)});
    if (proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
        proof?.receiptDigest!==digest(receipt)||proof?.dispatchId!==receipt.dispatchId||
        proof?.scopeHash!==receipt.scopeHash)
      return {state,hold:hold('AGENT_STORED_RECEIPT_UNVERIFIED')};
    return {state,item,receipt};
  }
  async observe(input) {
    const {state,item,receipt,hold:pendingHold} = await this.#pending(input);
    if (pendingHold) return pendingHold;
    // Previously reconciled results are idempotently readable from the
    // canonical PromptOutbox. They are re-attested, never re-dispatched.
    if (item.state==='RESPONSE_VERIFIED') {
      if (item.responseId!==receipt.turnId || !valid(item.agentResultRef))
        return hold('AGENT_STORED_RESULT_CONFLICT');
      const observation={state:'COMPLETED',receipt,resultRef:item.agentResultRef};
      const proof=await this.#host.attestObservation({context:state.context,
        observation,observationDigest:digest(observation)});
      if (proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
          proof?.observationDigest!==digest(observation)||
          proof?.scopeHash!==receipt.scopeHash||proof?.dispatchId!==receipt.dispatchId)
        return hold('AGENT_STORED_RESULT_UNVERIFIED');
      return safe({status:'RESULT_ATTESTED',receipt,resultRef:item.agentResultRef});
    }
    // A new controller process never inherits the old provider session.
    // Resume only the *recorded* session and scope through an attested host;
    // this does not submit another prompt or reset the existing outbox.
    try { await this.#restoreSession(state,receipt); }
    catch {return hold('AGENT_SESSION_RECONCILE_REQUIRED');}
    let raw;
    try { raw=await state.backend.observeTurn(receipt); }
    catch {return hold('AGENT_TURN_OBSERVATION_UNAVAILABLE');}
    const status=raw?.state;
    if (!['RUNNING','COMPLETED','CANCELLED','FAILED','UNKNOWN'].includes(status) ||
        !raw?.receipt || Object.keys(receipt).some(key=>raw.receipt[key]!==receipt[key]))
      return hold('AGENT_TURN_OBSERVATION_INVALID');
    if (status==='COMPLETED' && (!valid(raw.resultRef)||raw.resultRef.length>128))
      return hold('AGENT_TERMINAL_RESULT_UNVERIFIED');
    const observation = {state:status,receipt, ...(status==='COMPLETED'?{resultRef:raw.resultRef}:{})};
    const proof=await this.#host.attestObservation({context:state.context,
      observation,observationDigest:digest(observation)});
    if (proof?.source!=='TRUSTED_HOST' || proof?.verified!==true ||
        proof?.observationDigest!==digest(observation) ||
        proof?.scopeHash!==receipt.scopeHash || proof?.dispatchId!==receipt.dispatchId)
      return hold('AGENT_TURN_NOT_ATTESTED');
    if (status==='UNKNOWN'||status==='FAILED')
      return hold(status==='UNKNOWN'?'AGENT_TURN_OUTCOME_UNKNOWN':'AGENT_TURN_FAILED');
    if (status==='CANCELLED') return safe({status:'STOPPED',receipt});
    if (status==='RUNNING') return safe({status:'WAITING',receipt});
    // `RESPONSE_VERIFIED` means one host-attested provider result exists, NOT
    // successful QA or acceptance. The independent QA owner is a later gate.
    // Atomically publish the exact verified provider result in the existing
    // outbox, not an independent v2 state store or two separate writes.
    try {await state.outbox.transaction(data=>{
      const stored=data.items.find(x=>x.workspaceId===state.context.workspaceId &&
        x.promptId===item.promptId);
      if (!stored || stored.state!=='ACKNOWLEDGED' ||
          stored.responseHandle!==receipt.turnId ||
          stored.agentReceipt?.scopeHash!==receipt.scopeHash)
        throw Error('AGENT_RESPONSE_STATE_CONFLICT');
      stored.state='RESPONSE_VERIFIED';
      stored.responseId=receipt.turnId;
      stored.agentResultRef=raw.resultRef;
    });}
    catch{return hold('AGENT_RESPONSE_RECONCILE_FAILED');}
    return safe({status:'RESULT_ATTESTED',receipt,resultRef:raw.resultRef});
  }
  async cancel(input) {
    const {state,receipt,hold:pendingHold}=await this.#pending(input);
    if (pendingHold) return pendingHold;
    if (state===undefined || !receipt) return hold('AGENT_UNACKNOWLEDGED_SEND');
    try {this.#registry.resolve(state.context.profileId,'cancelTurn');}
    catch{return hold('AGENT_CANCEL_UNSUPPORTED');}
    const authorization=await this.#host.authorizeCancel({context:state.context,receipt});
    if (authorization?.source!=='TRUSTED_HOST' || authorization?.approved!==true ||
        authorization?.scopeHash!==receipt.scopeHash ||
        authorization?.dispatchId!==receipt.dispatchId)
      return fail('AGENT_CANCEL_NOT_AUTHORIZED');
    try { await this.#restoreSession(state,receipt); }
    catch {return hold('AGENT_SESSION_RECONCILE_REQUIRED');}
    let result;
    try {result=await state.backend.cancelTurn(receipt);}
    catch{return hold('AGENT_CANCEL_OUTCOME_UNKNOWN');}
    return result==='CONFIRMED'?safe({status:'STOP_REQUESTED',receipt}):
      hold('AGENT_CANCEL_OUTCOME_UNKNOWN');
  }
}
