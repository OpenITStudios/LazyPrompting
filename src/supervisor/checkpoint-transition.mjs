// Pure checkpoint transition contract. No persistence, network, or transport side effects.
const valid = x => typeof x === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(x);
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
        !valid(event.resultId) || !valid(event.taskId) || event.taskId !== current.pendingTaskId ||
        event.resultId === current.lastResultId || event.trustedEvidence !== true)
      return fail("RESULT_NOT_TRUSTED_OR_DUPLICATE");
    return success("RESULT_RECONCILED", {...copy(current),version:current.version+1,phase:"READY",
      lastTaskId:event.taskId,lastResultId:event.resultId,pendingTaskId:null,dispatchReceiptId:null});
  }
  return fail("UNSUPPORTED_TRANSITION");
}
