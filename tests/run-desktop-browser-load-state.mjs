import test from "node:test";
import assert from "node:assert/strict";
import {acceptBrowserLoad,clearBrowserTabState,retryableNavigation,retryMatchesActive,acceptBrowserNetwork} from "../apps/desktop/src/app/browser-load-state.mjs";
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

test("manual retry is only possible for safe failed supporting-tab navigation",()=>{
 const base={workspaceId:"workspace-01",tabId:"tab-01",action:"navigate",
  url:"https://docs.example.com/start"};
 const saved=retryableNavigation(base);
 assert.deepEqual(saved,{workspaceId:base.workspaceId,tabId:base.tabId,url:base.url});
 for(const changed of [
  {...base,tabId:"main"}, {...base,workspaceId:"workspace-11"},
  {...base,action:"reload"}, {...base,url:"https://docs.example.com/a?token=x"},
  {...base,url:"https://docs.example.com/#fragment"},
  {...base,url:"https://chatgpt.com/c/test"},
  {...base,url:"https://user:pass@example.com/"},
  {...base,url:"http://docs.example.com/"},
  {...base,url:"javascript:alert(1)"},
 ]){
  assert.equal(retryableNavigation(changed),null);
 }
 assert.equal(retryMatchesActive(saved,{workspaceId:"workspace-01",
  tabId:"tab-01",address:base.url}),true);
 assert.equal(retryMatchesActive(saved,{workspaceId:"workspace-02",
  tabId:"tab-01",address:base.url}),false);
 assert.equal(retryMatchesActive(saved,{workspaceId:"workspace-01",
  tabId:"tab-02",address:base.url}),false);
 assert.equal(retryMatchesActive(saved,{workspaceId:"workspace-01",
  tabId:"tab-01",address:"https://docs.example.com/other"}),false);
});

test("native network failure is scoped and never upgraded by page load finished",()=>{
 const ev=(workspaceId,tabId,state)=>({workspaceId,tabId,state});
 state=acceptBrowserLoad({},ev("workspace-01","tab-01","LOADING"),["tab-01"]);
 state=acceptBrowserNetwork(state,ev("workspace-01","tab-01","NETWORK_NAVIGATION_FAILED"),["tab-01"]);
 assert.equal(state["workspace-01"]["tab-01"].state,"NETWORK_NAVIGATION_FAILED");
 const failed=state;
 assert.equal(acceptBrowserLoad(state,ev("workspace-01","tab-01","LOAD_FINISHED_UNVERIFIED"),["tab-01"]),failed);
 assert.equal(acceptBrowserNetwork(state,ev("workspace-01","tab-01","NAVIGATION_COMPLETED_UNVERIFIED"),["tab-01"]),failed);
 assert.equal(acceptBrowserNetwork(state,ev("workspace-02","tab-01","NETWORK_NAVIGATION_FAILED")),failed);
 state=acceptBrowserNetwork(state,ev("workspace-01","main","NAVIGATION_COMPLETED_UNVERIFIED"));
 assert.equal(state["workspace-01"].main.verified,false);
});

test("a later native navigation start clears stale failure status without success",()=>{
 const initial={"workspace-01":{"tab-01":{
  state:"NETWORK_NAVIGATION_FAILED",verified:false,
  source:"NATIVE_WEBVIEW_NAVIGATION_COMPLETED"}}};
 const next=acceptBrowserLoad(initial,ev("workspace-01","tab-01","LOADING"),["tab-01"]);
 assert.equal(next["workspace-01"]["tab-01"].state,"LOADING");
 assert.equal(next["workspace-01"]["tab-01"].verified,false);
 assert.equal(initial["workspace-01"]["tab-01"].state,"NETWORK_NAVIGATION_FAILED");
});
