import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {ApiGoalRuntime,assessApiGoalStart,API_GOAL_FORMAT,
 projectApiGoalCodeModeStatus}
 from "../src/gateway/api-goal-runtime.mjs";
import {createOpenAIPlatformClient}
 from "../src/transport/openai-platform-http.mjs";

const root=await mkdtemp(join(tmpdir(),"lp-api-goal-source-"));
const workspaceId="api-workspace-01",model="gpt-6-astra";
const start={dataDir:root,workspaceId,model,
 goal:"Develop a concise, source-bound research plan",
 maxTurns:2,maxOutputTokens:1024,maxTotalTokens:10000};
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function until(runtime,runId,expected){
 for(let i=0;i<80;i++){
  const result=await runtime.status({dataDir:root,runId,workspaceId});
  if(result.state===expected)return result;
  if(!result.active)assert.equal(result.state,expected,result.blocker);
  await tick();
 }
 throw Error("API_GOAL_FAKE_RUNTIME_NOT_SETTLED");
}
let called=0,created=0;
const fake={
 conversations:{async create(){created++;return{id:"conv_fixture123"};}},
 responses:{async create(request,options){
  called++;
  assert.equal(request.model,model);
  assert.equal(request.conversation,"conv_fixture123");
  assert.equal(request.stream,false);
  assert.equal(request.background,false);
  assert.deepEqual(request.tools,[]);
  assert.equal(request.text.format.name,API_GOAL_FORMAT.name);
  assert.equal(request.text.format.strict,true);
  assert.equal(options.signal.aborted,false);
  const decision=called===1
   ?{decision:"CONTINUE",summary:"Investigated task boundaries",
      evidence:"Only scoped instructions were supplied",blocker:"",
      nextPrompt:"Check the next distinct requirement without making claims"}
   :{decision:"DONE_PROPOSED",summary:"Plan draft is prepared",
      evidence:"Text-only API result; no independent QA",blocker:"",
      nextPrompt:""};
  return {id:"resp_fixture"+called,model,conversation:{id:"conv_fixture123"},
   status:"completed",output:[{type:"message",role:"assistant",
    status:"completed",content:[{type:"output_text",text:JSON.stringify(decision)}]}],
   usage:{input_tokens:180,output_tokens:95,total_tokens:275}};
 }}
};
try{
 for(const bad of [
  {...start,workspaceId:"workspace-01"},
  {...start,maxTurns:6},
  {...start,maxOutputTokens:5000},
  {...start,maxTotalTokens:100000},
  {...start,mode:"ORDINARY_CONSUMER_CHAT"},
  {...start,goal:""}
 ])assert.equal(assessApiGoalStart(bad).ready,false);

 const host=new ApiGoalRuntime({
  clientFactory:()=>fake,
  nativeApproval:async scope=>{
   assert.equal(scope.workspaceId,workspaceId);
   assert.equal(scope.maxTurns,2);
   assert.equal(scope.maxOutputTokens,1024);
   return true;
  }
 });
 const started=await host.start(start);
 assert.equal(started.started,true);
 assert.equal(started.consumerChat,false);
 assert.equal(started.nextPromptAllowed,false);
 const finished=await until(host,started.runId,"REVIEW_REQUIRED");
 assert.equal(finished.turnCount,2);
 assert.equal(finished.totalTokens,550);
 assert.equal(finished.lastDecision,"DONE_PROPOSED");
 assert.equal(finished.summary,"Plan draft is prepared");
 assert.equal(finished.qa,"NOT_VERIFIED");
 assert.equal(finished.nextPromptAllowed,false);
 // Code Mode composed only the canonical status after the API receipt.
 // It never received the model output, a credential or a consumer chat.
 assert.deepEqual(finished.codeModeReview,{
  source:"CODE_MODE_API_GOAL_READ_ONLY",state:"REVIEW_REQUIRED",
  remaining:0,budgetWithin:true,continueProposed:false,
  qa:"NOT_VERIFIED",nextPromptAllowed:false
 });
 assert.equal(created,1);
 assert.equal(called,2);
 const store=new PromptOutbox(join(root,"outbox.json"));
 const snapshot=await store.read();
 assert.equal(snapshot.apiGoalRuns.length,1);
 assert.equal(snapshot.apiGoalRuns[0].state,"REVIEW_REQUIRED");
 assert.equal(snapshot.apiGoalRuns[0].conversationId,"conv_fixture123");
 assert.equal(snapshot.apiGoalRuns[0].turnCount,2);
 const projected=projectApiGoalCodeModeStatus(snapshot.apiGoalRuns[0]);
 assert.equal(projected.source,"GATEWAY_API_GOAL_OUTBOX_STATUS");
 assert.equal(projected.consumerChat,false);
 assert.equal(projected.qa,"NOT_VERIFIED");
 assert.equal(projected.nextPromptAllowed,false);
 assert.equal(Object.hasOwn(projected,"goalDigest"),false);
 assert.equal(Object.hasOwn(projected,"conversationId"),false);
 assert.equal(Object.hasOwn(projected,"model"),false);
 assert.equal(Object.hasOwn(projected,"outputText"),false);
 assert.equal(snapshot.items.length,2);
 assert.ok(snapshot.items.every(x=>x.state==="RESPONSE_VERIFIED"));
 assert.equal(JSON.stringify(snapshot).includes(start.goal),false);
 assert.equal(JSON.stringify(snapshot).includes("Plan draft is prepared"),false);
 const persisted=await new ApiGoalRuntime({
  clientFactory:()=>fake,nativeApproval:async()=>false
 }).status({dataDir:root,runId:started.runId,workspaceId});
 assert.equal(persisted.state,"REVIEW_REQUIRED");
 assert.equal(persisted.summary,"");
 assert.equal((await host.stop({dataDir:root,workspaceId,runId:started.runId})).state,
  "REVIEW_REQUIRED");
 // A later, separately approved API goal must have its OWN prompt
 // budget rather than inheriting historical turns of another conv_.
 const later=await store.beginApiGoalRun({workspaceId,
  goalDigest:"a".repeat(64),model,maxTurns:2,
  maxOutputTokens:1024,maxTotalTokens:10000});
 assert.equal(later.started,true);
 await store.bindApiGoalConversation({runId:later.runId,workspaceId,
  conversationId:"conv_later_fixture"});
 const separate=await store.reserve({workspaceId,
  sessionId:"conv_later_fixture",
  taskId:"api-turn-22222222-2222-2222-2222-222222222222",
  contextRevision:0,prompt:"Different reviewed API goal",
  promptLimit:2,maxConcurrent:1,singleDispatchPerTask:true});
 assert.equal(separate.reserved,true);


 // Missing operator consent must have no file/network effect.
 const deniedDir=await mkdtemp(join(root,"denied-"));
 const denied=new ApiGoalRuntime({
  clientFactory:()=>fake,nativeApproval:async()=>false
 });
 await assert.rejects(()=>denied.start({...start,dataDir:deniedDir}),
  /API_GOAL_NATIVE_APPROVAL_REQUIRED/);
 assert.equal(created,1);

 // A lost HTTP reply can have caused a billable API effect.
 // Leave exact original reservation held. Never create a second turn.
 let failures=0;
 const uncertainDir=await mkdtemp(join(root,"uncertain-"));
 const uncertain=new ApiGoalRuntime({
  clientFactory:()=>({
   conversations:{async create(){return{id:"conv_uncertain"};}},
   responses:{async create(){failures++;throw Error("NETWORK_UNCERTAIN");}}
  }),
  nativeApproval:async()=>true
 });
 const begun=await uncertain.start({...start,dataDir:uncertainDir});
 for(let i=0;i<80;i++){
  const r=await uncertain.status({
   dataDir:uncertainDir,workspaceId,runId:begun.runId});
  if(r.state==="RECONCILE_REQUIRED"&&!r.active)break;
  await tick();
 }
 const afterLoss=await uncertain.status({
  dataDir:uncertainDir,workspaceId,runId:begun.runId});
 assert.equal(afterLoss.state,"RECONCILE_REQUIRED");
 assert.equal(afterLoss.active,false);
 assert.equal(afterLoss.nextPromptAllowed,false);
 assert.equal(failures,1);
 assert.deepEqual(await uncertain.start({...start,dataDir:uncertainDir}),
  {started:false,reason:"API_GOAL_WORKSPACE_HELD",consumerChat:false});
 assert.equal(failures,1);

 // Official Platform REST client never uses ChatGPT consumer endpoints.
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,method:options.method,
   authorization:options.headers.Authorization,body:options.body});
  return {ok:true,status:200,
   headers:{get:()=>null},
   text:async()=>JSON.stringify({id:"conv_test"})};
 };
 const localClient=createOpenAIPlatformClient({
  apiKey:"sk-test-not-a-real-key-123456789012345",
  fetchImpl,timeoutMs:3000
 });
 const convo=await localClient.conversations.create();
 assert.equal(convo.id,"conv_test");
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://api.openai.com/v1/conversations");
 assert.equal(calls[0].method,"POST");
 assert.throws(()=>localClient.responses.retrieve("../consumer-chat"),
  /OPENAI_RESPONSE_ID_INVALID/);
 assert.throws(()=>createOpenAIPlatformClient({
  apiKey:"secret\nother",fetchImpl}),/OPENAI_API_KEY_OR_CLIENT_UNAVAILABLE/);
 assert.equal(calls.length,1);
 const refused=createOpenAIPlatformClient({
  apiKey:"sk-test-not-a-real-key-123456789012345",
  timeoutMs:3000,fetchImpl:async()=>({
   ok:false,status:429,headers:{get:()=>null},
   text:async()=>"never reveal this body"
  })
 });
 await assert.rejects(()=>refused.responses.create({model:"gpt-6-astra"}),
  /OPENAI_API_HTTP_429/);
}finally{
 await rm(root,{recursive:true,force:true});
}
console.log("API goal and official REST fixtures: PASS (mock HTTP, no billed requests)");
