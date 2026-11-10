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
