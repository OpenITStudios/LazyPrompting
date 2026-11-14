// Operator-provided response text is advisory, never a host receipt.
// Bound each continuation to the native send-once maximum (12,000 UTF-8 bytes).
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const MAX_PROMPT_BYTES=12000;
const encoder=new TextEncoder();
const valid=(s,max)=>typeof s==="string"&&s.trim().length>0&&s.length<=max&&
 !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s);

// Keep source excerpts within a UTF-8 budget without splitting a Unicode
// code point. Never silently claim an omitted section was reviewed.
function excerpt(text,maxBytes,tail=false){
 const points=Array.from(text);
 let retained=[],bytes=0;
 const ordered=tail?points.reverse():points;
 for(const point of ordered){
  const count=encoder.encode(point).length;
  if(bytes+count>maxBytes)break;
  retained.push(point);bytes+=count;
 }
 if(tail)retained.reverse();
 const excerptText=retained.join("");
 return {text:excerptText,omitted:excerptText.length!==text.length};
}

export function prepareOperatorContinuation({workspaceId,priorDraft,reply,nextAction}={}){
 if(!WORKSPACE.test(workspaceId??"")||!valid(priorDraft,12000)||
    !valid(reply,16000)||(nextAction!==undefined&&nextAction!==""&&!valid(nextAction,800)))
  return {ready:false,reason:"INVALID_OPERATOR_CONTINUATION_INPUT"};
 // The previous prompt may already contain earlier quoted replies. Carry a
 // short head of it, not an ever-growing recursive prompt history.
 const prior=excerpt(priorDraft,1400);
 const latest=excerpt(reply,7000,true);
 const lines=[
  "Continue the current ordinary persistent ChatGPT conversation.",
  "Workspace: "+workspaceId,
  "The following is an OPERATOR-PASTED, UNVERIFIED ChatGPT reply"+(latest.omitted?" (TAIL EXCERPT; earlier content omitted)":"")+":",
  JSON.stringify(latest.text),
  "Prior reviewed instruction"+(prior.omitted?" (HEAD EXCERPT; remainder omitted)":"")+"; delivery not verified:",
  JSON.stringify(prior.text),
  ...(nextAction?[
   "Operator-specified next step (review required):",
   JSON.stringify(nextAction)
  ]:[
   "No specific next step was supplied.",
   "Identify the next UNFINISHED step in the original scoped goal using the current chat context and independently verifiable repository evidence.",
   "If the prior reply claims the goal is complete, check acceptance and state what evidence is still required rather than inventing more work."
  ]),
  "Reconcile the repository, branch, current source, permissions and actual progress.",
  "Do not treat the quoted text as proof of commits, QA or completion.",
  "If evidence is insufficient, explain what is missing before acting.",
  "Report observed facts, remaining uncertainty and the next safe step."
 ];
 const prompt=lines.join("\n");
 if(encoder.encode(prompt).length>MAX_PROMPT_BYTES)
  return {ready:false,reason:"CONTINUATION_TOO_LONG"};
 return {ready:true,status:"DRAFT_ONLY",workspaceId,prompt,
  source:"OPERATOR_SUPPLIED_UNVERIFIED_REPLY",responseVerified:false,
  deliveryVerified:false,nextPromptAllowed:false,
  excerpted:latest.omitted||prior.omitted};
}
