import assert from "node:assert/strict";
import {TrustedAdaptiveSnapshot} from "../src/prompt/trusted-adaptive-snapshot.mjs";
const workspaces=Array.from({length:3},(_,i)=>({workspaceId:"w"+i,sessionId:"s"+i,status:"READY"}));
const signals=workspaces.map(w=>({trusted:true,workspaceId:w.workspaceId,sessionId:w.sessionId,code:"READY",responseTerminal:true,pendingPrompt:false}));
const snapshot=new TrustedAdaptiveSnapshot({
 readWorkspaces:async()=>workspaces,readSignals:async()=>signals,readOutbox:async()=>[],
 readEvents:async()=>[{trusted:true,workspaceId:"w2",sessionId:"s2",type:"SESSION_READY"}],
 progressStore:{snapshot:async()=>[{workspaceId:"w0",verified:true,noProgressCycles:3}]},
 readCursor:async()=>0
});
const result=await snapshot.inspect({maxDispatches:2});
assert.equal(result.ready,true);
assert.equal(result.dispatch[0].workspaceId,"w2");
assert.ok(result.review.some(x=>x.workspaceId==="w0"));
console.log("Trusted adaptive snapshot source scenarios authored, NOT_EXECUTED");
