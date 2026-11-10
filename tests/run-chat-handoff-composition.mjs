import assert from "node:assert/strict";
import {HandoffCoordinator} from "../src/prompt/handoff-coordinator.mjs";
import {classifySessionHealth} from "../src/prompt/session-health.mjs";
const workspace={workspaceId:"w1",sessionId:"s1",taskIds:["t1"],contextRevision:2,status:"PAUSED"};
const context={workspaceId:"w1",sessionId:"s1",taskId:"t1",contextRevision:2,goal:"Continue project",nextAction:"Inspect last work"};
let sent=null;
const coordinator=new HandoffCoordinator({
 registry:{read:async()=>({version:1,workspaces:[workspace]}),switchSession:async()=>({ok:true})},
 ledger:{reserve:async()=>({reserved:true,handoffId:"h1"}),activate:async()=>({activated:true})},
 outbox:{pending:async()=>[]},
 createSession:async args=>{sent=args;return {sessionId:"s2"};},
 verifyNewSession:async()=>({trusted:true,workspaceId:"w1",sessionId:"s2",contextRevision:2,contextAccepted:true})
});
assert.equal((await coordinator.begin({workspaceId:"w1",context})).status,"HANDOFF_COMPLETE_PAUSED");
assert.match(sent.bootstrapPrompt,/Continue the same work/);
assert.doesNotMatch(sent.bootstrapPrompt,/Checkpoint commit:/);
assert.equal(classifySessionHealth({workspaceId:"w1",sessionId:"s1",hostSignal:{trusted:true,workspaceId:"w1",sessionId:"s1",code:"CONTEXT_EXHAUSTED"}}).action,"PREPARE_HANDOFF");
assert.equal(classifySessionHealth({workspaceId:"w1",sessionId:"s1",hostSignal:{trusted:true,workspaceId:"w1",sessionId:"s1",code:"RATE_LIMITED"}}).action,"WAIT");
assert.equal(classifySessionHealth({workspaceId:"w1",sessionId:"s1",hostSignal:{trusted:false,code:"READY"}}).action,"PAUSE");
console.log("Chat handoff composition assertions authored, NOT_EXECUTED");
