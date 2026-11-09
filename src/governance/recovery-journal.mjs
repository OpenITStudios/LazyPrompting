import {mkdir,open,readFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const TYPES=new Set(["INTENT_RECORDED","GRANT_RESERVED","CHECKPOINT_RESERVED","DISPATCH_ATTEMPTED","ACK_RECORDED","RESULT_VERIFIED","RECONCILE_REQUIRED"]);
// Append-only single-host journal. A recorded intent is NOT permission to retry.
export class RecoveryJournal {
 constructor(path){if(typeof path!=="string"||!path.trim())throw new Error("JOURNAL_PATH_REQUIRED");this.path=resolve(path);this.lock=this.path+".lock";}
 async append({workspaceId,taskId,type,sourceSha}={}){
  if(!ID.test(workspaceId??"")||!ID.test(taskId??"")||!TYPES.has(type)||
     !/^[a-f0-9]{40}$/.test(sourceSha??""))throw new Error("INVALID_JOURNAL_ENTRY");
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});
  await mkdir(this.lock);
  try{
   const previous=await this.read();
   const sequence=previous.length+1;
   const fd=await open(this.path,"a",0o600);
   try{await fd.writeFile(JSON.stringify({sequence,workspaceId,taskId,type,sourceSha})+"\n");await fd.sync();}
   finally{await fd.close();}
   return {recorded:true,sequence};
  }finally{await import("node:fs/promises").then(fs=>fs.rmdir(this.lock));}
 }
 async read(){
  let data;try{data=await readFile(this.path,"utf8");}
  catch(e){if(e.code==="ENOENT")return [];throw e;}
  if(data.length>4*1024*1024)throw new Error("JOURNAL_CAPACITY");
  if(data&&!data.endsWith("\n"))throw new Error("TORN_JOURNAL_RECORD");
  const entries=data.trim()?data.trimEnd().split("\n").map(x=>JSON.parse(x)):[];
  if(entries.some((e,i)=>e.sequence!==i+1||!ID.test(e.workspaceId??"")||
      !ID.test(e.taskId??"")||!TYPES.has(e.type)||!/^[a-f0-9]{40}$/.test(e.sourceSha??"")))
    throw new Error("CORRUPT_JOURNAL");
  return entries;
 }
 async pending(){
  const records=await this.read(),latest=new Map();
  for(const record of records)latest.set(record.workspaceId+":"+record.taskId,record);
  return [...latest.values()].filter(x=>x.type!=="RESULT_VERIFIED");
 }
}
