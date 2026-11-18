import {randomUUID,createHash} from "node:crypto";
import {join,isAbsolute} from "node:path";
import {PromptOutbox} from "../prompt/prompt-outbox.mjs";
import {OptionalOpenAIResponsesTurn} from "../transport/optional-openai-responses.mjs";
import {executeCodeMode,validateCodeModeApiGoalStatus}
 from "./code-mode-runtime.mjs";

// API goal runner: independent, explicitly approved OpenAI Platform
// conversation, never the ordinary ChatGPT WebView2 session.
// All durable state stays in the existing app-local PromptOutbox.
const WORKSPACE="api-workspace-01";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MODEL=/^[a-zA-Z][a-zA-Z0-9_.-]{1,79}$/;
const hash=s=>createHash("sha256").update(s).digest("hex");
const DECISIONS=["CONTINUE","DONE_PROPOSED","BLOCKED"];
// Fixed interpreted program, never model-authored source code.
const CODE_MODE_API_REVIEW=[
 "const g=await tools.api_goal.status();",
 "return {runId:g.runId,state:g.state,turnCount:g.turnCount,",
 "remaining:g.maxTurns-g.turnCount,budgetWithin:g.totalTokens<g.maxTotalTokens,",
 "continueProposed:g.lastDecision==='CONTINUE',qa:g.qa,",
 "nextPromptAllowed:g.nextPromptAllowed};"
].join("\n");
// This sanitizes only the exact record owned by the original outbox;
// no raw goal, answer, API key or API conversation ID enters Code Mode.
export function projectApiGoalCodeModeStatus(record){
 return validateCodeModeApiGoalStatus({
  source:"GATEWAY_API_GOAL_OUTBOX_STATUS",schemaVersion:1,
  runId:record.runId,workspaceId:record.workspaceId,state:record.state,
  lastDecision:record.lastDecision,turnCount:record.turnCount,
  maxTurns:record.maxTurns,totalTokens:record.totalTokens,
  maxTotalTokens:record.maxTotalTokens,
  qa:"NOT_VERIFIED",consumerChat:false,nextPromptAllowed:false
 });
}

export const API_GOAL_FORMAT={
 type:"json_schema",name:"lazyprompting_goal_turn",strict:true,
 schema:{type:"object",additionalProperties:false,
  required:["decision","summary","evidence","blocker","nextPrompt"],
  properties:{
   decision:{type:"string",enum:DECISIONS},
   summary:{type:"string"},
   evidence:{type:"string"},
   blocker:{type:"string"},
   nextPrompt:{type:"string"}
  }}
};
const INSTRUCTIONS=[
 "You are a bounded, read-only prompting planner in an OpenAI Platform API conversation.",
 "You have NO access to repository files, browser state, plugins, devices, or runtime QA.",
 "Respond in the exact structured format. Assess only evidence explicitly in this conversation.",
 "CONTINUE means a useful distinct next prompt can make progress within the current goal.",
 "DONE_PROPOSED means you think the goal is satisfied, but an operator must review it.",
 "BLOCKED means more real evidence, permissions or user input are necessary.",
 "Do not claim tests, code changes, browsing, or independent QA passed without actual host receipts.",
 "Never propose secrets, unauthorized operations, personal-data extraction, or unbounded loops."
].join(" ");

function parseTurn(text){
 let item;
 try{item=JSON.parse(text);}
 catch{throw Error("API_GOAL_STRUCTURED_OUTPUT_INVALID");}
 if(!item||typeof item!=="object"||Array.isArray(item)||
    Object.keys(item).sort().join(",")!==
     "blocker,decision,evidence,nextPrompt,summary"||
    !DECISIONS.includes(item.decision)||
    !["summary","evidence","blocker","nextPrompt"].every(
      k=>typeof item[k]==="string"&&item[k].length<=2400)||
    !item.summary.trim()||
    (item.decision==="CONTINUE"&&!item.nextPrompt.trim())||
    item.nextPrompt.length>2000)
  throw Error("API_GOAL_STRUCTURED_OUTPUT_INVALID");
 return item;
}
export function assessApiGoalStart(input={}){
 // Exact fields; never accept approval, API key or consumer chat ID
 // from a renderer, model or extension.
 if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).sort().join(",")!==
    "dataDir,goal,maxOutputTokens,maxTotalTokens,maxTurns,model,workspaceId"||
    input.workspaceId!==WORKSPACE||!isAbsolute(input.dataDir??"")||
    input.dataDir.length>4096||typeof input.goal!=="string"||
    !input.goal.trim()||input.goal.length>2000||
    !MODEL.test(input.model??"")||
    !Number.isSafeInteger(input.maxTurns)||input.maxTurns<1||input.maxTurns>5||
    !Number.isSafeInteger(input.maxOutputTokens)||
    input.maxOutputTokens<256||input.maxOutputTokens>2048||
    !Number.isSafeInteger(input.maxTotalTokens)||
    input.maxTotalTokens<2048||input.maxTotalTokens>80000)
  return {ready:false,reason:"API_GOAL_SCOPE_INVALID"};
 return {ready:true,goalDigest:hash(input.goal),consumerChat:false};
}

export class ApiGoalRuntime {
 constructor({clientFactory,nativeApproval}={}){
  if(typeof clientFactory!=="function"||typeof nativeApproval!=="function")
   throw Error("API_GOAL_HOST_NOT_BOUND");
  this.clientFactory=clientFactory;
  this.nativeApproval=nativeApproval;
  this.live=new Map();
 }
 async start(input){
  // Credential is passed only inside an OS-approved private request
  // and excluded from persistent scope, logs, and subsequent prompts.
  const {apiKey,...request}=input??{};
  const check=assessApiGoalStart(request);
  if(!check.ready)throw Error(check.reason);
  const client=this.clientFactory(apiKey);
  if(typeof client?.conversations?.create!=="function"||
     typeof client?.responses?.create!=="function")
   throw Error("API_GOAL_CLIENT_UNAVAILABLE");
  const scope={...request,goalDigest:check.goalDigest};
  if(await this.nativeApproval(scope)!==true)
   throw Error("API_GOAL_NATIVE_APPROVAL_REQUIRED");
  const outbox=new PromptOutbox(join(input.dataDir,"outbox.json"));
  const started=await outbox.beginApiGoalRun({
   workspaceId:WORKSPACE,goalDigest:check.goalDigest,model:input.model,
   maxTurns:input.maxTurns,maxOutputTokens:input.maxOutputTokens,
   maxTotalTokens:input.maxTotalTokens
  });
  if(!started.started)return {...started,consumerChat:false};
  const runId=started.runId;
  const entry={runId,outbox,client,scope,abort:new AbortController(),
   stopped:false,live:true,state:"PREPARING",summary:"",
   evidence:"",blocker:"",lastDecision:null,
   turnCount:0,totalTokens:0,codeModeReview:null};
  this.live.set(runId,entry);
  // Detached bounded Node promise; no secondary scheduler and no
  // blocking of the private native gateway status/STOP RPCs.
  void this.run(entry).catch(()=>{});
  return {started:true,runId,workspaceId:WORKSPACE,
   state:"PREPARING",consumerChat:false,nextPromptAllowed:false};
 }
 async run(entry){
  const {outbox,client,scope,runId}=entry;
  try{
   const created=await client.conversations.create();
   const conv=created?.id;
   if(typeof conv!=="string"||!/^conv_[A-Za-z0-9_-]{1,128}$/.test(conv))
    throw Error("API_GOAL_CONVERSATION_UNVERIFIED");
   if(entry.stopped)throw Error("API_GOAL_STOP_REQUESTED");
   await outbox.bindApiGoalConversation({
    runId,workspaceId:WORKSPACE,conversationId:conv
   });
   entry.state="RUNNING";
   const turns=new OptionalOpenAIResponsesTurn({
    client,outbox,maxTurns:scope.maxTurns,responseFormat:API_GOAL_FORMAT,
    signal:entry.abort.signal,
    authorizeTurn:async turn=>{
     if(entry.stopped||turn.workspaceId!==WORKSPACE||
        turn.apiConversationId!==conv||turn.model!==scope.model||
        turn.maxOutputTokens>scope.maxOutputTokens||
        turn.contextRevision!==entry.turnCount)
      throw Error("API_GOAL_NATIVE_SCOPE_CHANGED");
     // A single signed native dialog approved this exact bounded
     // entire run. The trusted gateway rechecks each turn's scope.
     return {...turn,source:"TRUSTED_NATIVE_API_APPROVAL",approved:true};
    }
   });
   let prompt="Approved goal: "+scope.goal+"\n"+INSTRUCTIONS;
   const previous=new Set();
   for(let index=0;index<scope.maxTurns;index++){
    if(entry.stopped||entry.abort.signal.aborted)
     throw Error("API_GOAL_STOP_REQUESTED");
    if(previous.has(hash(prompt)))throw Error("API_GOAL_REPEATED_PROMPT");
    previous.add(hash(prompt));
    const result=await turns.submitOne({
     mode:"EXPLICIT_OPENAI_API",workspaceId:WORKSPACE,
     apiConversationId:conv,model:scope.model,prompt,
     turnId:"api-turn-"+randomUUID(),contextRevision:index,
     maxOutputTokens:scope.maxOutputTokens
    });
    const decision=parseTurn(result.outputText);
    const budget=await outbox.noteApiGoalTurn({
     runId,workspaceId:WORKSPACE,responseId:result.responseId,
     turnCount:index+1,decision:decision.decision,
     inputTokens:result.usage.inputTokens,
     outputTokens:result.usage.outputTokens
    });
    // Internal Code Mode composes an exact, read-only projection from
    // the canonical outbox after provider output was correlated. It
    // cannot dispatch an API request or promote independent QA.
    const persisted=await outbox.getApiGoalRun({
     runId,workspaceId:WORKSPACE
    });
    if(persisted.lastResponseId!==result.responseId||
       persisted.lastDecision!==decision.decision||
       persisted.turnCount!==index+1)
     throw Error("API_GOAL_CODE_MODE_STATE_CHANGED");
    const projection=projectApiGoalCodeModeStatus(persisted);
    const composed=await executeCodeMode(CODE_MODE_API_REVIEW,{
     invoke:async()=>{throw Error("API_GOAL_CODE_MODE_REMOTE_EFFECT_DENIED");},
     apiGoalStatus:projection
    });
    const reviewed=composed?.structuredContent?.value;
    if(composed.status!=="OK"||!reviewed||
       reviewed.runId!==runId||reviewed.turnCount!==budget.turnCount||
       reviewed.state!==budget.state||
       reviewed.qa!=="NOT_VERIFIED"||reviewed.nextPromptAllowed!==false||
       reviewed.remaining!==persisted.maxTurns-budget.turnCount||
       reviewed.budgetWithin!==(budget.totalTokens<persisted.maxTotalTokens)||
       reviewed.continueProposed!==(decision.decision==="CONTINUE")||
       (budget.state==="RUNNING")!==(
        reviewed.state==="RUNNING"&&reviewed.continueProposed&&
        reviewed.remaining>0&&reviewed.budgetWithin))
     throw Error("API_GOAL_CODE_MODE_RECONCILE_REQUIRED");
    entry.codeModeReview={
     source:"CODE_MODE_API_GOAL_READ_ONLY",state:reviewed.state,
     remaining:reviewed.remaining,budgetWithin:reviewed.budgetWithin,
     continueProposed:reviewed.continueProposed,
     qa:"NOT_VERIFIED",nextPromptAllowed:false
    };
    entry.turnCount=budget.turnCount;
    entry.totalTokens=budget.totalTokens;
    entry.lastDecision=decision.decision;
    entry.summary=decision.summary;
    entry.evidence=decision.evidence;
    entry.blocker=decision.blocker;
    entry.state=budget.state;
    if(budget.state!=="RUNNING")break;
    if(entry.stopped)throw Error("API_GOAL_STOP_REQUESTED");
    prompt=decision.nextPrompt;
   }
  }catch(e){
   entry.state="RECONCILE_REQUIRED";
   entry.blocker=/^[A-Z_]{1,80}$/.test(String(e?.message??""))?
    e.message:"API_GOAL_TRANSPORT_UNCERTAIN";
   try{
    const held=await outbox.holdApiGoalRun({
     runId,workspaceId:WORKSPACE,stop:entry.stopped
    });
    entry.state=held.state;
   }catch{
    entry.blocker="API_GOAL_OUTBOX_RECONCILE_REQUIRED";
   }
  }finally{
   entry.live=false;
   // Retain only the latest, bounded review state in memory.
   entry.scope={model:scope.model,workspaceId:WORKSPACE};
  }
 }
 async status({dataDir,runId,workspaceId}={}){
  if(workspaceId!==WORKSPACE||!isAbsolute(dataDir??"")||
     dataDir.length>4096||
     (runId!==null&&runId!==undefined&&!UUID.test(runId)))
   throw Error("API_GOAL_LOOKUP_INVALID");
  const store=new PromptOutbox(join(dataDir,"outbox.json"));
  if(!runId){
   const latest=(await store.read()).apiGoalRuns?.filter(
    x=>x.workspaceId===WORKSPACE).at(-1);
   if(!latest)return {source:"OPENAI_PLATFORM_GOAL",state:"NO_RUN",
    workspaceId,consumerChat:false,qa:"NOT_VERIFIED",
    nextPromptAllowed:false};
   runId=latest.runId;
  }
  const persisted=await store.getApiGoalRun({runId,workspaceId});
  const current=this.live.get(runId);
  // After restart, a formerly running run MUST be held; no silent
  // resurrection or duplicate paid generations.
  const state=!current&&["PREPARING","RUNNING"].includes(persisted.state)?
   "RECONCILE_REQUIRED":current?.state??persisted.state;
  return {source:"OPENAI_PLATFORM_GOAL",runId,workspaceId,
   conversationId:persisted.conversationId,state,
   lastDecision:current?.lastDecision??persisted.lastDecision,
   summary:current?.summary??"",evidence:current?.evidence??"",
   blocker:current?.blocker??(state==="RECONCILE_REQUIRED"?
    "API_GOAL_PREVIOUS_PROCESS_UNVERIFIED":""),
   turnCount:persisted.turnCount,totalTokens:persisted.totalTokens,
   maxTurns:persisted.maxTurns,maxTotalTokens:persisted.maxTotalTokens,
   codeModeReview:current?.codeModeReview??null,
   active:current?.live===true,consumerChat:false,
   qa:"NOT_VERIFIED",nextPromptAllowed:false};
 }
 async stop({dataDir,runId,workspaceId}={}){
  if(workspaceId!==WORKSPACE||!isAbsolute(dataDir??"")||
     !UUID.test(runId??""))throw Error("API_GOAL_STOP_SCOPE_INVALID");
  const entry=this.live.get(runId);
  if(!entry?.live)return this.status({dataDir,runId,workspaceId});
  entry.stopped=true;
  entry.abort.abort();
  // The current HTTP request may have reached OpenAI; it remains held.
  // STOP cancels new sends even if there is no provider ACK.
  return {runId,workspaceId,state:"STOP_REQUESTED",
   consumerChat:false,nextPromptAllowed:false};
 }
}
