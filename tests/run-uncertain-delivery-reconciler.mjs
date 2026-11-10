import assert from "node:assert/strict";
import {UncertainDeliveryReconciler} from "../src/prompt/uncertain-delivery-reconciler.mjs";
let state="RESERVED",lookups=0,acks=0;
const outbox={pending:async()=>[{workspaceId:"w",sessionId:"s",promptId:"p",state}],
 ack:async()=>{acks++;state="ACKNOWLEDGED";}};
const make=lookupDelivery=>new UncertainDeliveryReconciler({outbox,verifySession:async()=>true,lookupDelivery});
const unknown=await make(async()=>({trusted:true,sessionId:"s",idempotencyKey:"p",status:"NOT_FOUND"})).inspect({workspaceId:"w",sessionId:"s"});
assert.equal(unknown.status,"RECONCILE_REQUIRED");assert.equal(acks,0);
const accepted=await make(async()=>{lookups++;return {trusted:true,sessionId:"s",idempotencyKey:"p",status:"ACCEPTED",responseHandle:"h"};}).inspect({workspaceId:"w",sessionId:"s"});
assert.equal(accepted.status,"ACKNOWLEDGED");assert.equal(acks,1);assert.equal(lookups,1);
console.log("Uncertain delivery reconciliation scenarios authored, NOT_EXECUTED");
