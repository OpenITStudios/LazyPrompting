// Opt-in CDP adapter. Playwright must be installed separately; never launches a browser.
// Explicitly scoped localhost test pages only. Not a ChatGPT Web transport.
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
    slot={context,page};this.slots.set(workspaceId,slot);
   }catch(e){await context.close();throw e;}
  }
  try {
   await slot.page.goto(target,{waitUntil:"domcontentloaded",timeout:DEFAULT_TIMEOUT});
   const actual=this.validate(slot.page.url());
   if(actual!==target)throw Error("BROWSER_NAVIGATION_CHANGED");
   return {workspaceId,url:actual};
  } catch(e) {
   this.slots.delete(workspaceId);
   try{await slot.context.close()}catch{}
   throw e;
  }
 }
 async snapshot(workspaceId){
  return this.serial(workspaceId,()=>this.snapshotInternal(workspaceId));
 }
 async snapshotInternal(workspaceId){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)throw Error("WORKSPACE_NOT_OPEN");
  return {workspaceId,url:this.validate(slot.page.url()),title:(await slot.page.title()).slice(0,200)};
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
