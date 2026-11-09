import assert from "node:assert/strict";
import {ManagedAgentBackend} from "../src/transport/managed-agent-backend.mjs";
let generation="one",connected=0,closed=0;
const backend=new ManagedAgentBackend({
 probe:async()=>({ready:true,signature:generation}),
 connect:async()=>{connected++;return {observe:async id=>({taskId:id,complete:false}),dispatch:async()=>({receiptId:"ack"})};},
 disconnect:async()=>{closed++;}
});
assert.equal((await backend.observe("task1")).taskId,"task1");
assert.equal(connected,1);
generation="two";
assert.equal((await backend.observe("task1")).complete,false);
assert.equal(connected,2);
assert.equal(closed,1);
await assert.rejects(()=>backend.dispatch({}),/TRUSTED_AUTHORIZATION_RECEIPT_REQUIRED/);
await backend.close();
console.log("Managed agent backend: source test assertions authored");
