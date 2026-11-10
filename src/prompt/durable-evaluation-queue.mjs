import {mkdir,open,readFile,rename,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Single-host durable evaluation queue. Store response IDs, not transcript contents.
export class DurableEvaluationQueue {
 constructor(path){if(typeof path!=="string"||!path.trim())throw Error("EVALUATION_QUEUE_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async read(){
  try{const x=JSON.parse(await readFile(this.path,"utf8"));
   if(x?.schemaVersion!==1||!Array.isArray(x.items)||x.items.length>1000||
      x.items.some(i=>![i.workspaceId,i.sessionId,i.responseId].every(v=>ID.test(v??""))||
      !["PENDING","EVALUATED"].includes(i.state)))throw Error("CORRUPT_EVALUATION_QUEUE");
   return x;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,items:[]};throw e;}
 }
 async change(fn){
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});await mkdir(this.lock);
  try{const x=await this.read(),result=fn(x),tmp=this.path+"."+randomUUID()+".tmp";let fd;
   try{fd=await open(tmp,"wx",0o600);await fd.writeFile(JSON.stringify(x)+"\n");await fd.sync();await fd.close();fd=null;
    await rename(tmp,this.path);const d=await open(dirname(this.path),"r");try{await d.sync();}finally{await d.close();}
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return result;
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async enqueue({workspaceId,sessionId,responseId}={}){
  if(![workspaceId,sessionId,responseId].every(v=>ID.test(v??"")))throw Error("INVALID_EVALUATION_ID");
  return this.change(x=>{
   const prior=x.items.find(i=>i.workspaceId===workspaceId&&i.responseId===responseId);
   if(prior)return {enqueued:false,state:prior.state};
   if(x.items.length>=1000)throw Error("EVALUATION_QUEUE_FULL");
   x.items.push({workspaceId,sessionId,responseId,state:"PENDING"});
   return {enqueued:true};
  });
 }
 async complete({workspaceId,sessionId,responseId,verified}={}){
  if(verified!==true)throw Error("EVALUATION_NOT_VERIFIED");
  return this.change(x=>{
   const item=x.items.find(i=>i.workspaceId===workspaceId&&i.sessionId===sessionId&&i.responseId===responseId);
   if(!item)throw Error("EVALUATION_NOT_FOUND");
   item.state="EVALUATED";return {completed:true};
  });
 }
 async pending(){return (await this.read()).items.filter(i=>i.state==="PENDING");}
}
