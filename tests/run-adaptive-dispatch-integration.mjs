import assert from "node:assert/strict";
import {NonblockingDispatchCoordinator} from "../src/prompt/nonblocking-dispatch-coordinator.mjs";
const workspaces=Array.from({length:3},(_,i)=>({workspaceId:"w"+i,sessionId:"s"+i,status:"READY"}));
const signals=workspaces.map(w=>({trusted:true,workspaceId:w.workspaceId,sessionId:w.sessionId,code:"READY",responseTerminal:true,pendingPrompt:false}));
let cursor=0;const sent=[];
const coordinator=new NonblockingDispatchCoordinator({
 withSchedulerLease:async fn=>fn(),readCursor:async()=>cursor,
 saveCursor:async({expectedCursor,nextCursor})=>{assert.equal(cursor,expectedCursor);cursor=nextCursor;},
 readSnapshot:async()=>({workspaces,signals,pending:[]}),
 adaptiveSnapshot:{inspect:async()=>({ready:true,dispatch:[{workspaceId:"w2",sessionId:"s2"}],review:[]})},
 makePlan:async t=>({...t,status:"READY_TO_SEND",taskId:"t",contextRevision:0,prompt:"continue"}),
 dispatchGate:{send:async p=>{sent.push(p.workspaceId);return {status:"SENT"};}}
});
const result=await coordinator.sweep({maxDispatches:2,maxInFlight:3});
assert.equal(result.status,"SWEEP_COMPLETE");
assert.deepEqual(sent,["w2"]);
assert.equal(cursor,1);
console.log("Adaptive dispatch integration source scenarios authored, NOT_EXECUTED");
