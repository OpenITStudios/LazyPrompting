// Pure checkpoint transition contract. No persistence, network, or transport side effects.
const valid = x => typeof x === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(x);
const SHA = x => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x);
const DIGEST = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const fail = reason => ({ok:false,reason,checkpoint:null});
const success = (reason, checkpoint) => ({ok:true,reason,checkpoint});
const copy = c => ({...c});

export function transitionCheckpoint(current, event) {
  if (!current || !event || !valid(current.goalId) || !valid(event.goalId) ||
      event.goalId !== current.goalId || !valid(current.goalHash) ||
      !Number.isSafeInteger(current.version) || current.version < 0 ||
      !Number.isSafeInteger(event.expectedVersion) || event.expectedVersion !== current.version) {
    return fail("INVALID_OR_STALE_CHECKPOINT");
  }
  if (!["READY","DISPATCH_PENDING","WAITING","RECONCILE_REQUIRED","PAUSED","STOPPED","DONE"].includes(current.phase))
    return fail("INVALID_PHASE");
  if (current.phase === "STOPPED" || current.phase === "DONE") return fail("TERMINAL_STATE");
  if (event.type === "STOP") return success("STOPPED", {...copy(current),version:current.version+1,phase:"STOPPED"});
  if (event.type === "PAUSE") return success("PAUSED", {...copy(current),version:current.version+1,phase:"PAUSED"});
  if (current.phase === "PAUSED") {
    if (event.type !== "RESUME" || event.trustedAuthorization !== true) return fail("PAUSED_REQUIRES_TRUSTED_RESUME");
    return success("RESUMED", {...copy(current),version:current.version+1,phase:current.pendingTaskId?"RECONCILE_REQUIRED":"READY"});
  }
  // A PREPARE is the durable intent. It holds the checkpoint in a non-
  // dispatchable state while registry/outbox updates are reconciled.
  if (event.type === 'REVIEW_PREPARE') {
    const r=event.review;
    if (current.phase!=='WAITING'||event.trustedEvidence!==true||
        !r||!DIGEST(r.reviewId)||!SHA(r.baseSha)||!SHA(r.headSha)||
        !valid(r.goalId)||r.goalId!==current.goalId||
        !valid(r.workspaceId)||!valid(r.sessionId)||!valid(r.taskId)||
        !valid(r.promptId)||!valid(r.responseHandle)||!valid(r.responseId)||
        !Number.isSafeInteger(r.contextRevision)||r.contextRevision<0||
        !Number.isSafeInteger(r.checkpointVersion)||r.checkpointVersion!==current.version||
        r.taskId!==current.pendingTaskId||event.taskId!==r.taskId||
        r.baseSha!==current.headSha||
        (current.workspaceId!==undefined&&current.workspaceId!==r.workspaceId)||
        (current.sessionId!==undefined&&current.sessionId!==r.sessionId)||
        !['READY','DONE'].includes(r.targetPhase)||
        !['PASS','FAIL','NOT_EXECUTED'].includes(r.qa)||
        (r.targetPhase==='DONE'&&(r.qa!=='PASS'||r.acceptancePassed!==true))||
        current.lastResultId===r.responseId)
      return fail('REVIEW_PREPARE_REJECTED');
    return success('REVIEW_PREPARED',{
      ...copy(current),version:current.version+1,phase:'RECONCILE_REQUIRED',review:structuredClone(r)
    });
  }
  if (event.type === 'REVIEW_COMMIT') {
    const r=current.review;
    if (current.phase!=='RECONCILE_REQUIRED'||!r||
        event.trustedEvidence!==true||event.reviewId!==r.reviewId||
        event.responseId!==r.responseId||r.taskId!==current.pendingTaskId||
        !SHA(r.headSha)||!['READY','DONE'].includes(r.targetPhase))
      return fail('REVIEW_COMMIT_REJECTED');
    return success('REVIEW_COMMITTED',{
      ...copy(current),version:current.version+1,phase:r.targetPhase,
      headSha:r.headSha,lastTaskId:r.taskId,lastResultId:r.responseId,
      lastReview:{reviewId:r.reviewId,goalId:r.goalId,workspaceId:r.workspaceId,
        sessionId:r.sessionId,promptId:r.promptId,responseId:r.responseId,headSha:r.headSha,
        qa:r.qa,acceptancePassed:r.acceptancePassed},
      pendingTaskId:null,dispatchReceiptId:null,review:null
    });
  }
  if (event.type === "RESERVE") {
    if (current.phase !== "READY" || current.pendingTaskId) return fail("TASK_ALREADY_RESERVED");
    if (!valid(event.taskId) || event.taskId === current.lastTaskId) return fail("INVALID_OR_REPLAYED_TASK");
    return success("TASK_RESERVED", {...copy(current),version:current.version+1,phase:"DISPATCH_PENDING",pendingTaskId:event.taskId});
  }
  if (event.type === "DISPATCH_ACK") {
    if (current.phase !== "DISPATCH_PENDING" || event.taskId !== current.pendingTaskId || !valid(event.receiptId))
      return fail("INVALID_DISPATCH_ACK");
    return success("WAITING_FOR_RESULT", {...copy(current),version:current.version+1,phase:"WAITING",dispatchReceiptId:event.receiptId});
  }
  if (event.type === "DISPATCH_UNCERTAIN") {
    if (current.phase !== "DISPATCH_PENDING" || event.taskId !== current.pendingTaskId) return fail("INVALID_UNCERTAIN_DISPATCH");
    return success("RECONCILE_BEFORE_RETRY", {...copy(current),version:current.version+1,phase:"RECONCILE_REQUIRED"});
  }
  if (event.type === "RESULT") {
    if (!["WAITING","RECONCILE_REQUIRED"].includes(current.phase) ||
        current.review||!valid(event.resultId) || !valid(event.taskId) || event.taskId !== current.pendingTaskId ||
        event.resultId === current.lastResultId || event.trustedEvidence !== true)
      return fail("RESULT_NOT_TRUSTED_OR_DUPLICATE");
    return success("RESULT_RECONCILED", {...copy(current),version:current.version+1,phase:"READY",
      lastTaskId:event.taskId,lastResultId:event.resultId,pendingTaskId:null,dispatchReceiptId:null});
  }
  return fail("UNSUPPORTED_TRANSITION");
}
