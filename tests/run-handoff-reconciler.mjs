import assert from "node:assert/strict";
import {HandoffReconciler} from "../src/prompt/handoff-reconciler.mjs";
const entry={workspaceId:"w1",handoffId:"h1",oldSessionId:"s1",contextRevision:2,
 capsuleHash:"a".repeat(64),status:"RESERVED"};
let workspace={workspaceId:"w1",sessionId:"s1",contextRevision:2,status:"PAUSED"};
let switches=0,activations=0,lookups=0;
const reconciler=new HandoffReconciler({
 registry:{read:async()=>({version:1,workspaces:[workspace]}),switchSession:async()=>{switches++;return {ok:true};}},
 ledger:{read:async()=>({entries:[entry]}),activate:async()=>{activations++;}},
 lookupSession:async()=>{lookups++;return {found:true,sessionId:"s2"};},
 verifySession:async()=>({trusted:true,workspaceId:"w1",sessionId:"s2",handoffId:"h1",capsuleHash:"a".repeat(64),contextAccepted:true})
});
assert.equal((await reconciler.reconcile("w1")).status,"HANDOFF_COMPLETE_PAUSED");
assert.equal(switches,1);assert.equal(activations,1);assert.equal(lookups,1);
workspace={...workspace,sessionId:"s2",contextRevision:3,previousSessions:["s1"]};
assert.equal((await reconciler.reconcile("w1")).status,"HANDOFF_COMPLETE_PAUSED");
assert.equal(switches,1);assert.equal(activations,2);
console.log("Handoff reconciler tests authored, NOT_EXECUTED");
