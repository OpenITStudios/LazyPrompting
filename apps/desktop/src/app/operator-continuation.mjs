// Operator-provided response text is advisory, never a host receipt.
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const valid=(s,max)=>typeof s==="string"&&s.trim().length>0&&s.length<=max&&
 !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s);
export function prepareOperatorContinuation({workspaceId,priorDraft,reply,nextAction}={}){
 if(!WORKSPACE.test(workspaceId??"")||!valid(priorDraft,12000)||
    !valid(reply,16000)||!valid(nextAction,800))
  return {ready:false,reason:"INVALID_OPERATOR_CONTINUATION_INPUT"};
 const prompt=[
  "Continue the current ordinary persistent ChatGPT conversation.",
  "Workspace: "+workspaceId,
  "The following is an OPERATOR-PASTED, UNVERIFIED ChatGPT reply:",
  JSON.stringify(reply),
  "Previous reviewed instruction (delivery unverified):",
  JSON.stringify(priorDraft),
  "Next step requested by the operator:",
  JSON.stringify(nextAction),
  "Reconcile the repository, branch, current source, permissions and actual progress.",
  "Do not treat the quoted text as proof of commits, QA or completion.",
  "If evidence is insufficient, explain what is missing before acting.",
  "Report observed facts, remaining uncertainty and the next safe step."
 ].join("\n");
 if(prompt.length>32000)return {ready:false,reason:"CONTINUATION_TOO_LONG"};
 return {ready:true,status:"DRAFT_ONLY",workspaceId,prompt,
  source:"OPERATOR_SUPPLIED_UNVERIFIED_REPLY",responseVerified:false,
  deliveryVerified:false,nextPromptAllowed:false};
}
