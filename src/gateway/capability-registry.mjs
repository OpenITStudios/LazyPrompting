// Declarative public capability catalog. Registration does not imply runtime readiness.
const CAPABILITIES=Object.freeze([
 {name:"supervisor.status",tier:"PRIMARY",description:"Read supervisor capability and connection status",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"gateway"},
 {name:"supervisor.evaluate",tier:"PRIMARY",description:"Compute one bounded continuation decision without dispatch",inputSchema:{type:"object",properties:{input:{type:"object"}},required:["input"],additionalProperties:false},effect:"PURE",backend:"supervisor"},
 {name:"checkpoint.read",tier:"SUPPORT",description:"Read recovery state from configured checkpoint storage",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"checkpoint"},
 {name:"browser.open",tier:"EXPERIMENTAL",description:"Navigate explicitly approved public HTTPS origin",inputSchema:{type:"object",properties:{url:{type:"string",minLength:1,maxLength:2048}},required:["url"],additionalProperties:false},effect:"EXTERNAL_READ",backend:"browser"},
 {name:"browser.snapshot",tier:"EXPERIMENTAL",description:"Read bounded text from approved browser page",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"browser"},
 {name:"browser.close",tier:"EXPERIMENTAL",description:"Close the approved browser session",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"SESSION",backend:"browser"},
 {name:"lightpanda.open",tier:"EXPERIMENTAL",description:"Open an explicitly authorized local test page in one workspace",inputSchema:{type:"object",properties:{workspaceId:{type:"string",pattern:"^workspace-(0[1-9]|10)$"},url:{type:"string",minLength:1,maxLength:2048}},required:["workspaceId","url"],additionalProperties:false},effect:"LOCAL_BROWSER",backend:"lightpanda"},
 {name:"lightpanda.snapshot",tier:"EXPERIMENTAL",description:"Read URL/title or, on the opt-in JS adapter only, a bounded non-executable indexed control summary from an authorized local preview workspace",inputSchema:{type:"object",properties:{workspaceId:{type:"string",pattern:"^workspace-(0[1-9]|10)$"},view:{type:"string",minLength:5,maxLength:8},sinceFingerprint:{type:"string",minLength:64,maxLength:64}},required:["workspaceId"],additionalProperties:false},effect:"READ",backend:"lightpanda"},
 {name:"lightpanda.review",tier:"EXPERIMENTAL",
  description:"Revalidate one indexed target in the already open local preview without execution; requires native admission and exact snapshot fingerprint",
  inputSchema:{type:"object",properties:{
    workspaceId:{type:"string",minLength:12,maxLength:12},
    expectedFingerprint:{type:"string",minLength:64,maxLength:64},
    displayIndex:{type:"integer",minimum:1,maximum:36},
    operation:{type:"string",minLength:4,maxLength:9}
  },required:["workspaceId","expectedFingerprint","displayIndex","operation"],additionalProperties:false},
  effect:"READ",backend:"lightpanda"},
 {name:"lightpanda.close",tier:"EXPERIMENTAL",description:"Close one authorized local browser workspace",inputSchema:{type:"object",properties:{workspaceId:{type:"string",pattern:"^workspace-(0[1-9]|10)$"}},required:["workspaceId"],additionalProperties:false},effect:"SESSION",backend:"lightpanda"},
 // The only chat capability added here is an injected, synthetic localhost fixture.
 // Production desktop MCP and standalone gateway do NOT provide the host bridge.
 {name:"workspace_chat.fixture_submit",tier:"EXPERIMENTAL",description:"Test-only submit to an owned localhost chat fixture; requires independently admitted native host",inputSchema:{type:"object",properties:{workspaceId:{type:"string",minLength:12,maxLength:12},epoch:{type:"integer",minimum:1},promptId:{type:"string",minLength:1,maxLength:128},origin:{type:"string",minLength:1,maxLength:2048},text:{type:"string",minLength:1,maxLength:12000}},required:["workspaceId","epoch","promptId","origin","text"],additionalProperties:false},effect:"LOCAL_FIXTURE",backend:"fixture"},
 {name:"workspace_chat.fixture_status",tier:"EXPERIMENTAL",description:"Read one owned localhost chat fixture status; never returns chat contents",inputSchema:{type:"object",properties:{workspaceId:{type:"string",minLength:12,maxLength:12}},required:["workspaceId"],additionalProperties:false},effect:"READ",backend:"fixture"},
  {name:"chat_goal.progress_review",tier:"EXPERIMENTAL",
  description:"Host-injected, read-only goal review of one ACKed turn using trusted completion and GitHub evidence; never dispatches",
  inputSchema:{type:"object",properties:{
   workspaceId:{type:"string",minLength:12,maxLength:12},
   maxCommits:{type:"integer",minimum:1,maximum:100},
   proposal:{type:"object",properties:{
    outcome:{type:"string",minLength:1,maxLength:20},
    requiresApproval:{type:"boolean"},blocked:{type:"boolean"},
    nextAction:{type:"object",properties:{
     action:{type:"string",minLength:1,maxLength:1024},
     owner:{type:"string",minLength:1,maxLength:1024},
     proof:{type:"string",minLength:1,maxLength:1024},
     requiresApproval:{type:"boolean"}
    },additionalProperties:false}
   },additionalProperties:false},
   receipt:{type:"object",properties:{},additionalProperties:true}
  },required:["workspaceId"],additionalProperties:false},
  effect:"READ",backend:"goalreview"},
 {name:"code_mode.catalog",tier:"PRIMARY",description:"Discover the confined read-only Code Mode SDK and limits",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"codemode"},
 {name:"code_mode.execute",tier:"PRIMARY",description:"Execute bounded JS-subset over approved read-only tools; no host globals or side effects",inputSchema:{type:"object",properties:{code:{type:"string",minLength:1,maxLength:4096}},required:["code"],additionalProperties:false},effect:"PURE",backend:"codemode"},
]);
export const listCapabilities=()=>CAPABILITIES.map(x=>({...x}));
export function getCapability(name){return CAPABILITIES.find(x=>x.name===name)??null;}
export function searchCapabilities(query,{limit=4,enabled=new Set(["gateway","supervisor","checkpoint"])}={}){
 if(typeof query!=="string"||query.length>256||!Number.isSafeInteger(limit)||limit<1||limit>8)throw new Error("INVALID_SEARCH");
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean);
 return CAPABILITIES.filter(x=>enabled.has(x.backend)).map(x=>{
  const hay=(x.name+" "+x.description+" "+x.tier).toLowerCase();
  return {x,score:terms.reduce((n,t)=>n+(x.name.toLowerCase().includes(t)?4:hay.includes(t)?1:0),0)};
 }).filter(x=>terms.length===0||x.score>0).sort((a,b)=>b.score-a.score||a.x.name.localeCompare(b.x.name)).slice(0,limit)
 .map(({x})=>({name:x.name,tier:x.tier,description:x.description,effect:x.effect}));
}
