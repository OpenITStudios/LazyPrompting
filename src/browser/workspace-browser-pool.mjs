import {RemoteBrowser} from "./remote-browser.mjs";

// Each workspace owns a separate browser process/context, not just a tab.
// Browser access remains opt-in and requires host-level network egress controls.
export class WorkspaceBrowserPool {
 constructor({maxActive=2,createBrowser=options=>new RemoteBrowser(options)}={}){
  if(!Number.isSafeInteger(maxActive)||maxActive<1||maxActive>10||
     typeof createBrowser!=="function")throw new Error("INVALID_BROWSER_POOL");
  this.maxActive=maxActive;this.createBrowser=createBrowser;this.sessions=new Map();
 }
 status(){return {active:this.sessions.size,maxActive:this.maxActive,workspaceIds:[...this.sessions.keys()]};}
 async open({workspaceId,allowedOrigins,url}={}){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId??"")||
     !Array.isArray(allowedOrigins)||!allowedOrigins.length||typeof url!=="string")
   throw new Error("INVALID_BROWSER_WORKSPACE");
  if(this.sessions.has(workspaceId))throw new Error("WORKSPACE_BROWSER_ALREADY_ACTIVE");
  if(this.sessions.size>=this.maxActive)throw new Error("BROWSER_CAPACITY_REACHED");
  // Reserve the slot synchronously before any await: concurrent opens cannot exceed capacity.
  const browser=this.createBrowser({allowedOrigins});
  this.sessions.set(workspaceId,browser);
  try{
   await browser.validate(url);
   await browser.start();
   return await browser.navigate(url);
  }catch(e){
   if(this.sessions.get(workspaceId)===browser)this.sessions.delete(workspaceId);
   await browser.close().catch(()=>{});
   throw e;
  }
 }
 async snapshot(workspaceId){
  const browser=this.sessions.get(workspaceId);
  if(!browser)throw new Error("WORKSPACE_BROWSER_NOT_FOUND");
  return browser.snapshot();
 }
 async close(workspaceId){
  const browser=this.sessions.get(workspaceId);
  if(!browser)return false;
  this.sessions.delete(workspaceId);
  await browser.close();
  return true;
 }
 async closeAll(){
  const ids=[...this.sessions.keys()];
  for(const id of ids)await this.close(id);
 }
}
