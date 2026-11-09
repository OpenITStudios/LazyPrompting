// Deterministic budget admission; actual billing/time receipts must come from host.
export function admitWorkspaceBudget({workspace,activeAgents=0,maxActiveAgents=2,requestedTokens=0}={}){
 const deny=reason=>({admitted:false,reason});
 if(!workspace||workspace.status!=="READY"||workspace.grantValid!==true)return deny("WORKSPACE_NOT_READY");
 if(!Number.isSafeInteger(activeAgents)||activeAgents<0||
    !Number.isSafeInteger(maxActiveAgents)||maxActiveAgents<1||maxActiveAgents>10||
    activeAgents>=maxActiveAgents)return deny("AGENT_CAPACITY_REACHED");
 if(!Number.isSafeInteger(requestedTokens)||requestedTokens<0||
    !Number.isSafeInteger(workspace.remainingTokens)||workspace.remainingTokens<requestedTokens||
    !Number.isSafeInteger(workspace.remainingTicks)||workspace.remainingTicks<1)
   return deny("WORKSPACE_BUDGET_EXCEEDED");
 return {admitted:true,workspaceId:workspace.workspaceId,tokenAllowance:requestedTokens};
}
