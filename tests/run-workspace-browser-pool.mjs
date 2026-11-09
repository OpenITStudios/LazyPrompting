import assert from "node:assert/strict";
import {WorkspaceBrowserPool} from "../src/browser/workspace-browser-pool.mjs";
const instances=[];
const pool=new WorkspaceBrowserPool({maxActive:2,createBrowser:()=>{const b={
 validate:async()=>true,start:async()=>{},navigate:async url=>({url}),
 snapshot:async()=>({text:"isolated"}),close:async()=>{}
};instances.push(b);return b;}});
await pool.open({workspaceId:"ws1",allowedOrigins:["https://example.org"],url:"https://example.org"});
await pool.open({workspaceId:"ws2",allowedOrigins:["https://example.org"],url:"https://example.org"});
assert.equal(instances.length,2);
assert.equal(pool.status().active,2);
await assert.rejects(()=>pool.open({workspaceId:"ws3",allowedOrigins:["https://example.org"],url:"https://example.org"}),/BROWSER_CAPACITY_REACHED/);
await pool.closeAll();
assert.equal(pool.status().active,0);
console.log("Browser pool assertions authored, NOT_EXECUTED");
