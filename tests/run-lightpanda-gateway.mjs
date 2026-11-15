import assert from "node:assert/strict";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
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
let requests=0,views=[];
const indexAdapter={...adapter,browser:{},snapshot:async(id,view)=>{
 views.push([id,view]);return {workspaceId:id,view,actionAuthorized:false};
}};
const indexDenied=new CapabilityRouter({lightpanda:indexAdapter,
 nativeAdmission:async()=>({allowed:false,source:"NATIVE_HOST",scopeVerified:false})});
assert.equal((await indexDenied.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"})).code,"NATIVE_ADMISSION_REQUIRED");
assert.equal(views.length,0);
await indexDenied.close();
const indexAdmitted=new CapabilityRouter({lightpanda:indexAdapter,
 nativeAdmission:async()=>({allowed:true,source:"NATIVE_HOST",scopeVerified:true})});
assert.equal((await indexAdmitted.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"})).structuredContent.actionAuthorized,false);
assert.deepEqual(views,[[workspaceId,"index"]]);
assert.equal((await indexAdmitted.invoke("lightpanda.snapshot",{
 workspaceId,view:"foobar"})).code,"INVALID_ARGUMENTS");
assert.equal(views.length,1);
await indexAdmitted.close();

const nativeOnly=new CapabilityRouter({nativeLightpanda:async(_name,args)=>{
 requests++;return {status:"OK",structuredContent:args};
}});
assert.equal((await nativeOnly.invoke("lightpanda.snapshot",{
 workspaceId,view:"index"})).code,"LIGHTPANDA_INDEX_NATIVE_UNAVAILABLE");
assert.equal(requests,0);
const nativeMetadata=await nativeOnly.invoke("lightpanda.snapshot",{
 workspaceId,view:"metadata"});
assert.equal(nativeMetadata.status,"OK");
assert.deepEqual(nativeMetadata.structuredContent,{workspaceId});
assert.equal(requests,1);
await nativeOnly.close();
