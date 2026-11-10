<script lang="ts">
 import {createWorkspaceState,applyWorkspaceAction,listVisibleWorkspaces} from "./app/workspace-controller.mjs";
 type Workspace={id:string;name:string;connection:string;activity:string};
 type UIAction={type:string;workspaceId?:string;name?:string;mode?:string;filter?:string;focus?:boolean;confirmed?:boolean};
 let state=$state(createWorkspaceState());
 let connectionsOpen=$state(false);
 const current=$derived(state.workspaces.find((w:Workspace)=>w.id===state.selectedId)??state.workspaces[0]);
 const visible=$derived(listVisibleWorkspaces(state));
 function act(action:UIAction){const result=applyWorkspaceAction(state,{...action,expectedRevision:state.revision});if(result.status==="APPLIED")state=result.state;}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="Codex-controlled workspace manager"/></svelte:head>
<div class="lp-app" data-testid="app-root">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">LP</span><strong>LazyPrompting</strong></div><span class="lp-connection"><span class="lp-dot"></span>Offline</span></header>
 <main class:focused={state.focus} class="lp-shell">
  {#if !state.focus}
   <aside class="lp-sidebar" aria-label="Workspaces">
    <div class="lp-sidebar-heading"><h1>Workspaces</h1><span>10</span></div>
    <label class="lp-search"><span class="lp-sr-only">Search workspaces</span><input data-testid="workspace-search" type="search" placeholder="Search workspaces" value={state.filter} oninput={(e)=>act({type:"FILTER",filter:e.currentTarget.value})}/></label>
    <nav class="lp-workspace-list" aria-label="Select workspace">
     {#each visible as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-workspace" class:selected={state.selectedId===w.id} aria-pressed={state.selectedId===w.id} aria-label={"Select "+w.name} onclick={()=>act({type:"SELECT",workspaceId:w.id})}>
       <span class="lp-workspace-name">{w.name}</span><span class="lp-status-dot" aria-label="Not connected"></span>
      </button>
     {:else}
      <p class="lp-no-results">No matching workspaces</p>
     {/each}
    </nav>
    <div class="lp-sidebar-foot"><button type="button" class="lp-settings-button" data-testid="connections-open" onclick={()=>connectionsOpen=true}>Connection Status</button></div>
   </aside>
  {/if}
  <section class="lp-main-panel" aria-label="Selected workspace">
   <div class="lp-panel-header"><div class="lp-current"><div><h2>{current.name}</h2></div></div><div class="lp-actions"><button type="button" data-testid="focus-toggle" aria-pressed={state.focus} onclick={()=>act({type:"FOCUS",focus:!state.focus})}>{state.focus?"Show workspaces":"Focus"}</button></div></div>
   <div class="lp-viewer"><div class="lp-empty"><button type="button" class="lp-primary-action" disabled title="Browser runtime not verified">Open Browser</button></div></div>
  </section>
 </main>
 {#if connectionsOpen}
  <div class="lp-overlay" role="presentation"><section class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-connections-title"><div class="lp-dialog-heading"><h2 id="lp-connections-title">Connection Status</h2><button type="button" aria-label="Close connection status" onclick={()=>connectionsOpen=false}>×</button></div><div class="lp-connection-row"><span>Codex</span><strong>Offline</strong></div><div class="lp-connection-row"><span>MCP</span><strong>Offline</strong></div><div class="lp-connection-row"><span>Browser</span><strong>Unavailable</strong></div></section></div>
 {/if}
</div>
