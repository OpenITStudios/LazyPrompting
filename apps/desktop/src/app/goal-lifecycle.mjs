// Display-only lifecycle projection. UI signals, client drafts and public
// GitHub observations do not certify a goal, ChatGPT delivery or QA.
const WS=/^workspace-(0[1-9]|10)$/;
export function projectGoalLifecycle({workspaceId,hasDraft=false,chatHint="UNKNOWN",
 savedChatUrl=false,hasPublicSource=false}={}){
 const state=(stage,nextAction)=>Object.freeze({workspaceId,stage,nextAction,
  source:"UI_DISPLAY_ONLY",goalApproval:"NOT_ATTESTED",
  chatIdentity:savedChatUrl===true?"URL_BOOKMARK_ONLY":"NOT_ATTESTED",
  sourceEvidence:hasPublicSource===true?"PUBLIC_GITHUB_UNVERIFIED":"NOT_VERIFIED",
  deliveryVerified:false,resultVerified:false,qa:"NOT_EXECUTED",
  nextPromptAllowed:false});
 if(!WS.test(workspaceId??""))return state("INVALID_WORKSPACE",
  "Select a valid workspace before reviewing a goal.");
 if(chatHint==="POSSIBLY_COMPLETED"||chatHint==="ERROR")
  return state("EVIDENCE_REVIEW_REQUIRED",
   "Inspect the chat, then independently verify source and QA before continuing.");
 if(chatHint==="GENERATING"||chatHint==="WAITING")
  return state("CHAT_UI_STATUS_UNVERIFIED",
   "Inspect ordinary ChatGPT Chat; no authenticated delivery or result receipt exists.");
 if(hasDraft===true)return state("MANUAL_DRAFT_REVIEW_REQUIRED",
  "Review the client draft and verify its scope before manually using ChatGPT.");
 return state("GOAL_BINDING_UNVERIFIED",
  "Inspect existing native goal scope and approval before requesting more work.");
}


// Native Codex v1 status is global to the app, not assigned to one ChatGPT
// workspace. It is never a ChatGPT turn receipt or independent QA.
const RUN=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/i;
const CODEX_V1_STATES=new Set(["AWAITING_SCOPE_REVIEW","REVIEW_INTERRUPTED",
 "SCOPE_REVIEWED","STARTING","RUNNING","PAUSE_REQUESTED","PAUSED",
 "NEEDS_ATTENTION","REVIEW_COMPLETE","CODING_COMPLETE","STOPPED",
 "DECLINED","RECONCILE_REQUIRED"]);
export function acceptNativeCodexGoals(raw){
 if(!raw||raw.source!=="NATIVE_CODEX_V1_STATUS"||
    raw.qa!=="NOT_VERIFIED"||raw.nextPromptAllowed!==false||
    typeof raw.truncated!=="boolean"||!Array.isArray(raw.runs)||
    raw.runs.length>10)return null;
 const seen=new Set();
 const runs=[];
 for(const x of raw.runs){
  if(!x||!RUN.test(x.runId??"")||seen.has(x.runId)||
    !["READ_ONLY","WORKTREE_WRITE"].includes(x.mode)||
    !CODEX_V1_STATES.has(x.state)||
    !Number.isSafeInteger(x.checkpointRevision)||x.checkpointRevision<0||
    x.source!=="NATIVE_CODEX_V1_RUN_STATUS"||
    x.qa!=="NOT_VERIFIED"||x.chatTurnVerified!==false||
    x.nextPromptAllowed!==false)return null;
  seen.add(x.runId);
  runs.push({runId:x.runId,mode:x.mode,state:x.state,
   checkpointRevision:x.checkpointRevision});
 }
 return {runs,truncated:raw.truncated};
}
