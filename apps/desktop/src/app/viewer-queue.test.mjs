import test from "node:test";
import assert from "node:assert/strict";
import {createViewerQueue} from "./viewer-queue.mjs";
test("latest intent wins and no concurrent native operations",async()=>{
 const events=[];let release;
 const gate=new Promise(r=>{release=r});
 const q=createViewerQueue({hide:async()=>{events.push("hide");await gate;return true},show:async id=>events.push(id)});
 const first=q.schedule("workspace-01",true);
 await Promise.resolve();await Promise.resolve();
 const second=q.schedule("workspace-02",true);
 release();await Promise.all([first,second]);
 assert.deepEqual(events,["hide","hide","workspace-02"]);
});
test("unmounted selection hides without mounting",async()=>{
 const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>events.push("show")});
 assert.equal(await q.schedule("workspace-09",false),false);assert.deepEqual(events,["hide"]);
});
test("close prevents later operations",async()=>{
 const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>events.push("show")});
 await q.close();assert.equal(await q.schedule("workspace-01",true),false);assert.deepEqual(events,["hide"]);
});
