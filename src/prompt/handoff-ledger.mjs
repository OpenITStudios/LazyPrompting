import {mkdir,open,readFile,rename,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Durable single-host handoff state. No deletion of prior chat sessions.
export class HandoffLedger {
 constructor(path){if(typeof path!=="string"||!path.trim())throw new Error("HANDOFF_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async read(){
  try{
   const x=JSON.parse(await readFile(this.path,"utf8"));
   if(x?.schemaVersion!==1||!Array.isArray(x.entries)||x.entries.length>1000)
    throw new Error("CORRUPT_HANDOFF_LEDGER");
   return x;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,entries:[]};throw e;}
 }
 async change(fn){
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  await mkdir(this.lock);
  try{
   const data=await this.read(),result=fn(data),tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);await fd.writeFile(JSON.stringify(data)+"\n");
    await fd.sync();await fd.close();fd=null;await rename(tmp,this.path);
    const dir=await open(dirname(this.path),"r");try{await dir.sync();}finally{await dir.close();}
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return result;
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async reserve({workspaceId,oldSessionId,contextRevision,capsuleHash}={}){
  if(!ID.test(workspaceId??"")||!ID.test(oldSessionId??"")||
     !Number.isSafeInteger(contextRevision)||contextRevision<0||
     !/^[a-f0-9]{64}$/.test(capsuleHash??""))throw new Error("INVALID_HANDOFF_RESERVATION");
  return this.change(x=>{
   if(x.entries.some(e=>e.workspaceId===workspaceId&&e.status!=="ACTIVATED"))
    return {reserved:false,reason:"HANDOFF_ALREADY_PENDING"};
   const handoffId=randomUUID();
   x.entries.push({handoffId,workspaceId,oldSessionId,contextRevision,capsuleHash,status:"RESERVED",oldSessionDisposition:"RETAIN_ARCHIVED"});
   return {reserved:true,handoffId};
  });
 }
 async activate({handoffId,workspaceId,newSessionId,verified}={}){
  if(!ID.test(handoffId??"")||!ID.test(workspaceId??"")||
     !ID.test(newSessionId??"")||verified!==true)throw new Error("INVALID_HANDOFF_ACTIVATION");
  return this.change(x=>{
   const entry=x.entries.find(e=>e.handoffId===handoffId&&e.workspaceId===workspaceId);
   if(!entry||entry.status!=="RESERVED"||entry.oldSessionId===newSessionId||
      x.entries.some(e=>e.workspaceId!==workspaceId&&e.newSessionId===newSessionId))
    throw new Error("HANDOFF_ACTIVATION_CONFLICT");
   entry.status="ACTIVATED";entry.newSessionId=newSessionId;
   return {activated:true,oldSessionDisposition:"RETAIN_ARCHIVED"};
  });
 }
}
