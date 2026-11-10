<script lang="ts">

 import {createWorkspaceState,applyWorkspaceAction,listVisibleWorkspaces} from "./app/workspace-controller.mjs";


 type Workspace={id:string;name:string;connection:string;activity:string};
 type UIAction={type:string;workspaceId?:string;name?:string;mode?:string;filter?:string;focus?:boolean};
 let state=$state(createWorkspaceState());
 let editing=$state(false);
 let draft=$state("");


 const current=$derived(state.workspaces.find((w:Workspace)=>w.id===state.selectedId)??state.workspaces[0]);
 const visible=$derived(listVisibleWorkspaces(state));
 function act(action:UIAction){const result=applyWorkspaceAction(state,{...action,expectedRevision:state.revision});if(result.status==="APPLIED")state=result.state;}
 function beginRename(){draft=current.name;editing=true;}
 function saveRename(){const previous=state.revision;act({type:"RENAME",workspaceId:state.selectedId,name:draft});if(state.revision!==previous)editing=false;}
 function selectWorkspace(id:string){act({type:"SELECT",workspaceId:id});}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="Compact ten-workspace ChatGPT desktop control surface"/></svelte:head>
<div class="lp-app" data-testid="app-root">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">LP</span><strong>LazyPrompting</strong></div><span class="lp-connection"><span class="lp-dot"></span>Browser offline</span></header>
 <main class:focused={state.focus} class="lp-shell">
  {#if !state.focus}
   <aside class="lp-sidebar" aria-label="Workspaces">
    <div class="lp-sidebar-heading"><h1>Workspaces</h1><span>10</span></div>
    <label class="lp-search"><span class="lp-sr-only">Search workspaces</span><input data-testid="workspace-search" type="search" placeholder="Find workspace" value={state.filter} oninput={(e)=>act({type:"FILTER",filter:e.currentTarget.value})}/></label>
    <nav class="lp-workspace-list" aria-label="Select workspace">
     {#each visible as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-workspace" class:selected={state.selectedId===w.id} aria-pressed={state.selectedId===w.id} aria-label={"Select "+w.name} onclick={()=>selectWorkspace(w.id)}>
       <span class="lp-number">{w.id.slice(-2)}</span><span class="lp-workspace-name">{w.name}</span><span class="lp-status-dot" aria-label="Not connected"></span>
      </button>
     {:else}
      <p class="lp-no-results">No matching workspace</p>
     {/each}
    </nav>
    <div class="lp-sidebar-foot"><span class="lp-dot"></span>0 / 10 connected</div>
   </aside>
  {/if}
  <section class="lp-main-panel" aria-label="Selected workspace">
   <div class="lp-panel-header"><div class="lp-current"><span class="lp-current-number">{current.id.slice(-2)}</span><div><h2>{current.name}</h2><span>Not connected</span></div></div><div class="lp-actions"><button type="button" data-testid="rename-workspace" onclick={beginRename} aria-label="Rename selected workspace">Rename</button><button type="button" data-testid="focus-toggle" aria-pressed={state.focus} onclick={()=>act({type:"FOCUS",focus:!state.focus})}>{state.focus?"Show workspaces":"Focus"}</button></div></div>
   <div class="lp-viewer"><div class="lp-empty"><span class="lp-empty-icon" aria-hidden="true">▣</span><h3>Browser not connected</h3><p>ChatGPT will appear here when the browser integration is ready.</p></div></div>
   <div class="lp-panel-footer"><span>Scheduler unavailable</span><span>Automation off</span></div>
  </section>
 </main>
 {#if editing}
  <div class="lp-overlay" role="presentation"><form class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-rename-title" onsubmit={(e)=>{e.preventDefault();saveRename();}}><h2 id="lp-rename-title">Rename workspace</h2><p>Changes the local display name only.</p><label for="lp-rename-input">Workspace name</label><input id="lp-rename-input" maxlength="80" bind:value={draft} required/><div class="lp-dialog-actions"><button type="button" onclick={()=>editing=false}>Cancel</button><button type="submit" class="lp-primary" disabled={!draft.trim()}>Save name</button></div></form></div>
 {/if}
</div>
