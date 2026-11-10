<script lang="ts">
 import {createWorkspaceState,applyWorkspaceAction} from "./app/workspace-controller.mjs";
 import {onMount} from "svelte";
 import {invoke} from "@tauri-apps/api/core";
 import {readWebviewStatus} from "./app/webview-status.mjs";
 import {requestLocalPreviewMount,hideAllEmbeddedViews} from "./app/embedded-view-bridge.mjs";
 type Workspace={id:string;name:string;connection:string;activity:string};
 const workspaceStatus=(w:Workspace)=>w.connection==="ERROR"||w.activity==="ERROR"?"Error":w.connection!=="CONNECTED"?"Offline":w.activity==="RUNNING"?"Working":w.activity==="READY"||w.activity==="IDLE"?"Ready":"Offline";
 type UIAction={type:string;workspaceId?:string;focus?:boolean};
 let state=$state(createWorkspaceState());
 let connectionsOpen=$state(false);
 let webviewCandidateObserved=$state(false);
 let viewerElement:HTMLDivElement | undefined;
 let mountedSlots=$state<string[]>([]);
 let mounting=$state(false);
 let selectionGeneration=0;
 let connectionButton:HTMLButtonElement | undefined;
 let connectionPanel:HTMLElement | undefined;
 const current=$derived(state.workspaces.find((w:Workspace)=>w.id===state.selectedId)??state.workspaces[0]);
 function bounds(){if(!viewerElement)return null;const r=viewerElement.getBoundingClientRect();return {x:r.left+1,y:r.top+1,width:r.width-2,height:r.height-2};}
 async function showWorkspace(id:string){const b=bounds();if(!b)return;const result=await requestLocalPreviewMount(invoke,id,b);if(result.ok&&result.mounted&&!mountedSlots.includes(id))mountedSlots=[...mountedSlots,id];}
 async function openLocalPreview(){if(mounting||!webviewCandidateObserved)return;mounting=true;try{await showWorkspace(state.selectedId);}finally{mounting=false;}}
 function act(action:UIAction){const result=applyWorkspaceAction(state,{...action,expectedRevision:state.revision});if(result.status==="APPLIED"){state=result.state;if(action.type==="SELECT"){const generation=++selectionGeneration;const id=state.selectedId;void hideAllEmbeddedViews(invoke).then(()=>{if(generation===selectionGeneration&&mountedSlots.includes(id))void showWorkspace(id);});}}}
 onMount(()=>{let active=true;void readWebviewStatus(invoke).then(status=>{if(active)webviewCandidateObserved=status.observed;});return ()=>{active=false;void hideAllEmbeddedViews(invoke);};});
 function closeConnections(){connectionsOpen=false;connectionButton?.focus();}
 function onDocumentPointer(event:PointerEvent){if(connectionsOpen && !connectionButton?.contains(event.target as Node) && !connectionPanel?.contains(event.target as Node))connectionsOpen=false;}
 function onDocumentKey(event:KeyboardEvent){if(connectionsOpen && event.key==="Escape"){event.preventDefault();closeConnections();}}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="LazyPrompting desktop workspace shell"/></svelte:head>
<svelte:document onpointerdown={onDocumentPointer} onkeydown={onDocumentKey}/>
<div class="lp-app" data-testid="app-root" data-webview-candidate-observed={webviewCandidateObserved}>
 <header class="lp-topbar">
  <div class="lp-brand"><img class="lp-mark" src="/lazyprompting-icon.svg" alt="" aria-hidden="true"/><strong>LazyPrompting</strong></div>
  <div class="lp-connection-anchor">
   <button bind:this={connectionButton} type="button" class="lp-connection-trigger" data-testid="connection-status-header" aria-expanded={connectionsOpen} aria-haspopup="dialog" aria-controls="lp-connection-panel" onclick={()=>connectionsOpen=!connectionsOpen}>
    <span>Connections</span><span class="lp-header-status-group"><span class="lp-header-status-dot" aria-hidden="true"></span><span class="lp-header-status-label">Offline</span></span><svg class:rotated={connectionsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
   </button>
   {#if connectionsOpen}
    <section bind:this={connectionPanel} id="lp-connection-panel" class="lp-dialog" role="dialog" aria-modal="false" aria-labelledby="lp-connections-title">
     <div class="lp-dialog-heading"><div class="lp-dialog-title"><h2 id="lp-connections-title">Connections</h2></div><button class="lp-icon-button" type="button" aria-label="Close connections" onclick={closeConnections}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
     <div class="lp-connection-list">
      {#each [{name:"AI & MCP",status:"Offline",icon:"nodes"},{name:"Browser",status:"Unavailable",icon:"globe"}] as item}
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
    </section>
   {/if}
  </div>
 </header>
 <main class:focused={state.focus} class="lp-shell">
  {#if !state.focus}
   <aside class="lp-sidebar" aria-label="Workspaces">
    <div class="lp-sidebar-heading"><h1>Workspaces</h1><span>{state.workspaces.length}</span></div>
    <nav class="lp-workspace-list" aria-label="Select workspace">
     {#each state.workspaces as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-workspace" class:selected={state.selectedId===w.id} aria-pressed={state.selectedId===w.id} title={`${w.name} — ${workspaceStatus(w)}`} aria-label={`${w.name}, ${workspaceStatus(w)}`} onclick={()=>act({type:"SELECT",workspaceId:w.id})}>
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg><span class="lp-workspace-detail"><span class="lp-workspace-name">{w.name}</span><span class="lp-workspace-status" data-status={workspaceStatus(w).toLowerCase()}><span class="lp-workspace-status-dot" aria-hidden="true"></span>{workspaceStatus(w)}</span></span>
      </button>
     {/each}
    </nav>
   </aside>
  {/if}
  <section class="lp-main-panel" aria-label="Selected workspace">
   <div class="lp-panel-header"><h2 title={current.name}>{current.name}</h2><button type="button" class="lp-focus-button" data-testid="focus-toggle" aria-pressed={state.focus} onclick={()=>act({type:"FOCUS",focus:!state.focus})}>{state.focus?"Show workspaces":"Focus"}</button></div>
   <div class="lp-viewer" bind:this={viewerElement}><div class="lp-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg><h3>Browser not connected</h3><p>Browser runtime is not yet available.</p><button type="button" disabled={!webviewCandidateObserved||mounting} title="Open local WebView preview only" onclick={openLocalPreview}>Open Browser</button></div></div>
  </section>
 </main>
</div>