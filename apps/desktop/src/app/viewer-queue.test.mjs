import test from "node:test";
import assert from "node:assert/strict";
import {createViewerQueue} from "./viewer-queue.mjs";
test("latest intent wins and no concurrent native operations",async()=>{
 const events=[];let release;
 const gate=new Promise(r=>{release=r});
 const q=createViewerQueue({hide:async()=>{events.push("hide");await gate;return true},show:async id=>{events.push(id);return true}});
 const first=q.schedule("workspace-01",true);
 await Promise.resolve();await Promise.resolve();
 const second=q.schedule("workspace-02",true);
 release();await Promise.all([first,second]);
 assert.deepEqual(events,["hide","hide","workspace-02"]);
});
test("unmounted selection hides without mounting",async()=>{
 const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>{events.push("show");return true}});
 assert.equal(await q.schedule("workspace-09",false),false);assert.deepEqual(events,["hide"]);
});
test("close prevents later operations",async()=>{
 const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>events.push("show")});
 await q.close();assert.equal(await q.schedule("workspace-01",true),false);assert.deepEqual(events,["hide"]);
});

test("identical geometry coalesces native operations",async()=>{const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>{events.push("show");return true}});assert.equal(await q.schedule("workspace-01",true,"100x100"),true);await q.schedule("workspace-01",true,"100x100");assert.deepEqual(events,["hide","show"])});
test("changed geometry triggers refresh",async()=>{const events=[];const q=createViewerQueue({hide:async()=>{events.push("hide");return true},show:async()=>{events.push("show");return true}});await q.schedule("workspace-01",true,"a");await q.schedule("workspace-01",true,"b");assert.equal(events.length,4)});
test("failed native mount is not cached as success",async()=>{let attempts=0;const q=createViewerQueue({hide:async()=>true,show:async()=>{attempts++;return attempts>1}});assert.equal(await q.schedule("workspace-01",true,"a"),false);assert.equal(await q.schedule("workspace-01",true,"a"),true)});

test("duplicate hide-only intent does not report visible",async()=>{const q=createViewerQueue({hide:async()=>true,show:async()=>true});assert.equal(await q.schedule("workspace-02",false,"a"),false);assert.equal(await q.schedule("workspace-02",false,"a"),false)});
test("native show exception fails closed and allows retry",async()=>{let calls=0;const q=createViewerQueue({hide:async()=>true,show:async()=>{calls++;if(calls===1)throw Error("native failure");return true}});assert.equal(await q.schedule("workspace-01",true,"a"),false);assert.equal(await q.schedule("workspace-01",true,"a"),true)});
test("duplicate close does not issue repeated native hide",async()=>{let hides=0;const q=createViewerQueue({hide:async()=>{hides++;return true},show:async()=>true});await q.close();await q.close();assert.equal(hides,1)});

test("duplicate intent superseded before completion cannot report success",async()=>{
 let release;const gate=new Promise(r=>release=r);
 const q=createViewerQueue({hide:async()=>{await gate;return true},show:async()=>true});
 const first=q.schedule("workspace-01",true,"a");
 const duplicate=q.schedule("workspace-01",true,"a");
 const next=q.schedule("workspace-02",true,"b");
 release();
 const results=await Promise.all([first,duplicate,next]);
 assert.equal(results[1],false);
 assert.equal(results[2],true);
});
test("close after successful mount does not claim visible state",async()=>{
 const q=createViewerQueue({hide:async()=>true,show:async()=>true});
 assert.equal(await q.schedule("workspace-01",true,"a"),true);
 await q.close();
 assert.equal(await q.schedule("workspace-01",true,"a"),false);
});

test("geometry-only update keeps the already-visible workspace",async()=>{
 const e=[];const q=createViewerQueue({hide:async()=>{e.push("hide");return true},show:async id=>{e.push("show:"+id);return true},resize:async id=>{e.push("resize:"+id);return true}});
 await q.schedule("workspace-01",true,"a");await q.schedule("workspace-01",true,"b");
 assert.deepEqual(e,["hide","show:workspace-01","resize:workspace-01"]);
});
test("failed relayout uses original full fallback",async()=>{
 const e=[];const q=createViewerQueue({hide:async()=>{e.push("hide");return true},show:async()=>{e.push("show");return true},resize:async()=>{e.push("resize");return false}});
 await q.schedule("workspace-01",true,"a");await q.schedule("workspace-01",true,"b");
 assert.deepEqual(e,["hide","show","resize","hide","show"]);
});
test("switching workspaces never reuses the wrong native view",async()=>{
 const e=[];const q=createViewerQueue({hide:async()=>{e.push("hide");return true},show:async id=>{e.push("show:"+id);return true},resize:async()=>{e.push("resize");return true}});
 await q.schedule("workspace-01",true,"a");await q.schedule("workspace-02",true,"b");
 assert.deepEqual(e,["hide","show:workspace-01","hide","show:workspace-02"]);
});

test("stale relayout cannot report success after workspace changed",async()=>{
 let finishResize;const resizeGate=new Promise(resolve=>{finishResize=resolve});
 const e=[];
 const q=createViewerQueue({hide:async()=>{e.push("hide");return true},show:async id=>{e.push("show:"+id);return true},resize:async()=>{e.push("resize");await resizeGate;return true}});
 assert.equal(await q.schedule("workspace-01",true,"first"),true);
 const stale=q.schedule("workspace-01",true,"resized");
 await Promise.resolve();await Promise.resolve();
 const next=q.schedule("workspace-02",true,"different");
 finishResize();
 assert.equal(await stale,false);
 assert.equal(await next,true);
 assert.deepEqual(e.slice(-2),["hide","show:workspace-02"]);
});
test("failed hide invalidates known visible workspace",async()=>{
 let hides=0,resizeCalls=0;
 const q=createViewerQueue({hide:async()=>++hides!==2,show:async()=>true,resize:async()=>{resizeCalls++;return true}});
 assert.equal(await q.schedule("workspace-01",true,"a"),true);
 assert.equal(await q.schedule("workspace-02",true,"b"),false);
 assert.equal(await q.schedule("workspace-01",true,"c"),true);
 assert.equal(resizeCalls,0);
});
