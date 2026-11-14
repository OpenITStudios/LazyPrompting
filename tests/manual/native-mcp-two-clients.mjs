// Explicit operator-only Windows acceptance. Opens workspace-10, no navigation.
// Do NOT add this to automated test:* scripts.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {createInterface} from "node:readline";

if(process.platform!=="win32" || process.env.LAZY_MCP_OPERATOR_QA!=="yes"){
  console.error("Requires Windows and LAZY_MCP_OPERATOR_QA=yes with operator consent.");
  process.exit(2);
}
const executable=join(process.env.LOCALAPPDATA??"", "LazyPrompting", "lazyprompting-desktop.exe");
if(!existsSync(executable))throw Error("INSTALLED_LAZYPROMPTING_NOT_FOUND");

async function mcpClient(label){
  const child=spawn(executable,["mcp"],{stdio:["pipe","pipe","pipe"],windowsHide:true});
  const pending=new Map(),reader=createInterface({input:child.stdout,crlfDelay:Infinity});
  let nextId=0,stderr="";
  child.stderr.on("data",chunk=>{stderr=(stderr+chunk).slice(-4000);});
  child.on("exit",code=>{
    for(const [id,entry] of pending){
      clearTimeout(entry.timer);entry.reject(Error(`${label} exited ${code}: ${stderr}`));pending.delete(id);
    }
  });
  reader.on("line",line=>{
    let parsed;
    try{parsed=JSON.parse(line);}catch{return;}
    if(!pending.has(parsed.id))return;
    const entry=pending.get(parsed.id);pending.delete(parsed.id);clearTimeout(entry.timer);
    if(parsed.error)entry.reject(Error(`${label}: ${parsed.error.message}`));
    else entry.resolve(parsed.result);
  });
  const request=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error(`${label}: ${method} timed out`));},60_000);
    pending.set(id,{timer,resolve,reject});
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");
  });
  const notify=method=>child.stdin.write(JSON.stringify({jsonrpc:"2.0",method})+"\n");
  const init=await request("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:label,version:"1"}});
  assert.equal(init.serverInfo?.name,"lazyprompting");
  notify("notifications/initialized");
  const tools=await request("tools/list");
  assert.deepEqual(tools.tools.map(t=>t.name),["status","search_capabilities","describe_capability","invoke_capability"]);
  return {
    child,
    invoke:(name,args)=>request("tools/call",{name:"invoke_capability",arguments:{name,arguments:args}}),
    close:()=>new Promise(resolve=>{
      if(child.exitCode!==null){resolve();return;}
      child.once("exit",()=>resolve());child.stdin.end();
      setTimeout(()=>{if(child.exitCode===null)child.kill();},2000).unref();
    })
  };
}

const workspaceId="workspace-10";
let a,b;
try{
  a=await mcpClient("qa-client-a");
  b=await mcpClient("qa-client-b");
  const opened=await a.invoke("workspace_browser.open",{workspaceId});
  assert.notEqual(opened.isError,true,JSON.stringify(opened));
  const handoff=await a.invoke("workspace_chat.prepare_handoff",{
    workspaceId,
    goal:"Inspect the scoped source",
    acceptance:["Report source evidence without changing files"]
  });
  assert.notEqual(handoff.isError,true,JSON.stringify(handoff));
  const draft=handoff.structuredContent??{};
  assert.equal(draft.status,"DRAFT_ONLY");
  assert.equal(draft.delivery,"MANUAL_COPY_PASTE");
  assert.equal(draft.sent,false);
  assert.equal(draft.sessionVerified,false);
  assert.equal(draft.nextPromptAllowed,false);
  assert.match(draft.draftPrompt,/Inspect the scoped source/);
  const crossClientHandoff=await b.invoke("workspace_chat.prepare_handoff",{
    workspaceId,goal:"Foreign client",acceptance:["Must be denied"]
  });
  assert.equal(crossClientHandoff.isError,true,JSON.stringify(crossClientHandoff));
  assert.match(JSON.stringify(crossClientHandoff),/WORKSPACE_OWNED_BY_OTHER_CLIENT/);
  const denied=await b.invoke("workspace_browser.location",{workspaceId});
  assert.equal(denied.isError,true,JSON.stringify(denied));
  assert.match(JSON.stringify(denied),/WORKSPACE_OWNED_BY_OTHER_CLIENT/);
  const released=await a.invoke("workspace_browser.release",{workspaceId});
  assert.notEqual(released.isError,true,JSON.stringify(released));
  const adopted=await b.invoke("workspace_browser.location",{workspaceId});
  assert.notEqual(adopted.isError,true,JSON.stringify(adopted));
  await b.close();b=null;
  const reclaimed=await a.invoke("workspace_browser.location",{workspaceId});
  assert.notEqual(reclaimed.isError,true,JSON.stringify(reclaimed));
  console.log("PASS: two installed stdio clients, manual draft isolation, ownership, release, and reclaim after exit");
  console.log("Operator must inspect/copy/dismiss the main-window draft separately; this script does not prove UI delivery.");
} finally{
  if(b)await b.close();
  if(a)await a.close();
}
