// Opt-in CDP adapter. Playwright must be installed separately; never launches a browser.
// Explicitly scoped localhost test pages only. Not a ChatGPT Web transport.
// Index is a read-only Jev-inspired projection; no action execution or new grant.
import {projectLightpandaControlIndex} from "./lightpanda-control-index.mjs";
const ID=/^workspace-(0[1-9]|10)$/;
const DEFAULT_TIMEOUT=8000;
export class LightpandaCdpAdapter {
 constructor({endpoint,allowedOrigins=["http://127.0.0.1:1425"],connect=null}={}){
  const match=/^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(endpoint??"");
  if(!match||Number(match[1])>65535)throw Error("INVALID_CDP_ENDPOINT");
  this.endpoint=endpoint;this.allowed=new Set(allowedOrigins.map(origin=>{
   const u=new URL(origin);
   if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||u.username||u.password||
      u.pathname!=="/"||u.search||u.hash)throw Error("INVALID_ALLOWED_ORIGIN");
   return u.origin;
  }));
  if(!this.allowed.size)throw Error("ALLOWED_ORIGIN_REQUIRED");
  this.connect=connect;this.browser=null;this.slots=new Map();this.pending=new Map();this.closing=false;this.connecting=null;
 }
 validate(url){
  const u=new URL(url);
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||u.username||u.password||
     !this.allowed.has(u.origin))throw Error("BROWSER_ORIGIN_DENIED");
  return u.toString();
 }
 async start(){
  if(this.closing)throw Error("CDP_CLOSING");
  if(this.browser)return {connected:true,identityVerified:false,automationEnabled:false};
  if(!this.connecting){
   const attempt=(async()=>{
    const connect=this.connect??(await import("playwright")).chromium.connectOverCDP;
    const browser=await connect(this.endpoint,{timeout:DEFAULT_TIMEOUT});
    if(!browser||typeof browser.contexts!=="function"||typeof browser.close!=="function")throw Error("INVALID_CDP_BROWSER");
    if(this.closing){await browser.close();throw Error("CDP_CLOSING");}
    this.browser=browser;
    return {connected:true,identityVerified:false,automationEnabled:false};
   })();
   this.connecting=attempt;
   void attempt.finally(()=>{if(this.connecting===attempt)this.connecting=null}).catch(()=>{});
  }
  return this.connecting;
 }
 async open(workspaceId,url){
  return this.serial(workspaceId,()=>this.openInternal(workspaceId,url));
 }
 async openInternal(workspaceId,url){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const target=this.validate(url);
  const preview=new URL(target);
  if(preview.pathname!=="/browser-preview.html"||preview.search||preview.hash)throw Error("BROWSER_TARGET_DENIED");
  if(this.closing)throw Error("CDP_CLOSING");
  if(!this.browser)throw Error("CDP_NOT_CONNECTED");
  // No implicit session sharing; each workspace owns an isolated context.
  let slot=this.slots.get(workspaceId);
  if(!slot){
   const context=await this.browser.newContext({acceptDownloads:false,serviceWorkers:"block",permissions:[]});
   try{
    if(this.closing)throw Error("CDP_CLOSING");
    await context.route("**/*",route=>{
     try{this.validate(route.request().url());return route.continue()}
     catch{return route.abort()}
    });
    if(this.closing)throw Error("CDP_CLOSING");
    const page=await context.newPage();
    if(this.closing)throw Error("CDP_CLOSING");
    slot={context,page,generation:0,lastIndexFingerprint:null,eventsWired:false};
    // Source-side freshness guard for the opt-in indexed view. The real
    // Playwright Page reports navigation/load events; a mock/unsupported
    // client lacking them cannot assert a fresh indexed snapshot.
    if(typeof page.on==="function"){
     const invalidate=()=>{
      slot.generation++;
      slot.lastIndexFingerprint=null;
     };
     page.on("framenavigated",invalidate);
     page.on("load",invalidate);
     slot.eventsWired=true;
    }
    this.slots.set(workspaceId,slot);
   }catch(e){await context.close();throw e;}
  }
  try {
   await slot.page.goto(target,{waitUntil:"domcontentloaded",timeout:DEFAULT_TIMEOUT});
   // Even a same-address explicit reload starts a new observation epoch.
   slot.generation++;
   slot.lastIndexFingerprint=null;
   const actual=this.validate(slot.page.url());
   if(actual!==target)throw Error("BROWSER_NAVIGATION_CHANGED");
   return {workspaceId,url:actual};
  } catch(e) {
   this.slots.delete(workspaceId);
   try{await slot.context.close()}catch{}
   throw e;
  }
 }
 async snapshot(workspaceId,view="metadata",sinceFingerprint=null){
  if(!["metadata","index"].includes(view))throw Error("INVALID_SNAPSHOT_VIEW");
  if(sinceFingerprint!==null&&
     (view!=="index"||typeof sinceFingerprint!=="string"||
      !/^[a-f0-9]{64}$/.test(sinceFingerprint)))
   throw Error("LIGHTPANDA_SNAPSHOT_CURSOR_INVALID");
  return this.serial(workspaceId,()=>this.snapshotInternal(workspaceId,view,sinceFingerprint));
 }
 async snapshotInternal(workspaceId,view,sinceFingerprint){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)throw Error("WORKSPACE_NOT_OPEN");
  const current=this.validate(slot.page.url());
  const parsed=new URL(current);
  if(parsed.pathname!=="/browser-preview.html"||parsed.search||parsed.hash) {
   this.slots.delete(workspaceId);
   try{await slot.context.close()}catch{}
   throw Error("BROWSER_NAVIGATION_CHANGED");
  }
  if(view==="metadata")
   return {workspaceId,url:current,title:(await slot.page.title()).slice(0,200)};
  if(!slot.eventsWired)
   throw Error("LIGHTPANDA_INDEX_FRESHNESS_UNAVAILABLE");
  const generation=slot.generation;
  // Request one compact semantic observation through the existing admitted
  // localhost CDP session. Do not evaluate DOM scripts, expose node handles,
  // invoke a model, or retry unsupported methods.
  let session;
  let tree;
  try{
   const context=slot.page.context?.();
   if(typeof context?.newCDPSession!=="function")
     throw Error("LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE");
   session=await context.newCDPSession(slot.page);
   const result=await session.send("LP.getSemanticTree",{
     format:"text",interactiveOnly:true
   });
   tree=result?.semanticTree;
  }catch{
   throw Error("LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE");
  }finally{
   try{await session?.detach?.()}catch{}
  }
  // An old read must never silently describe a different preview page.
  if(slot.generation!==generation || slot.page.url()!==current){
   // Same-URL reloads can change a document's element identities.
   // No old observation may be reported as fresh or cached as unchanged.
   slot.lastIndexFingerprint=null;
   throw Error("LIGHTPANDA_INDEX_STALE");
  }
  const projection=projectLightpandaControlIndex(tree,{
   workspaceId,navigationEpoch:generation
  });
  const unchanged=sinceFingerprint!==null&&
   sinceFingerprint===projection.fingerprint&&
   slot.lastIndexFingerprint===projection.fingerprint;
  // Cache only the REDACTED fingerprint in the existing workspace slot.
  // There is no persistent page store, and no executable node handle.
  slot.lastIndexFingerprint=projection.fingerprint;
  return unchanged
   ?{...projection,unchanged:true,content:""}
   :projection;
 }
 async closeWorkspace(workspaceId){
  return this.serial(workspaceId,()=>this.closeWorkspaceInternal(workspaceId));
 }
 async closeWorkspaceInternal(workspaceId){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)return {closed:false};
  this.slots.delete(workspaceId);await slot.context.close();return {closed:true};
 }
 serial(workspaceId,operation){
  if(!ID.test(workspaceId))return Promise.reject(Error("INVALID_WORKSPACE"));
  const previous=this.pending.get(workspaceId)??Promise.resolve();
  const task=previous.catch(()=>{}).then(operation);
  const settled=task.then(()=>{},()=>{});
  this.pending.set(workspaceId,settled);
  void settled.then(()=>{if(this.pending.get(workspaceId)===settled)this.pending.delete(workspaceId)});
  return task;
 }
 async close(){
  this.closing=true;
  if(this.connecting){try{await this.connecting}catch{}}
  await Promise.all([...this.pending.values()]);
  const slots=[...this.slots.keys()];
  for(const id of slots){try{await this.closeWorkspaceInternal(id)}catch{}}
  const browser=this.browser;this.browser=null;
  if(browser)await browser.close();
 }
}
