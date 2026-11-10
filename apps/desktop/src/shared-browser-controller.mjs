import {SharedBrowserTopology} from "./shared-browser-topology.mjs";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Pure planning only: no browser process, credentials, navigation, or ChatGPT Web access.
export class SharedBrowserController {
 constructor({maxWorkspaces=10,maxVisible=2}={}){
  if(!Number.isSafeInteger(maxVisible)||maxVisible<1||maxVisible>maxWorkspaces)throw Error("INVALID_VISIBLE_LIMIT");
  this.topology=new SharedBrowserTopology({maxWorkspaces});
  this.maxVisible=maxVisible;this.views=new Map();this.selected=null;
 }
 bind({workspaceId,conversationId}={}){
  const existing=this.views.get(workspaceId);
  if(existing?.pending&&existing.conversationId!==conversationId)throw Error("PENDING_WORKSPACE_CANNOT_REBIND");
  this.topology.bind({workspaceId,conversationId});
  const prior=this.views.get(workspaceId);
  this.views.set(workspaceId,{workspaceId,conversationId,state:prior?.state??"PARKED",pending:prior?.pending??false});
  return this.snapshot();
 }
 select(workspaceId){
  if(!this.views.has(workspaceId))throw Error("WORKSPACE_NOT_BOUND");
  this.selected=workspaceId;
  // Render budget applies to visible views, not chat execution or authenticated host sessions.
  for(const [id,v] of this.views)v.state=id===workspaceId?"VISIBLE":"PARKED";
  return this.snapshot();
 }
 markPending({workspaceId,pending,verified}={}){
  if(verified!==true||typeof pending!=="boolean")throw Error("UNVERIFIED_PROMPT_STATE");
  const view=this.views.get(workspaceId);
  if(!view)throw Error("WORKSPACE_NOT_BOUND");
  view.pending=pending;return this.snapshot();
 }
 unbind(workspaceId){
  const view=this.views.get(workspaceId);
  if(!view)return false;
  if(view.pending)throw Error("PENDING_WORKSPACE_REQUIRES_RECONCILIATION");
  this.views.delete(workspaceId);this.topology.unbind(workspaceId);
  if(this.selected===workspaceId)this.selected=null;
  return true;
 }
 snapshot(){return {profile:"SHARED_BROWSER_PROFILE",loginScope:"SHARED",selected:this.selected,
  maxVisible:this.maxVisible,visible:[...this.views.values()].filter(v=>v.state==="VISIBLE").length,
  views:[...this.views.values()].map(v=>({...v}))};}
}
