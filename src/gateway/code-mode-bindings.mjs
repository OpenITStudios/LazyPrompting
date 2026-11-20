// Schema-exact, detached host snapshots for confined Code Mode.
// This module validates data only. Identity, leases, STOP and effect authority
// remain owned by the existing native/gateway hosts and canonical outboxes.
export const MAX_TOOL_RESULT = 16000;

const NATIVE_GOAL_RUN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/i;
const NATIVE_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const GOAL_STATES = new Set([
 "AWAITING_SCOPE_REVIEW","REVIEW_INTERRUPTED","SCOPE_REVIEWED","STARTING",
 "RUNNING","PAUSE_REQUESTED","PAUSED","NEEDS_ATTENTION","REVIEW_COMPLETE",
 "CODING_COMPLETE","STOPPED","DECLINED","RECONCILE_REQUIRED"
]);
const TASK_STATES = new Set([
 "QUEUED","RUNNING","REVIEWED","VERIFIED","BLOCKED","STOPPED","PAUSED",
 "RECONCILE_REQUIRED","UNKNOWN"
]);
const CHECK_STATES = new Set(["NOT_RECORDED","RECORDED_PASS","RECORDED_FAIL"]);
const AGENT_STATES=new Set([
 "STOPPED","DECLINED","AWAITING_OPERATOR","APPROVED_SOURCE_ONLY","RECONCILE_REQUIRED"
]);
const AGENT_REVIEWS=new Set([
 "STOPPED","NOT_REQUESTED","PENDING","DECLINED","REVIEWED_NO_EXECUTION","RECONCILE_REQUIRED"
]);
const RECEIPT_OBSERVATIONS=new Set([
 "LEGACY_RECORD_ONLY","TURN_STATUS_QUERY_ONLY","EVENT_AND_QUERY_CORRELATED"
]);
const TURN_ID=/^[A-Za-z0-9_:-]{1,128}$/;
const WORKSPACE = /^workspace-(0[1-9]|10)$/;
const SUPPORT_TAB = /^tab-0[1-3]$/;
export function validateNativeCodeModeBrowser(value) {
 if (!exactKeys(value,["source","workspaceId","tabId","origin",
      "chatContentRead","nextPromptAllowed"]) ||
     value.source !== "NATIVE_SUPPORT_TAB_ORIGIN" ||
     !WORKSPACE.test(value.workspaceId??"") ||
     !SUPPORT_TAB.test(value.tabId??"") ||
     value.chatContentRead !== false || value.nextPromptAllowed !== false ||
     typeof value.origin !== "string" || value.origin.length>256) {
   throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");
 }
 let url;
 try {url = new URL(value.origin);} catch {throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");}
 const host=url.hostname.replace(/\.$/,"");
 if (url.protocol !== "https:" || url.origin !== value.origin ||
     url.username || url.password || host === "localhost" || host === "127.0.0.1" ||
     host.endsWith(".localhost") || host === "chatgpt.com" ||
     host.endsWith(".chatgpt.com") || host === "openai.com" ||
     host.endsWith(".openai.com")) {
   throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");
 }
 return JSON.parse(JSON.stringify(value));
}
export function validateNativeCodeModeAgent(value) {
 if (!exactKeys(value,["source","schemaVersion","runId","state",
     "executionReview","scopeAndBinaryCurrent","executionReady","qa",
     "nextPromptAllowed"]) ||
    value.source!=="NATIVE_AGENT_V2_STATUS" || value.schemaVersion!==2 ||
    !NATIVE_GOAL_RUN.test(value.runId??"") ||
    !AGENT_STATES.has(value.state) || !AGENT_REVIEWS.has(value.executionReview) ||
    typeof value.scopeAndBinaryCurrent!=="boolean" ||
    value.executionReady!==false || value.nextPromptAllowed!==false ||
    value.qa!=="NOT_EXECUTED")
   throw Error("CODE_MODE_AGENT_BINDING_INVALID");
 return JSON.parse(JSON.stringify(value));
}
// Validate a native-originated denied effect-policy snapshot. This never
// interprets a source review or a replay handle as execution permission.
const AGENT_ACTIONS=["start","observe","cancel","reconcileReserved"];
const AGENT_DENIAL_REASONS=new Set(["AGENT_STOPPED",
 "AGENT_V2_SOURCE_NOT_APPROVED","AGENT_EXECUTION_REVIEW_REQUIRED",
 "AGENT_OS_SANDBOX_NOT_VERIFIED","AGENT_HOST_TURN_RECEIPT_REQUIRED"]);
export function validateNativeCodeModeEffectPolicy(value) {
 if(!exactKeys(value,["source","schemaVersion","runId","state","executionReview",
   "scopeAndBinaryCurrent","reservation","policies","executionReady",
   "qa","nextPromptAllowed"]) ||
    value.source!=="NATIVE_AGENT_V2_EFFECT_POLICY" ||
    value.schemaVersion!==2 || !NATIVE_GOAL_RUN.test(value.runId??"") ||
    !AGENT_STATES.has(value.state) ||
    !AGENT_REVIEWS.has(value.executionReview) ||
    typeof value.scopeAndBinaryCurrent!=="boolean" ||
    value.reservation!=="NOT_CREATED" || value.executionReady!==false ||
    value.qa!=="NOT_EXECUTED" || value.nextPromptAllowed!==false ||
    !Array.isArray(value.policies)||value.policies.length!==4)
   throw Error("CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
 for(let i=0;i<AGENT_ACTIONS.length;i++){
   const decision=value.policies[i];
   if(!exactKeys(decision,["action","admitted","reason"]) ||
      decision.action!==AGENT_ACTIONS[i] ||
      decision.admitted!==false || !AGENT_DENIAL_REASONS.has(decision.reason) ||
      (decision.reason==="AGENT_OS_SANDBOX_NOT_VERIFIED" && i!==0) ||
      (decision.reason==="AGENT_HOST_TURN_RECEIPT_REQUIRED" && i===0))
     throw Error("CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
 }
 return JSON.parse(JSON.stringify(value));
}
export function validateNativeCodeModeReceipt(value) {
 if (!exactKeys(value,["source","schemaVersion","runId","taskId","turnId",
     "recordedCompleted","processNotificationObserved","turnObservationKind",
     "finalTurnHostAttested","qa","acceptancePassed","nextPromptAllowed"]) ||
    value.source!=="NATIVE_CODEX_V1_TURN_RECEIPT" || value.schemaVersion!==1 ||
    !NATIVE_GOAL_RUN.test(value.runId??"") ||
    !/^task-[1-8]$/.test(value.taskId??"") ||
    !TURN_ID.test(value.turnId??"") ||
    value.recordedCompleted!==true ||
    typeof value.processNotificationObserved!=="boolean" ||
    !RECEIPT_OBSERVATIONS.has(value.turnObservationKind) ||
    value.finalTurnHostAttested!==false || value.qa!=="NOT_EXECUTED" ||
    value.acceptancePassed!==false || value.nextPromptAllowed!==false)
   throw Error("CODE_MODE_RECEIPT_BINDING_INVALID");
 return JSON.parse(JSON.stringify(value));
}
const exactKeys = (object, keys) => object && typeof object === "object" &&
 !Array.isArray(object) &&
 Object.keys(object).sort().join(",") === [...keys].sort().join(",");
const NATIVE_CAPABILITY=/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const NATIVE_EFFECTS=new Set(["READ","COMPOSITION_OR_HOST_DRAFT","DISPATCH",
 "CONTROL","APPROVAL","SENSITIVE_READ","NAVIGATION","DRAFT","DEBUG","UNCLASSIFIED"]);
export function validateNativeCodeModeCatalog(value) {
 if (!exactKeys(value,["source","capabilities"]) ||
     value.source!=="NATIVE_MCP_CATALOG" ||
     !Array.isArray(value.capabilities) ||
     value.capabilities.length<1 || value.capabilities.length>24)
   throw Error("CODE_MODE_NATIVE_CATALOG_INVALID");
 const names=new Set();
 for(const item of value.capabilities) {
   if (!exactKeys(item,["name","description","effect","permission",
       "codeModeAlias","invocableFromCode"]) ||
       typeof item.name!=="string" || item.name.length>80 ||
       !NATIVE_CAPABILITY.test(item.name) || names.has(item.name) ||
       typeof item.description!=="string" || item.description.length>512 ||
       !NATIVE_EFFECTS.has(item.effect) ||
       typeof item.permission!=="string" ||
       !/^[A-Z_]{3,64}$/.test(item.permission) ||
       (item.codeModeAlias!==null && (typeof item.codeModeAlias!=="string" ||
        !NATIVE_CAPABILITY.test(item.codeModeAlias))) ||
       item.invocableFromCode!==false)
     throw Error("CODE_MODE_NATIVE_CATALOG_INVALID");
   names.add(item.name);
 }
 return JSON.parse(JSON.stringify(value));
}
// Only an authenticated native owner may inject this exact workspace
// checkpoint projection. A digest or model text never grants authority.
export function validateNativeCodeModeWorkspaceGoal(value){
 if(!exactKeys(value,["source","schemaVersion","workspaceId","goalId",
    "goalRevision","phase","chatState","pendingTask",
    "requiresReconciliation","operatorApproved","sourceVerified",
    "chatTurnVerified","qa","nextPromptAllowed"])||
    value.source!=="NATIVE_WORKSPACE_GOAL"||value.schemaVersion!==1||
    !WORKSPACE.test(value.workspaceId??"")||
    !["UNINITIALIZED","PAUSED","STOPPED","DONE","READY",
      "DISPATCH_PENDING","WAITING","RECONCILE_REQUIRED"].includes(value.phase)||
    value.sourceVerified!==false||value.chatTurnVerified!==false||
    value.nextPromptAllowed!==false||value.qa!=="NOT_EXECUTED"||
    typeof value.pendingTask!=="boolean"||
    typeof value.requiresReconciliation!=="boolean"||
    typeof value.operatorApproved!=="boolean"||
    value.requiresReconciliation!==
      ["DISPATCH_PENDING","WAITING","RECONCILE_REQUIRED"].includes(value.phase))
   throw Error("CODE_MODE_WORKSPACE_GOAL_INVALID");
 if(value.phase==="UNINITIALIZED"){
  if(value.goalId!==null||value.goalRevision!==null||
     value.chatState!==null||value.pendingTask!==false||
     value.operatorApproved!==false)
   throw Error("CODE_MODE_WORKSPACE_GOAL_INVALID");
 }else if(typeof value.goalId!=="string"||
          !/^[A-Za-z0-9:_-]{1,128}$/.test(value.goalId)||
          !Number.isSafeInteger(value.goalRevision)||
          value.goalRevision<1||value.goalRevision>10000||
          !["UNBOUND","BOUND_VERIFIED"].includes(value.chatState)||
          value.operatorApproved!==true)
   throw Error("CODE_MODE_WORKSPACE_GOAL_INVALID");
 return JSON.parse(JSON.stringify(value));
}

// Native manual draft status is from the canonical desktop session-memory
// inbox. This is *not* a durable send/outbox receipt across host restarts.
export function validateNativeCodeModeHandoff(value) {
 if(!exactKeys(value,["source","workspaceId","state","draftFingerprint",
      "durability","retryAllowed","sent","operatorReviewRequired","qa","nextPromptAllowed"]) ||
    value.source!=="NATIVE_MANUAL_DRAFT_INBOX" ||
    !WORKSPACE.test(value.workspaceId??"") ||
    !["PENDING_REVIEW","EMPTY_UNVERIFIED"].includes(value.state) ||
    value.durability!=="SESSION_MEMORY" || value.retryAllowed!==false ||
    value.sent!==false || value.operatorReviewRequired!==true ||
    value.qa!=="NOT_EXECUTED" || value.nextPromptAllowed!==false ||
    (value.state==="PENDING_REVIEW" &&
      (typeof value.draftFingerprint!=="string" ||
       !/^[a-f0-9]{64}$/.test(value.draftFingerprint))) ||
    (value.state==="EMPTY_UNVERIFIED" && value.draftFingerprint!==null))
   throw Error("CODE_MODE_HANDOFF_BINDING_INVALID");
 return JSON.parse(JSON.stringify(value));
}
export function validateNativeCodeModeRepository(value) {
 if (!exactKeys(value,["source","schemaVersion","runId",
    "headMatchesApprovedSha","changedEntries","clean","qa","nextPromptAllowed"]) ||
    value.source!=="NATIVE_APPROVED_REPO_STATUS" || value.schemaVersion!==2 ||
    !NATIVE_GOAL_RUN.test(value.runId??"") ||
    typeof value.headMatchesApprovedSha!=="boolean" ||
    !Number.isSafeInteger(value.changedEntries) ||
    value.changedEntries<0 || value.changedEntries>256 ||
    value.clean!==(value.changedEntries===0) ||
    value.qa!=="NOT_EXECUTED" || value.nextPromptAllowed!==false)
   throw Error("CODE_MODE_REPOSITORY_BINDING_INVALID");
 return JSON.parse(JSON.stringify(value));
}
export function validateNativeCodeModeGoal(value) {
 if (!exactKeys(value,["source","schemaVersion","runId","state","mode",
     "baseSha","checkpointRevision","taskCount","tasks",
     "qa","chatTurnVerified","nextPromptAllowed"]) ||
   value.source !== "NATIVE_CODEX_V1_RUN_STATUS" || value.schemaVersion !== 1 ||
   !NATIVE_GOAL_RUN.test(value.runId??"") || !NATIVE_SHA.test(value.baseSha??"") ||
   !GOAL_STATES.has(value.state) ||
   !["READ_ONLY","WORKTREE_WRITE"].includes(value.mode) ||
   !Number.isSafeInteger(value.checkpointRevision) || value.checkpointRevision<0 ||
   !Number.isSafeInteger(value.taskCount) || value.taskCount<1 || value.taskCount>8 ||
   value.qa !== "NOT_VERIFIED" || value.chatTurnVerified !== false ||
   value.nextPromptAllowed !== false || !Array.isArray(value.tasks) ||
   value.tasks.length>value.taskCount)
   throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 for (const [i,task] of value.tasks.entries()) {
   if (!exactKeys(task,["id","state","recordedCheck","recordedChecks","lastExitCode"]) ||
       task.id !== "task-"+(i+1) || !TASK_STATES.has(task.state) ||
       !CHECK_STATES.has(task.recordedCheck) ||
       !Number.isSafeInteger(task.recordedChecks) ||
       task.recordedChecks<0 || task.recordedChecks>2 ||
       (task.lastExitCode!==null && !Number.isSafeInteger(task.lastExitCode)))
     throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 }
 const json = JSON.stringify(value);
 if (json.length>MAX_TOOL_RESULT) throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 return JSON.parse(json);
}
