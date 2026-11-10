<script lang="ts">
 import {onMount} from "svelte";
 import {readWebviewProviderStatus} from "./app/bridge/runtime";
 type ViewMode="compact"|"grid";
 type Workspace={id:string;name:string};
 const initial:Workspace[]=Array.from({length:10},(_,i)=>({id:`workspace-${String(i+1).padStart(2,"0")}`,name:`ChatGPT ${String(i+1).padStart(2,"0")}`}));
 let workspaces=$state<Workspace[]>(initial);
 let selectedId=$state(initial[0].id);
 let mode=$state<ViewMode>("compact");
 let filter=$state("");
 let focus=$state(false);
 let editing=$state(false);
 let draft=$state("");
 let browserStatus=$state("Not connected");
 const current=$derived(workspaces.find(w=>w.id===selectedId)??workspaces[0]);
 const visible=$derived(workspaces.filter(w=>w.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())||w.id.includes(filter.trim().toLocaleLowerCase())));
 onMount(()=>{void readWebviewProviderStatus().then(x=>{browserStatus=x?.runtimeUsableVerified?"Runtime verified · Not connected":"Not connected";});});
 function beginRename(){draft=current.name;editing=true;}
 function saveRename(){const name=draft.trim();if(name.length===0||name.length>80)return;workspaces=workspaces.map(w=>w.id===selectedId?{...w,name}:w);editing=false;}
 function selectWorkspace(id:string){if(workspaces.some(w=>w.id===id))selectedId=id;}
</script>
<svelte:head><title>LazyPrompting · Workspaces</title><meta name="description" content="Compact ten-workspace ChatGPT desktop control surface"/></svelte:head>
<div class="lp-app" data-testid="app-root">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">LP</span><div><strong>LazyPrompting</strong><small>Workspace Manager</small></div></div><span class="lp-connection"><span class="lp-dot"></span>{browserStatus}</span></header>
 <main class="lp-main">
  <div class="lp-heading"><div><h1>Workspaces</h1><p>10 conversations · One shared browser profile</p></div><span class="lp-counter">0 connected <span>/ 10</span></span></div>
  <section class:focused={focus} class="lp-browser" aria-label="Selected workspace">
   <div class="lp-browser-head"><div class="lp-browser-identity"><span class="lp-browser-index">{current.id.slice(-2)}</span><div><strong>{current.name}</strong><small>{current.id} · Not connected</small></div></div><div class="lp-browser-actions"><button type="button" data-testid="rename-workspace" onclick={beginRename} aria-label="Rename selected workspace">Rename</button><button type="button" data-testid="focus-toggle" aria-pressed={focus} onclick={()=>focus=!focus}>{focus?"Exit focus":"Focus mode"}</button></div></div>
   <div class="lp-browser-empty"><span class="lp-empty-icon" aria-hidden="true">▣</span><h2>Browser not connected</h2><p>The selected conversation will appear here when supported browser integration is available.</p><span class="lp-disabled-hint">Preview only · No messages are sent</span></div>
  </section>
  {#if !focus}
   <section class="lp-workspaces" aria-label="Workspace selection">
    <div class="lp-list-head"><div><h2>All workspaces</h2><span>{visible.length} of 10 shown</span></div><div class="lp-tools"><label class="lp-search"><span class="lp-sr-only">Search workspaces</span><input data-testid="workspace-search" type="search" placeholder="Search workspace..." bind:value={filter}/></label><div class="lp-switch" aria-label="Workspace layout"><button data-testid="compact-mode" class:active={mode==="compact"} aria-pressed={mode==="compact"} onclick={()=>mode="compact"}>Compact</button><button data-testid="grid-mode" class:active={mode==="grid"} aria-pressed={mode==="grid"} onclick={()=>mode="grid"}>Grid</button></div></div></div>
    <div class:compact={mode==="compact"} class:grid={mode==="grid"} class="lp-items">
     {#each visible as w (w.id)}
      <button type="button" data-testid={"workspace-"+w.id} class="lp-item" class:selected={selectedId===w.id} aria-pressed={selectedId===w.id} aria-label={"Select "+w.name} onclick={()=>selectWorkspace(w.id)}><span class="lp-item-number">{w.id.slice(-2)}</span><span class="lp-item-body"><strong>{w.name}</strong><small>Not connected</small></span><span class="lp-item-check" aria-hidden="true">{selectedId===w.id?"✓":""}</span></button>
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
