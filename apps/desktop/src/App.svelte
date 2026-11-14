<script lang="ts">
 import {createWorkspaceState,applyWorkspaceAction} from "./app/workspace-controller.mjs";
 import {onMount,tick} from "svelte";
 import {invoke} from "@tauri-apps/api/core";
 import {listen} from "@tauri-apps/api/event";
 import {readWebviewStatus} from "./app/webview-status.mjs";
 import {requestLocalPreviewMount,requestLocalPreviewClose,hideAllEmbeddedViews} from "./app/embedded-view-bridge.mjs";
 import {createViewerQueue} from "./app/viewer-queue.mjs";
 import {resolveBrowserAddress,shouldOpenSupportingTab} from "./app/browser-address.mjs";
 import {browserShortcut} from "./app/browser-shortcuts.mjs";
 import {appendSessionHistory,safeHistoryUrl} from "./app/browser-history.mjs";
 import {prepareOperatorContinuation} from "./app/operator-continuation.mjs";
 import {readPublicGitHubProgress,validPublicBinding,repositoryAlreadyAssigned} from "./app/public-github-progress.mjs";
 type Workspace={id:string;name:string};
 const workspaceStatus=(w:Workspace)=>mountedSlots.includes(w.id)?"Open":"Closed";
 type UIAction={type:string;workspaceId?:string;focus?:boolean};
 type ManualDraftReceipt={
  status:string;source:string;workspaceId:string;draftPrompt:string;
  sent:boolean;sessionVerified:boolean;resultVerified:boolean;nextPromptAllowed:boolean
 };
 let workspaceState=$state(createWorkspaceState());
 let connectionsOpen=$state(false);
 let webviewCandidateObserved=$state(false);
 let nativeDesktop=$state(false);
 let embeddedErrors=$state<Record<string,string>>({});
 let bookmarkAvailable=$state<Record<string,boolean>>({});
 let bookmarkBusy=$state(false);
 let chatNotices=$state<Record<string,string>>({});
 let manualDrafts=$state<Record<string,string>>({});
 let manualDraftNotices=$state<Record<string,string>>({});
 let manualDraftArea:HTMLTextAreaElement | undefined;
 let operatorSending=$state<Record<string,boolean>>({});
 // Native send hints only, never a trusted final-turn or GitHub receipt.
 let responseHints=$state<Record<string,"WAITING"|"GENERATING"|"POSSIBLY_COMPLETED"|"ERROR"|"UNKNOWN">>({});
 let checkingChatStatus=$state<Record<string,boolean>>({});
 type TabReceipt={workspaceId:string;activeTab:string;tabs:string[];source:string};
 let tabs=$state<Record<string,TabReceipt>>({});
 let tabBusy=$state<Record<string,boolean>>({});
 let tabWarnings=$state<Record<string,string>>({});
 let tabSessionBusy=$state<Record<string,boolean>>({});
 let savedTabAvailability=$state<Record<string,boolean>>({});
 let browserBookmarks=$state<Record<string,string[]>>({});
 let bookmarkListBusy=$state<Record<string,boolean>>({});
 let libraryOpen=$state<Record<string,boolean>>({});
 let sessionHistory=$state<Record<string,string[]>>({});

 // Per-tab display preference, not a readback from WebView2.
 let tabZoom=$state<Record<string,number>>({});
 let zoomBusy=$state<Record<string,boolean>>({});
 let findOpen=$state<Record<string,boolean>>({});
 let findQuery=$state<Record<string,string>>({});
 let findTab=$state<Record<string,string>>({});
 let findBusy=$state<Record<string,boolean>>({});
 let findNotice=$state<Record<string,string>>({});
 let findInput:HTMLInputElement|undefined;



 let popupOffers=$state<Record<string,string>>({});

 // Ephemeral display-only GitHub progress, indexed by workspace.
 let githubRepos=$state<Record<string,string>>({});
 let githubBranches=$state<Record<string,string>>({});
 let githubBusy=$state<Record<string,boolean>>({});
 let githubBaselines=$state<Record<string,string>>({});
 let githubScopeKeys=$state<Record<string,string>>({});
 let githubResults=$state<Record<string,{status:string;headSha?:string;changed?:boolean;commits?:{sha:string;summary:string}[];reason?:string}>>({});


 let manualReplies=$state<Record<string,string>>({});
 let nextActions=$state<Record<string,string>>({});
 let continuationNotices=$state<Record<string,string>>({});
 let browserAddresses=$state<Record<string,string>>({});
 let navigationRevision=0;
 let viewerElement:HTMLDivElement | undefined;
 let addressInput=$state<HTMLInputElement>();
 let mountedSlots=$state<string[]>([]);
 let mounting=$state(false);
 let viewerQueue:ReturnType<typeof createViewerQueue> | undefined;
 let viewerObserver:ResizeObserver | undefined;
 let connectionButton:HTMLButtonElement | undefined;
 let connectionPanel=$state<HTMLDivElement>();
 const current=$derived(workspaceState.workspaces.find((w:Workspace)=>w.id===workspaceState.selectedId)??workspaceState.workspaces[0]);
 function bounds(){if(!viewerElement)return null;const r=viewerElement.getBoundingClientRect();return {x:r.left+1,y:r.top+1,width:r.width-2,height:r.height-2};}
 async function showWorkspace(id:string){
  const b=bounds();if(!b)return false;
  const result=await requestLocalPreviewMount(invoke,id,b);
  const mounted=result.ok&&"mounted" in result&&result.mounted===true;
  if(mounted&&!mountedSlots.includes(id))mountedSlots=[...mountedSlots,id];
  if(mounted){void refreshTabs(id);void refreshSavedTabs(id);}
  embeddedErrors[id]=mounted?"":!result.ok&&result.reason==="INVALID_BROWSER_ADDRESS"
   ?"Enter a valid HTTP or HTTPS address.":"Could not open the browser.";
  return mounted;
 }
 async function openLocalPreview(){
  if(mounting||!nativeDesktop||!viewerQueue)return;
  mounting=true;
  const id=workspaceState.selectedId;
  let shown=false;
  try {
   shown=await viewerQueue.schedule(id,true,JSON.stringify([bounds(),++navigationRevision]));
  } finally {mounting=false;}
  if(shown){
   await tick();
   if(current.id===id)addressInput?.focus();
  }
 }
 function openAddress(event:SubmitEvent){
  event.preventDefault();
  const address=resolveBrowserAddress(browserAddresses[current.id]??"");
  if(!address){embeddedErrors[current.id]="Enter a web address or search terms.";return;}
  if(shouldOpenSupportingTab(tabs[current.id]?.activeTab??"main",address)){
   openTab(address);
   return;
  }
  void browserAction("navigate",address);
 }
 async function closeLocalPreview(){
  if(mounting||!viewerQueue)return;
  const id=workspaceState.selectedId;
  mounting=true;
  mountedSlots=mountedSlots.filter(slot=>slot!==id);
  try {
   await viewerQueue.schedule(id,false);
   delete responseHints[id];
   delete tabs[id];
   for(const key of Object.keys(tabZoom))if(key.startsWith(id+":"))delete tabZoom[key];
   delete popupOffers[id];
   delete findOpen[id];delete findQuery[id];delete findTab[id];delete findNotice[id];
   if(!await requestLocalPreviewClose(invoke,id)){
    mountedSlots=[...mountedSlots,id];
    embeddedErrors[id]="WebView2 preview could not be closed";
   }
  } finally {mounting=false;}
 }
 function acceptManualDraft(receipt:ManualDraftReceipt){
  if(!receipt||receipt.status!=="DRAFT_ONLY"||
   receipt.source!=="HOST_FORMATTED_UNVERIFIED_CLIENT_INPUT"||
   !/^workspace-(0[1-9]|10)$/.test(receipt.workspaceId??"")||
   typeof receipt.draftPrompt!=="string"||
   receipt.draftPrompt.length===0||receipt.draftPrompt.length>12000||
   receipt.sent!==false||receipt.sessionVerified!==false||
   receipt.resultVerified!==false||receipt.nextPromptAllowed!==false)return;
  manualDrafts[receipt.workspaceId]=receipt.draftPrompt;
  manualDraftNotices[receipt.workspaceId]="A client prepared this draft; review it before manually pasting it into ChatGPT.";
 }
 async function copyManualDraft(){
  const id=current.id;
  const draft=manualDrafts[id];
  if(!draft)return;
  if(navigator.clipboard?.writeText){
   try{
    await navigator.clipboard.writeText(draft);
    manualDraftNotices[id]="Draft copied. Review and paste it manually; LazyPrompting has not sent it.";
    return;
   }catch{/* Some desktop contexts do not grant clipboard access. */}
  }
  if(current.id===id){manualDraftArea?.focus();manualDraftArea?.select();}
  manualDraftNotices[id]="Clipboard access unavailable. Select the text and press Ctrl+C to copy.";
 }
 async function inspectPublicGitHub(){
  const id=current.id;
  if(githubBusy[id])return;
  const repository=(githubRepos[id]??"").trim();
  const branch=(githubBranches[id]??"").trim();
  if(!validPublicBinding({workspaceId:id,repository,branch})){
   githubResults[id]={status:"BLOCKED",reason:"Enter a valid owner/repo and branch."};
   return;
  }
  // This UI represents one repository per workspace. Never silently bind
  // the same repository to two different workspaces.
  if(repositoryAlreadyAssigned({workspaceId:id,repository,
      assignments:Object.fromEntries(Object.entries(githubScopeKeys)
       .map(([slot,key])=>[slot,key.split("@")[0]]))})){
   githubResults[id]={status:"BLOCKED",reason:"Repository is already assigned to another workspace."};
   return;
  }
  const key=repository+"@"+branch;
  const baseline=githubScopeKeys[id]===key?githubBaselines[id]??null:null;
  githubBusy[id]=true;
  try {
   const result=await readPublicGitHubProgress({workspaceId:id,repository,branch,baseSha:baseline});
   // Discard stale requests after an edit or workspace rebind.
   if((githubRepos[id]??"").trim()!==repository||(githubBranches[id]??"").trim()!==branch)return;
   if(result.status==="BASELINE_PINNED"){
    githubBaselines[id]=result.baseSha;
    githubScopeKeys[id]=key;
   }else if(githubScopeKeys[id]!==key){
    delete githubBaselines[id];
    delete githubScopeKeys[id];
   }
   githubResults[id]={status:result.status,headSha:result.headSha,changed:result.changed,
    commits:result.commits,reason:result.reason};
  } catch {
   githubResults[id]={status:"UNKNOWN",reason:"Unable to read GitHub."};
  }finally{githubBusy[id]=false;}
 }
 function applyTabs(id:string,r:TabReceipt){
  if(r?.source!=="NATIVE_TAB_REGISTRY"||r.workspaceId!==id||
     !Array.isArray(r.tabs)||r.tabs.length>3||
     r.tabs.some(x=>!/^tab-0[1-3]$/.test(x))||
     new Set(r.tabs).size!==r.tabs.length||
     (r.activeTab!=="main"&&!r.tabs.includes(r.activeTab)))
   throw Error("INVALID_TAB_RECEIPT");
  tabs[id]=r;
 }
 async function refreshTabs(id:string){
  try{applyTabs(id,await invoke<TabReceipt>("browser_tabs_snapshot",{workspaceId:id}));}
  catch{tabWarnings[id]="Tab state unavailable.";}
 }
 async function tabAction(command:"open_support_tab"|"select_browser_tab"|"close_support_tab",tabId?:string,address?:string){
  const id=current.id,b=bounds();
  if(!nativeDesktop||!mountedSlots.includes(id)||tabBusy[id]||zoomBusy[id]||!b)return;
  if(findBusy[id])return;
  if(findOpen[id])await closeFind();
  tabBusy[id]=true;
  try{
   const args={workspaceId:id,bounds:b,...(tabId?{tabId}:{}),...(address?{address}:{})};
   applyTabs(id,await invoke<TabReceipt>(command,args));
   if(command==="close_support_tab"&&tabId)delete tabZoom[zoomKey(id,tabId)];
   if(command==="open_support_tab")delete tabZoom[zoomKey(id,tabs[id]?.activeTab??"main")];
   if(address)browserAddresses[id]=address;
   else {
    // Switching a tab does not fire a page-load event.
    try {
     const result=await invoke<{workspaceId:string;url:string}>(
      "browser_active_action",{workspaceId:id,action:"location"});
     if(result.workspaceId===id&&typeof result.url==="string")
      browserAddresses[id]=result.url;
    }catch{/* Unknown address must not be invented. */}
   }
   if(command==="open_support_tab")delete popupOffers[id];
   tabWarnings[id]="";
  }catch{tabWarnings[id]="Tab operation unavailable.";}
  finally{tabBusy[id]=false;}
 }
 function openTab(address="https://www.bing.com/"){
  const safe=resolveBrowserAddress(address);
  if(!safe){tabWarnings[current.id]="Invalid tab URL.";return;}
  void tabAction("open_support_tab",undefined,safe);
 }
 async function refreshSavedTabs(id:string){
  if(!nativeDesktop)return;
  try{
   const r=await invoke<{workspaceId:string;status:string;source:string;urls:string[]}>(
    "read_saved_browser_tabs",{workspaceId:id});
   if(r.workspaceId!==id||r.source!=="LOCAL_SUPPORT_URL_SNAPSHOT_ONLY"||
      !["AVAILABLE","NOT_FOUND"].includes(r.status)||!Array.isArray(r.urls)||
      r.urls.length>3)throw Error("INVALID_SAVED_TAB_SNAPSHOT");
   savedTabAvailability[id]=r.status==="AVAILABLE";
  }catch{savedTabAvailability[id]=false;}
 }
 async function saveTabs(){
  const id=current.id;
  if(!nativeDesktop||!mountedSlots.includes(id)||tabBusy[id]||tabSessionBusy[id])return;
  tabSessionBusy[id]=true;
  tabBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;status:string;source:string}>(
    "save_browser_tabs",{workspaceId:id});
   if(r.workspaceId!==id||r.status!=="SAVED"||
      r.source!=="LOCAL_SUPPORT_URL_SNAPSHOT_ONLY")throw Error("INVALID_SAVE_RECEIPT");
   savedTabAvailability[id]=true;
   tabWarnings[id]="URLs saved. Review paths for sensitive details; ChatGPT main tab was not copied.";
  }catch{tabWarnings[id]="Save failed. Use HTTPS supporting pages without query or fragment.";}
  finally{tabSessionBusy[id]=false;tabBusy[id]=false;}
 }
 async function restoreTabs(){
  const id=current.id,b=bounds();
  if(!nativeDesktop||!mountedSlots.includes(id)||!b||tabBusy[id]||tabSessionBusy[id])return;
  tabSessionBusy[id]=true;
  tabBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;status:string;source:string;urls:string[];
    chatVerified:boolean;nextPromptAllowed:boolean}>(
    "read_saved_browser_tabs",{workspaceId:id});
   if(r.workspaceId!==id||r.source!=="LOCAL_SUPPORT_URL_SNAPSHOT_ONLY"||
      r.status!=="AVAILABLE"||!Array.isArray(r.urls)||!r.urls.length||r.urls.length>3||
      r.chatVerified!==false||r.nextPromptAllowed!==false)
    throw Error("INVALID_RESTORATION_SCOPE");
   const before=await invoke<TabReceipt>("browser_tabs_snapshot",{workspaceId:id});
   applyTabs(id,before);
   if(before.tabs.length){tabWarnings[id]="Close current supporting tabs first.";return;}
   for(const url of r.urls){
    if(typeof url!=="string"||resolveBrowserAddress(url)!==url)
     throw Error("INVALID_RESTORATION_URL");
    applyTabs(id,await invoke<TabReceipt>("open_support_tab",
      {workspaceId:id,address:url,bounds:b}));
   }
   tabWarnings[id]="Saved tabs reopened; login and page content not verified.";
  }catch{tabWarnings[id]="Restore incomplete or unavailable. Review tabs; no automatic retry.";}
  finally{tabSessionBusy[id]=false;tabBusy[id]=false;}
 }
 const zoomKey=(workspace:string,tabId:string)=>workspace+":"+tabId;
 const zoomLevels=[75,100,125,150];
 function zoomNow(){
  const id=current.id,tabId=tabs[id]?.activeTab??"main";
  return tabZoom[zoomKey(id,tabId)]??100;
 }
 async function setBrowserZoom(level:number){
  const id=current.id,tabId=tabs[id]?.activeTab??"main";
  if(!nativeDesktop||!mountedSlots.includes(id)||tabBusy[id]||zoomBusy[id]||
     !zoomLevels.includes(level))return;
  zoomBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;tabId:string;level:number;
    status:string;source:string;nextPromptAllowed:boolean}>(
    "browser_active_zoom",{workspaceId:id,level});
   if(r.workspaceId!==id||r.tabId!==tabId||r.level!==level||
      r.status!=="ZOOM_REQUESTED"||r.source!=="NATIVE_WEBVIEW"||
      r.nextPromptAllowed!==false)throw Error("INVALID_ZOOM_RECEIPT");
   tabZoom[zoomKey(id,tabId)]=level;
   tabWarnings[id]="Zoom requested. Actual page rendering is not verified.";
  }catch{tabWarnings[id]="Could not change browser zoom.";}
  finally{zoomBusy[id]=false;}
 }
 function stepBrowserZoom(direction:-1|1){
  const now=zoomNow();
  const next=zoomLevels.indexOf(now)+direction;
  if(next>=0&&next<zoomLevels.length)void setBrowserZoom(zoomLevels[next]);
 }
 function acceptBookmarks(id:string,r:{workspaceId:string;urls:string[];source:string;
    nextPromptAllowed:boolean;chatVerified:boolean}){
  if(r?.workspaceId!==id||r.source!=="NATIVE_LOCAL_SUPPORT_BOOKMARKS"||
     r.nextPromptAllowed!==false||r.chatVerified!==false||
     !Array.isArray(r.urls)||r.urls.length>20||new Set(r.urls).size!==r.urls.length||
     r.urls.some(url=>safeHistoryUrl(url)!==url))throw Error("INVALID_BOOKMARK_LIST");
  browserBookmarks[id]=r.urls;
 }
 async function refreshBrowserBookmarks(id:string){
  if(!nativeDesktop||bookmarkListBusy[id])return;
  bookmarkListBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;urls:string[];source:string;
    nextPromptAllowed:boolean;chatVerified:boolean}>("list_browser_bookmarks",{workspaceId:id});
   acceptBookmarks(id,r);
  }catch{tabWarnings[id]="Could not read supporting-page bookmarks.";}
  finally{bookmarkListBusy[id]=false;}
 }
 async function addCurrentBookmark(){
  const id=current.id;
  if(!nativeDesktop||!mountedSlots.includes(id)||tabBusy[id]||
     bookmarkListBusy[id]||tabs[id]?.activeTab==="main")return;
  bookmarkListBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;urls:string[];source:string;
    nextPromptAllowed:boolean;chatVerified:boolean}>("add_browser_bookmark",{workspaceId:id});
   acceptBookmarks(id,r);
   tabWarnings[id]="Supporting-page bookmark saved. Review URL paths for sensitive information.";
  }catch{tabWarnings[id]="Cannot bookmark this page. Use a supporting HTTPS tab without query or fragment.";}
  finally{bookmarkListBusy[id]=false;}
 }
 async function deleteBookmark(url:string){
  const id=current.id;
  if(!nativeDesktop||bookmarkListBusy[id]||!browserBookmarks[id]?.includes(url))return;
  bookmarkListBusy[id]=true;
  try{
   const r=await invoke<{workspaceId:string;urls:string[];source:string;
    nextPromptAllowed:boolean;chatVerified:boolean}>(
     "remove_browser_bookmark",{workspaceId:id,url});
   acceptBookmarks(id,r);
  }catch{tabWarnings[id]="Could not remove bookmark.";}
  finally{bookmarkListBusy[id]=false;}
 }
 function openLibraryUrl(url:string){
  if(safeHistoryUrl(url)!==url)return;
  if((tabs[current.id]?.activeTab??"main")==="main")openTab(url);
  else void browserAction("navigate",url);
 }
 function showFind(){
  const id=current.id;
  if(!nativeDesktop||!mountedSlots.includes(id))return;
  findOpen[id]=true;
  findTab[id]=tabs[id]?.activeTab??"main";
  findNotice[id]="Enter a term to request native WebView2 search.";
  void tick().then(()=>findInput?.focus());
 }
 async function requestFind(action:"start"|"next"|"previous"|"stop"){
  const id=current.id;
  if(!nativeDesktop||!mountedSlots.includes(id)||findBusy[id]||tabBusy[id])return;
  if(findTab[id]!== (tabs[id]?.activeTab??"main")){
   findNotice[id]="Search belongs to another tab. Reopen Find.";return;
  }
  const query=action==="start"?findQuery[id]?.trim():undefined;
  if(action==="start"&&(!query||query.length>128||
    [...query].some(c=>c.charCodeAt(0)<32))){
   findNotice[id]="Enter a search term of 1–128 characters.";return;
  }
  findBusy[id]=true;
  try{
   const result=await invoke<{workspaceId:string;status:string;source:string;
     nextPromptAllowed:boolean;resultVerified:boolean}>(
     "browser_find",{workspaceId:id,action,...(query?{query}:{})});
   if(result.workspaceId!==id||result.status!=="FIND_REQUESTED"||
      result.source!=="NATIVE_WEBVIEW_FIND"||
      result.nextPromptAllowed!==false||result.resultVerified!==false)
    throw Error("INVALID_NATIVE_FIND_RECEIPT");
   findNotice[id]=action==="stop"?"Find stopped (requested).":
     "Native Find requested; match count is not verified.";
  }catch{findNotice[id]="Native Find unavailable or request rejected.";}
  finally{findBusy[id]=false;}
 }
 async function closeFind(){
  const id=current.id;
  if(findOpen[id]&&findTab[id]===(tabs[id]?.activeTab??"main"))
   await requestFind("stop");
  findOpen[id]=false;
  delete findQuery[id];
  delete findTab[id];
 }
 async function inspectChatStatus(){
  const id=current.id;
  if(!nativeDesktop||checkingChatStatus[id]||!mountedSlots.includes(id))return;
  checkingChatStatus[id]=true;
  try {
   const receipt=await invoke<{workspaceId:string;state:string;source:string;
    deliveryVerified:boolean;resultVerified:boolean;nextPromptAllowed:boolean}>(
    "operator_chat_status",{workspaceId:id});
   if(receipt.workspaceId!==id||receipt.source!=="UNVERIFIED_NATIVE_WEBVIEW_UI"||
      receipt.deliveryVerified!==false||receipt.resultVerified!==false||
      receipt.nextPromptAllowed!==false||
      !["WAITING","GENERATING","POSSIBLY_COMPLETED","ERROR","UNKNOWN"].includes(receipt.state))
    throw Error("INVALID_CHAT_STATUS_RECEIPT");
   responseHints[id]=receipt.state as "WAITING"|"GENERATING"|"POSSIBLY_COMPLETED"|"ERROR"|"UNKNOWN";
  } catch {responseHints[id]="UNKNOWN";}
  finally {checkingChatStatus[id]=false;}
 }
 async function sendReviewedDraftOnce(){
  const id=current.id;
  const draft=manualDrafts[id];
  if(!nativeDesktop||mounting||operatorSending[id]||!mountedSlots.includes(id)||!draft)return;
  operatorSending[id]=true;
  try {
   const receipt=await invoke<{status:string;workspaceId:string;sent:boolean}>("operator_send_once",{workspaceId:id,text:draft});
   if(receipt.workspaceId!==id||receipt.status!=="UI_ACTION_REQUESTED"||receipt.sent!==false)
    throw Error("INVALID_OPERATOR_SEND_RECEIPT");
   responseHints[id]="WAITING";
   manualDraftNotices[id]="Send action requested once. Confirm the message appeared in ChatGPT; delivery is not verified.";
  } catch {
   responseHints[id]="UNKNOWN";
   manualDraftNotices[id]="Send was rejected or its outcome is unknown. Check the conversation before trying another action.";
  } finally {operatorSending[id]=false;}
 }
 function prepareNextDraft(){
  const id=current.id;
  const result=prepareOperatorContinuation({workspaceId:id,priorDraft:manualDrafts[id],
   reply:manualReplies[id],nextAction:nextActions[id]});
  if(!result.ready){
   continuationNotices[id]="Paste the reply for this workspace before preparing the next draft.";
   return;
  }
  manualDrafts[id]=result.prompt;
  manualDraftNotices[id]=result.excerpted
   ?"Continuation draft ready. Long context was shortened; review the original conversation before sending."
   :"Continuation draft ready. Review before sending.";
  continuationNotices[id]="Prepared; response, delivery and QA are not verified.";
  delete manualReplies[id];
  delete nextActions[id];
 }
 function dismissManualDraft(){
  const id=current.id;
  delete manualDrafts[id];
  delete manualDraftNotices[id];
 }
 async function refreshBookmark(id:string){
  if(!nativeDesktop)return;
  try{
   const x=await invoke<{workspaceId:string;available:boolean}>("chat_bookmark_status",{workspaceId:id});
   if(x?.workspaceId===id)bookmarkAvailable[id]=x.available===true;
  }catch{bookmarkAvailable[id]=false;}
 }
 async function saveChatBookmark(){
  if(!nativeDesktop||bookmarkBusy||mounting)return;
  bookmarkBusy=true;const id=current.id;
  try{
   await invoke("save_chat_bookmark",{workspaceId:id});
   await refreshBookmark(id);
   embeddedErrors[id]="";
   chatNotices[id]="Chat link saved on this PC. Account and session are not verified.";
  }catch{
   chatNotices[id]="";
   embeddedErrors[id]="Open an ordinary ChatGPT conversation before saving its link.";
  }finally{bookmarkBusy=false;}
 }
 async function reopenChatBookmark(){
  if(!nativeDesktop||bookmarkBusy||mounting)return;
  bookmarkBusy=true;const id=current.id;
  try{
   const receipt=await invoke<{status:string}>("restore_chat_bookmark",{workspaceId:id});
   embeddedErrors[id]="";
   chatNotices[id]=receipt.status==="ALREADY_DISPLAYED"
    ?"Saved conversation address is displayed; ChatGPT session not verified."
    :"Opening the saved address. Confirm the chat/account in ChatGPT.";
  }catch{
   chatNotices[id]="";
   embeddedErrors[id]="Cannot reopen here: close the active page or open ChatGPT home first.";
  }finally{bookmarkBusy=false;}
 }
 async function forgetChatBookmark(){
  if(!nativeDesktop||bookmarkBusy||mounting)return;
  bookmarkBusy=true;const id=current.id;
  try{
   await invoke("forget_chat_bookmark",{workspaceId:id});
   bookmarkAvailable[id]=false;
   embeddedErrors[id]="";
   chatNotices[id]="Local bookmark forgotten. ChatGPT conversation remains in your account.";
  }catch{
   chatNotices[id]="";
   embeddedErrors[id]="Could not forget the local bookmark.";
  }finally{bookmarkBusy=false;}
 }
 function act(action:UIAction){const result=applyWorkspaceAction(workspaceState,{...action,expectedRevision:workspaceState.revision});if(result.status==="APPLIED"){workspaceState=result.state;if(action.type==="SELECT"){void viewerQueue?.schedule(workspaceState.selectedId,mountedSlots.includes(workspaceState.selectedId),JSON.stringify(bounds()));}}}
 onMount(()=>{
 let active=true;
 let stopAddressListener:(()=>void)|undefined;
 let stopOpenedListener:(()=>void)|undefined;
 let stopManualDraftListener:(()=>void)|undefined;
 let stopPopupListener:(()=>void)|undefined;
 let stopFindErrorListener:(()=>void)|undefined;
 nativeDesktop="__TAURI_INTERNALS__" in window;
 if(nativeDesktop){
  for(const w of workspaceState.workspaces){
   void refreshBookmark(w.id);
   void refreshSavedTabs(w.id);
   void refreshBrowserBookmarks(w.id);
  }
  void listen<{workspaceId:string;url:string;tabId?:string}>("browser-address",({payload})=>{
   if(!active)return;
   if((tabs[payload.workspaceId]?.activeTab??"main")===(payload.tabId??"main"))
    browserAddresses[payload.workspaceId]=payload.url==="about:blank"?"":payload.url;
   if(typeof payload.workspaceId==="string")
    sessionHistory[payload.workspaceId]=appendSessionHistory(
     sessionHistory[payload.workspaceId]??[],payload.workspaceId,payload.tabId??"main",payload.url);
  }).then(stop=>{if(active)stopAddressListener=stop;else stop();}).catch(()=>{});
  void listen<{workspaceId:string}>("browser-opened",({payload})=>{
   const id=payload.workspaceId;
   if(!mountedSlots.includes(id)){
    mountedSlots=[...mountedSlots,id];
    if(workspaceState.selectedId===id)void viewerQueue?.schedule(id,true,JSON.stringify(bounds()));
   }
  }).then(stop=>{if(active)stopOpenedListener=stop;else stop();}).catch(()=>{});
  void listen<{workspaceId:string;url:string}>("browser-new-tab-request",({payload})=>{
   if(/^workspace-(0[1-9]|10)$/.test(payload?.workspaceId??"")&&
      typeof payload.url==="string"&&payload.url.length<=2048&&
      resolveBrowserAddress(payload.url)===payload.url)
    popupOffers[payload.workspaceId]=payload.url;
  }).then(stop=>{if(active)stopPopupListener=stop;else stop();}).catch(()=>{});
  void listen<{workspaceId:string;tabId:string;reason:string}>("browser-find-error",({payload})=>{
   if(active&&/^workspace-(0[1-9]|10)$/.test(payload?.workspaceId??"")&&
      payload.tabId===findTab[payload.workspaceId]&&findOpen[payload.workspaceId])
    findNotice[payload.workspaceId]="Find unsupported by the current WebView2 runtime.";
  }).then(stop=>{if(active)stopFindErrorListener=stop;else stop();}).catch(()=>{});
  void listen<ManualDraftReceipt>("workspace-chat-draft",({payload})=>{
   if(active)acceptManualDraft(payload);
  }).then(stop=>{if(active)stopManualDraftListener=stop;else stop();}).catch(()=>{});
 }
 viewerQueue=createViewerQueue({hide:(nextWorkspace?:string)=>hideAllEmbeddedViews(invoke,nextWorkspace),show:async (id:string)=>showWorkspace(id)});
 void readWebviewStatus(invoke).then(status=>{if(active)webviewCandidateObserved=status.observed;});
 if(viewerElement&&typeof ResizeObserver!=="undefined"){
   viewerObserver=new ResizeObserver(()=>{if(active&&mountedSlots.includes(workspaceState.selectedId))void viewerQueue?.schedule(workspaceState.selectedId,true,JSON.stringify(bounds()));});
   viewerObserver.observe(viewerElement);
 }
 return ()=>{active=false;stopAddressListener?.();stopOpenedListener?.();stopManualDraftListener?.();stopPopupListener?.();stopFindErrorListener?.();viewerObserver?.disconnect();void viewerQueue?.close();};
});
 async function browserAction(action:"back"|"forward"|"reload"|"navigate",address?:string){
  const workspaceId=current.id;
  try {
   await invoke("browser_active_action",{workspaceId,action,address});
   embeddedErrors[workspaceId]="";
  } catch {embeddedErrors[workspaceId]="The browser could not navigate to that address.";}
 }
 function closeConnections(){connectionsOpen=false;connectionButton?.focus();}
 function toggleConnections(){connectionsOpen=!connectionsOpen;}
 function onDocumentPointer(event:PointerEvent){if(connectionsOpen && !connectionButton?.contains(event.target as Node) && !connectionPanel?.contains(event.target as Node))connectionsOpen=false;}
 function onDocumentKey(event:KeyboardEvent){
  if(connectionsOpen && event.key==="Escape"){event.preventDefault();closeConnections();return;}
  if(!nativeDesktop||!mountedSlots.includes(current.id)||event.defaultPrevented)return;
  const el=event.target as HTMLElement|null;
  const editable=!!el&&(el.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(el.tagName));
  const id=current.id;
  const action=browserShortcut({key:event.key,ctrlKey:event.ctrlKey,metaKey:event.metaKey,
   altKey:event.altKey,shiftKey:event.shiftKey,editable:editable&&!["l","f"].includes(event.key.toLowerCase()),
   activeTab:tabs[id]?.activeTab??"main",tabs:tabs[id]?.tabs??[]});
  if(!action)return;
  // Escape from an address field only for explicit Ctrl+L; ordinary typing
  // and edit commands remain owned by the focused control.
  if(editable&&!["ADDRESS","FIND"].includes(action.type))return;
  event.preventDefault();
  switch(action.type){
   case "ADDRESS":addressInput?.focus();addressInput?.select();break;
   case "FIND":showFind();break;
   case "NEW_TAB":openTab();break;
   case "CLOSE_TAB":void tabAction("close_support_tab",action.tabId);break;
   case "SELECT_TAB":void tabAction("select_browser_tab",action.tabId);break;
   case "MAIN_TAB":void tabAction("select_browser_tab","main");break;
   case "RELOAD":void browserAction("reload");break;
   case "BACK":void browserAction("back");break;
   case "FORWARD":void browserAction("forward");break;
  }
 }
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="LazyPrompting desktop workspace shell"/></svelte:head>
<svelte:document onpointerdown={onDocumentPointer} onkeydown={onDocumentKey}/>
<div class="lp-app" data-testid="app-root" data-webview-candidate-observed={webviewCandidateObserved}>
 <header class="lp-topbar">
  <div class="lp-brand"><img class="lp-mark" src="/lazyprompting-icon.svg" alt="" aria-hidden="true"/><strong>LazyPrompting</strong></div>
  <div class="lp-connection-anchor">
   <button bind:this={connectionButton} type="button" class="lp-connection-trigger" data-testid="connection-status-header" aria-expanded={connectionsOpen} aria-haspopup="dialog" aria-controls="lp-connection-panel" onclick={toggleConnections}>
    <span>Connections</span><span class="lp-header-status-group"><span class="lp-header-status-dot" aria-hidden="true"></span><span class="lp-header-status-label">{nativeDesktop?"Host running":"Offline"}</span></span><svg class:rotated={connectionsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
   </button>
   {#if connectionsOpen}
    <div bind:this={connectionPanel} id="lp-connection-panel" class="lp-dialog" role="dialog" aria-modal="false" aria-labelledby="lp-connections-title">
     <div class="lp-dialog-heading"><div class="lp-dialog-title"><h2 id="lp-connections-title">Connections</h2></div><button class="lp-icon-button" type="button" aria-label="Close connections" onclick={closeConnections}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
     <div class="lp-connection-list">
      {#each [{name:"Codex / OpenCode MCP",status:nativeDesktop?"Host available":"Unavailable",icon:"nodes"},{name:"Browser",status:mountedSlots.includes(current.id)?"Open":nativeDesktop?"Closed":"Unavailable",icon:"globe"}] as item}
       <div class="lp-connection-row">
        <span class="lp-connection-identity"><span class="lp-connection-icon">
         {#if item.icon==="terminal"}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/></svg>
         {:else if item.icon==="nodes"}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3h6v3M18 9v3h-6"/></svg>
         {:else}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>{/if}
        </span><span>{item.name}</span></span>
        <span class:unavailable={item.status==="Unavailable"} class="lp-connection-state"><span class="lp-state-dot" aria-hidden="true"></span>{item.status}</span>
       </div>
      {/each}
     </div>
    </div>
   {/if}
  </div>
 </header>
 <main class:focused={workspaceState.focus} class="lp-shell">
  {#if !workspaceState.focus}
   <aside class="lp-sidebar" aria-label="Workspaces">
    <div class="lp-sidebar-heading"><h1>Workspaces</h1><span>{workspaceState.workspaces.length}</span></div>
    <nav class="lp-workspace-list" aria-label="Select workspace">
     {#each workspaceState.workspaces as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-workspace" class:selected={workspaceState.selectedId===w.id} aria-pressed={workspaceState.selectedId===w.id} title={`${w.name} — ${workspaceStatus(w)}`} aria-label={`${w.name}, ${workspaceStatus(w)}`} onclick={()=>act({type:"SELECT",workspaceId:w.id})}>
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg><span class="lp-workspace-detail"><span class="lp-workspace-name">{w.name}</span><span class="lp-workspace-status" data-status={workspaceStatus(w).toLowerCase()}><span class="lp-workspace-status-dot" aria-hidden="true"></span>{workspaceStatus(w)}</span></span>
      </button>
     {/each}
    </nav>
   </aside>
  {/if}
  <section class="lp-main-panel" aria-label="Selected workspace">
   <div class="lp-panel-header"><h2 title={current.name}>{current.name}</h2><button type="button" class="lp-focus-button" data-testid="focus-toggle" aria-pressed={workspaceState.focus} onclick={()=>act({type:"FOCUS",focus:!workspaceState.focus})}>{workspaceState.focus?"Show workspaces":"Focus"}</button></div>
   <div class="lp-viewer" role="region" aria-label="Workspace browser">
    {#if mountedSlots.includes(current.id)}
     <div class="lp-browser-tabs" aria-label="Browser tabs">
      <button type="button" class:active={(tabs[current.id]?.activeTab??"main")==="main"}
       disabled={tabBusy[current.id]} onclick={()=>tabAction("select_browser_tab","main")}>ChatGPT · Main</button>
      {#each tabs[current.id]?.tabs??[] as tabId (tabId)}
       <div class="lp-browser-tab-item">
        <button type="button" class:active={tabs[current.id]?.activeTab===tabId}
         disabled={tabBusy[current.id]} onclick={()=>tabAction("select_browser_tab",tabId)}>{tabId}</button>
        <button type="button" aria-label={"Close "+tabId} disabled={tabBusy[current.id]}
         onclick={()=>tabAction("close_support_tab",tabId)}>×</button>
       </div>
      {/each}
      <button type="button" aria-label="New browser tab"
       disabled={tabBusy[current.id]||(tabs[current.id]?.tabs?.length??0)>=3}
       onclick={()=>openTab()}>+</button>
      <button type="button" aria-label="Save supporting tabs"
       disabled={tabSessionBusy[current.id]||tabBusy[current.id]}
       onclick={saveTabs}>Save tabs</button>
      <button type="button" aria-label="Restore saved supporting tabs"
       disabled={tabSessionBusy[current.id]||tabBusy[current.id]||
         !savedTabAvailability[current.id]||(tabs[current.id]?.tabs.length??0)>0}
       onclick={restoreTabs}>Restore tabs</button>
     </div>
     {#if popupOffers[current.id]}
      <div class="lp-browser-tab-offer">
       <span>Page requested new tab: {popupOffers[current.id]}</span>
       <button type="button" class="lp-focus-button" onclick={()=>openTab(popupOffers[current.id])}>Open in tab</button>
       <button type="button" class="lp-focus-button" onclick={()=>delete popupOffers[current.id]}>Dismiss</button>
      </div>
     {/if}
     {#if tabWarnings[current.id]}<p role="status" class="lp-browser-error">{tabWarnings[current.id]}</p>{/if}
    {/if}
    {#if mountedSlots.includes(current.id)}
     <form class="lp-browser-address" onsubmit={openAddress}>
      <button class="lp-focus-button" type="button" aria-label="Go back" onclick={()=>browserAction("back")}>←</button>
      <button class="lp-focus-button" type="button" aria-label="Go forward" onclick={()=>browserAction("forward")}>→</button>
      <button class="lp-focus-button" type="button" aria-label="Reload" onclick={()=>browserAction("reload")}>↻</button>
      <button class="lp-focus-button" type="button" aria-label="Return to main ChatGPT tab" title="Home · ChatGPT main tab" disabled={tabs[current.id]?.activeTab==="main"||tabBusy[current.id]} onclick={()=>tabAction("select_browser_tab","main")}>⌂</button>
      <button class="lp-focus-button" type="button" aria-label="Find in current page" onclick={showFind}>Find</button>
      <div class="lp-browser-zoom" aria-label="Browser page zoom">
       <button type="button" aria-label="Zoom out" disabled={zoomBusy[current.id]||zoomNow()<=75}
        onclick={()=>stepBrowserZoom(-1)}>−</button>
       <span>{zoomNow()}%</span>
       <button type="button" aria-label="Zoom in" disabled={zoomBusy[current.id]||zoomNow()>=150}
        onclick={()=>stepBrowserZoom(1)}>+</button>
       <button type="button" aria-label="Reset zoom" disabled={zoomBusy[current.id]||zoomNow()===100}
        onclick={()=>setBrowserZoom(100)}>Reset</button>
      </div>

      <input aria-label="Search or enter a web address" placeholder="Search the web or enter an address" bind:this={addressInput} bind:value={browserAddresses[current.id]} maxlength="2048" disabled={mounting} />
      <button class="lp-focus-button" disabled={mounting||!browserAddresses[current.id]?.trim()}>Go</button>
      <button class="lp-focus-button" type="button" disabled={mounting} onclick={closeLocalPreview}>Close browser</button>
     </form>
    {/if}
    {#if mountedSlots.includes(current.id)&&findOpen[current.id]}
     <form class="lp-browser-find" aria-label="Find in current browser tab" onsubmit={(event)=>{event.preventDefault();void requestFind("start");}}>
      <input bind:this={findInput} aria-label="Find text in page"
       placeholder="Find text on this page" maxlength="128" bind:value={findQuery[current.id]} />
      <button type="submit" class="lp-focus-button" disabled={findBusy[current.id]||!findQuery[current.id]?.trim()}>Find</button>
      <button type="button" class="lp-focus-button" disabled={findBusy[current.id]} onclick={()=>requestFind("previous")}>Previous</button>
      <button type="button" class="lp-focus-button" disabled={findBusy[current.id]} onclick={()=>requestFind("next")}>Next</button>
      <button type="button" class="lp-focus-button" onclick={closeFind}>Close</button>
      {#if findNotice[current.id]}<span role="status">{findNotice[current.id]}</span>{/if}
     </form>
    {/if}
    {#if mountedSlots.includes(current.id)}
     <div class="lp-chat-bookmark-actions" aria-label="ChatGPT conversation bookmarks">
      <button class="lp-focus-button" type="button" disabled={bookmarkBusy||mounting} onclick={saveChatBookmark}>Save chat link</button>
      {#if bookmarkAvailable[current.id]}
       <button class="lp-focus-button" type="button" disabled={bookmarkBusy||mounting} onclick={reopenChatBookmark}>Reopen saved</button>
       <button class="lp-focus-button" type="button" disabled={bookmarkBusy||mounting} onclick={forgetChatBookmark}>Forget link</button>
      {/if}
     </div>
    {/if}
    {#if mountedSlots.includes(current.id)}
     <section class="lp-browser-library" aria-label="Browser history and bookmarks">
      <div class="lp-browser-library-tools">
       <button type="button" class="lp-focus-button" aria-expanded={!!libraryOpen[current.id]}
        onclick={()=>libraryOpen[current.id]=!libraryOpen[current.id]}>
        {libraryOpen[current.id]?"Hide library":"Bookmarks & history"}
       </button>
       <button type="button" class="lp-focus-button"
        disabled={bookmarkListBusy[current.id]||tabBusy[current.id]||
          !tabs[current.id]||tabs[current.id].activeTab==="main"}
        onclick={addCurrentBookmark}>Bookmark this tab</button>
      </div>
      {#if libraryOpen[current.id]}
       <div class="lp-browser-library-sections">
        <div>
         <strong>Saved bookmarks</strong>
         {#if !browserBookmarks[current.id]?.length}<p>No supporting-page bookmarks saved.</p>{/if}
         {#each browserBookmarks[current.id]??[] as url (url)}
          <div class="lp-browser-library-link">
           <button type="button" onclick={()=>openLibraryUrl(url)} title={url}>{url}</button>
           <button type="button" aria-label={"Remove bookmark "+url}
            disabled={bookmarkListBusy[current.id]} onclick={()=>deleteBookmark(url)}>×</button>
          </div>
         {/each}
        </div>
        <div>
         <strong>Recent support pages (current app session only)</strong>
         {#if !sessionHistory[current.id]?.length}<p>No recent supporting-page navigation.</p>{/if}
         {#each sessionHistory[current.id]??[] as url (url)}
          <div class="lp-browser-library-link">
           <button type="button" onclick={()=>openLibraryUrl(url)} title={url}>{url}</button>
          </div>
         {/each}
        </div>
       </div>
      {/if}
     </section>
    {/if}
    {#if mountedSlots.includes(current.id)}
     <div class="lp-workspace-evidence" aria-label="Workspace progress evidence">
      <span>Chat response: {responseHints[current.id]??"UNKNOWN"} (UI only)</span>
      <button type="button" class="lp-focus-button" disabled={checkingChatStatus[current.id]} onclick={inspectChatStatus}>Check status</button>
      <span>GitHub progress: {(githubScopeKeys[current.id]===((githubRepos[current.id]??"").trim()+"@"+(githubBranches[current.id]??"").trim()) ? githubResults[current.id]?.status??"NOT_CHECKED" : "NOT_CHECKED")} (read-only, unverified for completion)</span>
     </div>
    {/if}
    <section class="lp-public-github" aria-label="Public GitHub repository progress">
     <strong>Public GitHub progress</strong>
     <div class="lp-public-github-fields">
      <input aria-label="GitHub repository" placeholder="owner/repository" maxlength="201" bind:value={githubRepos[current.id]} />
      <input aria-label="GitHub branch" placeholder="branch" maxlength="200" bind:value={githubBranches[current.id]} />
      <button class="lp-focus-button" type="button" disabled={githubBusy[current.id]} onclick={inspectPublicGitHub}>Check GitHub</button>
     </div>
     {#if githubResults[current.id] && githubScopeKeys[current.id]===((githubRepos[current.id]??"").trim()+"@"+(githubBranches[current.id]??"").trim())}
      <p role="status">{githubResults[current.id].status}{githubResults[current.id].reason?" — "+githubResults[current.id].reason:""}</p>
      {#if githubResults[current.id].headSha}
       <p>HEAD: <code>{githubResults[current.id].headSha}</code></p>
      {/if}
      {#if githubResults[current.id].commits?.length}
       <p>{githubResults[current.id].commits?.length} new commit(s) since the saved session baseline. Review required; this does not prove ChatGPT completion.</p>
      {/if}
     {/if}
    </section>
    {#if embeddedErrors[current.id]}<p class="lp-browser-error" role="status">{embeddedErrors[current.id]}</p>{/if}
    {#if chatNotices[current.id]}<p class="lp-chat-notice" role="status">{chatNotices[current.id]}</p>{/if}
    {#if manualDrafts[current.id]}
     <section class="lp-manual-handoff" aria-label="Manual ChatGPT handoff">
      <div class="lp-manual-handoff-header">
       <strong>Manual ChatGPT handoff</strong>
       <div class="lp-manual-handoff-actions">
        <button class="lp-focus-button" type="button" disabled={!nativeDesktop||mounting||operatorSending[current.id]||!mountedSlots.includes(current.id)} onclick={sendReviewedDraftOnce}>Send once</button>
        <button class="lp-focus-button" type="button" onclick={copyManualDraft}>Copy draft</button>
        <button class="lp-focus-button" type="button" onclick={dismissManualDraft}>Dismiss</button>
       </div>
      </div>
      <p>Unverified MCP client content. Review its scope before sending once or copying. No delivery or result is verified.</p>
      <textarea bind:this={manualDraftArea} aria-label="Review and copy ChatGPT handoff draft" readonly value={manualDrafts[current.id]} rows="3"></textarea>
      {#if manualDraftNotices[current.id]}<p role="status">{manualDraftNotices[current.id]}</p>{/if}
      <div class="lp-operator-response" aria-label="Manual response continuation">
       <label for="lp-operator-reply">ChatGPT reply (pasted by operator)</label>
       <textarea id="lp-operator-reply" bind:value={manualReplies[current.id]} maxlength="16000" rows="3" placeholder="Paste the response for this workspace."></textarea>
       <label for="lp-operator-next">Next requested step (optional)</label>
       <input id="lp-operator-next" bind:value={nextActions[current.id]} maxlength="800" placeholder="Leave empty to ask ChatGPT to identify the next unfinished step." />
       <button type="button" class="lp-focus-button" disabled={operatorSending[current.id]} onclick={prepareNextDraft}>Prepare next draft</button>
       {#if continuationNotices[current.id]}<p role="status">{continuationNotices[current.id]}</p>{/if}
      </div>
     </section>
    {/if}
    <div class="lp-browser-page" bind:this={viewerElement}>
     {#if !mountedSlots.includes(current.id)}
      <div class="lp-empty">
       <button type="button" class="lp-focus-button" disabled={!nativeDesktop||mounting||bookmarkBusy} onclick={()=>openLocalPreview()}>Open ChatGPT</button>
       {#if bookmarkAvailable[current.id]}
        <button type="button" class="lp-focus-button" disabled={!nativeDesktop||mounting||bookmarkBusy} onclick={reopenChatBookmark}>Reopen saved conversation</button>
       {/if}
      </div>
     {/if}
    </div>
   </div>
  </section>
 </main>
</div>
