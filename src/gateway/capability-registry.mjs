// Declarative public capability catalog. Registration does not imply runtime readiness.
const CAPABILITIES=Object.freeze([
 {name:"supervisor.status",tier:"PRIMARY",description:"Read supervisor capability and connection status",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"gateway"},
 {name:"supervisor.evaluate",tier:"PRIMARY",description:"Compute one bounded continuation decision without dispatch",inputSchema:{type:"object",properties:{input:{type:"object"}},required:["input"],additionalProperties:false},effect:"PURE",backend:"supervisor"},
 {name:"checkpoint.read",tier:"SUPPORT",description:"Read recovery state from configured checkpoint storage",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"checkpoint"},
 {name:"browser.open",tier:"EXPERIMENTAL",description:"Navigate explicitly approved public HTTPS origin",inputSchema:{type:"object",properties:{url:{type:"string",minLength:1,maxLength:2048}},required:["url"],additionalProperties:false},effect:"EXTERNAL_READ",backend:"browser"},
 {name:"browser.snapshot",tier:"EXPERIMENTAL",description:"Read bounded text from approved browser page",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"READ",backend:"browser"},
 {name:"browser.close",tier:"EXPERIMENTAL",description:"Close the approved browser session",inputSchema:{type:"object",properties:{},additionalProperties:false},effect:"SESSION",backend:"browser"}
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
