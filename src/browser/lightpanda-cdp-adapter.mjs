// Opt-in CDP adapter. Playwright must be installed separately; never launches a browser.
// Explicitly scoped localhost test pages only. Not a ChatGPT Web transport.
// Index is a read-only Jev-inspired projection; no action execution or new grant.
import {projectLightpandaControlIndex,inspectLightpandaControlIndex,
 reviewLightpandaTarget} from "./lightpanda-control-index.mjs";
import {randomBytes} from "node:crypto";
const ID=/^workspace-(0[1-9]|10)$/;
const DEFAULT_TIMEOUT=8000;
const MAX_INDEX_TIMEOUT=2500;
const DETACH_TIMEOUT=200;
async function detachBounded(session){
 if(!session||typeof session.detach!=="function")return;
 let timer;
 try{
  await Promise.race([
   Promise.resolve().then(()=>session.detach()),
   new Promise(resolve=>{timer=setTimeout(resolve,DETACH_TIMEOUT)})
  ]);
 }catch{/* A failed detach is never a reason to retry an observation. */}
 finally{clearTimeout(timer)}
}
export class LightpandaCdpAdapter {
 constructor({endpoint,allowedOrigins=["http://127.0.0.1:1425"],
  connect=null,indexTimeoutMs=MAX_INDEX_TIMEOUT}={}){
  if(!Number.isSafeInteger(indexTimeoutMs)||indexTimeoutMs<25||
     indexTimeoutMs>MAX_INDEX_TIMEOUT)throw Error("INVALID_INDEX_TIMEOUT");
  this.indexTimeoutMs=indexTimeoutMs;
  const match=/^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(endpoint??"");
  if(!match||Number(match[1])>65535)throw Error("INVALID_CDP_ENDPOINT");
  this.endpoint=endpoint;this.allowed=new Set(allowedOrigins.map(origin=>{
   const u=new URL(origin);
   // This adapter owns ONLY the pinned local preview origin. An injected
   // alternate loopback port can target an unrelated local service.
   if(u.origin!=="http://127.0.0.1:1425"||u.username||u.password||
      u.pathname!=="/"||u.search||u.hash)
    throw Error("INVALID_ALLOWED_ORIGIN");
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
    slot={context,page,generation:0,lastIndexFingerprint:null,
     indexKey:randomBytes(32),eventsWired:false};
    // Source-side freshness guard for the opt-in indexed view. The real
    // Playwright Page reports navigation/load events; a mock/unsupported
    // client lacking them cannot assert a fresh indexed snapshot.
    if(typeof page.on==="function"){
     const invalidate=()=>{
      slot.generation++;
      slot.indexKey=randomBytes(32);
      slot.lastIndexFingerprint=null;
     };
     page.on("framenavigated",invalidate);
     page.on("domcontentloaded",invalidate);
     page.on("load",invalidate);
     page.on("close",invalidate);
     page.on("crash",invalidate);
     slot.eventsWired=true;
    }
    this.slots.set(workspaceId,slot);
   }catch(e){await context.close();throw e;}
  }
  try {
   await slot.page.goto(target,{waitUntil:"domcontentloaded",timeout:DEFAULT_TIMEOUT});
   // Even a same-address explicit reload starts a new observation epoch.
   slot.generation++;
   slot.indexKey=randomBytes(32);
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
 assertLocalPreview(slot){
  const current=this.validate(slot.page.url());
  const parsed=new URL(current);
  if(parsed.pathname!=="/browser-preview.html"||parsed.search||parsed.hash)
   throw Error("BROWSER_NAVIGATION_CHANGED");
  return current;
 }
 // One bounded, read-only CDP session owner shared by index observations
 // and target review. A timed-out session cannot initiate a late read.
 async readIndexedSession(slot,operation){
  let session,timer,timedOut=false;
  try{
   const context=slot.page.context?.();
   if(typeof context?.newCDPSession!=="function")
    throw Error("LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE");
   const request=(async()=>{
    const candidate=await context.newCDPSession(slot.page);
    if(timedOut){await detachBounded(candidate);return null;}
    session=candidate;
    return operation(candidate);
   })();
   return await Promise.race([
    request,
    new Promise((_,reject)=>{timer=setTimeout(()=>{
     timedOut=true;
     reject(Error("LIGHTPANDA_CONTROL_INDEX_TIMEOUT"));
    },this.indexTimeoutMs)})
   ]);
  }catch(error){
   const code=error?.message;
   if(code==="LIGHTPANDA_CONTROL_INDEX_TIMEOUT"||
      code==="LIGHTPANDA_REVIEW_STALE"||
      code==="LIGHTPANDA_REVIEW_TARGET_NOT_FOUND"||
      code==="LIGHTPANDA_REVIEW_ROLE_DENIED"||
      code==="LIGHTPANDA_REVIEW_TARGET_CHANGED"||
      code==="LIGHTPANDA_REVIEW_INPUT_TYPE_DENIED"||
      code==="LIGHTPANDA_INDEX_TRUNCATED"||
      code==="LIGHTPANDA_CONTROL_INDEX_AMBIGUOUS"||
      code==="LIGHTPANDA_CONTROL_INDEX_INVALID")throw error;
   throw Error("LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE");
  }finally{
   clearTimeout(timer);
   await detachBounded(session);
  }
 }
 assertFresh(slot,generation,current){
  if(slot.generation!==generation||slot.page.url()!==current){
   slot.lastIndexFingerprint=null;
   throw Error("LIGHTPANDA_INDEX_STALE");
  }
 }
 async snapshotInternal(workspaceId,view,sinceFingerprint){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)throw Error("WORKSPACE_NOT_OPEN");
  let current;
  try{current=this.assertLocalPreview(slot);}
  catch{
   this.slots.delete(workspaceId);
   try{await slot.context.close()}catch{}
   throw Error("BROWSER_NAVIGATION_CHANGED");
  }
  if(view==="metadata")
   return {workspaceId,url:current,title:(await slot.page.title()).slice(0,200)};
  if(!slot.eventsWired)throw Error("LIGHTPANDA_INDEX_FRESHNESS_UNAVAILABLE");
  const generation=slot.generation;
  const key=slot.indexKey;
  const result=await this.readIndexedSession(slot,session=>
   session.send("LP.getSemanticTree",{format:"text",interactiveOnly:true}));
  this.assertFresh(slot,generation,current);
  const projection=projectLightpandaControlIndex(result?.semanticTree,{
   workspaceId,navigationEpoch:generation,fingerprintKey:key
  });
  // A truncated index cannot prove nothing changed outside its visible set.
  const unchanged=!projection.truncated&&sinceFingerprint!==null&&
   sinceFingerprint===projection.fingerprint&&
   slot.lastIndexFingerprint===projection.fingerprint;
  slot.lastIndexFingerprint=projection.fingerprint;
  return unchanged?{...projection,unchanged:true,content:""}:projection;
 }
 async reviewTarget(workspaceId,proposal={}){
  if(!proposal||typeof proposal!=="object"||Array.isArray(proposal)||
     Object.keys(proposal).sort().join(",")!=="displayIndex,expectedFingerprint,operation")
   throw Error("LIGHTPANDA_REVIEW_INVALID");
  const {expectedFingerprint,displayIndex,operation}=proposal;
  if(!ID.test(workspaceId)||typeof expectedFingerprint!=="string"||
     !/^[a-f0-9]{64}$/.test(expectedFingerprint)||
     !Number.isSafeInteger(displayIndex)||displayIndex<1||
     displayIndex>36||!["CLICK","TYPE_TEXT"].includes(operation))
   throw Error("LIGHTPANDA_REVIEW_INVALID");
  return this.serial(workspaceId,()=>this.reviewTargetInternal(workspaceId,{
   expectedFingerprint,displayIndex,operation
  }));
 }
 async reviewTargetInternal(workspaceId,proposal){
  const slot=this.slots.get(workspaceId);if(!slot)throw Error("WORKSPACE_NOT_OPEN");
  const current=this.assertLocalPreview(slot);
  if(!slot.eventsWired)throw Error("LIGHTPANDA_INDEX_FRESHNESS_UNAVAILABLE");
  // A candidate must originate from this slot's most recent observed
  // fingerprint, not a caller-invented or superseded index.
  if(slot.lastIndexFingerprint!==proposal.expectedFingerprint)
   throw Error("LIGHTPANDA_REVIEW_STALE");
  const generation=slot.generation,key=slot.indexKey;
  // Re-read the exact page, then resolve only the selected private
  // backend ID via LP.getNodeDetails within the SAME CDP session.
  // No click/fill method exists anywhere on this path.
  const reviewed=await this.readIndexedSession(slot,async session=>{
   const result=await session.send("LP.getSemanticTree",{
    format:"text",interactiveOnly:true
   });
   const inspected=inspectLightpandaControlIndex(result?.semanticTree,{
    workspaceId,navigationEpoch:generation,fingerprintKey:key
   });
   if(inspected.projection.truncated)throw Error("LIGHTPANDA_INDEX_TRUNCATED");
   if(inspected.projection.fingerprint!==proposal.expectedFingerprint)
    throw Error("LIGHTPANDA_REVIEW_STALE");
   const target=inspected.targets[proposal.displayIndex-1];
   if(!target)throw Error("LIGHTPANDA_REVIEW_TARGET_NOT_FOUND");
   const response=await session.send("LP.getNodeDetails",{
    backendNodeId:target.backendNodeId
   });
   return reviewLightpandaTarget(inspected,proposal,response?.nodeDetails);
  });
  this.assertFresh(slot,generation,current);
  if(slot.lastIndexFingerprint!==proposal.expectedFingerprint)
   throw Error("LIGHTPANDA_REVIEW_STALE");
  return reviewed;
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
