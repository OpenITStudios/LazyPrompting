// Pure decision logic: no browser, network, model calls, or repository mutations.
const decision = (state, reason, action = null, prompt = null) => ({state, reason, action, prompt, modelCalls: 0});
const valid = x => typeof x === "string" && x.trim().length > 0 && x.length <= 1024 && !/[\x00-\x1f\x7f]/.test(x);
const safeList = xs => Array.isArray(xs) && xs.length <= 32 && xs.every(valid);
const sha = x => typeof x === "string" && /^[a-f0-9]{40}$/.test(x);
const bounded = (n, max) => Number.isSafeInteger(n) && n >= 0 && Number.isSafeInteger(max) && max >= 0;
const stop = (state, reason) => decision(state, reason);

export function evaluateContinuation(input) {
  if (!input || typeof input !== "object") return stop("BLOCKED", "INVALID_INPUT");
  const {goal, observation: o, evidence: e, checkpoint: c} = input;
  if (!goal || !c || !valid(goal.id) || !valid(goal.repository) || !valid(goal.branch) ||
      !safeList(goal.allowedActions) || !safeList(goal.preserve) ||
      !bounded(c.iteration, goal.maxIterations) || !bounded(c.elapsedMinutes, goal.maxMinutes) ||
      !bounded(c.modelTokensUsed, goal.maxModelTokens) || !bounded(c.noProgress, 1000000)) return stop("BLOCKED", "INVALID_GOAL_OR_CHECKPOINT");
  if (c.stopRequested || c.approvalRevoked) return stop("STOPPED", "OPERATOR_STOP");
  if (c.pauseRequested) return stop("PAUSED", "OPERATOR_PAUSE");
  if (c.transportApproved !== true) return stop("BLOCKED", "TRANSPORT_NOT_APPROVED");
  if (o && valid(o.resultId) && (o.resultId === c.lastResultId || o.taskId === c.lastDispatchedTaskId && c.lastDispatchedAcknowledged === true)) return stop("WAITING", "DUPLICATE_RESULT");
  if (!o || o.complete !== true || !valid(o.resultId) || !valid(o.taskId)) return stop("WAITING", "INCOMPLETE_OBSERVATION");
  if (!e || e.verified !== true || e.repository !== goal.repository || e.branch !== goal.branch ||
      !sha(e.headSha) || o.headSha !== e.headSha) return stop("BLOCKED", "UNVERIFIED_OR_STALE_EVIDENCE");
  if (c.iteration >= goal.maxIterations || c.elapsedMinutes >= goal.maxMinutes || c.modelTokensUsed >= goal.maxModelTokens) return stop("STOPPED", "BUDGET_EXHAUSTED");
  if (o.requiresApproval === true) return stop("PAUSED", "APPROVAL_REQUIRED");
  if (o.blocked === true) return stop("BLOCKED", "WORKER_BLOCKED");
  if (e.qa === "FAIL" && valid(e.failure)) return emit("FIX_FAILURE", "Diagnose and repair verified QA failure", "FAILED_QA", input, "verified failing owner", "reproduce exact failure and rerun targeted QA");
  if (e.changed === true && e.qa !== "PASS") return emit("VERIFY", "Verify changed source with actual executable evidence", "MISSING_QA_PROOF", input);
  if (o.outcome === "DONE" && e.acceptancePassed === true) return stop("DONE", "ACCEPTANCE_VERIFIED");
  if (o.outcome === "DONE") return emit("VERIFY", "Verify goal acceptance against exact evidence", "ACCEPTANCE_UNVERIFIED", input);
  if (c.noProgress >= 3) return stop("STOPPED", "STAGNATION");
  if (!o.nextAction || !valid(o.nextAction.action) || !valid(o.nextAction.owner) ||
      !valid(o.nextAction.proof)) return stop("BLOCKED", "AMBIGUOUS_NEXT_ACTION");
  if (!goal.allowedActions.includes(o.nextAction.action)) return stop("BLOCKED", "OUT_OF_SCOPE_ACTION");
  if (o.nextAction.requiresApproval === true) return stop("PAUSED", "ACTION_REQUIRES_APPROVAL");
  return emit("CONTINUE", o.nextAction.action, "AUTHORIZED_NEXT_ACTION", input, o.nextAction.owner, o.nextAction.proof);
}
function emit(state, action, reason, input, owner = "verified affected owner", proof = "exact source and test evidence") {
  const {goal, evidence: e} = input;
  const text = [
    "Goal: " + goal.id + ". Repository: " + goal.repository + ", branch: " + goal.branch + ".",
    "Verified HEAD: " + e.headSha + ". Decision: " + state + ".",
    "Next: " + action + ". Owner: " + owner + ".",
    "Preserve: " + (goal.preserve.length ? goal.preserve.join("; ") : "approved goal and permissions") + ".",
    "Required proof: " + proof + ".",
    "Stop on missing authority, contradictory evidence, or exhausted budget."
  ].join("\n");
  return decision("READY", reason, state, text);
}
