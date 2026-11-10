// Demand-driven backend lifecycle. No background heartbeat or mutation replay.
const VALID=new Set(["OFFLINE","PROBING","READY","DEGRADED"]);
export class BackendLifecycle {
 constructor({probe,connect,close,clock=()=>Date.now(),backoff=[250,500,1000,2000]}={}){
  if(typeof probe!=="function"||typeof connect!=="function"||typeof close!=="function"||typeof clock!=="function"||
    !Array.isArray(backoff)||!backoff.length||backoff.some(n=>!Number.isSafeInteger(n)||n<0||n>60000))
    throw new Error("INVALID_BACKEND_CONFIGURATION");
  this.probe=probe;this.connect=connect;this.closeBackend=close;this.clock=clock;this.backoff=backoff;
  this.state="OFFLINE";this.signature=null;this.backend=null;this.failures=0;this.retryAt=0;
  this.pending=null;
 }
 status(){
  return {state:this.state,signature:this.signature,connected:this.state==="READY",retryAt:this.retryAt};
 }
 async ensure(){
  if(this.pending)return this.pending;
  this.pending=this._ensure().finally(()=>{this.pending=null;});
  return this.pending;
 }
 async _ensure(){
  if(this.clock()<this.retryAt)return {ready:false,reason:"BACKOFF",retryAt:this.retryAt};
  this.state="PROBING";
  try{
   const health=await this.probe();
   if(!health||health.ready!==true||typeof health.signature!=="string"||!health.signature||health.signature.length>256)
     throw new Error("BACKEND_UNAVAILABLE");
   if(this.backend&&this.signature===health.signature){
     this.state="READY";this.failures=0;this.retryAt=0;
     return {ready:true,backend:this.backend,signature:this.signature,reused:true};
   }
   // A new generation invalidates old handles, never replays an uncertain operation.
   if(this.backend){await this.closeBackend(this.backend);this.backend=null;this.signature=null;}
   const next=await this.connect(health);
   if(!next)throw new Error("BACKEND_CONNECT_FAILED");
   this.backend=next;this.signature=health.signature;this.state="READY";
   this.failures=0;this.retryAt=0;
   return {ready:true,backend:next,signature:this.signature,reused:false};
  }catch(e){
   this.state="DEGRADED";
   const delay=this.backoff[Math.min(this.failures,this.backoff.length-1)];
   this.failures++;this.retryAt=this.clock()+delay;
   return {ready:false,reason:"BACKEND_UNAVAILABLE",retryAt:this.retryAt};
  }
 }
 async invalidate(){
  if(this.pending)await this.pending;
  if(this.backend)await this.closeBackend(this.backend);
  this.backend=null;this.signature=null;this.state="OFFLINE";this.retryAt=0;this.failures=0;
 }
}
