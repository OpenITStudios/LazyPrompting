// Source-only ChatGPT-hosted plugin contract. Inputs are untrusted model/UI data.
// Never infer native scope, ChatGPT account identity or permission from them.
const HEX = /^[a-f0-9]{48}$/;
const IDENT = /^[A-Za-z0-9:_-]{1,128}$/;
// Reject Unicode newline separators in model-visible single-line fields.
const INLINE_TEXT = /^[^\u0000-\u001f\u007f\u0085\u2028\u2029]+$/;
// Prompts may contain multi-line content and tabs, but never other controls.
const PROMPT_TEXT = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/;
const EVIDENCE_KINDS = new Set(["COMMIT", "QA_RECEIPT", "ARTIFACT", "DOCUMENT"]);
const REPORT_OUTCOMES = new Set(["CONTINUE", "DONE_PROPOSED", "BLOCKED", "NEEDS_REVIEW"]);
const DELIVERY_OUTCOMES = new Set(["accepted", "rejected", "uncertain"]);
// Exact Codex V1 states projected by the existing native goal owner.
// Source states are not ChatGPT final-turn or independent QA evidence.
const CODEX_STATES = new Set([
  "AWAITING_SCOPE_REVIEW","REVIEW_INTERRUPTED","SCOPE_REVIEWED",
  "STARTING","RUNNING","PAUSE_REQUESTED","PAUSED","NEEDS_ATTENTION",
  "REVIEW_COMPLETE","CODING_COMPLETE","STOPPED","DECLINED",
  "RECONCILE_REQUIRED",
]);
const STATUS_SOURCE = "NATIVE_CHAT_GOAL_READ_ONLY_STATUS";
const STATUS_KEYS = [
  "source","schemaVersion","workspaceId","goalDigest",
  "conversationDigest","epoch","codexState","qa","chatTurnVerified",
  "nextPromptAllowed","codexDispatchAuthorized","sent",
];
const TOOL_KEYS = Object.freeze({
  "goal.status": [],
  "goal.bind": ["code"],
  "goal.report": ["receipt", "outcome", "summary", "evidenceRefs"],
  "turn.claim": ["claim"],
  "turn.delivery": ["delivery", "outcome"],
});
const ALLOWED_HOST_STATES = Object.freeze({
  "goal.bind": ["BOUND", "NEXT_TURN_READY", "REVIEW_REQUIRED", "STOPPED", "RECONCILE_REQUIRED"],
  "goal.report": ["NEXT_TURN_READY", "REVIEW_REQUIRED", "STOPPED", "RECONCILE_REQUIRED"],
  "turn.claim": ["CLAIMED", "REVIEW_REQUIRED", "STOPPED", "RECONCILE_REQUIRED"],
  "turn.delivery": ["DELIVERY_RECORDED", "REVIEW_REQUIRED", "STOPPED", "RECONCILE_REQUIRED"],
});
// RegExp.test() coerces arrays/objects and "$" may match before a
// trailing line terminator. Require an exact primitive string match.
const exactString = (pattern, value) =>
  typeof value === "string" && pattern.exec(value)?.[0] === value;
const validOpaque = value => typeof value === "string" &&
  value.length === 48 && HEX.test(value);
const validIdentity = value => exactString(IDENT, value);
const plain = value => value !== null && typeof value === "object" &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (obj, keys) => plain(obj) &&
  Object.keys(obj).sort().join(",") === [...keys].sort().join(",");
// One backwards-compatible optional next step for the existing tool.
// This cannot grant workspace selection, repository access or execution.
const reportShape = input => exact(input, TOOL_KEYS["goal.report"]) ||
  exact(input, [...TOOL_KEYS["goal.report"], "nextAction"]);
const validText = (value, max = 600) =>
  typeof value === "string" && value.trim() !== "" &&
  value.length <= max && exactString(INLINE_TEXT, value);
const validPrompt = value => typeof value === "string" && value.trim() !== "" &&
  value.length <= 12000 && exactString(PROMPT_TEXT, value);
const validRefs = refs => Array.isArray(refs) && refs.length <= 8 &&
  refs.every(item => exact(item, ["kind", "ref"]) &&
    EVIDENCE_KINDS.has(item.kind) && validText(item.ref, 200));

export const CHAT_GOAL_TOOLS = Object.freeze(Object.keys(TOOL_KEYS));

export function parseChatGoalInput(tool, input) {
  if (!Object.hasOwn(TOOL_KEYS, tool) ||
    !(tool === "goal.report" ? reportShape(input) : exact(input, TOOL_KEYS[tool])))
    return null;
  switch (tool) {
    case "goal.status":
      return {};
    case "goal.bind":
      return validOpaque(input.code) ? {code: input.code} : null;
    case "goal.report": {
      const hasNext = Object.hasOwn(input, "nextAction");
      return validOpaque(input.receipt) && REPORT_OUTCOMES.has(input.outcome) &&
        validText(input.summary) && validRefs(input.evidenceRefs) &&
        (!hasNext || (input.outcome === "CONTINUE" && validText(input.nextAction, 200)))
        ? {receipt: input.receipt, outcome: input.outcome, summary: input.summary,
            evidenceRefs: input.evidenceRefs.map(ref => ({kind: ref.kind, ref: ref.ref})),
            ...(hasNext ? {nextAction: input.nextAction} : {})}
        : null;
    }
    case "turn.claim":
      return validOpaque(input.claim) ? {claim: input.claim} : null;
    case "turn.delivery":
      return validOpaque(input.delivery) && DELIVERY_OUTCOMES.has(input.outcome)
        ? {delivery: input.delivery, outcome: input.outcome} : null;
    default:
      return null;
  }
}

// The authenticated native host, not this adapter, creates and atomically
// consumes claims, verifies receipts, authorizes next turns and owns STOP.
export function parseHostChatGoalReceipt(tool, value) {
  if (!Object.hasOwn(ALLOWED_HOST_STATES, tool) || !plain(value) ||
    !ALLOWED_HOST_STATES[tool].includes(value.state) ||
    Object.keys(value).some(key => !["state", "nextClaim", "prompt", "delivery"].includes(key)))
    return null;
  if (value.state === "NEXT_TURN_READY") {
    return Object.keys(value).length === 2 && validOpaque(value.nextClaim)
      ? {state: value.state, nextClaim: value.nextClaim} : null;
  }
  if (value.state === "CLAIMED") {
    return Object.keys(value).length === 3 && validPrompt(value.prompt) &&
      validOpaque(value.delivery)
      ? {state: value.state, prompt: value.prompt, delivery: value.delivery} : null;
  }
  return Object.keys(value).length === 1 ? {state: value.state} : null;
}

// Only a trusted host may return this status, after checking the existing
// native goal, workspace lease and STOP. The model selects no target.
export function parseHostChatGoalStatus(value, admission) {
  if (!exact(value, STATUS_KEYS) ||
    value.source !== STATUS_SOURCE || value.schemaVersion !== 1 ||
    !admission || admission.chatBound !== true ||
    typeof admission.stopped !== "boolean" ||
    typeof value.workspaceId !== "string" ||
    value.workspaceId !== admission.workspaceId ||
    value.goalDigest !== admission.goalDigest ||
    value.conversationDigest !== admission.conversationDigest ||
    !Number.isSafeInteger(value.epoch) || value.epoch < 1 ||
    value.epoch !== admission.epoch ||
    !CODEX_STATES.has(value.codexState) ||
    value.qa !== "NOT_VERIFIED" ||
    value.chatTurnVerified !== false ||
    value.nextPromptAllowed !== false ||
    value.codexDispatchAuthorized !== false ||
    value.sent !== false)
    return null;
  const state = value.codexState;
  // Native STOP takes precedence even if Codex still reports RUNNING.
  const stopped = admission.stopped || state === "STOPPED" || state === "DECLINED";
  const reconcile = state === "RECONCILE_REQUIRED";
  const blocker = stopped ? "NATIVE_STOP"
    : reconcile ? "RECOVERY_REQUIRED"
    : ["RUNNING","STARTING"].includes(state) ? "WORK_IN_PROGRESS"
    : ["REVIEW_COMPLETE","CODING_COMPLETE"].includes(state) ? "QA_NOT_VERIFIED"
    : "NATIVE_REVIEW_REQUIRED";
  // Do not return goal/chat digests, principal tags, receipts, or worker text.
  return Object.freeze({
    source: STATUS_SOURCE,
    schemaVersion: 1,
    workspaceId: value.workspaceId,
    status: stopped ? "STOPPED" : reconcile ? "RECONCILE_REQUIRED" : "REVIEW_REQUIRED",
    codexState: state,
    blocker,
    qa: "NOT_VERIFIED",
    operatorReviewRequired: true,
    chatTurnVerified: false,
    codexDispatchAuthorized: false,
    nextPromptAllowed: false,
    sent: false,
  });
}

export function parseTrustedChatGoalPrincipal(value) {
  if (!plain(value) || !validIdentity(value.subjectId) ||
    !validIdentity(value.connectionId) ||
    (value.chatSessionHint !== undefined && value.chatSessionHint !== null &&
      !validIdentity(value.chatSessionHint))) return null;
  // The session hint is only a correlation aid, never ChatGPT URL/account proof.
  return Object.freeze({
    subjectId: value.subjectId,
    connectionId: value.connectionId,
    chatSessionHint: value.chatSessionHint ?? null,
  });
}
