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
 // A fresh native Started event indicates another page navigation attempt.
 // It resets prior status, but does not authorize automatic retry or dispatch.
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

// Only an explicit failed native navigation request can offer a manual retry.
// Never retry main ChatGPT or potentially sensitive/credential-bearing URLs.
export function retryableNavigation({workspaceId,tabId,action,url}={}){
 if(!WORKSPACE.test(workspaceId??"")||!/^tab-0[1-3]$/.test(tabId??"")||
    action!=="navigate"||typeof url!=="string"||url.length>2048)return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||
     parsed.search||parsed.hash||parsed.hostname.endsWith(".localhost")||
     ["chatgpt.com","www.chatgpt.com","chat.openai.com"].includes(parsed.hostname))
    return null;
  return parsed.href===url?{workspaceId,tabId,url}:null;
 }catch{return null}
}
export function retryMatchesActive(failure,{workspaceId,tabId,address}={}){
 return !!failure&&failure.workspaceId===workspaceId&&failure.tabId===tabId&&
  failure.url===address&&
  retryableNavigation({workspaceId,tabId,action:"navigate",url:failure.url})!==null;
}

// WebView2 NavigationCompleted is transport evidence, not HTTP status proof.
// Preserve network failures if page-load Finished arrives afterward.
export function acceptBrowserNetwork(current,event,supportTabs=[]){
 if(!event||!WORKSPACE.test(event.workspaceId??"")||!TAB.test(event.tabId??"")||
  !["NETWORK_NAVIGATION_FAILED","NAVIGATION_COMPLETED_UNVERIFIED",
    "NETWORK_STATUS_UNKNOWN"].includes(event.state)||
  (event.tabId!=="main"&&!supportTabs.includes(event.tabId)))return current;
 const workspace=current?.[event.workspaceId]??{};
 const existing=workspace[event.tabId]?.state;
 if(existing==="BLOCKED_BY_POLICY"||(
   existing==="NETWORK_NAVIGATION_FAILED"&&
   event.state!=="NETWORK_NAVIGATION_FAILED"))return current;
 return {...current,[event.workspaceId]:{...workspace,[event.tabId]:{
   state:event.state,verified:false,source:"NATIVE_WEBVIEW_NAVIGATION_COMPLETED"
 }}};
}
