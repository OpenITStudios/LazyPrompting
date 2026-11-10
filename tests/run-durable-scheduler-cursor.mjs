import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DurableSchedulerCursor} from "../src/prompt/durable-scheduler-cursor.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-cursor-"));
try{
 const cursor=new DurableSchedulerCursor(join(dir,"cursor.json"));
 assert.equal(await cursor.read(),0);
 assert.equal(await cursor.save({expectedCursor:0,nextCursor:1}),1);
 assert.equal(await cursor.read(),1);
 await assert.rejects(cursor.save({expectedCursor:0,nextCursor:1}),/STALE_SCHEDULER_CURSOR/);
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Durable cursor source scenarios authored, NOT_EXECUTED");
