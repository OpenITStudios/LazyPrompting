import assert from "node:assert/strict";
import {createSchedulerFileLease} from "../src/prompt/scheduler-file-lease.mjs";
import {NonblockingDispatchCoordinator} from "../src/prompt/nonblocking-dispatch-coordinator.mjs";
const lease=createSchedulerFileLease("/tmp/lazyprompting-scheduler-test-lock");
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
assert.equal((await coordinator.sweep()).status,"SWEEP_COMPLETE");
assert.equal(cursor,1);
console.log("Scheduler lease source scenarios authored, NOT_EXECUTED");
