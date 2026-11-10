<script lang="ts">
 import {createWorkspaceState,applyWorkspaceAction} from "./app/workspace-controller.mjs";
 import {onMount} from "svelte";
 import {invoke} from "@tauri-apps/api/core";
 import {readWebviewStatus} from "./app/webview-status.mjs";
 import {requestLocalPreviewMount,requestLocalPreviewClose,hideAllEmbeddedViews} from "./app/embedded-view-bridge.mjs";
 import {createViewerQueue} from "./app/viewer-queue.mjs";
 type Workspace={id:string;name:string;connection:string;activity:string};
 const workspaceStatus=(w:Workspace)=>w.connection==="ERROR"||w.activity==="ERROR"?"Error":w.connection!=="CONNECTED"?"Offline":w.activity==="RUNNING"?"Working":w.activity==="READY"||w.activity==="IDLE"?"Ready":"Offline";
 type UIAction={type:string;workspaceId?:string;focus?:boolean};
 let workspaceState=$state(createWorkspaceState());
 let connectionsOpen=$state(false);
 let gatewayStatus=$state("Unchecked");
 let gatewayError=$state("");
 type PreviewAction="open"|"snapshot"|"close";
 type PreviewResult={url?:string;title?:string;closed?:boolean};
 let previewBusy=$state(false);
 let previewResults=$state<Record<string,string>>({});
 type CodexResult={status:string;reason?:string;responseText?:string};
 let codexCwd=$state("");
 let codexPrompt=$state("");
 let codexFollowUp=$state("");
 let codexExpected=$state("");
 let codexBusy=$state(false);
 let codexResults=$state<Record<string,CodexResult>>({});
 const codexPolls=new Map<string,ReturnType<typeof setTimeout>>();
 const codexDeadlines=new Map<string,number>();
 let desktopActive=false;
 let webviewCandidateObserved=$state(false);
 let nativeDesktop=$state(false);
 let embeddedErrors=$state<Record<string,string>>({});
 let viewerElement:HTMLDivElement | undefined;
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
  embeddedErrors[id]=mounted?"":"WebView2 preview could not be mounted";
  return mounted;
 }
 async function openLocalPreview(){
  if(mounting||!nativeDesktop||!viewerQueue)return;
  mounting=true;
  try {
   const id=workspaceState.selectedId;
   await viewerQueue.schedule(id,true,JSON.stringify(bounds()));
  } finally {mounting=false;}
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
 function act(action:UIAction){const result=applyWorkspaceAction(workspaceState,{...action,expectedRevision:workspaceState.revision});if(result.status==="APPLIED"){const previous=workspaceState.selectedId;workspaceState=result.state;if(action.type==="SELECT"){if(previous!==workspaceState.selectedId){codexCwd="";codexPrompt="";codexFollowUp="";codexExpected="";}void viewerQueue?.schedule(workspaceState.selectedId,mountedSlots.includes(workspaceState.selectedId),JSON.stringify(bounds()));}}}
 onMount(()=>{
 let active=true;
 desktopActive=true;
 nativeDesktop="__TAURI_INTERNALS__" in window;
 viewerQueue=createViewerQueue({hide:()=>hideAllEmbeddedViews(invoke),show:async (id:string)=>showWorkspace(id)});
 void readWebviewStatus(invoke).then(status=>{if(active)webviewCandidateObserved=status.observed;});
 if(viewerElement&&typeof ResizeObserver!=="undefined"){
   viewerObserver=new ResizeObserver(()=>{if(active&&mountedSlots.includes(workspaceState.selectedId))void viewerQueue?.schedule(workspaceState.selectedId,true,JSON.stringify(bounds()));});
   viewerObserver.observe(viewerElement);
 }
 return ()=>{active=false;desktopActive=false;for(const timer of codexPolls.values())clearTimeout(timer);codexPolls.clear();viewerObserver?.disconnect();void viewerQueue?.close();};
});
 function closeConnections(){connectionsOpen=false;connectionButton?.focus();}
 function scheduleCodexPoll(workspaceId:string){
  if(!desktopActive||Date.now()>=(codexDeadlines.get(workspaceId)??0)){
   codexDeadlines.delete(workspaceId);
   return;
  }
  codexPolls.set(workspaceId,setTimeout(()=>void runCodex("observe",workspaceId,true),1500));
 }
 async function runCodex(action:"dispatch"|"observe"|"stop",workspaceId=workspaceState.selectedId,automatic=false){
  clearTimeout(codexPolls.get(workspaceId));
  codexPolls.delete(workspaceId);
  if(codexBusy){
   if(automatic)scheduleCodexPoll(workspaceId);
   return;
  }
  if(!automatic)codexDeadlines.set(workspaceId,Date.now()+300_000);
  const request=action==="dispatch"?{action,cwd:codexCwd,prompt:codexPrompt,
   ...(codexFollowUp.trim()&&codexExpected.trim()?{followUp:codexFollowUp,expectedResponse:codexExpected}:{})}:{action};
  codexBusy=true;
  try {
   const result=await invoke<CodexResult>("managed_codex",{workspaceId,request});
   codexResults[workspaceId]=result;
   if(result.status==="SENT"||result.status==="WAITING")scheduleCodexPoll(workspaceId);
   else codexDeadlines.delete(workspaceId);
  } catch(error) {
   codexResults[workspaceId]={status:"Blocked",reason:typeof error==="string"&&/^[A-Z_]{1,80}$/.test(error)?error:"CODEX_REQUEST_FAILED"};
   codexDeadlines.delete(workspaceId);
  } finally {
   codexBusy=false;
  }
 }
 async function runLightpanda(action:PreviewAction){
  if(previewBusy)return;
  const workspaceId=workspaceState.selectedId;
  previewBusy=true;
  try {
   const result=await invoke<PreviewResult>("lightpanda_preview",{workspaceId,action});
   previewResults[workspaceId]=action==="close"
    ?(result.closed?"Lightpanda preview closed":"No Lightpanda preview open")
    :[result.title,result.url].filter(Boolean).join(" · ");
  } catch(error) {
   previewResults[workspaceId]=typeof error==="string"&&/^[A-Z_]{1,64}$/.test(error)?error:"PREVIEW_FAILED";
  } finally {
   previewBusy=false;
  }
 }
 function toggleConnections(){
  connectionsOpen=!connectionsOpen;
  if(!connectionsOpen||gatewayStatus==="Checking")return;
  gatewayStatus="Checking";
  gatewayError="";
  void invoke("probe_gateway").then(
   ()=>{gatewayStatus="Ready";},
   (error:unknown)=>{
    gatewayStatus="Unavailable";
    gatewayError=typeof error==="string"&&/^[A-Z_]{1,64}$/.test(error)?error:"GATEWAY_PROBE_FAILED";
   }
  );
 }
 function onDocumentPointer(event:PointerEvent){if(connectionsOpen && !connectionButton?.contains(event.target as Node) && !connectionPanel?.contains(event.target as Node))connectionsOpen=false;}
 function onDocumentKey(event:KeyboardEvent){if(connectionsOpen && event.key==="Escape"){event.preventDefault();closeConnections();}}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="LazyPrompting desktop workspace shell"/></svelte:head>
<svelte:document onpointerdown={onDocumentPointer} onkeydown={onDocumentKey}/>
<div class="lp-app" data-testid="app-root" data-webview-candidate-observed={webviewCandidateObserved}>
 <header class="lp-topbar">
  <div class="lp-brand"><img class="lp-mark" src="/lazyprompting-icon.svg" alt="" aria-hidden="true"/><strong>LazyPrompting</strong></div>
  <div class="lp-connection-anchor">
   <button bind:this={connectionButton} type="button" class="lp-connection-trigger" data-testid="connection-status-header" aria-expanded={connectionsOpen} aria-haspopup="dialog" aria-controls="lp-connection-panel" onclick={toggleConnections}>
    <span>Connections</span><span class="lp-header-status-group"><span class="lp-header-status-dot" aria-hidden="true"></span><span class="lp-header-status-label">Offline</span></span><svg class:rotated={connectionsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
   </button>
   {#if connectionsOpen}
    <div bind:this={connectionPanel} id="lp-connection-panel" class="lp-dialog" role="dialog" aria-modal="false" aria-labelledby="lp-connections-title">
     <div class="lp-dialog-heading"><div class="lp-dialog-title"><h2 id="lp-connections-title">Connections</h2></div><button class="lp-icon-button" type="button" aria-label="Close connections" onclick={closeConnections}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
     <div class="lp-connection-list">
      {#each [{name:"Codex",status:"Offline",icon:"terminal"},{name:"MCP Gateway",status:gatewayStatus,icon:"nodes"},{name:"Browser",status:"Unavailable",icon:"globe"}] as item}
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
     {#if gatewayError}<p role="status">{gatewayError}</p>{/if}
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
   <div class="lp-panel-header lp-preview-controls" role="group" aria-label="Lightpanda preview controls">
    <button class="lp-focus-button" type="button" disabled={previewBusy} onclick={()=>runLightpanda("open")}>Open Lightpanda preview</button>
    <button class="lp-focus-button" type="button" disabled={previewBusy} onclick={()=>runLightpanda("snapshot")}>Read preview</button>
    <button class="lp-focus-button" type="button" disabled={previewBusy} onclick={()=>runLightpanda("close")}>Close preview</button>
    {#if mountedSlots.includes(current.id)}
     <button class="lp-focus-button" type="button" disabled={mounting} onclick={closeLocalPreview}>Close WebView2 preview</button>
    {/if}
    <span role="status">{previewResults[current.id]??""}</span>
   </div>
   <details class="lp-codex-controls">
    <summary>Managed Codex</summary>
    <label>Working directory <input bind:value={codexCwd} maxlength="2048" placeholder="C:\path\to\workspace"/></label>
    <label>Read-only task <textarea bind:value={codexPrompt} maxlength="1200" rows="3"></textarea></label>
    <details>
     <summary>One optional follow-up</summary>
     <label>Expected first response <textarea bind:value={codexExpected} maxlength="300" rows="2"></textarea></label>
     <label>Read-only follow-up <textarea bind:value={codexFollowUp} maxlength="600" rows="2"></textarea></label>
    </details>
    <div class="lp-preview-controls lp-panel-header">
     <button class="lp-focus-button" type="button" disabled={codexBusy||!codexCwd.trim()||!codexPrompt.trim()||Boolean(codexFollowUp.trim())!==Boolean(codexExpected.trim())} onclick={()=>runCodex("dispatch")}>Send Codex turn</button>
     <button class="lp-focus-button" type="button" disabled={codexBusy} onclick={()=>runCodex("observe")}>Recover result</button>
     <button class="lp-focus-button" type="button" disabled={codexBusy} onclick={()=>runCodex("stop")}>Stop Codex workspace</button>
    </div>
    {#if codexResults[current.id]}
     {@const result=codexResults[current.id]}
     <div role="status">{result.status}{result.reason?" · "+result.reason:""}</div>
     {#if result.responseText}<pre>{result.responseText}</pre>{/if}
    {/if}
   </details>
   <div class="lp-viewer" bind:this={viewerElement}><div class="lp-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg><h3>Local WebView2 preview</h3><p role="status">{embeddedErrors[current.id]??""}</p><button type="button" disabled={!nativeDesktop||mounting} onclick={openLocalPreview}>Open WebView2 preview</button></div></div>
  </section>
 </main>
</div>
