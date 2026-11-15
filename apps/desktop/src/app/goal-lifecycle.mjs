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
 return state("GOAL_NOT_HOST_BOUND",
  "Approve and bind an exact goal through a verified native host.");
}
