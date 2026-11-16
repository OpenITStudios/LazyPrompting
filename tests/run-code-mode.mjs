import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {prepareManualHandoff,projectManualHandoffReceipt,
 validateManualHandoffArguments,continueManualHandoff,
 validateManualContinuationArguments} from "../src/gateway/native-effect-broker.mjs";
import {CapabilityRouter,projectCheckpointSummary} from "../src/gateway/capability-router.mjs";
import {codeModeCatalog,executeCodeMode,validateCodeModeApiGoalStatus,
  validateNativeCodeModeGoal,validateNativeCodeModeBrowser,
 validateNativeCodeModeAgent,validateNativeCodeModeEffectPolicy,
 validateNativeCodeModeReceipt,
 validateNativeCodeModeRepository,validateNativeCodeModeCatalog,
 validateNativeCodeModeHandoff}
 from "../src/gateway/code-mode-runtime.mjs";

const gateway = new CapabilityRouter();
const catalog = (await gateway.invoke("code_mode.catalog")).structuredContent;
assert.equal(catalog.engine,"CONFINED_JS_READ_ONLY");
assert.equal(catalog.catalogScope,"NODE_GATEWAY");
assert.deepEqual(catalog.capabilities.map(x=>x.name),
 ["supervisor.status","supervisor.evaluate"]);
assert.equal(codeModeCatalog().maxToolCalls,8);
assert.deepEqual(catalog.builtins.map(x=>x.name),
 ["capabilities.search","capabilities.describe","goal.status","workspace.location",
  "goal.report","goal.receipt","api_goal.status","agent.status","agent.effect_policy",
  "checkpoint.summary",
  "repo.status","capabilities.native","handoff.reconcile","handoff.prepare","handoff.continue"]);
assert.equal(gateway.describe("capabilities.search").code,"UNKNOWN_CAPABILITY");
async function run(code) {
  return gateway.invoke("code_mode.execute",{code});
}
const composed=await run([
 "const first = await tools.supervisor.status();",
 "const second = await tools.supervisor.evaluate({input:{}});",
 "return {gateway:first.gateway, hasSecond:second !== null};"
].join("\n"));
assert.equal(composed.status,"OK",JSON.stringify(composed));
assert.equal(composed.structuredContent.value.gateway,"READY");
assert.equal(composed.structuredContent.value.hasSecond,true);
assert.equal(composed.structuredContent.toolCalls,2);

const discovery=await run([
 "const found=await tools.capabilities.search({query:'supervisor',limit:4});",
 "const result=[];",
 "for(const item of found.results){",
 " if(item.effect === 'READ' || item.effect === 'PURE') result.push(item.name);",
 "}",
 "const spec=await tools.capabilities.describe({name:'supervisor.evaluate'});",
 "return {names:result,readiness:spec.readiness,effect:spec.effect};"
].join("\n"));
assert.equal(discovery.status,"OK",JSON.stringify(discovery));
assert.deepEqual(discovery.structuredContent.value.names,["supervisor.evaluate","supervisor.status"]);
assert.equal(discovery.structuredContent.value.readiness,"AVAILABLE");
assert.equal(discovery.structuredContent.value.effect,"PURE");
assert.equal(discovery.structuredContent.toolCalls,2);
const disabled=await run([
 "const b=await tools.capabilities.describe({name:'browser.open'});",
 "return {ready:b.readiness,effect:b.effect};"
].join("\n"));
assert.equal(disabled.status,"OK",JSON.stringify(disabled));
assert.equal(disabled.structuredContent.value.ready,"DISABLED");
assert.equal(disabled.structuredContent.value.effect,"EXTERNAL_READ");

const selected=await run([
 "const response=await tools.supervisor.status();",
 "const result=[];",
 "for(const item of Object.keys(response)){",
 "  if(item === 'gateway' || item === 'mode') result.push(item);",
 "}",
 "return result;"
].join("\n"));
assert.equal(selected.status,"OK",JSON.stringify(selected));
assert.deepEqual(selected.structuredContent.value,["gateway","mode"]);

for (const code of [
 "return process;",
 "return globalThis;",
 "return this;",
 "return await tools.browser.open({url:'https://example.com'});",
 "return await tools.code_mode.execute({code:'return 1'});",
 "return ({}).constructor;",
 "return ({__proto__: {admin:true}});",
 "while(true){}",
 "return new Function('return process')();",
 "return import('node:fs');",
 "const a=globalThis;return a;",
 "return Object.getPrototypeOf({});",
 "return await tools.capabilities.invoke({name:'browser.open'});",
 "return await tools.capabilities.search({query:'browser',limit:99});",
 "return await tools.capabilities.search({query:'browser',extra:true});",
 "return await tools.capabilities.describe({name:'supervisor.status',grant:true});"
]) {
 const answer=await run(code);
 assert.equal(answer.status,"ERROR",code);
 assert.match(answer.code,/^CODE_MODE_/);
}
const failedDiscovery = await run(
 "return await tools.capabilities.describe({name:'does.not.exist'});"
);
assert.equal(failedDiscovery.code,"CODE_MODE_CAPABILITY_FAILED");
const cappedDiscovery = await run([
 "for(const item of [1,2,3,4,5,6,7,8,9]){",
 " await tools.capabilities.search({query:'supervisor',limit:2});",
 "}",
 "return true;"
].join("\n"));
assert.equal(cappedDiscovery.code,"CODE_MODE_CALL_LIMIT");

// API Goal read-only Code Mode binding is not a public MCP tool,
// a consumer ChatGPT result, or permission to create a paid API turn.
const apiGoalId="11111111-1111-1111-1111-111111111111";
const apiGoalStatus={
 source:"GATEWAY_API_GOAL_OUTBOX_STATUS",schemaVersion:1,
 runId:apiGoalId,workspaceId:"api-workspace-01",state:"RUNNING",
 lastDecision:"CONTINUE",turnCount:1,maxTurns:3,totalTokens:500,
 maxTotalTokens:10000,qa:"NOT_VERIFIED",consumerChat:false,
 nextPromptAllowed:false
};
assert.deepEqual(validateCodeModeApiGoalStatus(apiGoalStatus),apiGoalStatus);
const apiCode=[
 "const a=await tools.api_goal.status();",
 "return {runId:a.runId,remaining:a.maxTurns-a.turnCount,",
 "eligible:a.state==='RUNNING' && a.lastDecision==='CONTINUE' &&",
 "a.totalTokens<a.maxTotalTokens && a.turnCount<a.maxTurns,",
 "qa:a.qa,next:a.nextPromptAllowed};"
].join("\n");
assert.equal((await run(apiCode)).code,"CODE_MODE_CAPABILITY_DENIED");
const privateRead=await executeCodeMode(apiCode,{
 invoke:async()=>{throw Error("NEVER_CALL_A_PROVIDER");},
 apiGoalStatus
});
assert.equal(privateRead.status,"OK",JSON.stringify(privateRead));
assert.deepEqual(privateRead.structuredContent.value,{
 runId:apiGoalId,remaining:2,eligible:true,qa:"NOT_VERIFIED",next:false
});
assert.equal(privateRead.structuredContent.toolCalls,1);
assert.equal((await executeCodeMode(
 "return await tools.api_goal.status({runId:'another'});",{
 invoke:async()=>{},apiGoalStatus
 })).code,"CODE_MODE_ARGUMENTS_INVALID");
assert.equal((await executeCodeMode(
 "return await tools.api_goal.start({goal:'model'});",{
 invoke:async()=>{},apiGoalStatus
 })).code,"CODE_MODE_CAPABILITY_DENIED");
for(const forged of [
 {...apiGoalStatus,workspaceId:"workspace-01"},
 {...apiGoalStatus,source:"MODEL_CLAIMS_APPROVED"},
 {...apiGoalStatus,consumerChat:true},
 {...apiGoalStatus,nextPromptAllowed:true},
 {...apiGoalStatus,qa:"PASS"},
 {...apiGoalStatus,token:"secret"},
 {...apiGoalStatus,outputText:"PRIVATE_ANSWER"},
 {...apiGoalStatus,totalTokens:-1},
 {...apiGoalStatus,state:"DONE"},
 {...apiGoalStatus,runId:"different-run"},
 {...apiGoalStatus,turnCount:9}
]){
 assert.throws(()=>validateCodeModeApiGoalStatus(forged),
  /CODE_MODE_API_GOAL_BINDING_INVALID/);
 assert.equal((await executeCodeMode(apiCode,{
  invoke:async()=>{},apiGoalStatus:forged
 })).code,"CODE_MODE_API_GOAL_BINDING_INVALID");
}

// Synthetic native binding: verifies interpretation and strict shape only.
// It is not a receipt for actual Windows approval or client lease.
const runId="12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef";
const nativeGoal={
 source:"NATIVE_CODEX_V1_RUN_STATUS",schemaVersion:1,runId,
 state:"RUNNING",mode:"WORKTREE_WRITE",baseSha:"a".repeat(40),
 checkpointRevision:3,taskCount:1,
 tasks:[{id:"task-1",state:"VERIFIED",recordedCheck:"RECORDED_PASS",
    recordedChecks:1,lastExitCode:0}],
 qa:"NOT_VERIFIED",chatTurnVerified:false,nextPromptAllowed:false
};
assert.equal(validateNativeCodeModeGoal(nativeGoal).runId,runId);
const codeGoal="const g=await tools.goal.status(); return {state:g.state,qa:g.qa,check:g.tasks[0].recordedCheck,next:g.nextPromptAllowed};";
assert.equal((await run(codeGoal)).code,"CODE_MODE_CAPABILITY_DENIED");
const boundedGoal=await gateway.executeNativeCode(codeGoal,nativeGoal);
assert.equal(boundedGoal.status,"OK",JSON.stringify(boundedGoal));
assert.deepEqual(boundedGoal.structuredContent.value,{
 state:"RUNNING",qa:"NOT_VERIFIED",check:"RECORDED_PASS",next:false
});
assert.equal(boundedGoal.structuredContent.toolCalls,1);
const stopped=await gateway.executeNativeCode(
 "return (await tools.goal.status()).state;",
 {...nativeGoal,state:"STOPPED"});
assert.equal(stopped.structuredContent.value,"STOPPED");
const foreign=await gateway.executeNativeCode(
 "return await tools.goal.status({runId:'other'});",nativeGoal);
assert.equal(foreign.code,"CODE_MODE_ARGUMENTS_INVALID");
assert.equal((await gateway.invoke("code_mode.execute",{
 code:"return await tools.goal.status();",runId
})).code,"INVALID_ARGUMENTS");
for(const invalidGoal of [
 {...nativeGoal,source:"MODEL_CLAIMS_APPROVED"},
 {...nativeGoal,qa:"PASS"},
 {...nativeGoal,nextPromptAllowed:true},
 {...nativeGoal,chatTurnVerified:true},
 {...nativeGoal,schemaVersion:2},
 {...nativeGoal,runId:"another-run"},
 {...nativeGoal,tasks:[{...nativeGoal.tasks[0],summary:"PRIVATE_MESSAGE"}]},
 {...nativeGoal,tasks:[{...nativeGoal.tasks[0],id:"task-2"}]},
 {...nativeGoal,tasks:[{...nativeGoal.tasks[0],recordedCheck:"QA_PASS"}]}
]){
 assert.throws(()=>validateNativeCodeModeGoal(invalidGoal),
  /CODE_MODE_GOAL_BINDING_INVALID/);
 assert.equal((await gateway.executeNativeCode(codeGoal,invalidGoal)).code,
  "CODE_MODE_GOAL_BINDING_INVALID");
}
assert.equal((await gateway.executeNativeCode(
 "return await tools.browser.open({url:'https://example.com'});",nativeGoal)).code,
 "CODE_MODE_CAPABILITY_DENIED");

// A synthetic projection is NOT a live Windows lease/authentication receipt.
const nativeBrowser = {
 source:"NATIVE_SUPPORT_TAB_ORIGIN",workspaceId:"workspace-01",
 tabId:"tab-02",origin:"https://example.org",
 chatContentRead:false,nextPromptAllowed:false
};
assert.equal(validateNativeCodeModeBrowser(nativeBrowser).origin,"https://example.org");
const locationCode="const b=await tools.workspace.location(); return {origin:b.origin,tab:b.tabId,next:b.nextPromptAllowed};";
assert.equal((await run(locationCode)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(locationCode)).code,"CODE_MODE_CAPABILITY_DENIED");
const nativeLocation=await gateway.executeNativeCode(locationCode,null,nativeBrowser);
assert.equal(nativeLocation.status,"OK",JSON.stringify(nativeLocation));
assert.deepEqual(nativeLocation.structuredContent.value,{
 origin:"https://example.org",tab:"tab-02",next:false
});
assert.equal(nativeLocation.structuredContent.toolCalls,1);
const both=await gateway.executeNativeCode(
 "const b=await tools.workspace.location(); const g=await tools.goal.status(); return {origin:b.origin,state:g.state,qa:g.qa};",
 nativeGoal,nativeBrowser
);
assert.equal(both.status,"OK",JSON.stringify(both));
assert.deepEqual(both.structuredContent.value,{
 origin:"https://example.org",state:"RUNNING",qa:"NOT_VERIFIED"
});
assert.equal(both.structuredContent.toolCalls,2);
assert.equal((await gateway.executeNativeCode(
 "return await tools.workspace.location({workspaceId:'workspace-02'});",
 null,nativeBrowser)).code,"CODE_MODE_ARGUMENTS_INVALID");
assert.equal((await gateway.executeNativeCode(
 "return await tools.workspace.navigate({url:'https://example.org'});",
 null,nativeBrowser)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.invoke("code_mode.execute",{
 code:"return await tools.workspace.location();",workspaceId:"workspace-01"
})).code,"INVALID_ARGUMENTS");
for (const invalid of [
 {...nativeBrowser,origin:"https://example.org/private?token=hidden"},
 {...nativeBrowser,origin:"http://example.org"},
 {...nativeBrowser,origin:"https://chatgpt.com"},
 {...nativeBrowser,origin:"https://auth.openai.com"},
 {...nativeBrowser,origin:"https://localhost"},
 {...nativeBrowser,tabId:"main"},
 {...nativeBrowser,workspaceId:"workspace-11"},
 {...nativeBrowser,source:"MODEL_TAB"},
 {...nativeBrowser,chatContentRead:true},
 {...nativeBrowser,nextPromptAllowed:true},
 {...nativeBrowser,pageContent:"PRIVATE_CHAT"}
]) {
 assert.throws(()=>validateNativeCodeModeBrowser(invalid),
  /CODE_MODE_WORKSPACE_BINDING_INVALID/);
 assert.equal((await gateway.executeNativeCode(locationCode,null,invalid)).code,
  "CODE_MODE_WORKSPACE_BINDING_INVALID");
}
// Even a configured browser backend never unlocks page reads through code.
const originBrowser=new CapabilityRouter({browserOrigins:["https://example.org"]});
const readBlocked=await originBrowser.executeNativeCode(
 "return await tools.browser.snapshot();",null,nativeBrowser);
assert.equal(readBlocked.code,"CODE_MODE_CAPABILITY_DENIED");
await originBrowser.close();

// Native V1 report derives only from the already sanitized, leased status.
const reportCode="const r=await tools.goal.report(); return {taskCount:r.taskCount,qa:r.qa,recorded:r.tasks[0].recordedCheck,next:r.nextPromptAllowed};";
assert.equal((await run(reportCode)).code,"CODE_MODE_CAPABILITY_DENIED");
const goalReport=await gateway.executeNativeCode(reportCode,nativeGoal);
assert.equal(goalReport.status,"OK",JSON.stringify(goalReport));
assert.deepEqual(goalReport.structuredContent.value,
 {taskCount:1,qa:"NOT_VERIFIED",recorded:"RECORDED_PASS",next:false});
assert.equal((await gateway.executeNativeCode(
 "return await tools.goal.report({runId:'another-goal'});",nativeGoal)).code,
 "CODE_MODE_ARGUMENTS_INVALID");

const nativeReceipt={
 source:"NATIVE_CODEX_V1_TURN_RECEIPT",schemaVersion:1,runId,
 taskId:"task-1",turnId:"turn_01",recordedCompleted:true,
 processNotificationObserved:true,turnObservationKind:"EVENT_AND_QUERY_CORRELATED",
 finalTurnHostAttested:false,qa:"NOT_EXECUTED",
 acceptancePassed:false,nextPromptAllowed:false
};
assert.equal(validateNativeCodeModeReceipt(nativeReceipt).taskId,"task-1");
const receiptCode="const r=await tools.goal.receipt(); return {recorded:r.recordedCompleted,attested:r.finalTurnHostAttested,qa:r.qa,next:r.nextPromptAllowed};";
assert.equal((await run(receiptCode)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(receiptCode,nativeGoal)).code,
 "CODE_MODE_CAPABILITY_DENIED");
const receipt=await gateway.executeNativeCode(
 receiptCode,nativeGoal,null,null,nativeReceipt);
assert.equal(receipt.status,"OK",JSON.stringify(receipt));
assert.deepEqual(receipt.structuredContent.value,
 {recorded:true,attested:false,qa:"NOT_EXECUTED",next:false});
assert.equal((await gateway.executeNativeCode(
 "return await tools.goal.receipt({turnId:'other'});",nativeGoal,null,null,nativeReceipt)).code,
 "CODE_MODE_ARGUMENTS_INVALID");
for(const invalid of [
 {...nativeReceipt,runId:"foreign-run"},
 {...nativeReceipt,qa:"PASS"},
 {...nativeReceipt,finalTurnHostAttested:true},
 {...nativeReceipt,acceptancePassed:true},
 {...nativeReceipt,nextPromptAllowed:true},
 {...nativeReceipt,threadId:"PRIVATE_THREAD"},
 {...nativeReceipt,turnObservationKind:"MODEL_FINISHED"}
]){
 assert.throws(()=>validateNativeCodeModeReceipt(invalid),/CODE_MODE_RECEIPT_BINDING_INVALID/);
 assert.equal((await gateway.executeNativeCode(receiptCode,nativeGoal,null,null,invalid)).code,
  "CODE_MODE_RECEIPT_BINDING_INVALID");
}
const secondRun="abcdefab-1234-5678-9abc-001122334455.0123456789abcdef0123456789abcdef";
const foreignReceipt={...nativeReceipt,runId:secondRun};
assert.equal((await gateway.executeNativeCode(
 receiptCode,nativeGoal,null,null,foreignReceipt)).code,
 "CODE_MODE_RECEIPT_BINDING_INVALID");

const nativeAgent={
 source:"NATIVE_AGENT_V2_STATUS",schemaVersion:2,runId,
 state:"APPROVED_SOURCE_ONLY",executionReview:"REVIEWED_NO_EXECUTION",
 scopeAndBinaryCurrent:true,executionReady:false,
 nextPromptAllowed:false,qa:"NOT_EXECUTED"
};
assert.equal(validateNativeCodeModeAgent(nativeAgent).executionReady,false);
const agentCode="const a=await tools.agent.status(); return {state:a.state,ready:a.executionReady,qa:a.qa,next:a.nextPromptAllowed};";
assert.equal((await run(agentCode)).code,"CODE_MODE_CAPABILITY_DENIED");
const agentStatus=await gateway.executeNativeCode(agentCode,null,null,nativeAgent);
assert.equal(agentStatus.status,"OK",JSON.stringify(agentStatus));
assert.deepEqual(agentStatus.structuredContent.value,{
 state:"APPROVED_SOURCE_ONLY",ready:false,qa:"NOT_EXECUTED",next:false
});
assert.equal((await gateway.executeNativeCode(
 "return await tools.agent.status({agentRunId:'other'});",null,null,nativeAgent)).code,
 "CODE_MODE_ARGUMENTS_INVALID");
for (const badAgent of [
 {...nativeAgent,executionReady:true},
 {...nativeAgent,qa:"PASS"},
 {...nativeAgent,nextPromptAllowed:true},
 {...nativeAgent,source:"MODEL_GRANTED"},
 {...nativeAgent,state:"RUNNING"},
 {...nativeAgent,executionReview:"DISPATCH_ALLOWED"},
 {...nativeAgent,workerPath:"C:\\private\\worker.exe"}
]){
 assert.throws(()=>validateNativeCodeModeAgent(badAgent),/CODE_MODE_AGENT_BINDING_INVALID/);
 assert.equal((await gateway.executeNativeCode(agentCode,null,null,badAgent)).code,
  "CODE_MODE_AGENT_BINDING_INVALID");
}
assert.equal((await gateway.executeNativeCode(
 "return (await tools.agent.status()).state;",null,null,
 {...nativeAgent,state:"STOPPED",executionReview:"STOPPED",
  scopeAndBinaryCurrent:false})).structuredContent.value,"STOPPED");

// V2 effect policy is an already-bound native *denial* projection.
// A compatible source review and operator intent must never become a
// model-minted runtime grant or a durable reservation.
const nativeEffectPolicy={
 source:"NATIVE_AGENT_V2_EFFECT_POLICY",schemaVersion:2,runId,
 state:"APPROVED_SOURCE_ONLY",executionReview:"REVIEWED_NO_EXECUTION",
 scopeAndBinaryCurrent:true,reservation:"NOT_CREATED",
 policies:[
  {action:"start",admitted:false,reason:"AGENT_OS_SANDBOX_NOT_VERIFIED"},
  {action:"observe",admitted:false,reason:"AGENT_HOST_TURN_RECEIPT_REQUIRED"},
  {action:"cancel",admitted:false,reason:"AGENT_HOST_TURN_RECEIPT_REQUIRED"},
  {action:"reconcileReserved",admitted:false,reason:"AGENT_HOST_TURN_RECEIPT_REQUIRED"}
 ],
 executionReady:false,qa:"NOT_EXECUTED",nextPromptAllowed:false
};
assert.equal(validateNativeCodeModeEffectPolicy(nativeEffectPolicy).reservation,"NOT_CREATED");
const policyCode="const p=await tools.agent.effect_policy(); return {decision:p.policies[0].reason,reservation:p.reservation,ready:p.executionReady,next:p.nextPromptAllowed};";
assert.equal((await run(policyCode)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(policyCode,null,null,nativeAgent)).code,
 "CODE_MODE_CAPABILITY_DENIED");
const policy=await gateway.executeNativeCode(policyCode,null,null,nativeAgent,
 null,null,null,null,null,null,nativeEffectPolicy);
assert.equal(policy.status,"OK",JSON.stringify(policy));
assert.deepEqual(policy.structuredContent.value,{
 decision:"AGENT_OS_SANDBOX_NOT_VERIFIED",
 reservation:"NOT_CREATED",ready:false,next:false
});
assert.equal(policy.structuredContent.toolCalls,1);
assert.equal((await gateway.executeNativeCode(
 "return await tools.agent.effect_policy({action:'start'});",
 null,null,nativeAgent,null,null,null,null,null,null,
 nativeEffectPolicy)).code,"CODE_MODE_ARGUMENTS_INVALID");
assert.equal((await gateway.executeNativeCode(
 "return await tools.agent.start({runId:'another'});",
 null,null,nativeAgent,null,null,null,null,null,null,
 nativeEffectPolicy)).code,"CODE_MODE_CAPABILITY_DENIED");
for(const invalid of [
 {...nativeEffectPolicy,source:"MODEL_DECISION"},
 {...nativeEffectPolicy,runId:"other-run"},
 {...nativeEffectPolicy,reservation:"RESERVED"},
 {...nativeEffectPolicy,qa:"PASS"},
 {...nativeEffectPolicy,nextPromptAllowed:true},
 {...nativeEffectPolicy,executionReady:true},
 {...nativeEffectPolicy,grantId:"PRIVATE_GRANT"},
 {...nativeEffectPolicy,policies:[
  {...nativeEffectPolicy.policies[0],admitted:true},
  ...nativeEffectPolicy.policies.slice(1)]},
 {...nativeEffectPolicy,policies:[
  {...nativeEffectPolicy.policies[0],reason:"AGENT_HOST_TURN_RECEIPT_REQUIRED"},
  ...nativeEffectPolicy.policies.slice(1)]},
 {...nativeEffectPolicy,policies:nativeEffectPolicy.policies.slice().reverse()},
 {...nativeEffectPolicy,policies:[]}
]){
 assert.throws(()=>validateNativeCodeModeEffectPolicy(invalid),
   /CODE_MODE_AGENT_EFFECT_POLICY_INVALID/);
 assert.equal((await gateway.executeNativeCode(policyCode,null,null,nativeAgent,
   null,null,null,null,null,null,invalid)).code,
   "CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
}
const changedRun="abcdefab-1234-5678-9abc-001122334455.0123456789abcdef0123456789abcdef";
assert.equal((await gateway.executeNativeCode(policyCode,null,null,nativeAgent,
 null,null,null,null,null,null,
 {...nativeEffectPolicy,runId:changedRun})).code,
 "CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
assert.equal((await gateway.executeNativeCode(policyCode,null,null,
 {...nativeAgent,executionReview:"NOT_REQUESTED"},null,null,null,
 null,null,null,nativeEffectPolicy)).code,
 "CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
const stopPolicy={...nativeEffectPolicy,state:"STOPPED",executionReview:"STOPPED",
 scopeAndBinaryCurrent:false,
 policies:nativeEffectPolicy.policies.map(p=>({...p,reason:"AGENT_STOPPED"}))};
const stoppedPolicy=await gateway.executeNativeCode(policyCode,null,null,
 {...nativeAgent,state:"STOPPED",executionReview:"STOPPED",scopeAndBinaryCurrent:false},
 null,null,null,null,null,null,stopPolicy);
assert.equal(stoppedPolicy.status,"OK",JSON.stringify(stoppedPolicy));
assert.equal(stoppedPolicy.structuredContent.value.reservation,"NOT_CREATED");

// The canonical recovery owner is the ONLY checkpoint source. No raw IDs,
// paths, or checkpoint body are emitted to Code Mode.
const rawCheckpoint={version:7,goalId:"PRIVATE_GOAL",goalHash:"SECRET_DIGEST",
 phase:"WAITING",pendingTaskId:"PRIVATE_TASK",repoPath:"C:\\secret\\repo"};
const recovery={state:"RECONCILE_REQUIRED",checkpoint:rawCheckpoint};
assert.deepEqual(projectCheckpointSummary(recovery),{
 source:"CANONICAL_CHECKPOINT_SUMMARY",state:"RECONCILE_REQUIRED",
 version:7,pendingTask:true,requiresReconciliation:true,nextPromptAllowed:false
});
assert.equal((await run("return await tools.checkpoint.summary();")).code,
 "CODE_MODE_CAPABILITY_FAILED");
const checkpointRouter=new CapabilityRouter({checkpointStore:{
 recovery:async()=>recovery
}});
const recovered=await checkpointRouter.invoke("code_mode.execute",{
 code:"const c=await tools.checkpoint.summary(); return {state:c.state,reconcile:c.requiresReconciliation,version:c.version,next:c.nextPromptAllowed};"
});
assert.equal(recovered.status,"OK",JSON.stringify(recovered));
assert.deepEqual(recovered.structuredContent.value,{
 state:"RECONCILE_REQUIRED",reconcile:true,version:7,next:false
});
// Four independently sanctioned read-only projections, one MCP-visible
// result. This checks composition semantics, not real native authorization.
const mixed=await checkpointRouter.executeNativeCode([
 "const g=await tools.goal.report();",
 "const r=await tools.goal.receipt();",
 "const a=await tools.agent.status();",
 "const c=await tools.checkpoint.summary();",
 "return {checks:g.tasks.length,recorded:r.recordedCompleted,",
 " workerReady:a.executionReady,reconcile:c.requiresReconciliation,",
 " qa:g.qa,next:r.nextPromptAllowed};"
].join("\n"),nativeGoal,null,nativeAgent,nativeReceipt);
assert.equal(mixed.status,"OK",JSON.stringify(mixed));
assert.deepEqual(mixed.structuredContent.value,{
 checks:1,recorded:true,workerReady:false,reconcile:true,
 qa:"NOT_VERIFIED",next:false
});
assert.equal(mixed.structuredContent.toolCalls,4);

const rawJson=JSON.stringify(recovered);
for(const secret of ["PRIVATE_GOAL","PRIVATE_TASK","SECRET_DIGEST","C:\\secret"]){
 assert.equal(rawJson.includes(secret),false);
}
await checkpointRouter.close();
assert.deepEqual(projectCheckpointSummary({state:"UNINITIALIZED",checkpoint:null}),{
 source:"CANONICAL_CHECKPOINT_SUMMARY",state:"UNINITIALIZED",version:null,
 pendingTask:false,requiresReconciliation:false,nextPromptAllowed:false
});
for(const invalid of [
 {state:"READY",checkpoint:null},
 {state:"DONE",checkpoint:{...rawCheckpoint,phase:"WAITING"}},
 {state:"WAITING",checkpoint:rawCheckpoint},
 {state:"RECONCILE_REQUIRED",checkpoint:{...rawCheckpoint,version:-1}},
 {state:"FORGED",checkpoint:rawCheckpoint}
]){
 assert.throws(()=>projectCheckpointSummary(invalid),/CODE_MODE_CHECKPOINT_INVALID/);
}

// Real Git is never run here. A synthetic binding proves that interpreted
// code can only read the host-projected counts of an already owned V1 scope.
const nativeRepository={
 source:"NATIVE_APPROVED_REPO_STATUS",schemaVersion:2,runId,
 headMatchesApprovedSha:true,changedEntries:0,clean:true,
 qa:"NOT_EXECUTED",nextPromptAllowed:false
};
assert.equal(validateNativeCodeModeRepository(nativeRepository).changedEntries,0);
const repoCode="const r=await tools.repo.status(); return {changed:r.changedEntries,sha:r.headMatchesApprovedSha,qa:r.qa};";
assert.equal((await run(repoCode)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(repoCode,nativeGoal)).code,
 "CODE_MODE_CAPABILITY_DENIED");
const repoResult=await gateway.executeNativeCode(
 repoCode,null,null,nativeAgent,null,nativeRepository);
assert.equal(repoResult.status,"OK",JSON.stringify(repoResult));
assert.deepEqual(repoResult.structuredContent.value,
 {changed:0,sha:true,qa:"NOT_EXECUTED"});
assert.equal((await gateway.executeNativeCode(
 "return await tools.repo.status({repositoryPath:'C:/private'});",
 null,null,nativeAgent,null,nativeRepository)).code,"CODE_MODE_ARGUMENTS_INVALID");
for(const invalid of [
 {...nativeRepository,runId:"another-run"},
 {...nativeRepository,qa:"PASS"},
 {...nativeRepository,changedEntries:2,clean:true},
 {...nativeRepository,nextPromptAllowed:true},
 {...nativeRepository,clean:false},
 {...nativeRepository,changedEntries:-1},
 {...nativeRepository,changedEntries:257},
 {...nativeRepository,paths:["C:/PRIVATE"]},
 {...nativeRepository,sha:"model-claimed"},
 {...nativeRepository,headMatchesApprovedSha:"yes"}
]){
 assert.throws(()=>validateNativeCodeModeRepository(invalid),
  /CODE_MODE_REPOSITORY_BINDING_INVALID/);
 assert.equal((await gateway.executeNativeCode(
  repoCode,null,null,nativeAgent,null,invalid)).code,
  "CODE_MODE_REPOSITORY_BINDING_INVALID");
}
const wrongRunId="abcdefab-1234-5678-9abc-001122334455.0123456789abcdef0123456789abcdef";
assert.equal((await gateway.executeNativeCode(repoCode,null,null,nativeAgent,null,
 {...nativeRepository,runId:wrongRunId})).code,"CODE_MODE_REPOSITORY_BINDING_INVALID");

// Metadata is sourced from the native Rust facade, never from arbitrary
// JS tool names. It does not make native actions invocable from Code Mode.
const nativeCatalog={source:"NATIVE_MCP_CATALOG",capabilities:[
 {name:"code_mode.execute",description:"Confined Code Mode",
  effect:"COMPOSITION",permission:"HOST_EXECUTION_BOUNDARY",codeModeAlias:null,
  invocableFromCode:false},
 {name:"goal_run.start",description:"Native operator-approved goal",
  effect:"DISPATCH",permission:"NATIVE_GOAL_SCOPE_APPROVAL",codeModeAlias:null,
  invocableFromCode:false},
 {name:"workspace_browser.navigate",description:"Native selected support tab",
  effect:"NAVIGATION",permission:"OWNED_SUPPORTING_TAB",codeModeAlias:null,
  invocableFromCode:false},
 {name:"goal_run.status",description:"Read native run status",
  effect:"READ",permission:"OWNED_APPROVED_GOAL",codeModeAlias:"goal.status",
  invocableFromCode:false}
]};
assert.equal(validateNativeCodeModeCatalog(nativeCatalog).capabilities.length,4);
const nativeCode="const c=await tools.capabilities.native({query:'goal_run',limit:2}); return c.results;";
assert.equal((await run(nativeCode)).code,"CODE_MODE_CAPABILITY_DENIED");
const nativeSearch=await gateway.executeNativeCode(
 nativeCode,null,null,null,null,null,nativeCatalog);
assert.equal(nativeSearch.status,"OK",JSON.stringify(nativeSearch));
assert.deepEqual(nativeSearch.structuredContent.value.map(x=>x.name),
 ["goal_run.start","goal_run.status"]);
assert.equal(nativeSearch.structuredContent.value.every(x=>x.invocableFromCode===false),true);
assert.equal((await gateway.executeNativeCode(
 "return await tools.goal_run.start({requestId:'model'});",
 null,null,null,null,null,nativeCatalog)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(
 "return await tools.capabilities.native({query:'',limit:99});",
 null,null,null,null,null,nativeCatalog)).code,"CODE_MODE_ARGUMENTS_INVALID");
for(const forged of [
 {...nativeCatalog,source:"MODEL_CLAIMS_MCP"},
 {...nativeCatalog,capabilities:[...nativeCatalog.capabilities,nativeCatalog.capabilities[0]]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],invocableFromCode:true}]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],schema:{type:"object"}}]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],name:"../../etc/passwd"}]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],effect:"EXECUTE_ANYTHING"}]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],permission:"OWNER;DISABLE_STOP"}]},
 {...nativeCatalog,capabilities:[{...nativeCatalog.capabilities[0],codeModeAlias:"../../unsafe"}]},
 {...nativeCatalog,capabilities:[]},
 {...nativeCatalog,capabilities:Array.from({length:25},(_,i)=>({
  name:"test.action_"+i,description:"x",effect:"READ",
  permission:"OWNED_APPROVED_GOAL",codeModeAlias:null,invocableFromCode:false
 }))},
 {...nativeCatalog,grants:["ALL"]}
]) {
 assert.throws(()=>validateNativeCodeModeCatalog(forged),
  /CODE_MODE_NATIVE_CATALOG_INVALID/);
 assert.equal((await gateway.executeNativeCode(
  nativeCode,null,null,null,null,null,forged)).code,
  "CODE_MODE_NATIVE_CATALOG_INVALID");
}

// Reconciliation uses the native owner of the session-memory inbox, not a
// model-selected workspace or a shadow durable outbox.
const pendingHandoff={
 source:"NATIVE_MANUAL_DRAFT_INBOX",workspaceId:"workspace-01",
 state:"PENDING_REVIEW",draftFingerprint:"a".repeat(64),
 durability:"SESSION_MEMORY",retryAllowed:false,sent:false,operatorReviewRequired:true,
 qa:"NOT_EXECUTED",nextPromptAllowed:false
};
const emptyHandoff={
 ...pendingHandoff,state:"EMPTY_UNVERIFIED",draftFingerprint:null
};
assert.equal(validateNativeCodeModeHandoff(pendingHandoff).state,"PENDING_REVIEW");
assert.equal(validateNativeCodeModeHandoff(emptyHandoff).state,"EMPTY_UNVERIFIED");
const reconcileCode="const h=await tools.handoff.reconcile(); return {state:h.state,fingerprint:h.draftFingerprint,durable:h.durability,next:h.nextPromptAllowed};";
assert.equal((await run(reconcileCode)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await gateway.executeNativeCode(
 reconcileCode,null,null,null,null,null,nativeCatalog)).code,
 "CODE_MODE_CAPABILITY_DENIED");
const reconciled=await gateway.executeNativeCode(
 reconcileCode,null,null,null,null,null,nativeCatalog,null,
 "workspace-01",pendingHandoff);
assert.equal(reconciled.status,"OK",JSON.stringify(reconciled));
assert.deepEqual(reconciled.structuredContent.value,{
 state:"PENDING_REVIEW",fingerprint:"a".repeat(64),
 durable:"SESSION_MEMORY",next:false
});
assert.equal(reconciled.structuredContent.mode,"READ_ONLY");
assert.equal(reconciled.structuredContent.toolCalls,1);
const notFound=await gateway.executeNativeCode(
 "return (await tools.handoff.reconcile()).state;",
 null,null,null,null,null,nativeCatalog,null,
 "workspace-01",emptyHandoff);
assert.equal(notFound.status,"OK");
assert.equal(notFound.structuredContent.value,"EMPTY_UNVERIFIED");
assert.equal((await gateway.executeNativeCode(
 "return await tools.handoff.reconcile({workspaceId:'workspace-02'});",
 null,null,null,null,null,nativeCatalog,null,
 "workspace-01",pendingHandoff)).code,"CODE_MODE_ARGUMENTS_INVALID");
for(const invalid of [
 {...pendingHandoff,workspaceId:"workspace-02"},
 {...pendingHandoff,state:"SENT"},
 {...pendingHandoff,durability:"DISK"},
 {...pendingHandoff,draftFingerprint:null},
 {...pendingHandoff,chatContent:"PRIVATE_CHAT"},
 {...pendingHandoff,qa:"PASS"},
 {...pendingHandoff,retryAllowed:true},
 {...pendingHandoff,nextPromptAllowed:true},
 {...pendingHandoff,sent:true},
 {...pendingHandoff,operatorReviewRequired:false},
 {...emptyHandoff,draftFingerprint:"b".repeat(64)}
]){
 if(invalid.workspaceId==="workspace-02"){
  // Structurally valid, but not admitted for the selected workspace.
  assert.equal((await gateway.executeNativeCode(reconcileCode,
   null,null,null,null,null,nativeCatalog,null,"workspace-01",invalid)).code,
   "CODE_MODE_HANDOFF_BINDING_INVALID");
 } else {
  assert.throws(()=>validateNativeCodeModeHandoff(invalid),
   /CODE_MODE_HANDOFF_BINDING_INVALID/);
  assert.equal((await gateway.executeNativeCode(reconcileCode,
   null,null,null,null,null,nativeCatalog,null,"workspace-01",invalid)).code,
   "CODE_MODE_HANDOFF_BINDING_INVALID");
 }
}

// Native-effect broker: a typed manual draft is the first genuinely
// host-staged operation. This mock is NOT a native Windows/ChatGPT receipt.
const handoffCode=[
 "const g=await tools.supervisor.status();",
 "return await tools.handoff.prepare({goal:'Review ' + g.gateway,",
 " acceptance:['Audit source status'],nextStep:'Continue manually'});"
].join("\n");
const receiptFromHost={
 source:"HOST_FORMATTED_UNVERIFIED_CLIENT_INPUT",status:"DRAFT_ONLY",
 workspaceId:"workspace-01",delivery:"MANUAL_COPY_PASTE",
 draftPrompt:"PRIVATE_MANUAL_DRAFT_TEXT",draftFingerprint:"a".repeat(64),
 sent:false,sessionVerified:false,resultVerified:false,
 operatorReviewRequired:true,nextPromptAllowed:false,qa:"NOT_EXECUTED"
};
const preview=projectManualHandoffReceipt(receiptFromHost,"workspace-01");
assert.equal(preview.status,"DRAFT_ONLY");
assert.equal(JSON.stringify(preview).includes("PRIVATE_MANUAL_DRAFT_TEXT"),false);
assert.deepEqual(validateManualHandoffArguments({
 goal:"Review source",acceptance:["No unapproved writes"]}),
 {goal:"Review source",acceptance:["No unapproved writes"]});
assert.equal((await run(handoffCode)).code,"CODE_MODE_EFFECT_UNAVAILABLE");
assert.equal((await gateway.executeNativeCode(handoffCode,nativeGoal)).code,
 "CODE_MODE_EFFECT_UNAVAILABLE");
let effectCalls=0;
const fakeNativeEffect=async(name,args)=>{
 effectCalls++;
 assert.equal(name,"workspace_chat.prepare_handoff");
 assert.equal(args.workspaceId,"workspace-01");
 assert.equal(args.goal,"Review READY");
 assert.deepEqual(args.acceptance,["Audit source status"]);
 return {status:"OK",structuredContent:receiptFromHost};
};
const prepared=await gateway.executeNativeCode(
 handoffCode,null,null,null,null,null,nativeCatalog,
 fakeNativeEffect,"workspace-01");
assert.equal(prepared.status,"OK",JSON.stringify(prepared));
assert.equal(effectCalls,1);
assert.equal(prepared.structuredContent.mode,"HOST_MANUAL_DRAFT");
assert.equal(prepared.structuredContent.effectCalls,1);
assert.equal(prepared.structuredContent.nextPromptAllowed,false);
assert.deepEqual(prepared.structuredContent.value,preview);
assert.equal(JSON.stringify(prepared).includes("PRIVATE_MANUAL_DRAFT_TEXT"),false);
// The program must return the single effect. No post-effect operations,
// nested conditionals, or loops may create an ambiguous success state.
for(const program of [
 "const d=await tools.handoff.prepare({goal:'a',acceptance:['x']}); return d;",
 "return await tools.handoff.prepare({goal:'a',acceptance:['x']}) + 'ok';",
 "if(true){return await tools.handoff.prepare({goal:'a',acceptance:['x']});}",
 "return await tools.handoff.prepare({goal:'a',acceptance:['x']}) && await tools.handoff.prepare({goal:'b',acceptance:['y']});"
]){
 const result=await gateway.executeNativeCode(program,null,null,null,null,null,
  nativeCatalog,fakeNativeEffect,"workspace-01");
 assert.equal(result.code,"CODE_MODE_EFFECT_TERMINAL_REQUIRED",program);
}
assert.equal(effectCalls,1);
for(const args of [
 {goal:"a",acceptance:[],workspaceId:"workspace-01"},
 {goal:"a",acceptance:["x"],grant:true},
 {goal:"a",acceptance:["x"],workspaceId:"workspace-02"},
 {goal:"a",acceptance:["x"],repository:"other/repo"},
 {goal:"a",acceptance:["x"],nextStep:"\u0000unsafe"},
 {goal:"a",acceptance:["x"],baseSha:"b".repeat(40)},
 {goal:"",acceptance:["x"]}
]){
 assert.throws(()=>validateManualHandoffArguments(args),
   /CODE_MODE_EFFECT_ARGUMENTS_INVALID/);
}
assert.equal((await gateway.executeNativeCode(
 "return await tools.handoff.prepare({goal:'x',acceptance:['y'],workspaceId:'workspace-02'});",
 null,null,null,null,null,nativeCatalog,fakeNativeEffect,"workspace-01")).code,
 "CODE_MODE_EFFECT_ARGUMENTS_INVALID");
assert.equal(effectCalls,1);
assert.equal((await gateway.executeNativeCode(handoffCode,null,null,null,
 null,null,nativeCatalog,async()=>{throw Error("PRIVATE_HOST_PATH")}, "workspace-01")).code,
 "CODE_MODE_EFFECT_RECONCILE_REQUIRED");
const hostileReceipt=await gateway.executeNativeCode(
 handoffCode,null,null,null,null,null,nativeCatalog,
 async()=>({status:"OK",structuredContent:{...receiptFromHost,sent:true}}),
 "workspace-01");
assert.equal(hostileReceipt.code,"CODE_MODE_EFFECT_RECONCILE_REQUIRED");
assert.equal((await gateway.executeNativeCode(
 "return await tools.workspace_browser.navigate({address:'https://example.com'});",
 null,null,null,null,null,nativeCatalog,fakeNativeEffect,"workspace-01")).code,
 "CODE_MODE_CAPABILITY_DENIED");
assert.equal(effectCalls,1);

// A continuation is one terminal Code Mode effect over the SAME native inbox.
const previous="a".repeat(64);
const continuedCode="return await tools.handoff.continue({previousFingerprint:'"+
 previous+"',reply:'Operator pasted an answer without QA',nextStep:'Review proof'});";
const nextReceipt={...receiptFromHost,draftPrompt:"PRIVATE_FOLLOWUP_BODY",
 previousFingerprint:previous,draftFingerprint:"b".repeat(64)};
let followupCalls=0;
const nativeFollowup=async (capability,args)=>{
 followupCalls++;
 assert.equal(capability,"workspace_chat.continue_handoff");
 assert.equal(args.workspaceId,"workspace-01");
 assert.equal(args.previousFingerprint,previous);
 assert.equal(args.reply,"Operator pasted an answer without QA");
 assert.equal(args.nextStep,"Review proof");
 return {status:"OK",structuredContent:nextReceipt};
};
assert.equal((await run(continuedCode)).code,"CODE_MODE_EFFECT_UNAVAILABLE");
const continued=await gateway.executeNativeCode(
 continuedCode,null,null,null,null,null,nativeCatalog,
 nativeFollowup,"workspace-01",pendingHandoff);
assert.equal(continued.status,"OK",JSON.stringify(continued));
assert.equal(continued.structuredContent.mode,"HOST_MANUAL_DRAFT");
assert.equal(continued.structuredContent.effectCalls,1);
assert.equal(continued.structuredContent.value.draftFingerprint,"b".repeat(64));
assert.equal(continued.structuredContent.value.nextPromptAllowed,false);
assert.equal(JSON.stringify(continued).includes("PRIVATE_FOLLOWUP_BODY"),false);
assert.equal(followupCalls,1);
assert.equal((await gateway.executeNativeCode(
 continuedCode,null,null,null,null,null,nativeCatalog,
 nativeFollowup,"workspace-01",emptyHandoff)).code,
 "CODE_MODE_HANDOFF_STALE");
assert.equal((await gateway.executeNativeCode(
 continuedCode.replace(previous,"c".repeat(64)),null,null,null,
 null,null,nativeCatalog,nativeFollowup,"workspace-01",pendingHandoff)).code,
 "CODE_MODE_HANDOFF_STALE");
assert.equal(followupCalls,1);
assert.equal((await gateway.executeNativeCode(
 "return await tools.handoff.continue({previousFingerprint:'"+
 previous+"',reply:'Answer'}) + 'extra';",
 null,null,null,null,null,nativeCatalog,nativeFollowup,
 "workspace-01",pendingHandoff)).code,
 "CODE_MODE_EFFECT_TERMINAL_REQUIRED");
assert.equal(followupCalls,1);
for(const invalid of [
 {previousFingerprint:"bad",reply:"Answer"},
 {previousFingerprint:previous,reply:" "},
 {previousFingerprint:previous,reply:"a".repeat(3001)},
 {previousFingerprint:previous,reply:"Answer",approved:true},
 {previousFingerprint:previous,reply:"Answer",workspaceId:"workspace-02"},
 {previousFingerprint:previous,reply:"Answer",nextStep:"\u0000"},
])assert.throws(()=>validateManualContinuationArguments(invalid),
 /CODE_MODE_EFFECT_ARGUMENTS_INVALID/);
const badFollowup=await gateway.executeNativeCode(
 continuedCode,null,null,null,null,null,nativeCatalog,
 async()=>({status:"OK",structuredContent:{
  ...nextReceipt,previousFingerprint:"c".repeat(64)}}),
 "workspace-01",pendingHandoff);
assert.equal(badFollowup.code,"CODE_MODE_EFFECT_RECONCILE_REQUIRED");
const uncertainFollowup=await gateway.executeNativeCode(
 continuedCode,null,null,null,null,null,nativeCatalog,
 async()=>{throw Error("PRIVATE_REPLY");},"workspace-01",pendingHandoff);
assert.equal(uncertainFollowup.code,"CODE_MODE_EFFECT_RECONCILE_REQUIRED");

const excessiveString = await run([
 "const a = 'x';",
 ...Array.from({length:16},(_,i)=>
   "const v"+i+" = "+(i===0?"a+a":"v"+(i-1)+"+v"+(i-1))+";"),
 "return v15;"
].join("\n"));
assert.equal(excessiveString.code,"CODE_MODE_DATA_LIMIT");

const excessiveObject = await run([
 "const a = {data:'data'};",
 ...Array.from({length:15},(_,i)=>
   "const v"+i+" = {left:"+(i===0?"a":"v"+(i-1))+",right:"+(i===0?"a":"v"+(i-1))+"};"),
 "return v14;"
].join("\n"));
assert.equal(excessiveObject.code,"CODE_MODE_DATA_LIMIT");

const capped=await run([
 "for(const item of [1,2,3,4,5,6,7,8,9]){",
 " await tools.supervisor.status();",
 "}",
 "return true;"
].join("\n"));
assert.equal(capped.code,"CODE_MODE_CALL_LIMIT");
assert.equal((await run("return tools.supervisor.status;")).status,"ERROR");
assert.equal((await gateway.invoke("code_mode.execute",{code:""})).code,"INVALID_ARGUMENTS");
assert.equal((await gateway.invoke("code_mode.execute",{code:"return 1",extra:true})).code,"INVALID_ARGUMENTS");
// A configured browser backend must still be inaccessible from generated code.
const browserEnabled = new CapabilityRouter({browserOrigins:["https://example.com"]});
assert.equal(browserEnabled.describe("browser.open").structuredContent.readiness,"AVAILABLE");
const deniedBrowser=await browserEnabled.invoke("code_mode.execute",{
 code:"return await tools.browser.open({url:'https://example.com'});"
});
assert.equal(deniedBrowser.code,"CODE_MODE_CAPABILITY_DENIED");
await browserEnabled.close();
// The opt-in localhost indexed observation remains OUTSIDE confined Code
// Mode's read/pure allowlist. Metadata discovery is not execution.
assert.equal((await run(
 "return await tools.lightpanda.snapshot({workspaceId:'workspace-01',view:'index'});"
)).code,"CODE_MODE_CAPABILITY_DENIED");
assert.equal((await run(
 "return await tools.lightpanda.review({workspaceId:'workspace-01',expectedFingerprint:'"+
 "a".repeat(64)+"',displayIndex:2,operation:'CLICK'});"
)).code,"CODE_MODE_CAPABILITY_DENIED");

await gateway.close();
assert.equal((await gateway.invoke("code_mode.execute",{code:"return 1;"})).code,"GATEWAY_CLOSED");

const standalone=spawnSync(process.execPath,["src/gateway/mcp-gateway.mjs"],{
 input:[
  JSON.stringify({jsonrpc:"2.0",id:1,method:"lazyprompting/code",
   params:{action:"execute",code:"return 1;",nativeCatalog}}),
  JSON.stringify({jsonrpc:"2.0",id:2,method:"lazyprompting/code",
   params:{action:"catalog",nativeCatalog}})
 ].join("\n")+"\n",
 encoding:"utf8",timeout:5000,
 env:{...process.env,LAZY_NATIVE_BOOTSTRAP:""}
});
assert.equal(standalone.status,0,standalone.stderr);
const blockedPrivate=standalone.stdout.trim().split("\n").map(JSON.parse);
assert.equal(blockedPrivate.length,2);
assert.ok(blockedPrivate.every(item=>item.error?.code===-32601));
console.log("Code Mode source cases: composed reads, bounded output, negative syntax/authority cases");
