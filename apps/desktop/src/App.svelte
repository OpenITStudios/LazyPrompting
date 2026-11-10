<script lang="ts">
 import {onMount} from "svelte";
 import {readWebviewProviderStatus} from "./app/bridge/runtime";
 type Page="play"|"settings";
 let page:Page=$state("play");
 let selected=$state(1);
 let slots=$state<5|10>(5);
 let browserStatus=$state("Not connected");
 onMount(()=>{void readWebviewProviderStatus().then(x=>{browserStatus=x?.runtimeUsableVerified?"Runtime verified · Not connected":"Not connected";});});
</script>
<svelte:head><title>LazyPrompting · Workspace</title><meta name="description" content="Emulator-style ChatGPT workspace control center"/></svelte:head>
<div class="lt-app">
 <header class="lt-windowbar"><span class="lt-mini-mark">LP</span><strong>LazyPrompting</strong><span class="lt-windowhint">Desktop preview</span></header>
 <div class="lt-topbar"><div class="lt-brand"><span class="lt-brand-mark">LP</span><strong>LazyPrompting</strong></div><nav aria-label="Main navigation"><button class:chosen={page==="play"} onclick={()=>page="play"}>Play</button><button class:chosen={page==="settings"} onclick={()=>page="settings"}>Settings</button></nav><span class="lt-connection"><span class="lt-dot waiting"></span>{browserStatus}</span></div>
 <main class="lt-main">
  {#if page==="play"}
   <div class="lt-page-header"><div><h1>Choose a ChatGPT below</h1><p>All workspaces share one browser login. Each conversation stays separate.</p></div><button class="lt-secondary" onclick={()=>{selected=1;}}>Reset selection</button></div>
   <section class="lt-stage" aria-label="Selected conversation preview"><div class="lt-stage-inner"><span class="lt-stage-mark">LP</span><h2>Ready when you are</h2><p>Browser view will appear here after native integration is verified.</p><span class="lt-stage-selection">ChatGPT - {selected} selected</span></div></section>
   <div class="lt-slots-heading"><span>Your workspaces</span><span>0 of {slots} connected</span></div>
   <div class="lt-slot-grid">
    {#each Array.from({length:slots},(_,i)=>i+1) as n}
     <button class="lt-slot" class:active={selected===n} onclick={()=>selected=n} aria-label={"Select ChatGPT workspace "+n} aria-pressed={selected===n}>
      <strong>ChatGPT - {n}</strong>
      <span class="lt-slot-preview"><span class="lt-launch">Select workspace</span></span>
      <span class="lt-slot-status">Not connected</span>
     </button>
    {/each}
   </div>
   <p class="lt-footnote">Click a workspace to select it. Other workspace identities remain unchanged. Browser is not running.</p>
  {:else}
   <div class="lt-page-header"><div><h1>Settings</h1><p>Browser and workspace preferences.</p></div></div>
   <section class="lt-settings"><h2>Browser</h2><div class="lt-setting"><span>Login profile</span><strong>One shared profile</strong></div><div class="lt-setting"><span>Browser connection</span><strong>Not connected</strong></div><div class="lt-setting"><span>Automation</span><strong>Disabled</strong></div><h2>Workspace layout</h2><div class="lt-setting"><label for="slot-count">Visible slots</label><select id="slot-count" bind:value={slots}><option value={5}>5</option><option value={10}>10</option></select></div><p>Settings only change this temporary preview. No ChatGPT account data is stored.</p></section>
  {/if}
 </main>
</div>
