import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID,randomBytes,createHash} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const AGENT_PROFILE=/^[a-z][a-z0-9._-]{1,63}$/;
const SHA256=/^[a-f0-9]{64}$/;
const SOURCE_SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const RUN=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/;
const PREVIEW_WORKSPACE=/^workspace-(0[1-9]|10)$/;
const PREVIEW_URL="http://127.0.0.1:1425/browser-preview.html";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NONCE=/^[a-f0-9]{32}$/;
const NONZERO_SHA=/^[a-f0-9]{64}$/;
const browserPending=x=>x.state!=="VERIFIED";
function validBrowserReservation(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||
    Object.keys(x).sort().join(",")!==
    "actionId,documentEpoch,operation,origin,reservationNonce,snapshotFingerprint,state,targetDigest,textDigest,workspaceId")
  return false;
 return UUID.test(x.actionId??"")&&
  PREVIEW_WORKSPACE.test(x.workspaceId??"")&&x.origin===PREVIEW_URL&&
  Number.isSafeInteger(x.documentEpoch)&&x.documentEpoch>=1&&
  NONZERO_SHA.test(x.snapshotFingerprint??"")&&
  x.snapshotFingerprint!=="0".repeat(64)&&
  NONZERO_SHA.test(x.targetDigest??"")&&x.targetDigest!=="0".repeat(64)&&
  NONCE.test(x.reservationNonce??"")&&x.reservationNonce!=="0".repeat(32)&&
  ["CLICK","TYPE_TEXT"].includes(x.operation)&&
  (x.operation==="CLICK" ? x.textDigest===null :
   NONZERO_SHA.test(x.textDigest??"")&&x.textDigest!=="0".repeat(64))&&
  ["RESERVED","DISPATCH_PENDING","RECONCILE_REQUIRED"].includes(x.state);
}
function validExactBrowserActionProof(input){
 return !!(input&&typeof input==="object"&&!Array.isArray(input)&&
  Object.keys(input).sort().join(",")===
   "actionId,documentEpoch,operation,reservationNonce,snapshotFingerprint,targetDigest,textDigest,workspaceId"&&
  UUID.test(input.actionId??"")&&NONCE.test(input.reservationNonce??"")&&
  PREVIEW_WORKSPACE.test(input.workspaceId??"")&&
  Number.isSafeInteger(input.documentEpoch)&&input.documentEpoch>=1&&
  NONZERO_SHA.test(input.snapshotFingerprint??"")&&
  input.snapshotFingerprint!=="0".repeat(64)&&
  NONZERO_SHA.test(input.targetDigest??"")&&
  input.targetDigest!=="0".repeat(64)&&
  ["CLICK","TYPE_TEXT"].includes(input.operation)&&
  (input.operation==="CLICK"?input.textDigest===null:
   NONZERO_SHA.test(input.textDigest??"")&&input.textDigest!=="0".repeat(64)));
}
function matchesExactBrowserAction(x,input){
 return x.actionId===input.actionId&&
  x.reservationNonce===input.reservationNonce&&
  x.workspaceId===input.workspaceId&&
  x.documentEpoch===input.documentEpoch&&
  x.snapshotFingerprint===input.snapshotFingerprint&&
  x.targetDigest===input.targetDigest&&
  x.operation===input.operation&&x.textDigest===input.textDigest;
}
const hash=x=>createHash("sha256").update(x).digest("hex");
const validAgentIntent=x=>{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const keys=Object.keys(x).sort().join(",");
 // Read old V2 intent records safely, but do not upgrade them to run-bound
 // receipts: the controller requires a native runId for any new operation.
 const legacy=keys==="goalId,profileId,scopeHash,sourceSha";
 const current=keys==="goalId,profileId,runId,scopeHash,sourceSha"&&
   RUN.test(x.runId??"")&&x.runId.split(".")[0]===x.goalId;
 return (legacy||current)&&ID.test(x.goalId??"")&&
   AGENT_PROFILE.test(x.profileId??"")&&SHA256.test(x.scopeHash??"")&&
   SOURCE_SHA.test(x.sourceSha??"");
};
// Single-host durable prompt outbox; no network send and no implicit retries.
export class PromptOutbox {
 constructor(path){if(typeof path!=="string"||!path.trim())throw new Error("OUTBOX_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async read(){
  try{
   const data=JSON.parse(await readFile(this.path,"utf8"));
   if(data?.schemaVersion!==1||!Array.isArray(data.items)||data.items.length>1000||
      data.items.some(x=>!x||typeof x!=="object"||
       !ID.test(x.workspaceId??"")||
       (x.state==="SESSION_PENDING"
         ?(x.sessionId!==undefined||!validAgentIntent(x.agentIntent))
         :!ID.test(x.sessionId??""))||
       !ID.test(x.taskId??"")||!ID.test(x.promptId??"")||
       !["SESSION_PENDING","RESERVED","ACKNOWLEDGED","RECONCILE_REQUIRED","RESPONSE_VERIFIED"].includes(x.state)||
       (x.agentIntent!==undefined&&!validAgentIntent(x.agentIntent)))||
      (data.browserActions!==undefined &&
       (!Array.isArray(data.browserActions)||data.browserActions.length>1000||
        data.browserActions.some(x=>!validBrowserReservation(x))||
        new Set(data.browserActions.map(x=>x.actionId)).size!==data.browserActions.length||
        new Set(data.browserActions.map(x=>x.workspaceId)).size!==data.browserActions.length)))
    throw new Error("CORRUPT_PROMPT_OUTBOX");
   // Backward-compatible with files written before this optional type existed.
   return data;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,items:[]};throw e;}
 }
 async transaction(change){
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  await mkdir(this.lock);
  try{
   const state=await this.read();
   if(state.browserActions===undefined)state.browserActions=[];
   const result=change(state);
   const tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);await fd.writeFile(JSON.stringify(state)+"\n");
    await fd.sync();await fd.close();fd=null;await publishStateFile(tmp,this.path);
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return result;
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async reserve({workspaceId,sessionId,taskId,contextRevision,prompt,promptLimit,maxConcurrent=2,singleDispatchPerTask=false}={}){
  if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||
     !Number.isSafeInteger(contextRevision)||contextRevision<0||
     typeof prompt!=="string"||!prompt||prompt.length>12000||
     !Number.isSafeInteger(promptLimit)||promptLimit<1||promptLimit>1000||
     !Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>10)
    throw new Error("INVALID_PROMPT_RESERVATION");
  return this.transaction(state=>{
   // The same durable outbox lock holds prompt dispatch and browser
   // actions. Never run an unacknowledged browser mutation concurrently
   // with a prompt in the same workspace.
   if((state.browserActions??[]).some(x=>x.workspaceId===workspaceId&&browserPending(x)))
    return {reserved:false,reason:"WORKSPACE_BROWSER_ACTION_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if(singleDispatchPerTask===true&&state.items.some(x=>x.workspaceId===workspaceId&&x.taskId===taskId))
    return {reserved:false,reason:"TASK_ALREADY_DISPATCHED"};
   if(state.items.filter(x=>x.workspaceId===workspaceId).length>=promptLimit)
    return {reserved:false,reason:"PROMPT_BUDGET_EXHAUSTED"};
   if(new Set(state.items.filter(x=>x.state!=="RESPONSE_VERIFIED").map(x=>x.workspaceId)).size>=maxConcurrent)
    return {reserved:false,reason:"GLOBAL_CAPACITY_REACHED"};
   if(state.items.length>=1000)throw new Error("OUTBOX_CAPACITY");
   const promptId=randomUUID(),promptHash=hash(prompt);
   state.items.push({workspaceId,sessionId,taskId,contextRevision,promptId,promptHash,state:"RESERVED"});
   return {reserved:true,promptId};
  });
 }
 // V2 session intent uses the existing outbox lock; no second ledger.
 // Persist before opening an external provider session, not only before a turn.
 async reserveAgentIntent({workspaceId,taskId,goalId,runId,profileId,scopeHash,
  sourceSha,contextRevision,prompt,promptLimit,maxConcurrent=2}={}){
  if(![workspaceId,taskId,goalId].every(x=>ID.test(x??""))||
     !RUN.test(runId??"")||runId.split(".")[0]!==goalId||
     !AGENT_PROFILE.test(profileId??"")||!SHA256.test(scopeHash??"")||
     !SOURCE_SHA.test(sourceSha??"")||
     !Number.isSafeInteger(contextRevision)||contextRevision<0||
     typeof prompt!=="string"||!prompt||prompt.length>12000||
     !Number.isSafeInteger(promptLimit)||promptLimit<1||promptLimit>1000||
     !Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>10)
   throw new Error("INVALID_AGENT_INTENT");
  return this.transaction(state=>{
   // The same durable outbox lock holds prompt dispatch and browser
   // actions. Never run an unacknowledged browser mutation concurrently
   // with a prompt in the same workspace.
   if((state.browserActions??[]).some(x=>x.workspaceId===workspaceId&&browserPending(x)))
    return {reserved:false,reason:"WORKSPACE_BROWSER_ACTION_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.taskId===taskId))
    return {reserved:false,reason:"TASK_ALREADY_DISPATCHED"};
   if(state.items.filter(x=>x.workspaceId===workspaceId).length>=promptLimit)
    return {reserved:false,reason:"PROMPT_BUDGET_EXHAUSTED"};
   if(new Set(state.items.filter(x=>x.state!=="RESPONSE_VERIFIED").map(x=>x.workspaceId)).size>=maxConcurrent)
    return {reserved:false,reason:"GLOBAL_CAPACITY_REACHED"};
   if(state.items.length>=1000)throw new Error("OUTBOX_CAPACITY");
   const promptId=randomUUID(),promptHash=hash(prompt);
   state.items.push({workspaceId,taskId,contextRevision,promptId,promptHash,
    state:"SESSION_PENDING",agentIntent:{goalId,runId,profileId,scopeHash,sourceSha}});
   return {reserved:true,promptId};
  });
 }
 async ack({workspaceId,promptId,hostReceipt}={}){
  if(!ID.test(workspaceId??"")||!ID.test(promptId??"")||
     !hostReceipt||typeof hostReceipt!=="object"||
     !ID.test(hostReceipt.responseHandle??""))throw new Error("INVALID_PROMPT_ACK");
  return this.transaction(state=>{
   const item=state.items.find(x=>x.workspaceId===workspaceId&&x.promptId===promptId);
   if(!item||item.state!=="RESERVED")throw new Error("PROMPT_ACK_STATE_MISMATCH");
   item.state="ACKNOWLEDGED";item.responseHandle=hostReceipt.responseHandle;
   return {acknowledged:true};
  });
 }
 async reconcile({workspaceId,promptId,responseId,verified}={}){
  if(!ID.test(workspaceId??"")||!ID.test(promptId??"")||!ID.test(responseId??"")||verified!==true)
   throw new Error("TRUSTED_RESPONSE_REQUIRED");
  return this.transaction(state=>{
   const item=state.items.find(x=>x.workspaceId===workspaceId&&x.promptId===promptId);
   if(!item||item.state!=="ACKNOWLEDGED")throw new Error("RESPONSE_STATE_MISMATCH");
   item.state="RESPONSE_VERIFIED";item.responseId=responseId;
   return {completed:true};
  });
 }
 // B3 browser-action intent uses the EXISTING prompt outbox file,
 // lock, fsync and atomic publication. It is a durable hold only:
 // reserving does not grant any action and never starts a browser.
 // The target digest is an opaque host-calculated identity, not a raw
 // backend node ID or CSS selector. Browser action completion is
 // deliberately unavailable without a verified native receipt owner.
 async reservePreviewActionIntent(input={}){
  // Reject even decorative/forged approval fields. This method persists
  // a hold; it cannot consume a grant or claim action authority.
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!==
      "documentEpoch,operation,snapshotFingerprint,targetDigest,textDigest,workspaceId")
   throw Error("INVALID_BROWSER_ACTION_INTENT");
  const {workspaceId,documentEpoch,snapshotFingerprint,targetDigest,
    operation,textDigest}=input;
  if(!PREVIEW_WORKSPACE.test(workspaceId??"")||
     !Number.isSafeInteger(documentEpoch)||documentEpoch<1||
     !NONZERO_SHA.test(snapshotFingerprint??"")||
     snapshotFingerprint==="0".repeat(64)||
     !NONZERO_SHA.test(targetDigest??"")||targetDigest==="0".repeat(64)||
     !["CLICK","TYPE_TEXT"].includes(operation)||
     (operation==="CLICK" ? textDigest!==null :
       !NONZERO_SHA.test(textDigest??"")||textDigest==="0".repeat(64)))
    throw Error("INVALID_BROWSER_ACTION_INTENT");
  return this.transaction(state=>{
   if(state.items.some(x=>x.workspaceId===workspaceId&&
      x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if((state.browserActions??[]).some(x=>x.workspaceId===workspaceId&&
      browserPending(x)))
    return {reserved:false,reason:"WORKSPACE_BROWSER_ACTION_PENDING"};
   if(state.browserActions.length>=1000)
    throw Error("OUTBOX_CAPACITY");
   const actionId=randomUUID(),reservationNonce=randomBytes(16).toString("hex");
   state.browserActions.push({actionId,reservationNonce,workspaceId,
    origin:PREVIEW_URL,documentEpoch,snapshotFingerprint,targetDigest,
    operation,textDigest,state:"RESERVED"});
   return {reserved:true,actionId,reservationNonce};
  });
 }
 // Exact persisted-record check for a future authenticated native
 // host callback. It proves only that an intent row exists in this file;
 // it does NOT verify actor identity, create an effect grant, or attest QA.
 async matchReservedPreviewAction(input={}){
  if(!validExactBrowserActionProof(input))
   throw Error("INVALID_BROWSER_ACTION_RESERVATION_PROOF");
  const state=await this.read();
  const matches=(state.browserActions??[]).filter(x=>
   matchesExactBrowserAction(x,input)&&x.state==="RESERVED");
  return {matched:matches.length===1,actionAuthorized:false,
   resultVerified:false};
 }
 // A durable pre-effect fence. It does not call CDP or authorize
 // a browser mutation: it makes a second dispatch inadmissible
 // even when the host crashes before observing the effect.
 async sealPreviewActionDispatch(input={}){
  if(!validExactBrowserActionProof(input))
   throw Error("INVALID_BROWSER_ACTION_DISPATCH");
  return this.transaction(state=>{
   const matches=state.browserActions.filter(x=>
    matchesExactBrowserAction(x,input));
   if(matches.length!==1||matches[0].state!=="RESERVED")
    throw Error("BROWSER_ACTION_DISPATCH_ALREADY_HELD");
   matches[0].state="DISPATCH_PENDING";
   return {sealed:true,actionId:matches[0].actionId,
    state:"DISPATCH_PENDING",actionAuthorized:false,
    resultVerified:false};
  });
 }
 // A one-way transition for lost/uncertain native outcomes. It keeps
 // the reservation blocked; no model-provided "success" clears the row.
 // This method remains internal and does not initiate any page action.
 async holdPreviewActionUncertain(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!==
       "actionId,reservationNonce,workspaceId"||
     !UUID.test(input.actionId??"")||
     !NONCE.test(input.reservationNonce??"")||
     !PREVIEW_WORKSPACE.test(input.workspaceId??""))
   throw Error("INVALID_BROWSER_ACTION_HOLD");
  return this.transaction(state=>{
   const item=state.browserActions.find(x=>
    x.actionId===input.actionId&&x.workspaceId===input.workspaceId&&
    x.reservationNonce===input.reservationNonce);
   if(!item)throw Error("BROWSER_ACTION_RESERVATION_NOT_FOUND");
   item.state="RECONCILE_REQUIRED";
   return {held:true,actionId:item.actionId,state:item.state,
    actionAuthorized:false,resultVerified:false};
  });
 }
 // This read does not authorize a mutation or mark its result as verified.
 // A RESERVED or RECONCILE_REQUIRED row survives restart.
 async pendingPreviewActions(workspaceId){
  if(!PREVIEW_WORKSPACE.test(workspaceId??""))
   throw Error("INVALID_WORKSPACE_ID");
  return (await this.read()).browserActions?.filter(x=>
   x.workspaceId===workspaceId&&browserPending(x)).map(x=>({
    actionId:x.actionId,workspaceId:x.workspaceId,
    operation:x.operation,state:x.state
   }))??[];
 }
 async pending(workspaceId){
  if(!ID.test(workspaceId??""))throw new Error("INVALID_WORKSPACE_ID");
  // Compatibility: prompt-only consumers rely on this method even in a
  // catch/failure path. Browser holds use pendingPreviewActions(), and
  // all reserve methods independently refuse overlapping new work.
  return (await this.read()).items.filter(x=>
   x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED");
 }
}
