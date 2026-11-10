// Pure classification from authenticated host signals, not scroll position or response text.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function classifySessionHealth({workspaceId,sessionId,hostSignal}={}){
 const result=(state,action,reason)=>({state,action,reason,workspaceId,sessionId});
 if(!ID.test(workspaceId??"")||!ID.test(sessionId??"")||
    hostSignal?.trusted!==true||hostSignal.workspaceId!==workspaceId||
    hostSignal.sessionId!==sessionId)
  return result("UNKNOWN","PAUSE","HOST_SIGNAL_UNVERIFIED");
 const code=hostSignal.code;
 if(code==="CONTEXT_EXHAUSTED")return result("CONTEXT_EXHAUSTED","PREPARE_HANDOFF","CONTEXT_WINDOW_LIMIT");
 if(code==="RATE_LIMITED"||code==="QUOTA_EXHAUSTED")return result("RATE_LIMITED","WAIT","ACCOUNT_OR_MODEL_LIMIT");
 if(code==="AUTH_REQUIRED")return result("AUTH_REQUIRED","HUMAN_ACTION","SESSION_AUTHENTICATION_REQUIRED");
 if(code==="GENERATING"||code==="TOOL_RUNNING")return result("BUSY","OBSERVE_ONLY","RESPONSE_IN_PROGRESS");
 if(code==="RESPONSE_PARTIAL"||code==="DELIVERY_UNCERTAIN")return result("UNCERTAIN","RECONCILE","RESPONSE_NOT_TERMINAL");
 if(code==="APPROVAL_REQUIRED")return result("WAITING_APPROVAL","HUMAN_ACTION","USER_APPROVAL_REQUIRED");
 if(code==="READY"&&hostSignal.responseTerminal===true&&hostSignal.pendingPrompt!==true)
  return result("READY","PLAN_NEXT","SESSION_READY");
 return result("UNKNOWN","PAUSE","INSUFFICIENT_HOST_EVIDENCE");
}
