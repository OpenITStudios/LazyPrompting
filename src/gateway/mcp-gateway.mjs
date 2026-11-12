import {createInterface} from "node:readline";
import {CapabilityRouter} from "./capability-router.mjs";
import {CheckpointStore} from "../supervisor/checkpoint-store.mjs";
import {toMcpResult} from "./result-projection.mjs";
import {validateInput} from "./input-validation.mjs";
import {negotiateProtocol} from "./protocol-contract.mjs";
import {connectNativeHost,invokeNativeLightpanda} from "./native-ipc.mjs";
import {createDesktopCodexRuntime} from "../transport/desktop-codex-runtime.mjs";
import {runReadOnlyGoal} from "../transport/goal-codex-runner.mjs";
import {ActiveGoalRegistry} from "../runtime/active-goal-registry.mjs";

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
