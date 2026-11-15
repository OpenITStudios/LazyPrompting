import test from "node:test";
import assert from "node:assert/strict";
import {acceptBrowserLoad,clearBrowserTabState} from "../apps/desktop/src/app/browser-load-state.mjs";
const ev=(workspaceId,tabId,state)=>({workspaceId,tabId,state});
test("load completion never claims HTTP success and remains scoped",()=>{
 let data={};
 data=acceptBrowserLoad(data,ev("workspace-01","main","LOADING"));
 data=acceptBrowserLoad(data,ev("workspace-01","main","LOAD_FINISHED_UNVERIFIED"));
 assert.equal(data["workspace-01"].main.verified,false);
 const before=data;
 assert.equal(acceptBrowserLoad(data,ev("workspace-11","main","LOADING")),before);
 assert.equal(acceptBrowserLoad(data,ev("workspace-01","tab-01","LOADING")),before);
 data=acceptBrowserLoad(data,ev("workspace-02","tab-01","LOADING"),["tab-01"]);
 assert.equal(data["workspace-02"]["tab-01"].state,"LOADING");
 data=acceptBrowserLoad(data,ev("workspace-01","main","BLOCKED_BY_POLICY"));
 assert.equal(acceptBrowserLoad(data,ev("workspace-01","main","LOAD_FINISHED_UNVERIFIED")),data);
});
test("close and tab reuse remove prior evidence",()=>{
 const data={"workspace-01":{"main":{state:"LOADING"},"tab-01":{state:"BLOCKED_BY_POLICY"}}};
 const after=clearBrowserTabState(data,"workspace-01","tab-01");
 assert.equal(after["workspace-01"]["tab-01"],undefined);
 assert.equal(after["workspace-01"].main.state,"LOADING");
});
