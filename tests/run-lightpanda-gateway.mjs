import assert from "node:assert/strict";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
import {projectNativeLightpandaIndex} from "../src/gateway/native-ipc.mjs";
const url="http://127.0.0.1:1425/browser-preview.html";
const workspaceId="workspace-01";
const events=[];
const adapter={browser:null,validate:u=>{if(u!==url)throw Error("BROWSER_ORIGIN_DENIED")},start:async function(){this.browser={};events.push("start")},open:async(id,u)=>{events.push("open");return {workspaceId:id,url:u}},snapshot:async id=>({workspaceId:id,title:"Preview"}),closeWorkspace:async()=>({closed:true}),close:async()=>{}};
const disabled=new CapabilityRouter({lightpanda:adapter});
assert.equal(disabled.describe("lightpanda.open").structuredContent.readiness,"DISABLED");
assert.equal((await disabled.invoke("lightpanda.open",{workspaceId,url})).code,"CAPABILITY_DISABLED");
const denied=new CapabilityRouter({lightpanda:adapter,nativeAdmission:async()=>({allowed:true,source:"RENDERER",scopeVerified:true})});
assert.equal((await denied.invoke("lightpanda.open",{workspaceId,url})).code,"NATIVE_ADMISSION_REQUIRED");
assert.equal(events.length,0);
const admitted=new CapabilityRouter({lightpanda:adapter,nativeAdmission:async()=>({allowed:true,source:"NATIVE_HOST",scopeVerified:true})});
assert.equal((await admitted.invoke("lightpanda.open",{workspaceId,url})).status,"OK");
assert.equal((await admitted.invoke("lightpanda.snapshot",{workspaceId})).structuredContent.title,"Preview");
assert.equal((await admitted.invoke("lightpanda.close",{workspaceId})).status,"OK");
assert.deepEqual(events,["start","open"]);
await admitted.close();
console.log("Lightpanda gateway admission contract passed (injected mocks, no browser)");

let release;
const gate=new Promise(resolve=>{release=resolve});
const delayedAdapter={...adapter,browser:{},snapshot:async()=>{await gate;return {title:"Delayed"}}};
const busy=new CapabilityRouter({lightpanda:delayedAdapter,nativeAdmission:async()=>({allowed:true,source:"NATIVE_HOST",scopeVerified:true})});
const pending=busy.invoke("lightpanda.snapshot",{workspaceId});
await Promise.resolve();await Promise.resolve();
assert.equal((await busy.invoke("lightpanda.snapshot",{workspaceId})).code,"WORKSPACE_BUSY");
release();assert.equal((await pending).status,"OK");
await busy.close();
assert.equal((await busy.invoke("lightpanda.snapshot",{workspaceId})).code,"GATEWAY_CLOSED");

let releaseDrain;
const drainGate=new Promise(resolve=>{releaseDrain=resolve});
const lifecycle=[];
const drainingAdapter={...adapter,browser:{},snapshot:async()=>{lifecycle.push("snapshot-start");await drainGate;lifecycle.push("snapshot-end");return {title:"Done"}},close:async()=>{lifecycle.push("adapter-close")}};
const draining=new CapabilityRouter({lightpanda:drainingAdapter,nativeAdmission:async()=>({allowed:true,source:"NATIVE_HOST",scopeVerified:true})});
const ongoing=draining.invoke("lightpanda.snapshot",{workspaceId});
await Promise.resolve();await Promise.resolve();
const closing=draining.close();
assert.equal((await draining.invoke("lightpanda.snapshot",{workspaceId})).code,"GATEWAY_CLOSED");
releaseDrain();
assert.equal((await ongoing).status,"OK");
await closing;
assert.deepEqual(lifecycle,["snapshot-start","snapshot-end","adapter-close"]);
await draining.close();
assert.equal(lifecycle.filter(x=>x==="adapter-close").length,1);

let approveLate;
const lateGate=new Promise(resolve=>{approveLate=resolve});
let lateOps=0;
const lateAdapter={...adapter,browser:null,start:async()=>{lateOps++},open:async()=>{lateOps++;return {}}};
const late=new CapabilityRouter({lightpanda:lateAdapter,nativeAdmission:async()=>{await lateGate;return {allowed:true,source:"NATIVE_HOST",scopeVerified:true}}});
const lateCall=late.invoke("lightpanda.open",{workspaceId,url});
const lateClose=late.close();
approveLate();
assert.equal((await lateCall).code,"GATEWAY_CLOSED");
await lateClose;
assert.equal(lateOps,0);


// Opt-in control-index snapshot uses the same native admission and is
// unavailable from the installed Rust Lightpanda metadata-only bridge.
let requests=0,views=[],admittedReads=0;
const indexAdapter={...adapter,browser:{},snapshot:async(id,view,sinceFingerprint)=>{
 views.push([id,view,sinceFingerprint]);
 return {workspaceId:id,view,actionAuthorized:false,unchanged:sinceFingerprint!==null};
}};
const indexDenied=new CapabilityRouter({lightpanda:indexAdapter,
 nativeAdmission:async()=>({allowed:false,source:"NATIVE_HOST",scopeVerified:false})});
assert.equal((await indexDenied.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"})).code,"NATIVE_ADMISSION_REQUIRED");
assert.equal(views.length,0);
await indexDenied.close();
const indexAdmitted=new CapabilityRouter({lightpanda:indexAdapter,
 nativeAdmission:async()=>{admittedReads++;return {
  allowed:true,source:"NATIVE_HOST",scopeVerified:true
 }}});
assert.equal((await indexAdmitted.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"})).structuredContent.actionAuthorized,false);
assert.deepEqual(views,[[workspaceId,"index",null]]);
const token="a".repeat(64);
const indexedRepeat=await indexAdmitted.invoke("lightpanda.snapshot",{
 workspaceId,view:"index",sinceFingerprint:token});
assert.equal(indexedRepeat.structuredContent.unchanged,true);
assert.deepEqual(views,[[workspaceId,"index",null],[workspaceId,"index",token]]);
assert.equal((await indexAdmitted.invoke("lightpanda.snapshot",{
 workspaceId,view:"foobar"})).code,"INVALID_ARGUMENTS");
assert.equal(views.length,2);
const admittedBeforeInvalid=admittedReads;
for(const invalid of [
 {workspaceId,view:"index",sinceFingerprint:"bad"},
 {workspaceId,view:"metadata",sinceFingerprint:token},
 {workspaceId,sinceFingerprint:token},
 {workspaceId,view:"index",sinceFingerprint:"z".repeat(64)},
])assert.equal((await indexAdmitted.invoke("lightpanda.snapshot",invalid)).code,
 "INVALID_ARGUMENTS");
assert.equal(admittedReads,admittedBeforeInvalid);
assert.equal(views.length,2);
await indexAdmitted.close();

const nativeOnly=new CapabilityRouter({nativeLightpanda:async(_name,args)=>{
 requests++;return {status:"OK",structuredContent:args};
}});
// The installed private Rust host now admits one `view:index` read
// via its distinct one-use index grant; this stub only verifies routing.
// Signed-gateway native-ipc tests separately assert raw-tree redaction.
const nativeIndex=await nativeOnly.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"});
assert.equal(nativeIndex.status,"OK");
assert.deepEqual(nativeIndex.structuredContent,{workspaceId,view:"index"});
assert.equal(requests,1);
assert.equal((await nativeOnly.invoke("lightpanda.snapshot",{
 workspaceId,view:"index",sinceFingerprint:"a".repeat(64)})).code,
 "LIGHTPANDA_INDEX_NATIVE_CURSOR_UNAVAILABLE");
assert.equal(requests,1);
const nativeMetadata=await nativeOnly.invoke("lightpanda.snapshot",{
 workspaceId,view:"metadata"});
assert.equal(nativeMetadata.status,"OK");
assert.deepEqual(nativeMetadata.structuredContent,{workspaceId});
assert.equal(requests,2);
assert.equal((await nativeOnly.invoke("lightpanda.review",{
 workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"CLICK"
})).code,"LIGHTPANDA_REVIEW_NATIVE_UNAVAILABLE");
assert.equal(requests,1);
await nativeOnly.close();

// Read-only Jev-style target review uses the same existing host admission,
// not a second execution lane. The native Rust path explicitly denies it.
let reviews=0,reviewAdmissions=0;
const reviewAdapter={...adapter,browser:{},
 reviewTarget:async(id,proposal)=>{
  reviews++;
  assert.equal(id,workspaceId);
  assert.deepEqual(proposal,{expectedFingerprint:"a".repeat(64),
   displayIndex:2,operation:"CLICK"});
  return {source:"LIGHTPANDA_LOCAL_PREVIEW_TARGET_REVIEW",
   status:"NATIVE_ACTION_GRANT_REQUIRED",actionAuthorized:false,
   resultVerified:false,qa:"NOT_EXECUTED"};
 }};
const reviewDenied=new CapabilityRouter({lightpanda:reviewAdapter,
 nativeAdmission:async()=>({allowed:false,source:"NATIVE_HOST",scopeVerified:false})});
assert.equal((await reviewDenied.invoke("lightpanda.review",{
 workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"CLICK"
})).code,"NATIVE_ADMISSION_REQUIRED");
assert.equal(reviews,0);
await reviewDenied.close();
const reviewAdmitted=new CapabilityRouter({lightpanda:reviewAdapter,
 nativeAdmission:async()=>{reviewAdmissions++;return {
  allowed:true,source:"NATIVE_HOST",scopeVerified:true
 }}});
const reviewed=await reviewAdmitted.invoke("lightpanda.review",{
 workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"CLICK"
});
assert.equal(reviewed.status,"OK");
assert.equal(reviewed.structuredContent.actionAuthorized,false);
assert.equal(reviewed.structuredContent.status,"NATIVE_ACTION_GRANT_REQUIRED");
assert.equal(reviews,1);
assert.equal(reviewAdmissions,1);
for(const invalid of [
 {workspaceId,expectedFingerprint:"bad",displayIndex:2,operation:"CLICK"},
 {workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:0,operation:"CLICK"},
 {workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:37,operation:"CLICK"},
 {workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"EXECUTE"},
 {workspaceId,expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"CLICK",approved:true},
 {workspaceId:"workspace-11",expectedFingerprint:"a".repeat(64),displayIndex:2,operation:"CLICK"}
]){
 assert.equal((await reviewAdmitted.invoke("lightpanda.review",invalid)).code,
  "INVALID_ARGUMENTS");
}
assert.equal(reviews,1);
assert.equal(reviewAdmissions,1);
await reviewAdmitted.close();


// The signed gateway is the ONLY place allowed to project the raw tree
// sent over the authenticated native pipe. No private backend IDs, input
// values or selectors may escape through a public MCP tool result.
const rawPreview={
 source:"NATIVE_LIGHTPANDA_PREVIEW_TREE",workspaceId,
 url:"http://127.0.0.1:1425/browser-preview.html",readOnly:true,
 semanticTree:[
  "1 RootWebArea 'Offline preview'",
  "17 [i] button 'Check preview'",
  "18 [i] searchbox 'Preview query'",
  "19 [i] checkbox 'Preview checked'",
  "20 [i] textbox 'api key'"
 ].join("\n")
};
const privateGrant="c".repeat(64);
const publicIndex=projectNativeLightpandaIndex(rawPreview,workspaceId,privateGrant);
assert.equal(publicIndex.actionAuthorized,false);
assert.equal(publicIndex.readOnly,true);
assert.equal(publicIndex.items,3);
assert.equal(publicIndex.truncated,false);
assert.match(publicIndex.fingerprint,/^[a-f0-9]{64}$/);
assert.ok(publicIndex.content.includes("button"));
assert.ok(!JSON.stringify(publicIndex).includes("17 [i]"));
assert.ok(!JSON.stringify(publicIndex).includes("api key"));
assert.ok(!JSON.stringify(publicIndex).includes("semanticTree"));
assert.notEqual(projectNativeLightpandaIndex(rawPreview,workspaceId,"d".repeat(64))
 .fingerprint,publicIndex.fingerprint);
for(const invalid of [
 {...rawPreview,source:"RENDERER"},
 {...rawPreview,workspaceId:"workspace-02"},
 {...rawPreview,url:"https://chatgpt.com"},
 {...rawPreview,readOnly:false},
 {...rawPreview,backendNodeId:17},
 {...rawPreview,semanticTree:"x".repeat(65537)}
])assert.throws(()=>projectNativeLightpandaIndex(invalid,workspaceId,privateGrant),
 /LIGHTPANDA_INDEX_NATIVE_UNAVAILABLE/);
assert.throws(()=>projectNativeLightpandaIndex(rawPreview,workspaceId,"bad"),
 /LIGHTPANDA_INDEX_NATIVE_UNAVAILABLE/);
