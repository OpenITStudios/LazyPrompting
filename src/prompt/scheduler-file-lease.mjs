import {mkdir,rm} from "node:fs/promises";
import {resolve} from "node:path";
// Single-host exclusive scheduler lock. A stale lock must be reconciled manually.
export function createSchedulerFileLease(path){
 if(typeof path!=="string"||!path.trim())throw new Error("SCHEDULER_LEASE_PATH_REQUIRED");
 const lockPath=resolve(path);
 return async function withSchedulerLease(work){
  if(typeof work!=="function")throw new Error("SCHEDULER_WORK_REQUIRED");
  await mkdir(lockPath);
  try{return await work();}
  finally{await rm(lockPath,{recursive:true,force:true});}
 };
}
