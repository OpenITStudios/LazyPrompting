import test from "node:test";
import assert from "node:assert/strict";
import {admitWork,classifyNextStep} from "./work-admission.mjs";
const base={id:"job_1",workspaceId:"workspace-01",authorized:true,transportVerified:true,paused:false,blocked:false,attempts:0,steps:0,tokens:0,elapsedMs:0};
test("valid work admitted without any model invocation",()=>assert.equal(admitWork(base).allowed,true));
for(const [field,value,reason] of [["authorized",false,"NOT_AUTHORIZED"],["transportVerified",false,"TRANSPORT_UNVERIFIED"],["paused",true,"STOPPED"],["blocked",true,"STOPPED"],["attempts",2,"ATTEMPT_BUDGET"],["steps",12,"STEP_BUDGET"],["tokens",12000,"TOKEN_BUDGET"],["elapsedMs",120000,"TIME_BUDGET"],["workspaceId","workspace-11","INVALID_WORKSPACE"],["tokens",-1,"INVALID_USAGE"]]){
 test(`rejects ${field}=${value}`,()=>assert.equal(admitWork({...base,[field]:value}).reason,reason));
}
test("rejects malformed input and limits",()=>{assert.equal(admitWork(null).allowed,false);assert.equal(admitWork(base,{maxAttempts:0,maxSteps:12,maxTokens:100,maxElapsedMs:1000}).reason,"INVALID_LIMITS")});
test("unchanged events do not invoke AI",()=>assert.equal(classifyNextStep({changed:false,requiresReasoning:true}),"SKIP_UNCHANGED"));
test("known actions bypass AI",()=>assert.equal(classifyNextStep({changed:true,knownAction:true,requiresReasoning:true}),"DETERMINISTIC"));
test("unknown work requires review",()=>assert.equal(classifyNextStep({changed:true}),"REVIEW_REQUIRED"));
