import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Only host-verified progress evidence may change counters. No transcript content stored.
export class DurableProgressReview {
 constructor(path){if(typeof path!=="string"||!path.trim())throw Error("PROGRESS_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async read(){
  try{const x=JSON.parse(await readFile(this.path,"utf8"));
   if(x?.schemaVersion!==1||!Array.isArray(x.items)||x.items.length>10||
      x.items.some(i=>![i.workspaceId,i.sessionId,i.responseId].every(v=>ID.test(v??""))||
      !Number.isSafeInteger(i.noProgressCycles)||i.noProgressCycles<0||i.noProgressCycles>3))
    throw Error("CORRUPT_PROGRESS_REVIEW");
   return x;
  }catch(e){if(e.code==="ENOENT")return {schemaVersion:1,items:[]};throw e;}
 }
 async record({workspaceId,sessionId,responseId,verified,progressMade}={}){
  if(![workspaceId,sessionId,responseId].every(x=>ID.test(x??""))||
     verified!==true||typeof progressMade!=="boolean")throw Error("UNVERIFIED_PROGRESS_EVENT");
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});await mkdir(this.lock);
  try{
   const data=await this.read();let item=data.items.find(x=>x.workspaceId===workspaceId);
   if(item&&item.sessionId!==sessionId)throw Error("PROGRESS_SESSION_CHANGED_REVIEW_REQUIRED");
   if(item&&item.responseId===responseId)return {duplicate:true,noProgressCycles:item.noProgressCycles};
   if(!item){if(data.items.length>=10)throw Error("PROGRESS_CAPACITY");item={workspaceId,sessionId,responseId,noProgressCycles:0};data.items.push(item);}
   item.responseId=responseId;item.noProgressCycles=progressMade?0:Math.min(3,item.noProgressCycles+1);
   const tmp=this.path+"."+randomUUID()+".tmp";let fd;
   try{fd=await open(tmp,"wx",0o600);await fd.writeFile(JSON.stringify(data)+"\n");await fd.sync();await fd.close();fd=null;
    await publishStateFile(tmp,this.path);
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return {duplicate:false,noProgressCycles:item.noProgressCycles,reviewRequired:item.noProgressCycles>=3};
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async snapshot(){return (await this.read()).items.map(x=>({workspaceId:x.workspaceId,noProgressCycles:x.noProgressCycles,verified:true}));}
}
