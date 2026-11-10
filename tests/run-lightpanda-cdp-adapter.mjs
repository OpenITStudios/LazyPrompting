import assert from "node:assert/strict";
import {LightpandaCdpAdapter} from "../src/browser/lightpanda-cdp-adapter.mjs";
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://example.com:9222"}),/INVALID_CDP_ENDPOINT/);
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",allowedOrigins:["https://chatgpt.com"]}),/INVALID_ALLOWED_ORIGIN/);
const events=[];
const connect=async()=>{
 const contexts=[];
 return {contexts:()=>contexts,newContext:async()=>{
  const page={goto:async url=>{events.push(url);page.current=url},url:()=>page.current,title:async()=>"Local Test"};
  const ctx={route:async()=>{},newPage:async()=>page,close:async()=>{events.push("context-close")}};
  contexts.push(ctx);return ctx;
 },close:async()=>{events.push("browser-close")}};
};
const adapter=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect});
assert.throws(()=>adapter.validate("https://example.com"),/BROWSER_ORIGIN_DENIED/);
assert.throws(()=>adapter.validate("http://127.0.0.1:1425@evil.com/"),/BROWSER_ORIGIN_DENIED/);
await adapter.start();
assert.deepEqual(await adapter.open("workspace-01","http://127.0.0.1:1425/browser-preview.html"),{workspaceId:"workspace-01",url:"http://127.0.0.1:1425/browser-preview.html"});
await adapter.open("workspace-10","http://127.0.0.1:1425/browser-preview.html");
assert.equal((await adapter.snapshot("workspace-01")).title,"Local Test");
await assert.rejects(()=>adapter.open("workspace-11","http://127.0.0.1:1425/"),/INVALID_WORKSPACE/);
assert.equal((await adapter.closeWorkspace("workspace-01")).closed,true);
await adapter.close();
assert.equal(events.filter(x=>x==="context-close").length,2);
assert.equal(events.at(-1),"browser-close");
console.log("Lightpanda CDP adapter deterministic tests passed (mocked; no live browser)");

let release;
const gate=new Promise(resolve=>{release=resolve});
const order=[];
const browser2={contexts:()=>[],newContext:async()=>({route:async()=>{},newPage:async()=>{
 const page={current:"http://127.0.0.1:1425/",goto:async url=>{order.push("start");await gate;page.current=url;order.push("done")},url:()=>page.current,title:async()=>"Test"};return page;
},close:async()=>{order.push("close")}}),close:async()=>{}};
const queued=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect:async()=>browser2});
await queued.start();
const opening=queued.open("workspace-02","http://127.0.0.1:1425/browser-preview.html");
const closing=queued.closeWorkspace("workspace-02");
await Promise.resolve();await Promise.resolve();
release();
await opening;await closing;
assert.deepEqual(order,["start","done","close"]);
await queued.close();

let releaseConnect;
const connectGate=new Promise(resolve=>{releaseConnect=resolve});
let connects=0,disconnects=0;
const shared=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect:async()=>{
 connects++;await connectGate;
 return {contexts:()=>[],close:async()=>{disconnects++}};
}});
const startingA=shared.start();
const startingB=shared.start();
releaseConnect();
assert.equal((await startingA).connected,true);
assert.equal((await startingB).connected,true);
assert.equal(connects,1);
await shared.close();
assert.equal(disconnects,1);

const strict=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect});
await strict.start();
await assert.rejects(()=>strict.open("workspace-03","http://127.0.0.1:1425/admin"),/BROWSER_TARGET_DENIED/);
await assert.rejects(()=>strict.open("workspace-03","http://127.0.0.1:1425/browser-preview.html?token=x"),/BROWSER_TARGET_DENIED/);
assert.equal(strict.slots.size,0);
await strict.close();
