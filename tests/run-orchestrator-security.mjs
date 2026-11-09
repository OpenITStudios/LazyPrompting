import assert from "node:assert/strict";
import {SupervisorOrchestrator} from "../src/supervisor/orchestrator.mjs";
const base={goal:{id:"G1",repository:"OpenITStudios/LazyPrompting",branch:"Local",allowedActions:["Improve validator"],preserve:[],maxIterations:10,maxMinutes:60,maxModelTokens:1000},
 observation:{resultId:"r2",taskId:"t2",complete:true,headSha:"a".repeat(40),outcome:"CONTINUE",nextAction:{action:"Improve validator",owner:"supervisor",proof:"exact QA"}},
 checkpoint:{goalId:"G1",goalHash:"h1",version:1,phase:"READY",iteration:1,elapsedMinutes:1,modelTokensUsed:0,noProgress:0,transportApproved:true}};
let dispatched=0,reserved=0,authorized=false;
const adapter={dispatch:async()=>{dispatched++;return {receiptId:"ack1"};}};
const store={apply:async()=>{reserved++;return {ok:true,checkpoint:{version:2}};}};
const evidence={reconcile:async()=>({verified:true,repository:base.goal.repository,branch:"Local",headSha:"a".repeat(40),qa:"PASS",changed:false,acceptancePassed:false})};
const orchestrator=new SupervisorOrchestrator({checkpointStore:store,evidenceProvider:evidence,agentAdapter:adapter,
 authorizeDispatch:async()=>authorized?{authorized:true,taskId:"t3"}:{authorized:false,reason:"NO_GRANT"}});
const request={...base,taskId:"t3",grantId:"grant1"};
assert.equal((await orchestrator.reserveAndDispatch(request)).status,"NOT_DISPATCHED");
assert.equal(dispatched,0);
assert.equal(reserved,0);
authorized=true;
assert.equal((await orchestrator.reserveAndDispatch(request)).status,"DISPATCHED");
assert.equal(dispatched,1);
console.log("Orchestrator security: source assertions authored");
