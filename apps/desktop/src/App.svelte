<script lang="ts">
 import {onMount} from "svelte";
 import {readWebviewProviderStatus} from "./app/bridge/runtime";
 import {createWorkspaceState,applyWorkspaceAction,listVisibleWorkspaces} from "./app/workspace-controller.mjs";
 import {projectSchedulerStatus} from "./app/scheduler-projection.mjs";
 type Workspace={id:string;name:string;connection:string;activity:string};
 let state=$state(createWorkspaceState());
 let editing=$state(false);
 let draft=$state("");
 let browserStatus=$state("Not connected");
 const current=$derived(state.workspaces.find((w:Workspace)=>w.id===state.selectedId)??state.workspaces[0]);
 const visible=$derived(listVisibleWorkspaces(state));
 // No trusted scheduler host snapshot exists yet. Never present simulated activity as live.
 const scheduler=$derived(projectSchedulerStatus(null,state.workspaces.map((w:Workspace)=>w.id)));
 onMount(()=>{void readWebviewProviderStatus().then(x=>{browserStatus=x?.runtimeUsableVerified?"Runtime verified · Not connected":"Not connected";});});
 function act(action:Record<string,unknown>){const result=applyWorkspaceAction(state,{...action,expectedRevision:state.revision});if(result.status==="APPLIED")state=result.state;}
 function beginRename(){draft=current.name;editing=true;}
 function saveRename(){const previous=state.revision;act({type:"RENAME",workspaceId:state.selectedId,name:draft});if(state.revision!==previous)editing=false;}
 function selectWorkspace(id:string){act({type:"SELECT",workspaceId:id});}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="Compact ten-workspace ChatGPT desktop control surface"/></svelte:head>
<div class="lp-app" data-testid="app-root">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">LP</span><div><strong>LazyPrompting</strong><small>Workspace Manager</small></div></div><span class="lp-connection"><span class="lp-dot"></span>{browserStatus}</span></header>
 <main class="lp-main">
  <div class="lp-heading"><div><h1>Workspaces</h1><p>10 conversations · One shared browser profile</p></div><span class="lp-counter">0 connected <span>/ 10 · Scheduler unavailable</span></span></div>
  <section class:focused={state.focus} class="lp-browser" aria-label="Selected workspace">
   <div class="lp-browser-head"><div class="lp-browser-identity"><span class="lp-browser-index">{current.id.slice(-2)}</span><div><strong>{current.name}</strong><small>{current.id} · Not connected · {scheduler.verified?scheduler.byId[current.id]?.status:"Activity unknown"}</small></div></div><div class="lp-browser-actions"><button type="button" data-testid="rename-workspace" onclick={beginRename} aria-label="Rename selected workspace">Rename</button><button type="button" data-testid="focus-toggle" aria-pressed={state.focus} onclick={()=>act({type:"FOCUS",focus:!state.focus})}>{state.focus?"Exit focus":"Focus mode"}</button></div></div>
   <div class="lp-browser-empty"><span class="lp-empty-icon" aria-hidden="true">▣</span><h2>Browser not connected</h2><p>The selected conversation will appear here when supported browser integration is available.</p><span class="lp-disabled-hint">Preview only · No messages are sent</span></div>
  </section>
  {#if !state.focus}
   <section class="lp-workspaces" aria-label="Workspace selection">
    <div class="lp-list-head"><div><h2>All workspaces</h2><span>{visible.length} of 10 shown</span></div><div class="lp-tools"><label class="lp-search"><span class="lp-sr-only">Search workspaces</span><input data-testid="workspace-search" type="search" placeholder="Search workspace..." value={state.filter} oninput={(e)=>act({type:"FILTER",filter:e.currentTarget.value})}/></label><div class="lp-switch" aria-label="Workspace layout"><button data-testid="compact-mode" class:active={state.mode==="compact"} aria-pressed={state.mode==="compact"} onclick={()=>act({type:"VIEW_MODE",mode:"compact"})}>Compact</button><button data-testid="grid-mode" class:active={state.mode==="grid"} aria-pressed={state.mode==="grid"} onclick={()=>act({type:"VIEW_MODE",mode:"grid"})}>Grid</button></div></div></div>
    <div class:compact={state.mode==="compact"} class:grid={state.mode==="grid"} class="lp-items">
     {#each visible as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-item" class:selected={state.selectedId===w.id} aria-pressed={state.selectedId===w.id} aria-label={"Select "+w.name} onclick={()=>selectWorkspace(w.id)}><span class="lp-item-number">{w.id.slice(-2)}</span><span class="lp-item-body"><strong>{w.name}</strong><small>Not connected · {scheduler.verified?scheduler.byId[w.id]?.status:"Activity unknown"}</small></span><span class="lp-item-check" aria-hidden="true">{state.selectedId===w.id?"✓":""}</span></button>
     {:else}
      <p class="lp-empty-results">No matching workspaces. Clear search to see all ten.</p>
     {/each}
    </div>
   </section>
  {/if}
  <p class="lp-footer">Workspace names and selection are temporary in this preview. Browser and automation remain disabled.</p>
 </main>
 {#if editing}
  <div class="lp-overlay" role="presentation"><form class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-rename-title" onsubmit={(e)=>{e.preventDefault();saveRename();}}><h2 id="lp-rename-title">Rename workspace</h2><p>Changes the local display name only.</p><label for="lp-rename-input">Workspace name</label><input id="lp-rename-input" maxlength="80" bind:value={draft} required/><div class="lp-dialog-actions"><button type="button" onclick={()=>editing=false}>Cancel</button><button type="submit" class="lp-primary" disabled={!draft.trim()}>Save name</button></div></form></div>
 {/if}
</div>
