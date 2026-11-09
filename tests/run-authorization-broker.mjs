import assert from "node:assert/strict";
import {AuthorizationBroker} from "../src/governance/authorization-broker.mjs";
const head="a".repeat(40);
const used=new Set();
const broker=new AuthorizationBroker({
 replayLedger:{reserve:async ({key})=>{if(used.has(key))return {reserved:false,reason:"REPLAY_DETECTED"};used.add(key);return {reserved:true};}},
 verifyGrant:async id=>({trusted:true,revoked:false,goalId:"G1",repository:"OpenITStudios/LazyPrompting",branch:"Local",operations:["agent-dispatch"],expiresAt:2000}),
 readCurrentHead:async()=>head,clock:()=>1000
});
const request={grantId:"grant1",goalId:"G1",taskId:"task1",repository:"OpenITStudios/LazyPrompting",branch:"Local",expectedHead:head,operation:"agent-dispatch"};
assert.equal((await broker.authorize(request)).authorized,true);
assert.equal((await broker.authorize(request)).reason,"REPLAY_DETECTED");
assert.equal((await broker.authorize({...request,taskId:"task2",branch:"main"})).reason,"INVALID_SCOPE");
assert.equal((await broker.authorize({...request,taskId:"task3",expectedHead:"b".repeat(40)})).reason,"STALE_HEAD");
console.log("Authorization broker source tests: 4 assertions passed");
