<script lang="ts">
 import {createWorkspaceState,applyWorkspaceAction} from "./app/workspace-controller.mjs";
 import {onMount,tick} from "svelte";
 import {invoke} from "@tauri-apps/api/core";
 import {listen} from "@tauri-apps/api/event";
 import {readWebviewStatus} from "./app/webview-status.mjs";
 import {requestLocalPreviewMount,requestLocalPreviewClose,hideAllEmbeddedViews} from "./app/embedded-view-bridge.mjs";
 import {createViewerQueue} from "./app/viewer-queue.mjs";
 import {resolveBrowserAddress} from "./app/browser-address.mjs";
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
  void browserAction("navigate",address);
 }
 async function closeLocalPreview(){
  if(mounting||!viewerQueue)return;
  const id=workspaceState.selectedId;
  mounting=true;
  mountedSlots=mountedSlots.filter(slot=>slot!==id);
  try {
   await viewerQueue.schedule(id,false);
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
 nativeDesktop="__TAURI_INTERNALS__" in window;
 if(nativeDesktop){
  for(const w of workspaceState.workspaces)void refreshBookmark(w.id);
  void listen<{workspaceId:string;url:string}>("browser-address",({payload})=>{
   browserAddresses[payload.workspaceId]=payload.url==="about:blank"?"":payload.url;
  }).then(stop=>{if(active)stopAddressListener=stop;else stop();}).catch(()=>{});
  void listen<{workspaceId:string}>("browser-opened",({payload})=>{
   const id=payload.workspaceId;
   if(!mountedSlots.includes(id)){
    mountedSlots=[...mountedSlots,id];
    if(workspaceState.selectedId===id)void viewerQueue?.schedule(id,true,JSON.stringify(bounds()));
   }
  }).then(stop=>{if(active)stopOpenedListener=stop;else stop();}).catch(()=>{});
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
 return ()=>{active=false;stopAddressListener?.();stopOpenedListener?.();stopManualDraftListener?.();viewerObserver?.disconnect();void viewerQueue?.close();};
});
 async function browserAction(action:"back"|"forward"|"reload"|"navigate",address?:string){
  const workspaceId=current.id;
  try {
   await invoke("browser_action",{workspaceId,action,address});
   embeddedErrors[workspaceId]="";
  } catch {embeddedErrors[workspaceId]="The browser could not navigate to that address.";}
 }
 function closeConnections(){connectionsOpen=false;connectionButton?.focus();}
 function toggleConnections(){connectionsOpen=!connectionsOpen;}
 function onDocumentPointer(event:PointerEvent){if(connectionsOpen && !connectionButton?.contains(event.target as Node) && !connectionPanel?.contains(event.target as Node))connectionsOpen=false;}
 function onDocumentKey(event:KeyboardEvent){
  if(connectionsOpen && event.key==="Escape"){event.preventDefault();closeConnections();}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="l"&&addressInput){
   event.preventDefault();addressInput.focus();addressInput.select();
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
     <form class="lp-browser-address" onsubmit={openAddress}>
      <button class="lp-focus-button" type="button" aria-label="Go back" onclick={()=>browserAction("back")}>←</button>
      <button class="lp-focus-button" type="button" aria-label="Go forward" onclick={()=>browserAction("forward")}>→</button>
      <button class="lp-focus-button" type="button" aria-label="Reload" onclick={()=>browserAction("reload")}>↻</button>
      <input aria-label="Search or enter a web address" placeholder="Search the web or enter an address" bind:this={addressInput} bind:value={browserAddresses[current.id]} maxlength="2048" disabled={mounting} />
      <button class="lp-focus-button" disabled={mounting||!browserAddresses[current.id]?.trim()}>Go</button>
      <button class="lp-focus-button" type="button" disabled={mounting} onclick={closeLocalPreview}>Close browser</button>
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
    {#if embeddedErrors[current.id]}<p class="lp-browser-error" role="status">{embeddedErrors[current.id]}</p>{/if}
    {#if chatNotices[current.id]}<p class="lp-chat-notice" role="status">{chatNotices[current.id]}</p>{/if}
    {#if manualDrafts[current.id]}
     <section class="lp-manual-handoff" aria-label="Manual ChatGPT handoff">
      <div class="lp-manual-handoff-header">
       <strong>Manual ChatGPT handoff</strong>
       <div class="lp-manual-handoff-actions">
        <button class="lp-focus-button" type="button" onclick={copyManualDraft}>Copy draft</button>
        <button class="lp-focus-button" type="button" onclick={dismissManualDraft}>Dismiss</button>
       </div>
      </div>
      <p>Unverified MCP client content. Review its scope before pasting into ChatGPT. Nothing was sent or verified.</p>
      <textarea bind:this={manualDraftArea} aria-label="Review and copy ChatGPT handoff draft" readonly value={manualDrafts[current.id]} rows="3"></textarea>
      {#if manualDraftNotices[current.id]}<p role="status">{manualDraftNotices[current.id]}</p>{/if}
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
