<script lang="ts">
 import {onMount} from "svelte";
 import {readWebviewProviderStatus} from "./app/bridge/runtime";
 type Page="play"|"settings";
 let page:Page=$state("play");
 let selected=$state(1);
 let slots=$state<5|10>(10);
 let browserStatus=$state("Not connected");
 const slotIds=Array.from({length:10},(_,i)=>i+1);
 onMount(()=>{void readWebviewProviderStatus().then(x=>{browserStatus=x?.runtimeUsableVerified?"Runtime verified · Not connected":"Not connected";});});
</script>
<svelte:head><title>LazyPrompting · Workspace</title><meta name="description" content="Emulator-style ChatGPT workspace control center"/></svelte:head>
<div class="lt-app">
 <header class="lt-windowbar"><span class="lt-mini-mark">LP</span><strong>LazyPrompting</strong><span class="lt-windowhint">Desktop preview</span></header>
 <div class="lt-topbar"><div class="lt-brand"><span class="lt-brand-mark">LP</span><strong>LazyPrompting</strong></div><nav aria-label="Main navigation"><button class:chosen={page==="play"} onclick={()=>page="play"}>Play</button><button class:chosen={page==="settings"} onclick={()=>page="settings"}>Settings</button></nav><span class="lt-connection"><span class="lt-dot waiting"></span>{browserStatus}</span></div>
 <main class="lt-main">
  {#if page==="play"}
   <div class="lt-page-header"><div><h1>ChatGPT workspaces</h1><p>10 separate conversations · one shared browser login</p></div><span class="lt-summary-status"><span class="lt-dot waiting"></span>0 connected / {slots} slots</span></div>
   <section class="lt-stage" aria-label="Selected conversation preview"><div class="lt-stage-inner"><span class="lt-stage-mark">LP</span><h2>ChatGPT - {selected}</h2><p>Selected workspace · Browser view unavailable until verified integration.</p><span class="lt-stage-selection">No live conversation is connected</span></div></section>
   <div class="lt-slots-heading"><span>Your workspaces</span><span>{slots} slots · select to switch</span></div>
   <div class="lt-slot-grid">
    {#each slotIds.slice(0,slots) as n}
     <button class="lt-slot" class:active={selected===n} onclick={()=>selected=n} aria-label={"Select ChatGPT workspace "+n} aria-pressed={selected===n}>
      <strong>ChatGPT - {n}</strong>
      <span class="lt-slot-preview"><span class="lt-slot-number">{String(n).padStart(2,"0")}</span><span class="lt-launch">Select</span></span>
      <span class="lt-slot-status">Not connected</span>
     </button>
    {/each}
   </div>
   <p class="lt-footnote">Select a slot to change the main view. Other conversations remain separate; no browser is running.</p>
  {:else}
   <div class="lt-page-header"><div><h1>Settings</h1><p>Browser and workspace preferences.</p></div></div>
   <section class="lt-settings"><h2>Browser</h2><div class="lt-setting"><span>Login profile</span><strong>One shared profile</strong></div><div class="lt-setting"><span>Browser connection</span><strong>Not connected</strong></div><div class="lt-setting"><span>Automation</span><strong>Disabled</strong></div><h2>Workspace layout</h2><div class="lt-setting"><label for="slot-count">Visible slots</label><select id="slot-count" bind:value={slots}><option value={5}>5</option><option value={10}>10</option></select></div><p>Settings only change this temporary preview. No ChatGPT account data is stored.</p></section>
  {/if}
 </main>
</div>
