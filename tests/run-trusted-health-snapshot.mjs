import assert from "node:assert/strict";
import {TrustedHealthSnapshot} from "../src/prompt/trusted-health-snapshot.mjs";
const workspaces=Array.from({length:4},(_,i)=>({workspaceId:"w"+i,sessionId:"s"+i,status:"READY"}));
const monitor=new TrustedHealthSnapshot({
 readWorkspaces:async()=>workspaces,
 readSignals:async()=>workspaces.map(w=>({trusted:true,workspaceId:w.workspaceId,sessionId:w.sessionId,code:"READY",responseTerminal:true,pendingPrompt:false})),
 readOutbox:async()=>[]
});
const first=await monitor.inspect({cursor:0,maxActive:2});
const second=await monitor.inspect({cursor:first.nextCursor,maxActive:2});
assert.deepEqual(first.actions.filter(a=>a.action==="PLAN_NEXT").map(a=>a.workspaceId),["w0","w1"]);
assert.deepEqual(second.actions.filter(a=>a.action==="PLAN_NEXT").map(a=>a.workspaceId),["w2","w3"]);
const bad=new TrustedHealthSnapshot({readWorkspaces:async()=>workspaces,readSignals:async()=>{throw Error("offline");},readOutbox:async()=>[]});
assert.equal((await bad.inspect()).ready,false);
console.log("Trusted health snapshot scenarios authored, NOT_EXECUTED");
