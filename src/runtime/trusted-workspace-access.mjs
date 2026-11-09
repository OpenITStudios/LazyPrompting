import {selectWorkspace} from "./workspace-router.mjs";

// Authentication is performed by the host, not by chat content or browser state.
// A host must supply an independently authenticated session identity.
export class TrustedWorkspaceAccess {
 constructor({registry,authenticateSession}={}){
  if(!registry||typeof registry.read!=="function"||typeof authenticateSession!=="function")
   throw new Error("TRUSTED_WORKSPACE_HOST_REQUIRED");
  this.registry=registry;this.authenticateSession=authenticateSession;
 }
 async admit({hostCredential,workspaceId,taskId}={}){
  const identity=await this.authenticateSession(hostCredential);
  if(!identity||identity.trusted!==true||
     typeof identity.sessionId!=="string"||identity.sessionId.length>128)
   return {admitted:false,reason:"HOST_AUTHENTICATION_REQUIRED"};
  const state=await this.registry.read();
  const result=selectWorkspace({bindings:state.workspaces,callerSessionId:identity.sessionId,workspaceId,taskId});
  if(!result.admitted)return result;
  return {...result,registryVersion:state.version};
 }
 async browserSnapshot({hostCredential,workspaceId,taskId,browserPool}={}){
  const admission=await this.admit({hostCredential,workspaceId,taskId});
  if(!admission.admitted)return admission;
  if(!browserPool||typeof browserPool.snapshot!=="function")
   return {admitted:false,reason:"BROWSER_BACKEND_UNAVAILABLE"};
  return {admitted:true,workspaceId,observation:await browserPool.snapshot(workspaceId)};
 }
}
