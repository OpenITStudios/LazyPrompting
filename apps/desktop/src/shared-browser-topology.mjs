// One browser-managed profile; workspace identity remains logical, not a security boundary.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export class SharedBrowserTopology {
 constructor({maxWorkspaces=10}={}){
  if(!Number.isInteger(maxWorkspaces)||maxWorkspaces<1||maxWorkspaces>10)throw Error("INVALID_CAPACITY");
  this.maxWorkspaces=maxWorkspaces;this.views=new Map();this.profile="SHARED_BROWSER_PROFILE";
 }
 bind({workspaceId,conversationId}={}){
  if(!ID.test(workspaceId??"")||!ID.test(conversationId??""))throw Error("INVALID_BINDING");
  if(!this.views.has(workspaceId)&&this.views.size>=this.maxWorkspaces)throw Error("WORKSPACE_CAPACITY");
  if([...this.views].some(([id,conversation])=>id!==workspaceId&&conversation===conversationId))
   throw Error("CONVERSATION_ALREADY_BOUND");
  this.views.set(workspaceId,conversationId);
  return this.snapshot();
 }
 unbind(workspaceId){return this.views.delete(workspaceId);}
 snapshot(){return {profile:this.profile,loginScope:"SHARED",browserSecurityIsolation:false,
  workspaces:[...this.views].map(([workspaceId,conversationId])=>({workspaceId,conversationId}))};}
}
