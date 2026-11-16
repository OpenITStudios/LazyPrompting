import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {assessChatTransport} from "../src/transport/chat-session-capabilities.mjs";
import {OptionalOpenAIResponsesTurn,assessOptionalResponsesTurn}
 from "../src/transport/optional-openai-responses.mjs";

const workspaceId="api-workspace-01",apiConversationId="conv_disposable_test";
const model="gpt-6-astra";
const turnId="api-turn-11111111-1111-1111-1111-111111111111";
const input={mode:"EXPLICIT_OPENAI_API",workspaceId,apiConversationId,
 turnId,model,contextRevision:0,maxOutputTokens:200,prompt:"Inspect source only"};
const modelResponse=(id="resp_disposable_one")=>({
 id,model,status:"completed",conversation:{id:apiConversationId},
 output:[{type:"message",role:"assistant",status:"completed",
  content:[{type:"output_text",text:"Source reviewed. QA still pending."}]}],
 usage:{input_tokens:80,output_tokens:40,total_tokens:120}
});
let calls=0,approvals=0;
const client={responses:{async create(body){
 calls++;
 assert.equal(body.model,model);
 assert.equal(body.conversation,apiConversationId);
 assert.deepEqual(body.input,[{role:"user",content:input.prompt}]);
 assert.equal(body.max_output_tokens,200);
 assert.equal(body.background,false);
 assert.equal(body.stream,false);
 assert.deepEqual(body.tools,[]);
 return modelResponse();
}}};
const permit=async scope=>{
 approvals++;
 return {source:"TRUSTED_NATIVE_API_APPROVAL",approved:true,...scope};
};
const root=await mkdtemp(join(tmpdir(),"lp-optional-openai-"));
try{
 const store=new PromptOutbox(join(root,"canonical-outbox.json"));
 const turn=new OptionalOpenAIResponsesTurn({
  client,outbox:store,authorizeTurn:permit,maxTurns:3
 });
 const result=await turn.submitOne(input);
 assert.equal(result.source,"OPENAI_RESPONSES_API_ONLY");
 assert.equal(result.apiConversationId,apiConversationId);
 assert.equal(result.responseId,"resp_disposable_one");
 assert.equal(result.state,"API_RESPONSE_COMPLETED");
 assert.equal(result.consumerChat,false);
 assert.equal(result.nextPromptAllowed,false);
 assert.equal(result.qa,"NOT_VERIFIED");
 assert.equal(result.outputText,"Source reviewed. QA still pending.");
 assert.deepEqual(result.usage,{inputTokens:80,outputTokens:40,totalTokens:120});
 const state=await new PromptOutbox(store.path).read();
 assert.equal(state.items[0].state,"RESPONSE_VERIFIED");
 assert.equal(state.items[0].responseId,"resp_disposable_one");
 assert.equal(JSON.stringify(state).includes(input.prompt),false);
 assert.equal(JSON.stringify(state).includes(result.outputText),false);
 assert.equal(calls,1);
 await assert.rejects(()=>turn.submitOne(input),/TASK_ALREADY_DISPATCHED/);
 assert.equal(calls,1);

 for(const invalid of [
  {...input,mode:"ORDINARY_CHATGPT"},
  {...input,workspaceId:"workspace-01"},
  {...input,apiConversationId:"https://chatgpt.com/c/example"},
  {...input,apiConversationId:"conv_"},
  {...input,turnId:"task-1"},
  {...input,maxOutputTokens:5000},
  {...input,consumerChat:true},
  {...input,prompt:""},
  {...input,contextRevision:-1}
 ]){
  assert.equal(assessOptionalResponsesTurn(invalid).ready,false);
  await assert.rejects(()=>turn.submitOne(invalid),
   /API_TURN_SCOPE_INVALID/);
 }
 assert.throws(()=>new OptionalOpenAIResponsesTurn({
  client,outbox:store
 }),/API_HOST_NOT_CONFIGURED/);
 const untrusted=new OptionalOpenAIResponsesTurn({
  client,outbox:new PromptOutbox(join(root,"untrusted.json")),
  authorizeTurn:async()=>({approved:true}),maxTurns:1
 });
 await assert.rejects(()=>untrusted.submitOne(input),
  /API_TURN_NATIVE_APPROVAL_REQUIRED/);
 assert.equal(calls,1);

 const throwing=new OptionalOpenAIResponsesTurn({
  client:{responses:{async create(){throw Error("TRANSPORT_LOST");}}},
  outbox:new PromptOutbox(join(root,"transport-lost.json")),
  authorizeTurn:permit,maxTurns:2
 });
 await assert.rejects(()=>throwing.submitOne(input),/TRANSPORT_LOST/);
 const held=new PromptOutbox(join(root,"transport-lost.json"));
 assert.equal((await held.pending(workspaceId)).length,1);
 await assert.rejects(()=>throwing.submitOne(input),/WORKSPACE_PROMPT_PENDING/);

 const incomplete=new OptionalOpenAIResponsesTurn({
  client:{responses:{async create(){return {
   ...modelResponse("resp_incomplete"),status:"incomplete"
  };}}},
  outbox:new PromptOutbox(join(root,"incomplete.json")),
  authorizeTurn:permit,maxTurns:2
 });
 await assert.rejects(()=>incomplete.submitOne(input),
  /API_RESPONSE_NOT_COMPLETED/);
 assert.equal((await incomplete.outbox.pending(workspaceId))[0].state,
  "ACKNOWLEDGED");

 const wrongConversation=new OptionalOpenAIResponsesTurn({
  client:{responses:{async create(){return {
   ...modelResponse("resp_foreign"),conversation:{id:"conv_foreign"}
  };}}},
  outbox:new PromptOutbox(join(root,"wrong-conversation.json")),
  authorizeTurn:permit,maxTurns:2
 });
 await assert.rejects(()=>wrongConversation.submitOne(input),
  /API_RESPONSE_IDENTITY_UNVERIFIED/);
 assert.equal((await wrongConversation.outbox.pending(workspaceId))[0].state,
  "RESERVED");

 const refusal=new OptionalOpenAIResponsesTurn({
  client:{responses:{async create(){return {
   ...modelResponse("resp_refusal"),
   output:[{type:"message",role:"assistant",status:"completed",
    content:[{type:"refusal",refusal:"Cannot comply."}]}]
  };}}},
  outbox:new PromptOutbox(join(root,"refusal.json")),
  authorizeTurn:permit,maxTurns:2
 });
 await assert.rejects(()=>refusal.submitOne(input),
  /API_RESPONSE_REFUSAL_REQUIRES_REVIEW/);
 assert.equal((await refusal.outbox.pending(workspaceId))[0].state,
  "ACKNOWLEDGED");

 const badUsage=new OptionalOpenAIResponsesTurn({
  client:{responses:{async create(){return {
   ...modelResponse("resp_bad_usage"),usage:null
  };}}},
  outbox:new PromptOutbox(join(root,"bad-usage.json")),
  authorizeTurn:permit,maxTurns:2
 });
 await assert.rejects(()=>badUsage.submitOne(input),
  /API_RESPONSE_USAGE_UNVERIFIED/);
 assert.equal((await badUsage.outbox.pending(workspaceId)).length,1);

 const syntheticConsumer={kind:"SUPPORTED_CHAT_SESSION_HOST",
  productFamily:"RESPONSES_API",providerId:"openai",integrationId:"api",
  approved:true,documented:true,unattendedUseApproved:true,
  supportsExistingConsumerChats:true,capabilities:{
   createSession:true,sendPrompt:true,observeResponse:true,lookupSession:true,
   verifySession:true,lookupDelivery:true
  }};
 assert.equal(assessChatTransport({manifest:syntheticConsumer,hostAttestation:{
  trusted:true,providerId:"openai",integrationId:"api",
  sessionBindingVerified:true,existingChatBindingVerified:true
 }}).ready,false);
 assert.ok(approvals>=5);
}finally{
 await rm(root,{recursive:true,force:true});
}
console.log("Optional official Responses API: source fixtures authored, NOT_EXECUTED");
