// Read-only source regressions. No native process, provider call or QA execution.
import assert from "node:assert/strict";
import {CapabilityRouter,projectCheckpointSummary} from "../src/gateway/capability-router.mjs";
import {executeCodeMode} from "../src/gateway/code-mode-runtime.mjs";
import * as bindings from "../src/gateway/code-mode-bindings.mjs";
import * as compatibility from "../src/gateway/code-mode-runtime.mjs";

// Existing consumers can continue importing the original runtime exports.
const names=[
 "validateNativeCodeModeBrowser","validateNativeCodeModeAgent",
 "validateNativeCodeModeEffectPolicy","validateNativeCodeModeReceipt",
 "validateNativeCodeModeCatalog","validateNativeCodeModeHandoff",
 "validateNativeCodeModeRepository","validateCodeModeApiGoalStatus",
 "validateNativeCodeModeGoal"
];
for(const name of names)assert.equal(compatibility[name],bindings[name],name);

const runId="12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef";
const goal={
 source:"NATIVE_CODEX_V1_RUN_STATUS",schemaVersion:1,runId,
 state:"RUNNING",mode:"READ_ONLY",baseSha:"a".repeat(40),
 checkpointRevision:2,taskCount:1,
 tasks:[{id:"task-1",state:"RUNNING",recordedCheck:"NOT_RECORDED",
  recordedChecks:0,lastExitCode:null}],
 qa:"NOT_VERIFIED",chatTurnVerified:false,nextPromptAllowed:false
};
const receipt={
 source:"NATIVE_CODEX_V1_TURN_RECEIPT",schemaVersion:1,runId,
 taskId:"task-1",turnId:"turn-1",recordedCompleted:true,
 processNotificationObserved:true,turnObservationKind:"EVENT_AND_QUERY_CORRELATED",
 finalTurnHostAttested:false,qa:"NOT_EXECUTED",
 acceptancePassed:false,nextPromptAllowed:false
};
const goalCode=[
 "const g=await tools.goal.status();",
 "const report=await tools.goal.report();",
 "const receipt=await tools.goal.receipt();",
 "return {state:g.state,qa:g.qa,revision:report.checkpointRevision,",
 "taskCount:report.taskCount,receiptKind:receipt.turnObservationKind,",
 "acceptance:receipt.acceptancePassed,nextAllowed:g.nextPromptAllowed};"
].join("\n");
const gateway=new CapabilityRouter();
try{
 const response=await gateway.executeNativeCode(goalCode,goal,null,null,receipt);
 assert.equal(response.status,"OK",JSON.stringify(response));
 assert.deepEqual(response.structuredContent.value,{
  state:"RUNNING",qa:"NOT_VERIFIED",revision:2,taskCount:1,
  receiptKind:"EVENT_AND_QUERY_CORRELATED",acceptance:false,nextAllowed:false
 });
 assert.equal(response.structuredContent.toolCalls,3);
 assert.equal((await gateway.invoke("code_mode.execute",{code:goalCode})).code,
  "CODE_MODE_CAPABILITY_DENIED");
 assert.equal((await gateway.executeNativeCode(goalCode,goal,null,null,{
  ...receipt,runId:"00000000-0000-0000-0000-000000000000.0123456789abcdef0123456789abcdef"
 })).code,"CODE_MODE_RECEIPT_BINDING_INVALID");
 const stopped=await gateway.executeNativeCode(goalCode,{...goal,state:"STOPPED"},
  null,null,receipt);
 assert.equal(stopped.structuredContent.value.state,"STOPPED");
 assert.equal(stopped.structuredContent.value.nextAllowed,false);
}finally{await gateway.close();}

// The canonical CheckpointStore is injected as a trusted synthetic owner.
// Code Mode must return only the fixed recovery indicators, not raw fields.
const stored={state:"READY",checkpoint:{
 phase:"READY",version:7,pendingTaskId:null,privateFixture:"never-return"
}};
const checkpointGateway=new CapabilityRouter({
 checkpointStore:{recovery:async()=>stored}
});
try{
 const code=[
  "const s=await tools.checkpoint.summary();",
  "const g=await tools.supervisor.status();",
  "return {state:s.state,version:s.version,",
  "nextAllowed:s.nextPromptAllowed,gateway:g.gateway};"
 ].join("\n");
 const result=await checkpointGateway.invoke("code_mode.execute",{code});
 assert.equal(result.status,"OK",JSON.stringify(result));
 const expected=projectCheckpointSummary(stored);
 assert.deepEqual(result.structuredContent.value,{
  state:expected.state,version:expected.version,
  nextAllowed:expected.nextPromptAllowed,gateway:"READY"
 });
 assert.equal(result.structuredContent.toolCalls,2);
 assert.ok(!JSON.stringify(result).includes("never-return"));
 assert.equal((await gateway.invoke("code_mode.execute",{code})).code,"GATEWAY_CLOSED");
}finally{await checkpointGateway.close();}

// Optional API Goal is a private outbox-derived projection, not a public
// paid API call or a consumer ChatGPT response/continuation receipt.
const api={
 source:"GATEWAY_API_GOAL_OUTBOX_STATUS",schemaVersion:1,
 runId:"11111111-1111-1111-1111-111111111111",
 workspaceId:"api-workspace-01",state:"REVIEW_REQUIRED",
 lastDecision:"DONE_PROPOSED",turnCount:2,maxTurns:3,
 totalTokens:2000,maxTotalTokens:8000,qa:"NOT_VERIFIED",
 consumerChat:false,nextPromptAllowed:false
};
const apiCode=[
 "const a=await tools.api_goal.status();",
 "return {remaining:a.maxTurns-a.turnCount,",
 "review:a.state==='REVIEW_REQUIRED',",
 "qa:a.qa,consumerChat:a.consumerChat,nextAllowed:a.nextPromptAllowed};"
].join("\n");
const publicGateway=new CapabilityRouter();
try{
 const answer=await executeCodeMode(apiCode,{
  invoke:async()=>{throw Error("NO_PROVIDER_OR_HOST_EFFECT");},
  apiGoalStatus:api
 });
 assert.equal(answer.status,"OK",JSON.stringify(answer));
 assert.deepEqual(answer.structuredContent.value,{
  remaining:1,review:true,qa:"NOT_VERIFIED",
  consumerChat:false,nextAllowed:false
 });
 assert.equal(answer.structuredContent.toolCalls,1);
 assert.equal((await publicGateway.invoke("code_mode.execute",{code:apiCode})).code,
  "CODE_MODE_CAPABILITY_DENIED");
 assert.equal((await executeCodeMode(apiCode,{
  invoke:async()=>{throw Error("NO_PROVIDER_OR_HOST_EFFECT");},
  apiGoalStatus:{...api,nextPromptAllowed:true}
 })).code,"CODE_MODE_API_GOAL_BINDING_INVALID");
}finally{await publicGateway.close();}
console.log("Code Mode workflow fixtures authored: V1, recovery, API outbox, legacy binding exports");
