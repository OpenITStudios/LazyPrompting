import assert from "node:assert/strict";
import {NonblockingDispatchCoordinator} from "../src/prompt/nonblocking-dispatch-coordinator.mjs";
const workspaces=Array.from({length:3},(_,i)=>({workspaceId:"w"+i,sessionId:"s"+i,status:"READY"}));
const signals=workspaces.map(w=>({trusted:true,workspaceId:w.workspaceId,sessionId:w.sessionId,code:"READY",responseTerminal:true,pendingPrompt:false}));
let cursor=0,called=[];
const coordinator=new NonblockingDispatchCoordinator({
 withSchedulerLease:async work=>work(),
 readSnapshot:async()=>({workspaces,signals,pending:[]}),
 readCursor:async()=>cursor,
 saveCursor:async({expectedCursor,nextCursor})=>{assert.equal(expectedCursor,cursor);cursor=nextCursor;},
 makePlan:async t=>({...t,status:"READY_TO_SEND",taskId:"task",contextRevision:0,prompt:"continue"}),
 dispatchGate:{send:async p=>{called.push(p.workspaceId);return {status:"SENT"};}}
});
const result=await coordinator.sweep({maxDispatches:2,maxInFlight:3});
assert.equal(result.status,"SWEEP_COMPLETE");
assert.deepEqual(called,["w0","w1"]);
assert.equal(cursor,2);
console.log("Nonblocking dispatch coordinator source scenarios authored, NOT_EXECUTED");
