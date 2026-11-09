import assert from "node:assert/strict";
import {ReservationVerifier} from "../src/governance/reservation-verifier.mjs";
const head="a".repeat(40);
const receipt={authorized:true,reason:"TRUSTED_SCOPE_RESERVED",grantId:"grant1",
 goalId:"g1",taskId:"t1",repository:"OpenITStudios/LazyPrompting",branch:"Local",
 operation:"agent-dispatch",expectedHead:head};
let revoked=false;
const verifier=new ReservationVerifier({
 ledger:{read:async()=>({reservations:[{key:"grant1:t1",taskId:"t1",goalId:"g1",grantId:"grant1",headSha:head,status:"RESERVED"}]})},
 verifyGrant:async()=>({trusted:true,revoked,goalId:"g1",repository:"OpenITStudios/LazyPrompting",branch:"Local",operations:["agent-dispatch"],expiresAt:2000}),
 readCurrentHead:async()=>head,clock:()=>1000
});
const args={receipt,goalId:"g1",taskId:"t1",repository:receipt.repository,branch:"Local",operation:"agent-dispatch"};
assert.equal(await verifier.verify(args),true);
assert.equal(await verifier.verify({...args,receipt:{...receipt,expectedHead:"b".repeat(40)}}),false);
revoked=true;
assert.equal(await verifier.verify(args),false);
console.log("Reservation verifier: 3 assertions authored, not executed");
