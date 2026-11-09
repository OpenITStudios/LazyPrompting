import { createInterface } from "node:readline";
import { evaluateContinuation } from "../supervisor/decision-engine.mjs";
import { CheckpointStore } from "../supervisor/checkpoint-store.mjs";
import { RemoteBrowser } from "../browser/remote-browser.mjs";

const VERSION = "2025-03-26";
const browserOrigins=(process.env.LAZY_BROWSER_ORIGINS??"").split(",").map(x=>x.trim()).filter(Boolean);
const browser=browserOrigins.length?new RemoteBrowser({allowedOrigins:browserOrigins}):null;
const TOOLS = [
  {name:"supervisor_status",description:"Read-only capabilities and safety status",inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"supervisor_evaluate",description:"Pure continuation decision, no dispatch",inputSchema:{type:"object",properties:{input:{type:"object"}},required:["input"],additionalProperties:false}},
  {name:"checkpoint_read",description:"Read checkpoint from a configured trusted local store",inputSchema:{type:"object",properties:{},additionalProperties:false}},
  ...(browser?[{name:"browser_open",description:"Navigate to an explicitly allowlisted public HTTPS origin (read only)",inputSchema:{type:"object",properties:{url:{type:"string"}},required:["url"],additionalProperties:false}},
    {name:"browser_snapshot",description:"Read bounded text from current allowlisted page",inputSchema:{type:"object",properties:{},additionalProperties:false}},
    {name:"browser_close",description:"Close browser session",inputSchema:{type:"object",properties:{},additionalProperties:false}}]:[])
];
const output = x => process.stdout.write(JSON.stringify(x)+"\n");
const response = (id,result) => output({jsonrpc:"2.0",id,result});
const error = (id,code,message) => output({jsonrpc:"2.0",id,error:{code,message}});
const textResult = value => ({content:[{type:"text",text:JSON.stringify(value)}],isError:false});
const MAX_LINE=1024*1024;
const store=process.env.LAZY_CHECKPOINT_FILE?new CheckpointStore(process.env.LAZY_CHECKPOINT_FILE):null;
async function handle(req){
  if(!req||req.jsonrpc!=="2.0"||typeof req.method!=="string") return error(req?.id??null,-32600,"Invalid Request");
  if(req.method==="notifications/initialized") return;
  if(!Object.hasOwn(req,"id")) return;
  const id=req.id;
  if(req.method==="initialize") return response(id,{protocolVersion:VERSION,capabilities:{tools:{listChanged:false}},serverInfo:{name:"lazyprompting",version:"0.1.0"}});
  if(req.method==="ping") return response(id,{});
  if(req.method==="tools/list") return response(id,{tools:TOOLS});
  if(req.method!=="tools/call") return error(id,-32601,"Method not found");
  const name=req.params?.name, args=req.params?.arguments??{};
  if(!TOOLS.some(t=>t.name===name)) return error(id,-32602,"Unknown tool");
  if(!args||typeof args!=="object"||Array.isArray(args)) return error(id,-32602,"Invalid arguments");
  try {
    if(name==="supervisor_status") return response(id,textResult({mode:"READ_ONLY",browser:browser?"ALLOWLISTED_READ_ONLY":"DISABLED",dispatch:"DISABLED",tools:TOOLS.map(t=>t.name)}));
    if(name==="supervisor_evaluate") {
      if(!args.input||typeof args.input!=="object"||Array.isArray(args.input)) return error(id,-32602,"input object required");
      return response(id,textResult(evaluateContinuation(args.input)));
    }
    if(name==="checkpoint_read") return response(id,textResult(store?await store.recovery():{state:"NOT_CONFIGURED"}));
    if(name==="browser_open") {
      if(typeof args.url!=="string")return error(id,-32602,"url required");
      if(!browser.page)await browser.start();
      return response(id,textResult(await browser.navigate(args.url)));
    }
    if(name==="browser_snapshot")return response(id,textResult(await browser.snapshot()));
    if(name==="browser_close"){await browser.close();return response(id,textResult({state:"CLOSED"}));}
  } catch(e){return response(id,{content:[{type:"text",text:"Tool failed: "+String(e?.message??e)}],isError:true});}
}
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of lines){
  if(Buffer.byteLength(line,"utf8")>MAX_LINE){error(null,-32600,"Request too large");continue;}
  let req;
  try{req=JSON.parse(line);}catch{error(null,-32700,"Parse error");continue;}
  await handle(req);
}
