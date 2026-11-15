import assert from "node:assert/strict";
import {LightpandaCdpAdapter} from "../src/browser/lightpanda-cdp-adapter.mjs";
import {projectLightpandaControlIndex} from "../src/browser/lightpanda-control-index.mjs";
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

let releaseContext,contextStarted;
const contextGate=new Promise(resolve=>{releaseContext=resolve});
const contextEntered=new Promise(resolve=>{contextStarted=resolve});
let disposed=0,connectionDisposed=0;
const lateBrowser={contexts:()=>[],newContext:async()=>{
 contextStarted();await contextGate;
 return {route:async()=>{},newPage:async()=>({}),close:async()=>{disposed++}};
},close:async()=>{connectionDisposed++}};
const late=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect:async()=>lateBrowser});
await late.start();
const lateOpen=late.open("workspace-04","http://127.0.0.1:1425/browser-preview.html");
await contextEntered;
const lateShutdown=late.close();
releaseContext();
await assert.rejects(lateOpen,/CDP_CLOSING/);
await lateShutdown;
assert.equal(late.slots.size,0);
assert.equal(disposed,1);
assert.equal(connectionDisposed,1);

const redirected=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",connect});
await redirected.start();
await redirected.open("workspace-05","http://127.0.0.1:1425/browser-preview.html");
redirected.slots.get("workspace-05").page.current="http://127.0.0.1:1425/admin";
await assert.rejects(()=>redirected.snapshot("workspace-05"),/BROWSER_NAVIGATION_CHANGED/);
assert.equal(redirected.slots.has("workspace-05"),false);
await redirected.close();


// Jev-style indexed UI observation stays local-preview, read-only and
// display-only. These tests use mock CDP objects, never a running browser.
const semantic=[
 "1 RootWebArea 'Example'",
 "16 [i] link 'Learn more'",
 "17 [i] button 'Search'",
 "18 [i] textbox 'Search terms'",
 "19 [i] textbox 'API key'",
 "20 [i] textbox 'alice@example.com'",
 "21 [i] button '1234567890123456'"
].join("\n");
const projected=projectLightpandaControlIndex(semantic,{workspaceId:"workspace-01"});
assert.deepEqual(projected.content.split("\n"),[
 '#1 link "Learn more"',
 '#2 button "Search"',
 '#3 textbox "Search terms"'
]);
assert.equal(projected.items,3);
assert.match(projected.fingerprint,/^[a-f0-9]{64}$/);
assert.equal(projected.unchanged,false);
assert.notEqual(projectLightpandaControlIndex(semantic,{workspaceId:"workspace-02"}).fingerprint,
 projected.fingerprint);
assert.notEqual(projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",navigationEpoch:1}).fingerprint,projected.fingerprint);
assert.equal(projected.readOnly,true);
assert.equal(projected.actionAuthorized,false);
assert.equal(projected.displayIndexesOnly,true);
assert.equal(projected.snapshotLocalRefs,false);
assert.equal(projected.nextPromptAllowed,false);
assert.equal(projected.resultVerified,false);
assert.ok(!JSON.stringify(projected).includes("alice@example.com"));
assert.ok(!JSON.stringify(projected).includes("API key"));
assert.ok(!JSON.stringify(projected).includes("1234567890123456"));
for(const invalid of [
 {workspaceId:"workspace-11",value:semantic},
 {workspaceId:"workspace-01",value:{}},
 {workspaceId:"workspace-01",value:"x".repeat(65537)}
])assert.throws(()=>projectLightpandaControlIndex(invalid.value,{
 workspaceId:invalid.workspaceId}),/LIGHTPANDA_CONTROL_INDEX_INVALID/);
const many=projectLightpandaControlIndex(Array.from({length:60},(_,i)=>
 `${i+1} [i] button 'Action ${i+1}'`).join("\n"),{workspaceId:"workspace-10"});
assert.equal(many.items,36);
assert.equal(many.truncated,true);
assert.ok(Buffer.byteLength(many.content,"utf8")<=4096);
assert.equal(many.content.includes("Action 37"),false);
const fallback=projectLightpandaControlIndex("1 RootWebArea 'Empty'",{
 workspaceId:"workspace-01"});
assert.equal(fallback.items,0);
assert.equal(fallback.content,"(no eligible interactive controls)");
assert.throws(()=>projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",navigationEpoch:-1}),/LIGHTPANDA_CONTROL_INDEX_INVALID/);
let reads=0,detachCount=0;
let liveSemantic=semantic,staleNextRead=false;
const indexedBrowser={contexts:()=>[],newContext:async()=>{
 const listeners={};
 const page={current:null,context:()=>context,goto:async url=>{page.current=url},
  on:(event,callback)=>{listeners[event]=callback},
  url:()=>page.current,title:async()=>"Demo"};
 const context={route:async()=>{},newPage:async()=>page,close:async()=>{},
  newCDPSession:async()=>({send:async(name,args)=>{
   reads++;
   assert.equal(name,"LP.getSemanticTree");
   assert.deepEqual(args,{format:"text",interactiveOnly:true});
   if(staleNextRead){
    staleNextRead=false;listeners.load?.();
   }
   return {semanticTree:liveSemantic};
  },detach:async()=>{detachCount++}})};
 return context;
},close:async()=>{}};
const indexed=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 connect:async()=>indexedBrowser});
await indexed.start();
await indexed.open("workspace-01","http://127.0.0.1:1425/browser-preview.html");
const compact=await indexed.snapshot("workspace-01","index");
assert.equal(compact.source,"LIGHTPANDA_LOCAL_PREVIEW_CONTROL_INDEX");
assert.equal(compact.items,3);
assert.equal(compact.unchanged,false);
assert.match(compact.fingerprint,/^[a-f0-9]{64}$/);
assert.equal(reads,1);
const unchanged=await indexed.snapshot("workspace-01","index",compact.fingerprint);
assert.equal(unchanged.unchanged,true);
assert.equal(unchanged.content,"");
assert.equal(unchanged.fingerprint,compact.fingerprint);
assert.ok(Buffer.byteLength(JSON.stringify(unchanged),"utf8")<
 Buffer.byteLength(JSON.stringify(compact),"utf8"),
 "unchanged uses fewer JSON bytes; not measured model tokens");
assert.equal(reads,2);
liveSemantic=semantic.replace("button 'Search'","button 'Find'");
const changed=await indexed.snapshot("workspace-01","index",compact.fingerprint);
assert.equal(changed.unchanged,false);
assert.match(changed.content,/button "Find"/);
assert.notEqual(changed.fingerprint,compact.fingerprint);
staleNextRead=true;
await assert.rejects(indexed.snapshot("workspace-01","index",changed.fingerprint),
 /LIGHTPANDA_INDEX_STALE/);
const afterReload=await indexed.snapshot("workspace-01","index",changed.fingerprint);
assert.equal(afterReload.unchanged,false);
assert.notEqual(afterReload.fingerprint,changed.fingerprint);
await indexed.open("workspace-01","http://127.0.0.1:1425/browser-preview.html");
const afterSameUrlReload=await indexed.snapshot("workspace-01","index",
 afterReload.fingerprint);
assert.equal(afterSameUrlReload.unchanged,false);
assert.notEqual(afterSameUrlReload.fingerprint,afterReload.fingerprint);
await assert.rejects(indexed.snapshot("workspace-01","metadata",compact.fingerprint),
 /LIGHTPANDA_SNAPSHOT_CURSOR_INVALID/);
await assert.rejects(indexed.snapshot("workspace-01","index","x"),
 /LIGHTPANDA_SNAPSHOT_CURSOR_INVALID/);
assert.equal(detachCount,6);
assert.equal((await indexed.snapshot("workspace-01")).title,"Demo");
assert.equal(reads,6); // metadata default makes no semantic query
await assert.rejects(indexed.snapshot("workspace-01","execute"),
 /INVALID_SNAPSHOT_VIEW/);
assert.equal(reads,6); // invalid mode performs no CDP observation
await indexed.close();

const withoutIndexedMethod=new LightpandaCdpAdapter({
 endpoint:"http://127.0.0.1:9222",connect:async()=>browser2});
await withoutIndexedMethod.start();
await withoutIndexedMethod.open("workspace-02",
 "http://127.0.0.1:1425/browser-preview.html");
await assert.rejects(withoutIndexedMethod.snapshot("workspace-02","index"),
 /LIGHTPANDA_INDEX_FRESHNESS_UNAVAILABLE/);
await withoutIndexedMethod.close();
