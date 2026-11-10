export const MAX_WORKSPACES = 10;
export const MODES = Object.freeze(["UNBOUND","PREVIEW_ONLY","MANAGED_SUPPORTED_HOST"]);
export const STATES = Object.freeze(["IDLE","READY","GENERATING","WAITING","REVIEW_REQUIRED","PAUSED","BLOCKED"]);
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function createWorkspace({id,label}={}){
 if(!ID.test(id??"")||typeof label!=="string"||!label.trim()||label.length>80)throw Error("INVALID_WORKSPACE");
 return {id,label:label.trim(),mode:"UNBOUND",state:"IDLE",pending:false,sessionId:null};
}
export function applyWorkspaceEvent(workspaces,event){
 if(!Array.isArray(workspaces)||workspaces.length>MAX_WORKSPACES)throw Error("WORKSPACE_CAPACITY");
 if(!event||!ID.test(event.workspaceId??""))throw Error("INVALID_WORKSPACE_EVENT");
 const found=workspaces.find(x=>x.id===event.workspaceId);
 if(!found)throw Error("WORKSPACE_NOT_FOUND");
 if(event.kind==="SET_MODE"){
  if(!MODES.includes(event.mode))throw Error("INVALID_BROWSER_MODE");
  if(found.pending)throw Error("PENDING_WORKSPACE_CANNOT_REBIND");
  return workspaces.map(x=>x.id===found.id?{...x,mode:event.mode}:x);
 }
 if(event.kind==="SET_STATE"){
  if(!STATES.includes(event.state))throw Error("INVALID_WORKSPACE_STATE");
  if(event.state==="READY"&&found.mode==="UNBOUND")throw Error("UNBOUND_WORKSPACE_NOT_READY");
  return workspaces.map(x=>x.id===found.id?{...x,state:event.state}:x);
 }
 if(event.kind==="SET_PENDING"){
  if(typeof event.pending!=="boolean")throw Error("INVALID_PENDING_VALUE");
  if(event.pending&&found.pending)throw Error("DUPLICATE_INFLIGHT_PROMPT");
  if(event.pending&&found.mode!=="MANAGED_SUPPORTED_HOST")throw Error("HOST_NOT_ADMITTED");
  return workspaces.map(x=>x.id===found.id?{...x,pending:event.pending}:x);
 }
 throw Error("UNSUPPORTED_WORKSPACE_EVENT");
}
export function appendWorkspace(workspaces,workspace){
 if(!Array.isArray(workspaces)||workspaces.length>=MAX_WORKSPACES)throw Error("WORKSPACE_CAPACITY");
 if(workspaces.some(w=>w.id===workspace.id))throw Error("DUPLICATE_WORKSPACE");
 return [...workspaces,workspace];
}
