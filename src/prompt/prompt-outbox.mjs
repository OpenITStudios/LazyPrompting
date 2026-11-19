import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {mkdir,open,readFile,rm,lstat,readdir,unlink,rmdir} from "node:fs/promises";
import {dirname,resolve,join} from "node:path";
import {randomUUID,randomBytes,createHash} from "node:crypto";
// The canonical durable outbox contains only bounded metadata/receipts.
// Check before reading or replacing; corrupt/oversized state is never reset.
const MAX_OUTBOX_BYTES=16*1024*1024;
async function readBoundedOutbox(path){
 const fd=await open(path,"r");
 try{
  const info=await fd.stat();
  if(!info.isFile()||info.size>MAX_OUTBOX_BYTES)throw Error("OUTBOX_SIZE_LIMIT");
  // One extra byte detects growth after stat without reading unbounded data.
  const bytes=Buffer.alloc(info.size+1);
  let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await fd.read(bytes,offset,bytes.length-offset,offset);
   if(bytesRead===0)break;
   offset+=bytesRead;
  }
  if(offset>info.size)throw Error("OUTBOX_SIZE_LIMIT");
  return bytes.toString("utf8",0,offset);
 }finally{await fd.close();}
}
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
// Retired API workspace IDs remain readable for compatibility.
const API_WS=/^api-workspace-(0[1-9]|10)$/;
const activePrompt = item => item.state!=="RESPONSE_VERIFIED"&&!API_WS.test(item.workspaceId);
const API_CONV=/^conv_[A-Za-z0-9_-]{1,128}$/;
const API_RESP=/^resp_[A-Za-z0-9_-]{1,128}$/;
const API_MODEL=/^[a-zA-Z][a-zA-Z0-9_.-]{1,79}$/;
const API_RUN_STATES=["PREPARING","RUNNING","REVIEW_REQUIRED","STOPPED","RECONCILE_REQUIRED"];
const API_DECISIONS=[null,"CONTINUE","DONE_PROPOSED","BLOCKED","TURN_LIMIT"];
const apiActive=x=>["PREPARING","RUNNING","RECONCILE_REQUIRED"].includes(x.state);
function validApiRun(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||
  Object.keys(x).sort().join(",")!==
  "conversationId,goalDigest,lastDecision,lastResponseId,maxOutputTokens,maxTotalTokens,maxTurns,model,runId,state,totalTokens,turnCount,workspaceId")return false;
 return UUID.test(x.runId??"")&&API_WS.test(x.workspaceId??"")&&
  NONZERO_SHA.test(x.goalDigest??"")&&x.goalDigest!=="0".repeat(64)&&
  API_MODEL.test(x.model??"")&&API_RUN_STATES.includes(x.state)&&
  Number.isSafeInteger(x.maxTurns)&&x.maxTurns>=1&&x.maxTurns<=5&&
  Number.isSafeInteger(x.maxOutputTokens)&&x.maxOutputTokens>=256&&x.maxOutputTokens<=2048&&
  Number.isSafeInteger(x.maxTotalTokens)&&x.maxTotalTokens>=2048&&x.maxTotalTokens<=80000&&
  Number.isSafeInteger(x.turnCount)&&x.turnCount>=0&&x.turnCount<=x.maxTurns&&
  Number.isSafeInteger(x.totalTokens)&&x.totalTokens>=0&&x.totalTokens<=1000000&&
  (x.conversationId===null||API_CONV.test(x.conversationId??""))&&
  (x.lastResponseId===null||API_RESP.test(x.lastResponseId??""))&&
  API_DECISIONS.includes(x.lastDecision);
}
// A user-clicked ordinary ChatGPT send is never an authenticated turn.
// Persist only digests and opaque IDs; no chat URLs or message bodies.
function validOperatorChatAttempt(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||
    Object.keys(x).sort().join(",")!==
     "attemptId,conversationDigest,promptDigest,state,workspaceId")return false;
 return UUID.test(x.attemptId??"")&&PREVIEW_WORKSPACE.test(x.workspaceId??"")&&
   NONZERO_SHA.test(x.conversationDigest??"")&&
   x.conversationDigest!=="0".repeat(64)&&
   NONZERO_SHA.test(x.promptDigest??"")&&
   x.promptDigest!=="0".repeat(64)&&
   ["ATTEMPT_UNVERIFIED","REVIEWED_UNVERIFIED"].includes(x.state);
}
const operatorChatKey=x=>[x.workspaceId,x.conversationDigest,x.promptDigest].join(":");
const operatorChatPending=x=>x.state==="ATTEMPT_UNVERIFIED";
// Durable *intent only*: neither a ChatGPT send nor an authenticated answer.
const pluginPending=x=>x.state==="RESERVED_UNVERIFIED"||x.state==="RECONCILE_REQUIRED";
function validPluginIntent(x){
 if(!x||typeof x!=="object"||Array.isArray(x)||
   Object.keys(x).sort().join(",")!==
   "bindDigest,claimDigest,conversationDigest,goalDigest,promptDigest,receiptDigest,state,turnId,workspaceId")
  return false;
 return UUID.test(x.turnId??"")&&PREVIEW_WORKSPACE.test(x.workspaceId??"")&&
  pluginPending(x)&&["goalDigest","conversationDigest","promptDigest",
   "bindDigest","claimDigest","receiptDigest"].every(k=>
    NONZERO_SHA.test(x[k]??"")&&x[k]!=="0".repeat(64));
}
// A completed row is safe to exclude from pending only when its received
// response identity is present. Acknowledged rows need a provider handle,
// while earlier RESERVED/SESSION_PENDING/unknown states stay held unchanged.
function validPromptReceipt(x){
 if(["ACKNOWLEDGED","RESPONSE_VERIFIED"].includes(x.state) &&
    (typeof x.responseHandle!=="string"||!ID.test(x.responseHandle)))return false;
 return x.state!=="RESPONSE_VERIFIED"||
  (typeof x.responseId==="string"&&ID.test(x.responseId));
}
function validBrowserReservation(x){
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const keys=Object.keys(x).sort().join(",");
 const pending="actionId,documentEpoch,operation,origin,reservationNonce,snapshotFingerprint,state,targetDigest,textDigest,workspaceId";
 const completed="actionId,documentEpoch,operation,origin,reservationNonce,resultDigest,snapshotFingerprint,state,targetDigest,textDigest,workspaceId";
 if(x.state==="VERIFIED" ? keys!==completed||
  !NONZERO_SHA.test(x.resultDigest??"")||x.resultDigest==="0".repeat(64)
  :keys!==pending)return false;
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
  ["RESERVED","DISPATCH_PENDING","RECONCILE_REQUIRED","VERIFIED"].includes(x.state);
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
   const data=JSON.parse(await readBoundedOutbox(this.path));
   if(data?.schemaVersion!==1||!Array.isArray(data.items)||data.items.length>1000||
      data.items.some(x=>!x||typeof x!=="object"||
       !ID.test(x.workspaceId??"")||
       (x.state==="SESSION_PENDING"
         ?(x.sessionId!==undefined||!validAgentIntent(x.agentIntent))
         :!ID.test(x.sessionId??""))||
       !ID.test(x.taskId??"")||!ID.test(x.promptId??"")||
       !["SESSION_PENDING","RESERVED","ACKNOWLEDGED","RECONCILE_REQUIRED","RESPONSE_VERIFIED"].includes(x.state)||
       (x.agentIntent!==undefined&&!validAgentIntent(x.agentIntent))||
       !validPromptReceipt(x))||
      // A duplicate prompt ID or two unresolved rows for one workspace
      // make acknowledgements ambiguous. Never let such rows release a hold.
      new Set(data.items.map(x=>x.promptId)).size!==data.items.length||
      new Set(data.items.filter(x=>x.state!=="RESPONSE_VERIFIED").map(x=>x.workspaceId)).size!==
       data.items.filter(x=>x.state!=="RESPONSE_VERIFIED").length||
      (data.browserActions!==undefined &&
       (!Array.isArray(data.browserActions)||data.browserActions.length>1000||
        data.browserActions.some(x=>!validBrowserReservation(x))||
        new Set(data.browserActions.map(x=>x.actionId)).size!==data.browserActions.length||
        new Set(data.browserActions.filter(browserPending).map(x=>x.workspaceId)).size!==
          data.browserActions.filter(browserPending).length))||
       (data.operatorChatAttempts!==undefined&&
        (!Array.isArray(data.operatorChatAttempts)||
         data.operatorChatAttempts.length>1000||
         data.operatorChatAttempts.some(x=>!validOperatorChatAttempt(x))||
         new Set(data.operatorChatAttempts.map(x=>x.attemptId)).size!==
          data.operatorChatAttempts.length||
         // Historical REVIEWED_UNVERIFIED rows may repeat exact prompt
         // hashes in later operator-approved turns. Pending rows may not.
         new Set(data.operatorChatAttempts.filter(operatorChatPending).map(x=>x.workspaceId)).size!==
          data.operatorChatAttempts.filter(operatorChatPending).length))||
       (data.chatPluginIntents!==undefined&&
         (!Array.isArray(data.chatPluginIntents)||data.chatPluginIntents.length>1000||
          data.chatPluginIntents.some(x=>!validPluginIntent(x))||
          new Set(data.chatPluginIntents.map(x=>x.turnId)).size!==data.chatPluginIntents.length||
          new Set(data.chatPluginIntents.map(x=>x.workspaceId)).size!==data.chatPluginIntents.length))||
       (data.apiGoalRuns!==undefined&&
        (!Array.isArray(data.apiGoalRuns)||data.apiGoalRuns.length>100||
         data.apiGoalRuns.some(x=>!validApiRun(x))||
         new Set(data.apiGoalRuns.map(x=>x.runId)).size!==data.apiGoalRuns.length||
         new Set(data.apiGoalRuns.filter(apiActive).map(x=>x.workspaceId)).size!==
          data.apiGoalRuns.filter(apiActive).length)))
     throw new Error("CORRUPT_PROMPT_OUTBOX");
   // Backward-compatible with files written before this optional type existed.
   return data;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,items:[]};throw e;}
 }
 // The native host may request a *manual*, operator-approved recovery
 // only when a random owner token matches and its OS process is gone.
 // An old lock without usable metadata remains held, never auto-stolen.
 async inspectInterruptedLock(){
  let dir;
  try{dir=await lstat(this.lock);}
  catch(e){if(e.code==="ENOENT")return {status:"UNLOCKED"};throw e;}
  if(!dir.isDirectory()||dir.isSymbolicLink())
   return {status:"LOCK_UNVERIFIED"};
  const entries=await readdir(this.lock);
  if(entries.length!==1||entries[0]!=="owner.json")
   return {status:"LOCK_UNVERIFIED"};
  const file=join(this.lock,"owner.json");
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size>512)
   return {status:"LOCK_UNVERIFIED"};
  let owner;
  try{owner=JSON.parse(await readFile(file,"utf8"));}
  catch{return {status:"LOCK_UNVERIFIED"};}
  if(!owner||typeof owner!=="object"||Array.isArray(owner)||
     Object.keys(owner).sort().join(",")!=="pid,token,version"||
     owner.version!==1||!Number.isSafeInteger(owner.pid)||
     owner.pid<1||owner.pid>2147483647||!UUID.test(owner.token??""))
   return {status:"LOCK_UNVERIFIED"};
  let alive=true;
  try{process.kill(owner.pid,0);}
  catch(e){if(e.code==="ESRCH")alive=false;}
  return alive?{status:"LOCK_HELD"}:
   {status:"LOCK_STALE_CANDIDATE",ownerToken:owner.token};
 }
 async recoverInterruptedLock({ownerToken}={}){
  if(!UUID.test(ownerToken??""))
   throw Error("OUTBOX_RECOVERY_TOKEN_INVALID");
  const state=await this.inspectInterruptedLock();
  if(state.status!=="LOCK_STALE_CANDIDATE"||
     state.ownerToken!==ownerToken)
   throw Error("OUTBOX_LOCK_NOT_CONFIRMED_STALE");
  // A second inspection and non-recursive removal deny a new/live
  // owner, unexpected entries and an unchanged ambiguous outcome.
  const current=await this.inspectInterruptedLock();
  if(current.status!=="LOCK_STALE_CANDIDATE"||
     current.ownerToken!==ownerToken)
   throw Error("OUTBOX_LOCK_CHANGED");
  await unlink(join(this.lock,"owner.json"));
  await rmdir(this.lock);
  return {recovered:true,actionAuthorized:false,
   resultVerified:false,nextPromptAllowed:false};
 }
 async transaction(change){
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  try{await mkdir(this.lock,{mode:0o700});}
  catch(error){
   // A competing writer or a crash-held lock fails closed.
   // Never auto-retry an operator's unknown ChatGPT send.
   if(error?.code==="EEXIST")throw Error("OUTBOX_LOCK_BUSY");
   throw error;
  }
  let ownerFd;
  try{
   const token=randomUUID();
   ownerFd=await open(join(this.lock,"owner.json"),"wx",0o600);
   await ownerFd.writeFile(JSON.stringify({version:1,pid:process.pid,token})+"\n");
   await ownerFd.sync();
   await ownerFd.close();ownerFd=null;
   const state=await this.read();
   if(state.browserActions===undefined)state.browserActions=[];
   const result=change(state);
   const encoded=JSON.stringify(state)+"\n";
   if(Buffer.byteLength(encoded,"utf8")>MAX_OUTBOX_BYTES)
    throw Error("OUTBOX_SIZE_LIMIT");
   const tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);await fd.writeFile(encoded);
    await fd.sync();await fd.close();fd=null;await publishStateFile(tmp,this.path);
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return result;
  }finally{
   if(ownerFd)await ownerFd.close();
   await rm(this.lock,{recursive:true,force:true});
  }
 }
 async reserve({workspaceId,sessionId,taskId,contextRevision,prompt,promptLimit,maxConcurrent=2,singleDispatchPerTask=false}={}){
  if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||API_WS.test(workspaceId)||
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
   if((state.chatPluginIntents??[]).some(x=>x.workspaceId===workspaceId&&pluginPending(x)))
    return {reserved:false,reason:"WORKSPACE_CHAT_PLUGIN_PENDING"};
   if((state.operatorChatAttempts??[]).some(x=>x.workspaceId===workspaceId&&operatorChatPending(x)))
    return {reserved:false,reason:"WORKSPACE_OPERATOR_CHAT_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if(singleDispatchPerTask===true&&state.items.some(x=>x.workspaceId===workspaceId&&x.taskId===taskId))
    return {reserved:false,reason:"TASK_ALREADY_DISPATCHED"};
   if(state.items.filter(x=>x.workspaceId===workspaceId).length>=promptLimit)
    return {reserved:false,reason:"PROMPT_BUDGET_EXHAUSTED"};
   if(new Set(state.items.filter(activePrompt).map(x=>x.workspaceId)).size>=maxConcurrent)
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
  if(![workspaceId,taskId,goalId].every(x=>ID.test(x??""))||API_WS.test(workspaceId)||
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
   if((state.chatPluginIntents??[]).some(x=>x.workspaceId===workspaceId&&pluginPending(x)))
    return {reserved:false,reason:"WORKSPACE_CHAT_PLUGIN_PENDING"};
   if((state.operatorChatAttempts??[]).some(x=>x.workspaceId===workspaceId&&operatorChatPending(x)))
    return {reserved:false,reason:"WORKSPACE_OPERATOR_CHAT_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.taskId===taskId))
    return {reserved:false,reason:"TASK_ALREADY_DISPATCHED"};
   if(state.items.filter(x=>x.workspaceId===workspaceId).length>=promptLimit)
    return {reserved:false,reason:"PROMPT_BUDGET_EXHAUSTED"};
   if(new Set(state.items.filter(activePrompt).map(x=>x.workspaceId)).size>=maxConcurrent)
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

 // Native host admission only; no public MCP, OAuth, model send or DONE action.
 // Generated private codes are not stored; only SHA-256 digests are persisted.
 async reserveChatPluginIntent(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!=="conversationDigest,goalDigest,promptDigest,workspaceId")
   throw Error("CHAT_PLUGIN_INVALID_INTENT");
  const {workspaceId,goalDigest,conversationDigest,promptDigest}=input;
  if(!PREVIEW_WORKSPACE.test(workspaceId??"")||
    [goalDigest,conversationDigest,promptDigest].some(v=>
      !NONZERO_SHA.test(v??"")||v==="0".repeat(64)))
   throw Error("CHAT_PLUGIN_INVALID_INTENT");
  return this.transaction(state=>{
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if((state.browserActions??[]).some(x=>x.workspaceId===workspaceId&&browserPending(x)))
    return {reserved:false,reason:"WORKSPACE_BROWSER_ACTION_PENDING"};
   if((state.operatorChatAttempts??[]).some(x=>x.workspaceId===workspaceId&&operatorChatPending(x)))
    return {reserved:false,reason:"WORKSPACE_OPERATOR_CHAT_PENDING"};
   if((state.chatPluginIntents??[]).some(x=>x.workspaceId===workspaceId&&pluginPending(x)))
    return {reserved:false,reason:"WORKSPACE_CHAT_PLUGIN_PENDING"};
   if((state.chatPluginIntents??[]).length>=1000)throw Error("OUTBOX_CAPACITY");
   const turnId=randomUUID(),bind=randomBytes(24).toString("hex"),
    claim=randomBytes(24).toString("hex"),receipt=randomBytes(24).toString("hex");
   state.chatPluginIntents=[...(state.chatPluginIntents??[]),{
    turnId,workspaceId,goalDigest,conversationDigest,promptDigest,
    bindDigest:hash(bind),claimDigest:hash(claim),receiptDigest:hash(receipt),
    state:"RESERVED_UNVERIFIED"}];
   return {reserved:true,turnId,bind,claim,receipt,deliveryVerified:false,
    resultVerified:false,nextPromptAllowed:false};
  });
 }
 async holdChatPluginIntent(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).sort().join(",")!=="turnId,workspaceId"||
    !PREVIEW_WORKSPACE.test(input.workspaceId??"")||!UUID.test(input.turnId??""))
   throw Error("CHAT_PLUGIN_INVALID_HOLD");
  return this.transaction(state=>{
   const row=(state.chatPluginIntents??[]).find(x=>
    x.workspaceId===input.workspaceId&&x.turnId===input.turnId);
   if(!row)throw Error("CHAT_PLUGIN_INTENT_NOT_FOUND");
   row.state="RECONCILE_REQUIRED";
   return {held:true,state:row.state,deliveryVerified:false,
    resultVerified:false,nextPromptAllowed:false};
  });
 }
 async pendingChatPluginIntent(workspaceId){
  if(!PREVIEW_WORKSPACE.test(workspaceId??""))
   throw Error("CHAT_PLUGIN_INVALID_WORKSPACE");
  const rows=(await this.read()).chatPluginIntents?.filter(x=>
   x.workspaceId===workspaceId&&pluginPending(x))??[];
  return {workspaceId,active:rows.length,ambiguous:rows.length>1,
   state:rows.length===1?rows[0].state:null,
   deliveryVerified:false,resultVerified:false,nextPromptAllowed:false};
 }
 // Host-owned at-most-once admission for the explicit operator ChatGPT
 // send action. Reservation persists across restart without asserting delivery.
 // A different operator-reviewed prompt remains possible.
 async reserveOperatorChatAttempt(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!==
      "conversationDigest,promptDigest,workspaceId")
   throw Error("INVALID_OPERATOR_CHAT_ATTEMPT");
  const {workspaceId,conversationDigest,promptDigest}=input;
  if(!PREVIEW_WORKSPACE.test(workspaceId??"")||
     !NONZERO_SHA.test(conversationDigest??"")||
     conversationDigest==="0".repeat(64)||
     !NONZERO_SHA.test(promptDigest??"")||
     promptDigest==="0".repeat(64))
   throw Error("INVALID_OPERATOR_CHAT_ATTEMPT");
  return this.transaction(state=>{
   if(state.items.some(x=>x.workspaceId===workspaceId&&
      x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
   if(state.browserActions.some(x=>x.workspaceId===workspaceId&&
      browserPending(x)))
    return {reserved:false,reason:"WORKSPACE_BROWSER_ACTION_PENDING"};
   if((state.chatPluginIntents??[]).some(x=>x.workspaceId===workspaceId&&pluginPending(x)))
    return {reserved:false,reason:"WORKSPACE_CHAT_PLUGIN_PENDING"};
   const attempts=state.operatorChatAttempts??[];
   const active=attempts.filter(x=>x.workspaceId===workspaceId&&operatorChatPending(x));
   const same={workspaceId,conversationDigest,promptDigest};
   if(active.some(x=>operatorChatKey(x)===operatorChatKey(same)))
    return {reserved:false,reason:"OPERATOR_PROMPT_ALREADY_ATTEMPTED"};
   if(active.length)return {reserved:false,reason:"WORKSPACE_OPERATOR_CHAT_PENDING"};
   if(attempts.length>=1000)throw Error("OUTBOX_CAPACITY");
   const attemptId=randomUUID();
   state.operatorChatAttempts=[...attempts,{attemptId,workspaceId,
    conversationDigest,promptDigest,state:"ATTEMPT_UNVERIFIED"}];
   return {reserved:true,attemptId,deliveryVerified:false,
    resultVerified:false,nextPromptAllowed:false};
  });
 }
 // Only the native, operator-pasted manual continuation may review a
 // pending ChatGPT UI attempt. This is NEVER a verified model response.
 async reviewOperatorChatAttempt(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!==
      "conversationDigest,promptDigest,workspaceId")
   throw Error("INVALID_OPERATOR_CHAT_REVIEW");
  const {workspaceId,conversationDigest,promptDigest}=input;
  if(!PREVIEW_WORKSPACE.test(workspaceId??"")||
     !NONZERO_SHA.test(conversationDigest??"")||
     conversationDigest==="0".repeat(64)||
     !NONZERO_SHA.test(promptDigest??"")||
     promptDigest==="0".repeat(64))
   throw Error("INVALID_OPERATOR_CHAT_REVIEW");
  return this.transaction(state=>{
   const pending=(state.operatorChatAttempts??[]).filter(x=>
    x.workspaceId===workspaceId&&operatorChatPending(x));
   if(!pending.length)
    return {reviewed:false,reason:"NO_OPERATOR_CHAT_ATTEMPT",
     resultVerified:false,nextPromptAllowed:false};
   if(pending.length!==1)throw Error("OPERATOR_CHAT_PENDING_AMBIGUOUS");
   const attempt=pending[0];
   if(attempt.conversationDigest!==conversationDigest||
      attempt.promptDigest!==promptDigest)
    throw Error("OPERATOR_CHAT_REVIEW_SCOPE_MISMATCH");
   attempt.state="REVIEWED_UNVERIFIED";
   return {reviewed:true,attemptId:attempt.attemptId,
    state:attempt.state,resultVerified:false,nextPromptAllowed:false};
  });
 }
 async pendingOperatorChatAttempt(workspaceId){
  if(!PREVIEW_WORKSPACE.test(workspaceId??""))
   throw Error("INVALID_OPERATOR_CHAT_WORKSPACE");
  const pending=(await this.read()).operatorChatAttempts?.filter(x=>
   x.workspaceId===workspaceId&&operatorChatPending(x))??[];
  return {workspaceId,active:pending.length,ambiguous:pending.length>1,
   // Private native-only callback fields, never projected to public MCP.
   promptDigest:pending.length===1?pending[0].promptDigest:null,
   conversationDigest:pending.length===1?pending[0].conversationDigest:null,
   deliveryVerified:false,resultVerified:false,nextPromptAllowed:false};
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
   if((state.chatPluginIntents??[]).some(x=>x.workspaceId===workspaceId&&pluginPending(x)))
    return {reserved:false,reason:"WORKSPACE_CHAT_PLUGIN_PENDING"};
   if((state.operatorChatAttempts??[]).some(x=>x.workspaceId===workspaceId&&operatorChatPending(x)))
    return {reserved:false,reason:"WORKSPACE_OPERATOR_CHAT_PENDING"};
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
   if(item.state==="VERIFIED")throw Error("BROWSER_ACTION_ALREADY_VERIFIED");
   item.state="RECONCILE_REQUIRED";
   return {held:true,actionId:item.actionId,state:item.state,
    actionAuthorized:false,resultVerified:false};
  });
 }
 // Only an installed native host request may use this after independent
 // fixed-fixture observation. A digest never authorizes an effect.
 async verifyPreviewActionEffect(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join(",")!=="proof,resultDigest"||
     !validExactBrowserActionProof(input.proof)||
     !NONZERO_SHA.test(input.resultDigest??"")||
     input.resultDigest==="0".repeat(64))
   throw Error("INVALID_BROWSER_ACTION_VERIFICATION");
  return this.transaction(state=>{
   const matches=state.browserActions.filter(x=>matchesExactBrowserAction(x,input.proof));
   if(matches.length!==1||matches[0].state!=="DISPATCH_PENDING")
    throw Error("BROWSER_ACTION_VERIFICATION_STATE_MISMATCH");
   matches[0].state="VERIFIED";
   matches[0].resultDigest=input.resultDigest;
   return {verified:true,actionId:matches[0].actionId,
    state:"VERIFIED",resultVerified:true};
  });
 }
 // This read only projects pending state; it grants no mutation.
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
