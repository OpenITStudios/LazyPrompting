// Tab-local WebView loading evidence only. No successful HTTP or ChatGPT claim.
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const TAB=/^(main|tab-0[1-3])$/;
const STATE=new Set(["LOADING","LOAD_FINISHED_UNVERIFIED","BLOCKED_BY_POLICY"]);
export function acceptBrowserLoad(current,event,supportTabs=[]){
 if(!event||!WORKSPACE.test(event.workspaceId??"")||!TAB.test(event.tabId??"")||
  !STATE.has(event.state)||(event.tabId!=="main"&&!supportTabs.includes(event.tabId)))
  return current;
 const workspace=current?.[event.workspaceId]??{};
 if(event.state==="LOAD_FINISHED_UNVERIFIED"&&workspace[event.tabId]?.state!=="LOADING")
  return current;
 return {...current,[event.workspaceId]:{...workspace,[event.tabId]:{
  state:event.state,verified:false,source:"NATIVE_WEBVIEW_PAGE_EVENT"
 }}};
}
export function clearBrowserTabState(current,workspaceId,tabId){
 if(!WORKSPACE.test(workspaceId??"")||!TAB.test(tabId??""))return current;
 const copy={...current}, workspace={...copy[workspaceId]};
 delete workspace[tabId];copy[workspaceId]=workspace;
 return copy;
}
