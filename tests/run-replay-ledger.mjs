import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ReplayLedger} from "../src/governance/replay-ledger.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-ledger-"));
try{
 const path=join(root,"ledger.json");
 const data={key:"g1:t1",goalId:"g1",taskId:"t1",grantId:"grant1",headSha:"a".repeat(40)};
 assert.equal((await new ReplayLedger(path).reserve(data)).reserved,true);
 assert.equal((await new ReplayLedger(path).reserve(data)).reason,"REPLAY_DETECTED");
 assert.equal((await new ReplayLedger(path).reserve({...data,key:"g1:t2",taskId:"t1"})).reason,"REPLAY_DETECTED");
 assert.equal((await new ReplayLedger(path).read()).reservations.length,1);
 console.log("Replay ledger: 4 assertions passed");
}finally{await rm(root,{recursive:true,force:true});}
