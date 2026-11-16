// Codex goal task-N IDs and ordinary ChatGPT workspace-NN IDs
// are distinct trust domains, not aliases with matching suffixes.
const TASK=/^task-[1-8]$/;
const CHAT=/^workspace-(0[1-9]|10)$/;
export function assertCodexTaskOutboxScope({state,taskId}={}){
 if(!TASK.test(taskId??"")||state?.schemaVersion!==1||
    !Array.isArray(state.items))throw Error("GOAL_TASK_OUTBOX_SCOPE_INVALID");
 if((state.browserActions??[]).length||
    (state.operatorChatAttempts??[]).length)
  throw Error("GOAL_TASK_OUTBOX_CROSS_SURFACE_CONTAMINATION");
 if(state.items.some(item=>item?.workspaceId!==taskId))
  throw Error("GOAL_TASK_OUTBOX_SCOPE_MISMATCH");
 return {kind:"CODEX_TASK",taskId,chatWorkspaceBound:false,
  nextChatPromptAllowed:false};
}
export function assessIndependentGoalChatScopes({taskId,workspaceId}={}){
 if(!TASK.test(taskId??"")||!CHAT.test(workspaceId??""))
  return {valid:false,reason:"CROSS_SURFACE_IDENTITY_INVALID"};
 return {valid:true,separateActors:true,
  chatBindingVerified:false,canSendToConsumerChat:false};
}
