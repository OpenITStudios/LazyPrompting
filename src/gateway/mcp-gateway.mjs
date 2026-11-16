import {createInterface} from "node:readline";
import {CapabilityRouter} from "./capability-router.mjs";
import {CheckpointStore} from "../supervisor/checkpoint-store.mjs";
import {toMcpResult} from "./result-projection.mjs";
import {validateInput} from "./input-validation.mjs";
import {negotiateProtocol} from "./protocol-contract.mjs";
import {connectNativeHost,invokeNativeLightpanda,readNativePreparedAgentRun,readNativeAgentSourceBinding,evaluateNativeAgentAction,finishNativeAgentCallbacks,
  invokeNativeCodeEffect,finishNativeCodeEffect} from "./native-ipc.mjs";
import {normalizeNativeAgentSourceBinding} from "../agent/native-source-binding.mjs";
import {createDesktopCodexRuntime} from "../transport/desktop-codex-runtime.mjs";
import {runReadOnlyGoal} from "../transport/goal-codex-runner.mjs";
import {ActiveGoalRegistry} from "../runtime/active-goal-registry.mjs";
import {PromptOutbox} from "../prompt/prompt-outbox.mjs";
import {ApiGoalRuntime} from "../transport/api-goal-runtime.mjs";
import {createOpenAIPlatformClient} from "../transport/openai-platform-http.mjs";
import {isAbsolute,join} from "node:path";
import {NativeAgentRequestRouter} from "../agent/native-agent-request-router.mjs";

const TOOL_SPECS=[
 {name:"status",description:"Compact Gateway and backend readiness",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"search_capabilities",description:"Find available capabilities by intent (default max 4)",inputSchema:{type:"object",properties:{query:{type:"string",maxLength:256},limit:{type:"integer",minimum:1,maximum:8}},required:["query"],additionalProperties:false}},
 {name:"describe_capability",description:"Get schema, effects and readiness for one exact capability",inputSchema:{type:"object",properties:{name:{type:"string",minLength:1,maxLength:128}},required:["name"],additionalProperties:false}},
 {name:"invoke_capability",description:"Invoke a registered capability, subject to runtime policy",inputSchema:{type:"object",properties:{name:{type:"string"},arguments:{type:"object",properties:{},additionalProperties:true}},required:["name"],additionalProperties:false}}
];
const output=x=>process.stdout.write(JSON.stringify(x)+"\n");
const reply=(id,result)=>output({jsonrpc:"2.0",id,result});
const error=(id,code,message)=>output({jsonrpc:"2.0",id,error:{code,message}});
const toolResult=toMcpResult;
const native=process.env.LAZY_NATIVE_BOOTSTRAP==="1"?await connectNativeHost(process.stdin):null;
const router=new CapabilityRouter({
 checkpointStore:process.env.LAZY_CHECKPOINT_FILE?new CheckpointStore(process.env.LAZY_CHECKPOINT_FILE):null,
 browserOrigins:(process.env.LAZY_BROWSER_ORIGINS??"").split(",").map(x=>x.trim()).filter(Boolean),
 nativeLightpanda:native?(name,args,grantId)=>invokeNativeLightpanda(native,name,args,grantId):null
});
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
let codex, codexConfig;
const activeGoals = new ActiveGoalRegistry({maxActive: 2});
// Only an authenticated native host may bind real v2 callbacks. No MCP tool,
// environment flag or model-supplied JSON can bind a worker here.
const nativeAgentRouter = native ? new NativeAgentRequestRouter() : null;
// Private native-host-only optional API goal owner. No public MCP or
// consumer ChatGPT tool is registered. The gateway has no API client
// until an OS-approved native main-window request is received.
const apiGoals = native ? new ApiGoalRuntime({
 clientFactory:()=>createOpenAIPlatformClient({
  apiKey:process.env.OPENAI_API_KEY
 }),
 nativeApproval:async scope=>scope.workspaceId==="api-workspace-01"
}) : null;
try{
 for await(const line of lines){
  if(Buffer.byteLength(line)>1024*1024){error(null,-32600,"Message too large");continue;}
  let req;try{req=JSON.parse(line);}catch{error(null,-32700,"Parse error");continue;}
  if(!req||req.jsonrpc!=="2.0"||typeof req.method!=="string"){error(req?.id??null,-32600,"Invalid Request");continue;}
  if(!Object.hasOwn(req,"id"))continue;
  const id=req.id;
  if(req.method==="initialize"){
   const negotiated=negotiateProtocol(req.params);
   if(!negotiated.ok){error(id,-32602,negotiated.reason);continue;}
   reply(id,{protocolVersion:negotiated.version,capabilities:{tools:{listChanged:false}},serverInfo:{name:"lazyprompting-gateway",version:"0.2.0"}});continue;
  }
  if(req.method==="ping"){reply(id,{});continue;}
  if(req.method==="tools/list"){reply(id,{tools:TOOL_SPECS});continue;}
  // Private read-only Code Mode transport. Standalone callers cannot invoke it.
  if(req.method==="lazyprompting/code"&&native){
   const action=req.params?.action;
   const exact=req.params && typeof req.params==="object" && !Array.isArray(req.params);
   if(!exact || !["catalog","execute"].includes(action) ||
      !Object.hasOwn(req.params,"nativeCatalog") ||
      (action==="catalog" &&
        Object.keys(req.params).sort().join(",")!=="action,nativeCatalog") ||
      (action==="execute" && (Object.keys(req.params).some(k=>
         !["action","code","goal","browser","agent","receipt","repository","nativeCatalog",
           "effectToken","handoffWorkspaceId","handoffStatus","effectPolicy"].includes(k)) ||
       (Object.hasOwn(req.params,"effectPolicy") &&
        (!req.params.effectPolicy || typeof req.params.effectPolicy!=="object" ||
         Array.isArray(req.params.effectPolicy))) ||
       (Object.hasOwn(req.params,"handoffStatus") &&
        (!req.params.handoffStatus ||
         typeof req.params.handoffStatus!=="object" ||
         Array.isArray(req.params.handoffStatus))) ||
       typeof req.params.effectToken!=="string" ||
       !/^[a-f0-9]{32}$/.test(req.params.effectToken) ||
       (Object.hasOwn(req.params,"handoffWorkspaceId") &&
        (typeof req.params.handoffWorkspaceId!=="string" ||
         !/^workspace-(0[1-9]|10)$/.test(req.params.handoffWorkspaceId))) ||
       typeof req.params.code!=="string" ||
       (Object.hasOwn(req.params,"goal") &&
        (!req.params.goal || typeof req.params.goal!=="object" ||
         Array.isArray(req.params.goal))) ||
       (Object.hasOwn(req.params,"browser") &&
        (!req.params.browser || typeof req.params.browser!=="object" ||
         Array.isArray(req.params.browser))) ||
       (Object.hasOwn(req.params,"agent") &&
        (!req.params.agent || typeof req.params.agent!=="object" ||
         Array.isArray(req.params.agent))) ||
       (Object.hasOwn(req.params,"receipt") &&
        (!req.params.receipt || typeof req.params.receipt!=="object" ||
         Array.isArray(req.params.receipt))) ||
       (Object.hasOwn(req.params,"repository") &&
        (!req.params.repository || typeof req.params.repository!=="object" ||
         Array.isArray(req.params.repository))) ||
       (Object.hasOwn(req.params,"nativeCatalog") &&
        (!req.params.nativeCatalog || typeof req.params.nativeCatalog!=="object" ||
         Array.isArray(req.params.nativeCatalog)))))){
    error(id,-32602,"Invalid Code Mode request");continue;
   }
   if(action==="catalog"){
    reply(id,await router.invoke("code_mode.catalog",{}));continue;
   }
   const token=req.params.effectToken;
   let result;
   try{
    const nativeEffect=(capability,args)=>
      invokeNativeCodeEffect(native,token,capability,args);
    result=await router.executeNativeCode(req.params.code,req.params.goal??null,
      req.params.browser??null,req.params.agent??null,req.params.receipt??null,
      req.params.repository??null,req.params.nativeCatalog??null,
      nativeEffect,req.params.handoffWorkspaceId??null,
      req.params.handoffStatus??null,req.params.effectPolicy??null);
   }catch{
    result={status:"ERROR",code:"CODE_MODE_EFFECT_RECONCILE_REQUIRED"};
   }finally{
    // Always end the per-request pipe pump, including rejected/no-effect
    // programs. Missing DONE is a fatal host timeout, never implicit success.
    try{finishNativeCodeEffect(native,token);}
    catch{result={status:"ERROR",code:"CODE_MODE_EFFECT_RECONCILE_REQUIRED"};}
   }
   reply(id,result);continue;
  }
  if(req.method==="lazyprompting/agent"&&nativeAgentRouter){
   // A native-originated RPC carries a one-shot correlation token. The actual
   // read goes through the authenticated named pipe, not caller-provided JSON.
   const raw=req.params??{};
   const token=raw.callbackToken;
   const scoped={action:raw.action,...(raw.runId?{runId:raw.runId}:{})};
   let result={status:"BLOCKED",reason:"NATIVE_AGENT_CALLBACK_FAILED",
     nextPromptAllowed:false,qa:"NOT_EXECUTED"};
   try{
    if(typeof token!=="string"||!/^[a-f0-9]{32}$/.test(token))
     throw Error("AGENT_CALLBACK_TOKEN_INVALID");
    if(scoped.action==="status") {
     // The private gateway health query is global and read-only. It does not
     // select a goal, so it must not demand a run-bound execution grant.
     result=nativeAgentRouter.status();
    } else if(scoped.action==="inspect") {
     const source=await readNativePreparedAgentRun(native,token,scoped.runId);
     result={status:"SOURCE_INSPECTED",...source};
    } else if(scoped.action==="source") {
     const source=await readNativeAgentSourceBinding(native,token,scoped.runId);
     result=normalizeNativeAgentSourceBinding(source,scoped.runId);
    } else {
     // Even if another module binds an adapter, native action policy is
     // authoritative and checked over the authenticated pipe before any
     // controller can execute or inspect a provider turn.
     const policy=await evaluateNativeAgentAction(
       native,token,scoped.runId,scoped.action
     );
     result=policy.admitted===false
       ?{status:"BLOCKED",reason:policy.reason,action:policy.action,
         executionReview:policy.executionReview,
         executionReady:false,qa:"NOT_EXECUTED",nextPromptAllowed:false}
       :{status:"BLOCKED",reason:"NATIVE_AGENT_DISPATCH_NOT_BOUND",
         executionReady:false,qa:"NOT_EXECUTED",nextPromptAllowed:false};
    }
   }catch{
    result={status:"BLOCKED",reason:"NATIVE_AGENT_CALLBACK_FAILED",
      nextPromptAllowed:false,qa:"NOT_EXECUTED"};
   }finally{
    // The native host waits for this exact terminal frame before reading
    // the stdio reply. It must not be omitted even when an operation fails.
    try{finishNativeAgentCallbacks(native,token);}catch{
     result={status:"BLOCKED",reason:"NATIVE_AGENT_CALLBACK_TERMINATION_FAILED",
       nextPromptAllowed:false,qa:"NOT_EXECUTED"};
    }
   }
   reply(id,result);
   continue;
  }
  // Native-bootstrap-only durable browser action transition. Not a public
  // MCP or Code Mode route. The host, not page or model input, owns dataDir.
  if(req.method==="lazyprompting/browserAction"&&native){
   const p=req.params;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      Object.keys(p).sort().join(",")!=="action,dataDir,payload"||
      !["reserve","seal","verify","hold"].includes(p.action)||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096||!p.payload||typeof p.payload!=="object"||
      Array.isArray(p.payload)){
    error(id,-32602,"INVALID_BROWSER_ACTION_REQUEST");continue;
   }
   try{
    const store=new PromptOutbox(join(p.dataDir,"outbox.json"));
    const result=p.action==="reserve"?
      await store.reservePreviewActionIntent(p.payload):
      p.action==="seal"?await store.sealPreviewActionDispatch(p.payload):
      p.action==="verify"?await store.verifyPreviewActionEffect(p.payload):
      await store.holdPreviewActionUncertain(p.payload);
    reply(id,result);
   }catch(e){
    const code=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"BROWSER_ACTION_OUTBOX_FAILED");
   }
   continue;
  }
  // A private installed-native reservation; never a public MCP or
  // Code Mode browser capability. The host chooses the app-data root.
  if(req.method==="lazyprompting/operatorChatSend"&&native){
   const p=req.params;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      Object.keys(p).sort().join(",")!==
       "conversationDigest,dataDir,promptDigest,workspaceId"||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096){
    error(id,-32602,"INVALID_OPERATOR_CHAT_REQUEST");continue;
   }
   try{
    const store=new PromptOutbox(join(p.dataDir,"outbox.json"));
    reply(id,await store.reserveOperatorChatAttempt({
     workspaceId:p.workspaceId,conversationDigest:p.conversationDigest,
     promptDigest:p.promptDigest
    }));
   }catch(e){
    const reason=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(reason)?
     reason:"OPERATOR_CHAT_OUTBOX_FAILED");
   }
   continue;
  }
  // Authenticated native-only operator review; NOT ChatGPT QA.
  if(req.method==="lazyprompting/operatorChatReview"&&native){
   const p=req.params;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      Object.keys(p).sort().join(",")!==
       "conversationDigest,dataDir,promptDigest,workspaceId"||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096){
    error(id,-32602,"INVALID_OPERATOR_REVIEW_REQUEST");continue;
   }
   try{
    const outbox=new PromptOutbox(join(p.dataDir,"outbox.json"));
    reply(id,await outbox.reviewOperatorChatAttempt({
     workspaceId:p.workspaceId,
     conversationDigest:p.conversationDigest,promptDigest:p.promptDigest
    }));
   }catch(e){
    const code=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"OPERATOR_CHAT_REVIEW_FAILED");
   }
   continue;
  }
  // Read-only native pending attempt binding. Only Tauri can receive
  // its hashes, never the renderer, public MCP or Code Mode.
  if(req.method==="lazyprompting/operatorChatPending"&&native){
   const p=req.params;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      Object.keys(p).sort().join(",")!=="dataDir,workspaceId"||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096){
    error(id,-32602,"INVALID_OPERATOR_PENDING_REQUEST");continue;
   }
   try{
    const store=new PromptOutbox(join(p.dataDir,"outbox.json"));
    reply(id,await store.pendingOperatorChatAttempt(p.workspaceId));
   }catch(e){
    const code=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"OPERATOR_CHAT_PENDING_FAILED");
   }
   continue;
  }
  // Private lock-owner inspection/recovery. The authenticated Tauri
  // host selects dataDir and requires an OS confirmation before recover.
  if(req.method==="lazyprompting/operatorChatLock"&&native){
   const p=req.params;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      Object.keys(p).sort().join(",")!=="action,dataDir,ownerToken"||
      !["inspect","recover"].includes(p.action)||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096||
      (p.action==="inspect"?p.ownerToken!==null:
       typeof p.ownerToken!=="string")){
    error(id,-32602,"INVALID_OPERATOR_LOCK_REQUEST");continue;
   }
   try{
    const outbox=new PromptOutbox(join(p.dataDir,"outbox.json"));
    reply(id,p.action==="inspect"?
     await outbox.inspectInterruptedLock():
     await outbox.recoverInterruptedLock({ownerToken:p.ownerToken}));
   }catch(e){
    const code=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"OPERATOR_LOCK_RECOVERY_FAILED");
   }
   continue;
  }
  // Optional OpenAI Platform API mode: a separate API conversation,
  // approved and bounded by the Tauri main window. Never an ordinary
  // ChatGPT consumer browser result or a public MCP capability.
  if(req.method==="lazyprompting/apiGoal"&&apiGoals){
   const p=req.params;
   const action=p?.action;
   if(!p||typeof p!=="object"||Array.isArray(p)||
      !["start","status","stop"].includes(action)||
      p.workspaceId!=="api-workspace-01"||
      typeof p.dataDir!=="string"||!isAbsolute(p.dataDir)||
      p.dataDir.length>4096||
      (action==="start"
        ?Object.keys(p).sort().join(",")!==
          "action,dataDir,goal,maxOutputTokens,maxTotalTokens,maxTurns,model,workspaceId"
        :Object.keys(p).sort().join(",")!==
          "action,dataDir,runId,workspaceId")){
    error(id,-32602,"INVALID_API_GOAL_REQUEST");continue;
   }
   try{
    const result=action==="start"?await apiGoals.start({
     dataDir:p.dataDir,workspaceId:p.workspaceId,
     goal:p.goal,model:p.model,maxTurns:p.maxTurns,
     maxOutputTokens:p.maxOutputTokens,maxTotalTokens:p.maxTotalTokens
    }):action==="status"?await apiGoals.status({
     dataDir:p.dataDir,workspaceId:p.workspaceId,runId:p.runId
    }):await apiGoals.stop({
     dataDir:p.dataDir,workspaceId:p.workspaceId,runId:p.runId
    });
    reply(id,result);
   }catch(e){
    const code=String(e?.message??"");
    // Never return network bodies, credentials or model output in errors.
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:
     "API_GOAL_REQUEST_FAILED");
   }
   continue;
  }
  if(req.method==="lazyprompting/codex"&&native){
   const params=req.params??{};
   if(params.action==="goalRun"){
    let release;
    try{
     release=activeGoals.acquire({
      dataDir:params.dataDir,cwd:params.cwd,stopFile:params.stopFile,coding:params.coding??null
     });
    }catch(e){
     const code=String(e?.message??"");
     error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"GOAL_ADMISSION_FAILED");
     continue;
    }
    let ready, failed;
    const startup=new Promise((resolve,reject)=>{ready=resolve;failed=reject;});
    // Each admitted run owns a distinct checkpoint and subprocess.
    void runReadOnlyGoal(params,{onReady:ready}).catch(failed).finally(release);
    try{
     await startup;
     reply(id,{status:"STARTING"});
    }catch(e){
     const code=String(e?.message??"");
     error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"GOAL_START_FAILED");
    }
    continue;
   }
   try {
    if(!codex){
     codex=await createDesktopCodexRuntime(params);
     codexConfig={dataDir:params.dataDir,executable:params.executable};
    }
    if(params.dataDir!==codexConfig.dataDir||params.executable!==codexConfig.executable)
     throw new Error("CODEX_LAUNCH_CONFIG_CHANGED");
    reply(id,await codex.run(params));
   } catch(e) {
    const code=String(e?.message??"");
    error(id,-32000,/^[A-Z_]{1,80}$/.test(code)?code:"CODEX_REQUEST_FAILED");
   }
   continue;
  }
  if(req.method!=="tools/call"){error(id,-32601,"Method not found");continue;}
  const name=req.params?.name,args=req.params?.arguments??{};
  const spec=TOOL_SPECS.find(x=>x.name===name);
  if(!spec||!validateInput(spec.inputSchema,args)){error(id,-32602,"Invalid tool arguments");continue;}
  let result;
  try{
   if(name==="status")result=router.status();
   else if(name==="search_capabilities")result=router.search(args.query,args.limit??4);
   else if(name==="describe_capability")result=router.describe(args.name);
   else result=await router.invoke(args.name,args.arguments??{},req.params?._meta?.["lazyprompting/grant"]);
  }catch(e){result={status:"ERROR",code:String(e?.message??e).slice(0,160)};}
  reply(id,toolResult(result));
 }
}finally{native?.destroy();await codex?.close();await router.close();}
