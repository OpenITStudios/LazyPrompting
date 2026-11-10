import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSchedulerFileLease} from "../src/prompt/scheduler-file-lease.mjs";
import {NonblockingDispatchCoordinator} from "../src/prompt/nonblocking-dispatch-coordinator.mjs";
const directory=await mkdtemp(join(tmpdir(),"lazyprompting-scheduler-test-"));
const lease=createSchedulerFileLease(join(directory,"lock"));
const workspaces=[{workspaceId:"w1",sessionId:"s1",status:"READY"}];
const signals=[{trusted:true,workspaceId:"w1",sessionId:"s1",code:"READY",responseTerminal:true,pendingPrompt:false}];
let cursor=0;
const coordinator=new NonblockingDispatchCoordinator({
 withSchedulerLease:lease,
 readSnapshot:async()=>({workspaces,signals,pending:[]}),
 readCursor:async()=>cursor,
 saveCursor:async({expectedCursor,nextCursor})=>{assert.equal(expectedCursor,cursor);cursor=nextCursor;},
 makePlan:async t=>({...t,status:"READY_TO_SEND",taskId:"t1",contextRevision:0,prompt:"continue"}),
 dispatchGate:{send:async()=>({status:"SENT"})}
});
try {
 assert.equal((await coordinator.sweep()).status,"SWEEP_COMPLETE");
 assert.equal(cursor,1);
} finally {
 await rm(directory,{recursive:true,force:true});
}
console.log("Scheduler lease scenario passed");
