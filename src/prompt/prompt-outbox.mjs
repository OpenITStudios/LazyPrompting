import {mkdir,open,readFile,rename,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID,createHash} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const hash=x=>createHash("sha256").update(x).digest("hex");
// Single-host durable prompt outbox; no network send and no implicit retries.
export class PromptOutbox {
 constructor(path){if(typeof path!=="string"||!path.trim())throw new Error("OUTBOX_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async read(){
  try{
   const data=JSON.parse(await readFile(this.path,"utf8"));
   if(data?.schemaVersion!==1||!Array.isArray(data.items)||data.items.length>1000||
      data.items.some(x=>!ID.test(x.workspaceId??"")||!ID.test(x.sessionId??"")||
       !ID.test(x.taskId??"")||!ID.test(x.promptId??"")||
       !["RESERVED","ACKNOWLEDGED","RECONCILE_REQUIRED","RESPONSE_VERIFIED"].includes(x.state)))
    throw new Error("CORRUPT_PROMPT_OUTBOX");
   return data;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,items:[]};throw e;}
 }
 async transaction(change){
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  await mkdir(this.lock);
  try{
   const state=await this.read();
   const result=change(state);
   const tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);await fd.writeFile(JSON.stringify(state)+"\n");
    await fd.sync();await fd.close();fd=null;await rename(tmp,this.path);
    const dir=await open(dirname(this.path),"r");try{await dir.sync();}finally{await dir.close();}
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return result;
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async reserve({workspaceId,sessionId,taskId,contextRevision,prompt,promptLimit,maxConcurrent=2}={}){
  if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||
     !Number.isSafeInteger(contextRevision)||contextRevision<0||
     typeof prompt!=="string"||!prompt||prompt.length>12000||
     !Number.isSafeInteger(promptLimit)||promptLimit<1||promptLimit>1000||
     !Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>10)
    throw new Error("INVALID_PROMPT_RESERVATION");
  return this.transaction(state=>{
   if(state.items.some(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED"))
    return {reserved:false,reason:"WORKSPACE_PROMPT_PENDING"};
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
 async pending(workspaceId){
  if(!ID.test(workspaceId??""))throw new Error("INVALID_WORKSPACE_ID");
  return (await this.read()).items.filter(x=>x.workspaceId===workspaceId&&x.state!=="RESPONSE_VERIFIED");
 }
}
