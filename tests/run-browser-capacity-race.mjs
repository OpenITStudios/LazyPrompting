import assert from "node:assert/strict";
import {WorkspaceBrowserPool} from "../src/browser/workspace-browser-pool.mjs";
let releaseValidation;
const gate=new Promise(resolve=>{releaseValidation=resolve;});
const pool=new WorkspaceBrowserPool({maxActive:1,createBrowser:()=>({
 validate:async()=>gate,start:async()=>{},navigate:async url=>({url}),
 snapshot:async()=>({}),close:async()=>{}
})});
const first=pool.open({workspaceId:"w1",allowedOrigins:["https://example.org"],url:"https://example.org"});
assert.equal(pool.status().active,1);
await assert.rejects(()=>pool.open({workspaceId:"w2",allowedOrigins:["https://example.org"],url:"https://example.org"}),/BROWSER_CAPACITY_REACHED/);
releaseValidation();
await first;
await pool.closeAll();
console.log("Concurrent browser capacity test authored, NOT_EXECUTED");
