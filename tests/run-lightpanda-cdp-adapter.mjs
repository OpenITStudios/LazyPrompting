import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {LightpandaCdpAdapter} from "../src/browser/lightpanda-cdp-adapter.mjs";
// The actual in-app/WSL preview fixture must expose controls for a real
// indexed/typed-action smoke, while remaining offline and script-free.
// This checks the source fixture only; it does NOT run a browser.
const preview=readFileSync(fileURLToPath(new URL(
 "../apps/desktop/public/browser-preview.html",import.meta.url)),"utf8");
assert.match(preview,/<title>Browser 01 · Local WebView Proof<\/title>/);
assert.match(preview,/<input[^>]*type="search"[^>]*aria-label="Preview query"/);
assert.match(preview,/<input[^>]*type="checkbox"/);
assert.match(preview,/<button[^>]*type="button"/);
assert.doesNotMatch(preview,/<script\b/i);
assert.doesNotMatch(preview,/<form\b/i);
assert.doesNotMatch(preview,/<a\s[^>]*href=/i);
assert.doesNotMatch(preview,/<(iframe|img|video|link)\b/i);
import {projectLightpandaControlIndex} from "../src/browser/lightpanda-control-index.mjs";
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://example.com:9222"}),/INVALID_CDP_ENDPOINT/);
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",allowedOrigins:["https://chatgpt.com"]}),/INVALID_ALLOWED_ORIGIN/);
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 allowedOrigins:["http://127.0.0.1:1426"]}),/INVALID_ALLOWED_ORIGIN/);
assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 allowedOrigins:["http://127.0.0.1:1425/other"]}),/INVALID_ALLOWED_ORIGIN/);
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
const indexKey=Buffer.alloc(32,0x47); // deterministic fixture key; production uses randomBytes
const projected=projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",fingerprintKey:indexKey});
assert.deepEqual(projected.content.split("\n"),[
 '#1 link "Learn more"',
 '#2 button "Search"',
 '#3 textbox "Search terms"'
]);
assert.equal(projected.items,3);
assert.match(projected.fingerprint,/^[a-f0-9]{64}$/);
assert.equal(projected.unchanged,false);
assert.notEqual(projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-02",fingerprintKey:indexKey}).fingerprint,
 projected.fingerprint);
assert.notEqual(projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",fingerprintKey:Buffer.alloc(32,0x48)}).fingerprint,
 projected.fingerprint);
// The public control list is byte-identical, yet its backend node differs.
// Comparison must NOT return a stale/unchanged shortcut.
const replacedId=projectLightpandaControlIndex(
 semantic.replace("17 [i] button 'Search'","27 [i] button 'Search'"),
 {workspaceId:"workspace-01",fingerprintKey:indexKey});
assert.equal(replacedId.content,projected.content);
assert.notEqual(replacedId.fingerprint,projected.fingerprint);
assert.ok(!JSON.stringify(projected).includes("backendNodeId"));
assert.ok(!JSON.stringify(projected).includes("17 [i]"));
assert.throws(()=>projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01"}),/LIGHTPANDA_CONTROL_INDEX_INVALID/);
assert.throws(()=>projectLightpandaControlIndex(
 "16 [i] link 'Learn more'\n16 [i] button 'Search'",
 {workspaceId:"workspace-01",fingerprintKey:indexKey}),
 /LIGHTPANDA_CONTROL_INDEX_AMBIGUOUS/);
assert.throws(()=>projectLightpandaControlIndex(
 "2147483648 [i] button 'Overflow'",
 {workspaceId:"workspace-01",fingerprintKey:indexKey}),
 /LIGHTPANDA_CONTROL_INDEX_INVALID/);
assert.notEqual(projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",navigationEpoch:1,
 fingerprintKey:indexKey}).fingerprint,projected.fingerprint);
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
 workspaceId:invalid.workspaceId,fingerprintKey:indexKey}),
 /LIGHTPANDA_CONTROL_INDEX_INVALID/);
const many=projectLightpandaControlIndex(Array.from({length:60},(_,i)=>
 `${i+1} [i] button 'Action ${i+1}'`).join("\n"),{workspaceId:"workspace-10",fingerprintKey:indexKey});
assert.equal(many.items,36);
assert.equal(many.truncated,true);
assert.ok(Buffer.byteLength(many.content,"utf8")<=4096);
assert.equal(many.content.includes("Action 37"),false);
const fallback=projectLightpandaControlIndex("1 RootWebArea 'Empty'",{
 workspaceId:"workspace-01",fingerprintKey:indexKey});
assert.equal(fallback.items,0);
assert.equal(fallback.content,"(no eligible interactive controls)");
assert.throws(()=>projectLightpandaControlIndex(semantic,{
 workspaceId:"workspace-01",navigationEpoch:-1,fingerprintKey:indexKey}),
 /LIGHTPANDA_CONTROL_INDEX_INVALID/);
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


// A stalled semantic-tree request must release the workspace queue without
// fabricating an empty index or retrying. No live Lightpanda process is used.
let timedOutDetaches=0;
const hungBrowser={contexts:()=>[],newContext:async()=>{
 const page={current:null,on:()=>{},context:()=>context,
  goto:async url=>{page.current=url},url:()=>page.current,
  title:async()=>"Preview"};
 const context={route:async()=>{},newPage:async()=>page,close:async()=>{},
  newCDPSession:async()=>({
   send:async()=>new Promise(()=>{}),
   detach:async()=>{timedOutDetaches++}
  })};
 return context;
},close:async()=>{}};
const stalled=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 indexTimeoutMs:30,connect:async()=>hungBrowser});
await stalled.start();
await stalled.open("workspace-03","http://127.0.0.1:1425/browser-preview.html");
await assert.rejects(stalled.snapshot("workspace-03","index"),
 /LIGHTPANDA_CONTROL_INDEX_TIMEOUT/);
assert.equal(timedOutDetaches,1);
assert.equal(stalled.slots.get("workspace-03").lastIndexFingerprint,null);
assert.equal((await stalled.snapshot("workspace-03","metadata")).title,"Preview");
// Successful metadata read proves serialization can advance after timeout.
await stalled.close();
for(const indexTimeoutMs of [0,24,2501,1.5,NaN])
 assert.throws(()=>new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
  indexTimeoutMs}),/INVALID_INDEX_TIMEOUT/);

// A late CDP session allocation after timeout is detached, never used to
// start an asynchronous semantic-tree read after its grant has expired.
let releaseCreate,lateSendCount=0,lateDetachCount=0;
const creating=new Promise(resolve=>{releaseCreate=resolve});
const lateBrowser={contexts:()=>[],newContext:async()=>{
 const page={current:null,on:()=>{},context:()=>context,
  goto:async url=>{page.current=url},url:()=>page.current,
  title:async()=>"Delayed"};
 const context={route:async()=>{},newPage:async()=>page,close:async()=>{},
  newCDPSession:()=>creating};
 return context;
},close:async()=>{}};
const lateSessionAdapter=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 indexTimeoutMs:30,connect:async()=>lateBrowser});
await lateSessionAdapter.start();
await lateSessionAdapter.open("workspace-04","http://127.0.0.1:1425/browser-preview.html");
await assert.rejects(lateSessionAdapter.snapshot("workspace-04","index"),
 /LIGHTPANDA_CONTROL_INDEX_TIMEOUT/);
releaseCreate({send:async()=>{lateSendCount++},
 detach:async()=>{lateDetachCount++}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(lateSendCount,0);
assert.equal(lateDetachCount,1);
await lateSessionAdapter.close();


// Host-approved local-preview target review. It re-reads the current
// semantic tree and privately checks LP.getNodeDetails, but never mutates
// the page or reveals backend IDs/selectors/values in its public receipt.
let detailCalls=0,reviewTreeReads=0,reviewDetach=0;
let detailMode="ok",reviewTree=semantic;
const reviewBrowser={contexts:()=>[],newContext:async()=>{
 const events={};
 const page={current:null,on:(name,cb)=>{events[name]=cb},
  context:()=>context,goto:async url=>{page.current=url},
  url:()=>page.current,title:async()=>"Local review"};
 const context={route:async()=>{},newPage:async()=>page,close:async()=>{},
  newCDPSession:async()=>{
   const session={send:async(name,args)=>{
    if(name==="LP.getSemanticTree"){
     reviewTreeReads++;
     assert.deepEqual(args,{format:"text",interactiveOnly:true});
     return {semanticTree:reviewTree};
    }
    if(name==="LP.getNodeDetails"){
     detailCalls++;
     assert.ok(Number.isSafeInteger(args.backendNodeId));
     if(detailMode==="navigate"){events.load?.();}
     if(detailMode==="unsupported")throw Error("Unsupported LP method");
     const roles={16:["link","Learn more"],17:["button","Search"],
      18:["textbox","Search terms"]};
     const [role,label]=roles[args.backendNodeId]??["button","Unknown"];
     return {nodeDetails:{
      backendNodeId:detailMode==="foreignId"?
       args.backendNodeId+1:args.backendNodeId,role,
      name:detailMode==="mismatch"?"Changed":label,
      isInteractive:true,inputType:detailMode==="password"?
       "password":role==="textbox"?"text":undefined,
      selector:"#private-selector",value:"NEVER_PUBLISH"
     }};
    }
    throw Error("Unexpected read method");
   },detach:async()=>{reviewDetach++}};
   return session;
  }};
 return context;
},close:async()=>{}};
const reviewer=new LightpandaCdpAdapter({endpoint:"http://127.0.0.1:9222",
 connect:async()=>reviewBrowser});
await reviewer.start();
await reviewer.open("workspace-01","http://127.0.0.1:1425/browser-preview.html");
const reviewSnap=await reviewer.snapshot("workspace-01","index");
const baseProposal={expectedFingerprint:reviewSnap.fingerprint,
 displayIndex:2,operation:"CLICK"};
const validReview=await reviewer.reviewTarget("workspace-01",baseProposal);
assert.equal(validReview.status,"NATIVE_ACTION_GRANT_REQUIRED");
assert.equal(validReview.actionAuthorized,false);
assert.equal(validReview.resultVerified,false);
assert.equal(validReview.qa,"NOT_EXECUTED");
assert.equal(validReview.role,"button");
assert.equal(validReview.label,"Search");
assert.equal(validReview.displayIndex,2);
assert.ok(!JSON.stringify(validReview).includes("backendNodeId"));
assert.ok(!JSON.stringify(validReview).includes("NEVER_PUBLISH"));
assert.ok(!JSON.stringify(validReview).includes("private-selector"));
assert.equal(detailCalls,1);
assert.equal(reviewTreeReads,2);
assert.equal(reviewDetach,2);
// A guessed fingerprint or an index from another workspace cannot acquire
// a target receipt, even when its readable control labels are identical.
await reviewer.open("workspace-02","http://127.0.0.1:1425/browser-preview.html");
await assert.rejects(reviewer.reviewTarget("workspace-02",baseProposal),
 /LIGHTPANDA_REVIEW_STALE/);
assert.equal(detailCalls,1);
await assert.rejects(reviewer.reviewTarget("workspace-01",{
 ...baseProposal,expectedFingerprint:"f".repeat(64)
}),/LIGHTPANDA_REVIEW_STALE/);
assert.equal(detailCalls,1); // mismatched snapshot cannot resolve a node
await assert.rejects(reviewer.reviewTarget("workspace-01",{
 ...baseProposal,displayIndex:20
}),/LIGHTPANDA_REVIEW_TARGET_NOT_FOUND/);
assert.equal(detailCalls,1);
await assert.rejects(reviewer.reviewTarget("workspace-01",{
 ...baseProposal,operation:"TYPE_TEXT"
}),/LIGHTPANDA_REVIEW_ROLE_DENIED/);
const textReview=await reviewer.reviewTarget("workspace-01",{
 ...baseProposal,displayIndex:3,operation:"TYPE_TEXT"
});
assert.equal(textReview.role,"textbox");
assert.equal(textReview.actionAuthorized,false);
detailMode="password";
await assert.rejects(reviewer.reviewTarget("workspace-01",{
 ...baseProposal,displayIndex:3,operation:"TYPE_TEXT"
}),/LIGHTPANDA_REVIEW_INPUT_TYPE_DENIED/);
detailMode="mismatch";
await assert.rejects(reviewer.reviewTarget("workspace-01",baseProposal),
 /LIGHTPANDA_REVIEW_TARGET_CHANGED/);
detailMode="foreignId";
await assert.rejects(reviewer.reviewTarget("workspace-01",baseProposal),
 /LIGHTPANDA_REVIEW_TARGET_CHANGED/);
detailMode="navigate";
await assert.rejects(reviewer.reviewTarget("workspace-01",baseProposal),
 /LIGHTPANDA_INDEX_STALE/);
detailMode="ok";
const fresher=await reviewer.snapshot("workspace-01","index");
assert.notEqual(fresher.fingerprint,reviewSnap.fingerprint);
await assert.rejects(reviewer.reviewTarget("workspace-01",baseProposal),
 /LIGHTPANDA_REVIEW_STALE/);
reviewTree=Array.from({length:60},(_,i)=>
 `${i+1} [i] button 'Action ${i+1}'`).join("\n");
const truncatedSnap=await reviewer.snapshot("workspace-01","index");
assert.equal(truncatedSnap.truncated,true);
const notUnchanged=await reviewer.snapshot("workspace-01","index",
 truncatedSnap.fingerprint);
assert.equal(notUnchanged.unchanged,false);
await assert.rejects(reviewer.reviewTarget("workspace-01",{
 expectedFingerprint:truncatedSnap.fingerprint,displayIndex:1,operation:"CLICK"
}),/LIGHTPANDA_INDEX_TRUNCATED/);
for(const invalid of [
 {...baseProposal,displayIndex:0},
 {...baseProposal,displayIndex:37},
 {...baseProposal,operation:"EXECUTE"},
 {...baseProposal,expectedFingerprint:"not-a-fingerprint"},
 {...baseProposal,actionAuthorized:true}
]){
 if("actionAuthorized" in invalid){
  // Adapter's exact argument contract must reject caller-supplied grants.
  // No native authority can come from a proposal object.
  await assert.rejects(reviewer.reviewTarget("workspace-01",invalid),
   /LIGHTPANDA_REVIEW_INVALID/);
 }else{
  await assert.rejects(reviewer.reviewTarget("workspace-01",invalid),
   /LIGHTPANDA_REVIEW_INVALID/);
 }
}
await reviewer.close();
