// Prompt-only deterministic budget gate. Counts committed reservations, not guessed tokens.
export function checkPromptBudget({workspace,outboxItems=[],maxConcurrent=2,activeWorkspaces=0}={}){
 const deny=reason=>({admitted:false,reason});
 if(!workspace||workspace.status!=="READY")return deny("WORKSPACE_NOT_READY");
 if(!Number.isSafeInteger(workspace.promptLimit)||workspace.promptLimit<1||
    !Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>10||
    !Number.isSafeInteger(activeWorkspaces)||activeWorkspaces<0)
   return deny("INVALID_BUDGET");
 if(!Array.isArray(outboxItems))return deny("INVALID_OUTBOX");
 const used=outboxItems.filter(x=>x.workspaceId===workspace.workspaceId).length;
 if(used>=workspace.promptLimit)return deny("PROMPT_BUDGET_EXHAUSTED");
 if(outboxItems.some(x=>x.workspaceId===workspace.workspaceId&&x.state!=="RESPONSE_VERIFIED"))
   return deny("PROMPT_PENDING");
 if(activeWorkspaces>=maxConcurrent)return deny("GLOBAL_CAPACITY_REACHED");
 return {admitted:true,remainingPrompts:workspace.promptLimit-used};
}
