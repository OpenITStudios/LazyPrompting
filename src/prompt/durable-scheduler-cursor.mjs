import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
// Single-host durable cursor. Must be called under exclusive scheduler lease.
export class DurableSchedulerCursor {
 constructor(path){if(typeof path!=="string"||!path.trim())throw new Error("CURSOR_PATH_REQUIRED");this.path=resolve(path);}
 async read(){
  try{const x=JSON.parse(await readFile(this.path,"utf8"));
   if(x?.schemaVersion!==1||!Number.isSafeInteger(x.cursor)||x.cursor<0)throw Error("CORRUPT_SCHEDULER_CURSOR");
   return x.cursor;
  }catch(e){if(e.code==="ENOENT")return 0;throw e;}
 }
 async save({expectedCursor,nextCursor}={}){
  if(!Number.isSafeInteger(expectedCursor)||expectedCursor<0||
     !Number.isSafeInteger(nextCursor)||nextCursor!==expectedCursor+1)
   throw Error("INVALID_CURSOR_TRANSITION");
  const actual=await this.read();
  if(actual!==expectedCursor)throw Error("STALE_SCHEDULER_CURSOR");
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  const tmp=this.path+"."+randomUUID()+".tmp";let fd;
  try{
   fd=await open(tmp,"wx",0o600);
   await fd.writeFile(JSON.stringify({schemaVersion:1,cursor:nextCursor})+"\n");
   await fd.sync();await fd.close();fd=null;
   await publishStateFile(tmp,this.path);
  }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
  return nextCursor;
 }
}
