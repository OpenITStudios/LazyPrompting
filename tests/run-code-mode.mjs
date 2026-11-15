import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {CapabilityRouter,projectCheckpointSummary} from "../src/gateway/capability-router.mjs";
import {codeModeCatalog,validateNativeCodeModeGoal,validateNativeCodeModeBrowser,
 validateNativeCodeModeAgent,validateNativeCodeModeReceipt}
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
  "goal.report","goal.receipt","agent.status","checkpoint.summary"]);
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

await gateway.close();
assert.equal((await gateway.invoke("code_mode.execute",{code:"return 1;"})).code,"GATEWAY_CLOSED");

const standalone=spawnSync(process.execPath,["src/gateway/mcp-gateway.mjs"],{
 input:JSON.stringify({jsonrpc:"2.0",id:1,method:"lazyprompting/code",
  params:{action:"execute",code:"return 1;"}})+"\n",
 encoding:"utf8",timeout:5000,
 env:{...process.env,LAZY_NATIVE_BOOTSTRAP:""}
});
assert.equal(standalone.status,0,standalone.stderr);
assert.equal(JSON.parse(standalone.stdout).error.code,-32601);
console.log("Code Mode source cases: composed reads, bounded output, negative syntax/authority cases");
