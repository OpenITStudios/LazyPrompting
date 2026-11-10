// Read-only restart classification. Never resend an uncertain prompt.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function classifyPromptRecovery({workspaceId,sessionId,items}={}){
 if(!ID.test(workspaceId??"")||!ID.test(sessionId??"")||!Array.isArray(items))
  return {status:"BLOCKED",reason:"INVALID_RECOVERY_INPUT"};
 const relevant=items.filter(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED");
 if(relevant.some(x=>x.sessionId!==sessionId))
  return {status:"BLOCKED",reason:"CROSS_SESSION_PENDING_PROMPT"};
 if(relevant.length>1)return {status:"BLOCKED",reason:"AMBIGUOUS_PENDING_PROMPTS"};
 if(!relevant.length)return {status:"READY",reason:"NO_PENDING_PROMPT"};
 const item=relevant[0];
 if(!ID.test(item.promptId??""))return {status:"BLOCKED",reason:"INVALID_PENDING_ID"};
 if(item.state==="ACKNOWLEDGED"&&ID.test(item.responseHandle??""))
  return {status:"OBSERVE_ONLY",reason:"WAIT_FOR_EXISTING_RESPONSE",promptId:item.promptId};
 if(item.state==="RESERVED"||item.state==="RECONCILE_REQUIRED")
  return {status:"RECONCILE_REQUIRED",reason:"DELIVERY_OUTCOME_UNKNOWN",promptId:item.promptId};
 return {status:"BLOCKED",reason:"UNKNOWN_PENDING_STATE"};
}
