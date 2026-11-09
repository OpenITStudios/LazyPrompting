import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
const child=spawn(process.execPath,["src/mcp/server.mjs"],{stdio:["pipe","pipe","pipe"]});
const pending=new Map();
const lines=createInterface({input:child.stdout});
lines.on("line",line=>{
  const msg=JSON.parse(line);
  if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}
});
let id=0;
function request(method,params){
  const next=++id;
  const promise=new Promise(resolve=>pending.set(next,resolve));
  child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:next,method,params})+"\n");
  return promise;
}
try{
  const init=await request("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"test",version:"1"}});
  assert.equal(init.result.serverInfo.name,"lazyprompting");
  const list=await request("tools/list",{});
  assert.equal(list.result.tools.length,3);
  const status=await request("tools/call",{name:"supervisor_status",arguments:{}});
  assert.match(status.result.content[0].text,/READ_ONLY/);
  const unknown=await request("tools/call",{name:"browser_open",arguments:{url:"https://chatgpt.com"}});
  assert.equal(unknown.error.code,-32602);
  console.log("MCP smoke: 4/4 passed");
}finally{child.kill();}
