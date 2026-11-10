// Pure, fail-closed handoff planning. Old conversations are retained, never deleted.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function prepareChatHandoff({workspace,oldSession,context,outboxItems=[]}={}){
 const deny=reason=>({ready:false,reason});
 if(!workspace||!ID.test(workspace.workspaceId??"")||!ID.test(workspace.sessionId??"")||
    !ID.test(workspace.taskId??"")||workspace.sessionId!==oldSession||
    !Number.isSafeInteger(workspace.contextRevision)||workspace.contextRevision<0||
    !Array.isArray(outboxItems))return deny("INVALID_HANDOFF_IDENTITY");
 if(workspace.status==="STOPPED"||workspace.status==="BLOCKED")return deny("WORKSPACE_INACTIVE");
 if(outboxItems.some(x=>x.workspaceId===workspace.workspaceId&&x.state!=="RESPONSE_VERIFIED"))
  return deny("PENDING_PROMPT_REQUIRES_RECONCILIATION");
 if(!context||context.workspaceId!==workspace.workspaceId||
    context.sessionId!==oldSession||context.taskId!==workspace.taskId||
    context.contextRevision!==workspace.contextRevision||
    typeof context.goal!=="string"||!context.goal.trim()||
    typeof context.nextAction!=="string"||!context.nextAction.trim())
  return deny("INCOMPLETE_CONTEXT_CAPSULE");
 const serialized=JSON.stringify(context);
 if(Buffer.byteLength(serialized,"utf8")>65536)return deny("CONTEXT_CAPSULE_TOO_LARGE");
 return {ready:true,workspaceId:workspace.workspaceId,oldSessionId:oldSession,
  contextRevision:workspace.contextRevision,capsule:structuredClone(context),
  oldSessionDisposition:"RETAIN_ARCHIVED",requiresNewSessionVerification:true};
}
export function verifyChatHandoff({plan,newSessionId,hostProof}={}){
 if(plan?.ready!==true||!ID.test(newSessionId??"")||
    newSessionId===plan.oldSessionId||hostProof?.trusted!==true||
    hostProof.workspaceId!==plan.workspaceId||hostProof.sessionId!==newSessionId||
    hostProof.contextRevision!==plan.contextRevision||
    hostProof.contextAccepted!==true)
  return {activated:false,reason:"NEW_SESSION_NOT_VERIFIED"};
 return {activated:true,workspaceId:plan.workspaceId,oldSessionId:plan.oldSessionId,
  newSessionId,contextRevision:plan.contextRevision+1,oldSessionDisposition:"RETAIN_ARCHIVED"};
}
