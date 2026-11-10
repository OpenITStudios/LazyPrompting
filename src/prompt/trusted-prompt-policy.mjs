// Budget policy comes from an authenticated host-owned registry, not model text.
export class TrustedPromptPolicy {
 constructor({readWorkspace,verifyIdentity}={}){
  if(typeof readWorkspace!=="function"||typeof verifyIdentity!=="function")
   throw new Error("TRUSTED_PROMPT_POLICY_REQUIRED");
  this.readWorkspace=readWorkspace;this.verifyIdentity=verifyIdentity;
 }
 async resolve({hostIdentity,workspaceId,sessionId,contextRevision}={}){
  if((await this.verifyIdentity({hostIdentity,workspaceId,sessionId}))!==true)
   return {authorized:false,reason:"HOST_IDENTITY_DENIED"};
  const w=await this.readWorkspace(workspaceId);
  if(!w||w.workspaceId!==workspaceId||w.sessionId!==sessionId||
     w.contextRevision!==contextRevision||w.status!=="READY")
   return {authorized:false,reason:"WORKSPACE_SCOPE_CHANGED"};
  if(!Number.isSafeInteger(w.promptLimit)||w.promptLimit<1||w.promptLimit>1000)
   return {authorized:false,reason:"INVALID_HOST_BUDGET"};
  return {authorized:true,promptLimit:w.promptLimit,maxConcurrent:2};
 }
}
