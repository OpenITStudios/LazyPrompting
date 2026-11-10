import {getCapability,searchCapabilities} from "./capability-registry.mjs";
import {evaluateContinuation} from "../supervisor/decision-engine.mjs";
import {RemoteBrowser} from "../browser/remote-browser.mjs";
import {validateInput} from "./input-validation.mjs";

const ok=(data)=>({status:"OK",structuredContent:data});
const fail=(code)=>({status:"ERROR",code});
export class CapabilityRouter {
 constructor({checkpointStore=null,browserOrigins=[],lightpanda=null,nativeAdmission=null}={}){
  this.store=checkpointStore;
  this.lightpanda=lightpanda;
  this.nativeAdmission=nativeAdmission;
  this.lightpandaInFlight=new Set();
  this.lightpandaPending=new Set();
  this.lightpandaClosePromise=null;
  this.lightpandaClosed=false;
  this.browser=browserOrigins.length?new RemoteBrowser({allowedOrigins:browserOrigins}):null;
  this.enabled=new Set(["gateway","supervisor",...(checkpointStore?["checkpoint"]:[]),...(this.browser?["browser"]:[]),...(lightpanda&&typeof nativeAdmission==="function"?["lightpanda"]:[])]);
 }
 status(){return ok({gateway:"READY",mode:"READ_ONLY",capabilityCount:[...["supervisor.status","supervisor.evaluate","checkpoint.read","browser.open","browser.snapshot","browser.close","lightpanda.open","lightpanda.snapshot","lightpanda.close"]].filter(name=>this.enabled.has(getCapability(name).backend)).length,backends:{supervisor:"READY",checkpoint:this.store?"CONFIGURED":"UNAVAILABLE",browser:this.browser?"CONFIGURED_NOT_STARTED":"DISABLED",lightpanda:this.enabled.has("lightpanda")?"ADMISSION_REQUIRED":"DISABLED",agent:"NOT_CONNECTED"},dispatch:"DISABLED"});}
 search(query,limit=4){return ok({results:searchCapabilities(query,{limit,enabled:this.enabled})});}
 describe(name){
  const c=getCapability(name);
  if(!c)return fail("UNKNOWN_CAPABILITY");
  return ok({name:c.name,tier:c.tier,description:c.description,inputSchema:c.inputSchema,effect:c.effect,readiness:this.enabled.has(c.backend)?"AVAILABLE":"DISABLED"});
 }
 async invoke(name,args={}){
  const c=getCapability(name);
  if(!c)return fail("UNKNOWN_CAPABILITY");
  if(!this.enabled.has(c.backend))return fail("CAPABILITY_DISABLED");
  if(!args||typeof args!=="object"||Array.isArray(args))return fail("INVALID_ARGUMENTS");
  if(!validateInput(c.inputSchema,args))return fail("INVALID_ARGUMENTS");
  try{
   if(c.backend==="lightpanda"){
    if(this.lightpandaClosed)return fail("GATEWAY_CLOSED");
    const slot=args.workspaceId;
    if(this.lightpandaInFlight.has(slot))return fail("WORKSPACE_BUSY");
    this.lightpandaInFlight.add(slot);
    let releasePending;
    const settled=new Promise(resolve=>{releasePending=resolve});
    this.lightpandaPending.add(settled);
    try {
    // Renderer flags are never authorization. Only a host-owned callback may admit.
    const admission=await this.nativeAdmission?.({capability:name,workspaceId:args.workspaceId,url:args.url??null});
    if(this.lightpandaClosed)return fail("GATEWAY_CLOSED");
    if(!admission||admission.allowed!==true||admission.source!=="NATIVE_HOST"||admission.scopeVerified!==true)return fail("NATIVE_ADMISSION_REQUIRED");
    if(name==="lightpanda.open"){
      this.lightpanda.validate(args.url);
      if(!this.lightpanda.browser)await this.lightpanda.start();
      return ok(await this.lightpanda.open(args.workspaceId,args.url));
    }
    if(name==="lightpanda.snapshot")return ok(await this.lightpanda.snapshot(args.workspaceId));
    if(name==="lightpanda.close")return ok(await this.lightpanda.closeWorkspace(args.workspaceId));
    } finally {this.lightpandaInFlight.delete(slot);this.lightpandaPending.delete(settled);releasePending()}
   }
   switch(name){
    case "supervisor.status":return this.status();
    case "supervisor.evaluate":return ok(evaluateContinuation(args.input));
    case "checkpoint.read":return ok(await this.store.recovery());
    case "browser.open":{
      if(typeof args.url!=="string")return fail("INVALID_ARGUMENTS");
      // Validate before launching a browser or creating any network-capable process.
      await this.browser.validate(args.url);
      if(!this.browser.page)await this.browser.start();
      return ok(await this.browser.navigate(args.url));
    }
    case "browser.snapshot":return ok(await this.browser.snapshot());
    case "browser.close":await this.browser.close();return ok({closed:true});
    default:return fail("UNREGISTERED_CAPABILITY");
   }
  }catch(e){return fail(String(e?.message??"EXECUTION_FAILED").slice(0,160));}
 }
 async close(){
  if(this.lightpandaClosePromise)return this.lightpandaClosePromise;
  this.lightpandaClosed=true;
  this.lightpandaClosePromise=(async()=>{
   await Promise.all([...this.lightpandaPending]);
   try{await this.browser?.close()}finally{await this.lightpanda?.close()}
  })();
  return this.lightpandaClosePromise;
 }
}
