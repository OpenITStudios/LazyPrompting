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
  this.connect=connect;this.browser=null;this.slots=new Map();
 }
 validate(url){
  const u=new URL(url);
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||u.username||u.password||
     !this.allowed.has(u.origin))throw Error("BROWSER_ORIGIN_DENIED");
  return u.toString();
 }
 async start(){
  if(this.browser)throw Error("CDP_ALREADY_CONNECTED");
  const connect=this.connect??(await import("playwright")).chromium.connectOverCDP;
  const browser=await connect(this.endpoint,{timeout:DEFAULT_TIMEOUT});
  if(!browser||typeof browser.contexts!=="function"||typeof browser.close!=="function")throw Error("INVALID_CDP_BROWSER");
  this.browser=browser;
  return {connected:true,identityVerified:false,automationEnabled:false};
 }
 async open(workspaceId,url){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const target=this.validate(url);
  if(!this.browser)throw Error("CDP_NOT_CONNECTED");
  // No implicit session sharing; each workspace owns an isolated context.
  let slot=this.slots.get(workspaceId);
  if(!slot){
   const context=await this.browser.newContext({acceptDownloads:false,serviceWorkers:"block",permissions:[]});
   try{
    await context.route("**/*",route=>{
     try{this.validate(route.request().url());return route.continue()}
     catch{return route.abort()}
    });
    const page=await context.newPage();slot={context,page};this.slots.set(workspaceId,slot);
   }catch(e){await context.close();throw e;}
  }
  await slot.page.goto(target,{waitUntil:"domcontentloaded",timeout:DEFAULT_TIMEOUT});
  return {workspaceId,url:this.validate(slot.page.url())};
 }
 async snapshot(workspaceId){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)throw Error("WORKSPACE_NOT_OPEN");
  return {workspaceId,url:this.validate(slot.page.url()),title:(await slot.page.title()).slice(0,200)};
 }
 async closeWorkspace(workspaceId){
  if(!ID.test(workspaceId))throw Error("INVALID_WORKSPACE");
  const slot=this.slots.get(workspaceId);if(!slot)return {closed:false};
  this.slots.delete(workspaceId);await slot.context.close();return {closed:true};
 }
 async close(){
  const slots=[...this.slots.keys()];
  for(const id of slots){try{await this.closeWorkspace(id)}catch{}}
  const browser=this.browser;this.browser=null;
  if(browser)await browser.close();
 }
}
