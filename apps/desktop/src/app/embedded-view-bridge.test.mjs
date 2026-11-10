import test from "node:test";
import assert from "node:assert/strict";
import {workspaceIds,validateEmbeddedSnapshot,readEmbeddedSnapshot,requestLocalPreviewMount,validateViewerBounds,hideAllEmbeddedViews} from "./embedded-view-bridge.mjs";
const bounds={x:200,y:100,width:700,height:500};
const sample=id=>({workspaceId:id,viewLabel:id.replace("workspace-","browser-"),source:"NATIVE_TAURI_WINDOW_REGISTRY",mounted:true});
test("all ten canonical IDs",()=>{assert.equal(workspaceIds.length,10);assert.equal(new Set(workspaceIds).size,10)});
test("rejects mismatched host identity",()=>assert.equal(validateEmbeddedSnapshot(sample("workspace-02"),"workspace-01").ok,false));
test("rejects invalid slots",()=>assert.equal(validateEmbeddedSnapshot(sample("workspace-11"),"workspace-11").ok,false));
test("reads only fixed snapshot command",async()=>{const calls=[];const r=await readEmbeddedSnapshot(async(c,a)=>{calls.push([c,a]);return sample(a.workspaceId)},"workspace-10");assert.equal(r.mounted,true);assert.deepEqual(calls,[["embedded_view_snapshot",{workspaceId:"workspace-10"}]])});
test("mount uses independent host read",async()=>{const calls=[];const r=await requestLocalPreviewMount(async(c,a)=>{calls.push(c);return sample(a.workspaceId)},"workspace-01",bounds);assert.equal(r.ok,true);assert.deepEqual(calls,["mount_embedded_view","embedded_view_snapshot"])});
test("forged mount response rejected before read",async()=>{const calls=[];const r=await requestLocalPreviewMount(async c=>{calls.push(c);return sample("workspace-02")},"workspace-01",bounds);assert.equal(r.ok,false);assert.deepEqual(calls,["mount_embedded_view"])});
test("host failure fails closed",async()=>assert.equal((await readEmbeddedSnapshot(async()=>{throw Error("down")},"workspace-01")).ok,false));

test("invalid geometry fails closed",async()=>{assert.equal(validateViewerBounds({x:0,y:0,width:100,height:100}),null);assert.equal((await requestLocalPreviewMount(async()=>{throw Error("must not call")},"workspace-01",{x:0,y:0,width:0,height:0})).reason,"INVALID_INPUT")});
test("hide-all uses fixed native command",async()=>{const calls=[];assert.equal(await hideAllEmbeddedViews(async name=>{calls.push(name)}),true);assert.deepEqual(calls,["hide_embedded_views"])});
