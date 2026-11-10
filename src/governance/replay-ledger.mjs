import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";

// Single-host durable reservation ledger. A reservation is consumed BEFORE an external effect.
export class ReplayLedger {
  constructor(path){
    if(typeof path!=="string"||!path.trim())throw new Error("LEDGER_PATH_REQUIRED");
    this.path=resolve(path);this.lock=this.path+".lock";
  }
  async read(){
    try{
      const value=JSON.parse(await readFile(this.path,"utf8"));
      if(!value||value.schemaVersion!==1||!Array.isArray(value.reservations))throw new Error("CORRUPT_LEDGER");
      return value;
    }catch(e){if(e?.code==="ENOENT")return {schemaVersion:1,reservations:[]};throw e;}
  }
  async reserve({key,goalId,taskId,grantId,headSha}){
    if(!/^[A-Za-z0-9:_-]{1,260}$/.test(key??"")||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(goalId??"")||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??"")||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(grantId??"")||
       !/^[a-f0-9]{40}$/.test(headSha??""))throw new Error("INVALID_RESERVATION");
    await mkdir(dirname(this.path),{recursive:true});
    await mkdir(this.lock); // fail closed on contention or stale lock; never steal
    try{
      const ledger=await this.read();
      if(ledger.reservations.some(r=>r.key===key||r.taskId===taskId))
        return {reserved:false,reason:"REPLAY_DETECTED"};
      if(ledger.reservations.length>=10000)throw new Error("LEDGER_CAPACITY_REACHED");
      ledger.reservations.push({key,goalId,taskId,grantId,headSha,status:"RESERVED"});
      const tmp=this.path+"."+randomUUID()+".tmp";
      let handle;
      try{
        handle=await open(tmp,"wx",0o600);
        await handle.writeFile(JSON.stringify(ledger)+"\n");
        await handle.sync();
        await handle.close();handle=null;
        await publishStateFile(tmp,this.path);
      }finally{if(handle)await handle.close();await rm(tmp,{force:true});}
      return {reserved:true,reason:"DURABLE_RESERVATION_RECORDED"};
    }finally{await rm(this.lock,{recursive:true,force:true});}
  }
}
