<script lang="ts">
 import {onMount} from "svelte";
 import {readRuntimeStatus,readWebviewProviderStatus} from "./app/bridge/runtime";
 let providerLabel=$state("Not verified");
 let nativeStatus=$state("NOT CONNECTED");
 onMount(()=>{void readRuntimeStatus().then(x=>{nativeStatus=x.mode==="SOURCE_FOUNDATION"?"SOURCE FOUNDATION":"NOT CONNECTED";});void readWebviewProviderStatus().then(x=>{providerLabel=x?`System WebView · ${x.os} · ${x.runtimeObserved ? "Runtime detected ("+x.runtimeVersion+")" : "Runtime not confirmed"} · Login unverified`:"Provider unavailable";});});
 type Workspace={id:string;label:string;mode:"UNBOUND"|"PREVIEW_ONLY"|"MANAGED_SUPPORTED_HOST";state:"IDLE"|"READY"|"GENERATING"|"WAITING"|"REVIEW_REQUIRED"|"PAUSED"|"BLOCKED";pending:boolean;sessionId:string|null};
 let workspaces:Workspace[]=$state(Array.from({length:4},(_,i)=>({id:`chat-${i+1}`,label:`Chat ${String(i+1).padStart(2,"0")}`,mode:"UNBOUND",state:"IDLE",pending:false,sessionId:null})));
 let selected=$state("chat-1");
 let activeNav=$state<"overview"|"browser"|"queue"|"settings">("overview");
 let draftLabel=$state("");
 let showCreate=$state(false);
 let notice=$state("Kontrol ChatGPT belum terhubung. Tampilan ini adalah shell pengelola workspace, bukan sesi browser aktif.");
 const current=$derived(workspaces.find(w=>w.id===selected));
 const readyCount=$derived(workspaces.filter(w=>w.state==="READY").length);
 const pendingCount=$derived(workspaces.filter(w=>w.pending).length);
 function addWorkspace(){
  if(workspaces.length>=10)return;
  const id="chat-"+(Math.max(0,...workspaces.map(w=>Number(w.id.split("-")[1])||0))+1);
  workspaces=[...workspaces,{id,label:draftLabel.trim().slice(0,80)||`Chat ${id.split("-")[1]}`,mode:"UNBOUND",state:"IDLE",pending:false,sessionId:null}];
  selected=id;draftLabel="";showCreate=false;notice="Workspace dibuat pada state UI sementara. Tidak ada browser atau sesi ChatGPT yang dibuka.";
 }
 function chooseNav(nav:typeof activeNav){activeNav=nav;}
</script>
<svelte:head><title>LazyPrompting · Workspace Manager</title><meta name="description" content="Control center untuk workspace dan browser terisolasi."/></svelte:head>
<div class="shell">
 <aside class="navigation" aria-label="Navigasi utama">
  <div class="brand"><span class="mark">L</span><div><strong>LazyPrompting</strong><small>Workspace Manager</small></div></div>
  <div class="nav-heading">WORKSPACE</div>
  <button class:chosen={activeNav==="overview"} onclick={()=>chooseNav("overview")}>◫ <span>Overview</span></button>
  <button class:chosen={activeNav==="browser"} onclick={()=>chooseNav("browser")}>▣ <span>Browser Manager</span></button>
  <button class:chosen={activeNav==="queue"} onclick={()=>chooseNav("queue")}>≡ <span>Prompt Queue</span></button>
  <div class="nav-heading">SYSTEM</div>
  <button class:chosen={activeNav==="settings"} onclick={()=>chooseNav("settings")}>⚙ <span>Settings</span></button>
  <div class="nav-footer"><span class="offline-dot"></span> Source preview mode</div>
 </aside>
 <main>
  <header class="topbar"><div class="breadcrumb">WORKSPACES <span>/</span> {activeNav==="overview"?"Overview":activeNav==="browser"?"Browser Manager":activeNav==="queue"?"Prompt Queue":"Settings"}</div><div class="top-meta"><span class="version">v0.1 · {nativeStatus}</span><span class="status">● NOT CONNECTED</span></div></header>
  <section class="content">
   {#if activeNav==="overview"}
    <div class="heading"><div><p class="eyebrow">CONTROL CENTER</p><h1>Workspace Overview</h1><p>Pantau pekerjaan terpisah dari satu dashboard, tanpa mencampurkan konteks antar-chat.</p></div><button class="primary" onclick={()=>showCreate=true} disabled={workspaces.length>=10}>+ Add Workspace</button></div>
    <div class="stats"><div class="stat"><small>WORKSPACES</small><strong>{workspaces.length}<span>/10</span></strong><p>Independent slots</p></div><div class="stat"><small>READY TO DISPATCH</small><strong>{readyCount}</strong><p>Host verification required</p></div><div class="stat"><small>IN-FLIGHT PROMPTS</small><strong>{pendingCount}</strong><p>Max one per chat</p></div><div class="stat"><small>BROWSER INSTANCES</small><strong>0</strong><p>Not launched</p></div></div>
    <div class="split"><section class="panel"><div class="panel-header"><div><h2>Managed Workspaces</h2><p>Identity and status are independent per workspace</p></div><span class="small-pill">Capacity 10</span></div><div class="workspace-grid">{#each workspaces as w(w.id)}<button class="workspace-card" class:active={selected===w.id} onclick={()=>selected=w.id}><div class="card-top"><span class="workspace-icon">▣</span><span class="chip">{w.state}</span></div><strong>{w.label}</strong><small>{w.id} · {w.mode==="UNBOUND"?"No session bound":w.mode}</small></button>{/each}</div></section><section class="panel details"><div class="panel-header"><div><h2>Selected Workspace</h2><p>Session details and dispatch boundary</p></div></div>{#if current}<div class="detail-avatar">▣</div><h3>{current.label}</h3><p class="muted">{current.id}</p><div class="detail-line"><span>Mode</span><strong>{current.mode}</strong></div><div class="detail-line"><span>Session</span><strong>Not connected</strong></div><div class="detail-line"><span>Prompt</span><strong>{current.pending?"Pending":"No pending prompt"}</strong></div><div class="detail-line"><span>Automation</span><strong>Disabled</strong></div><div class="soft-warning">Live send and response monitoring stay disabled until an approved host is available.</div>{/if}</section></div>
   {:else if activeNav==="browser"}
    <div class="heading"><div><p class="eyebrow">ISOLATED INSTANCES</p><h1>Browser Manager</h1><p>Setiap workspace memiliki identitas browser sendiri, dengan batas sumber daya dan kontrol eksplisit.</p></div></div><section class="panel empty-state"><div class="big-symbol">▣</div><h2>No active browser instances</h2><p>Candidate: {providerLabel}</p><p>Browser multi-instance native, storage isolation, dan host binding belum dijalankan. Shell ini tidak mengakses ChatGPT Web secara otomatis.</p><div class="capabilities"><span>Independent identity</span><span>Resource limits</span><span>Explicit lifecycle</span><span>Verified host only</span></div></section>
   {:else if activeNav==="queue"}
    <div class="heading"><div><p class="eyebrow">NON-BLOCKING DISPATCH</p><h1>Prompt Queue</h1><p>Pengiriman satu per satu per chat, tanpa menunggu respons chat lain selesai.</p></div></div><section class="panel empty-state"><div class="big-symbol">≡</div><h2>No dispatch queue connected</h2><p>Queue akan menampilkan status Waiting, Sending, Generating, Review, dan Blocked setelah host yang didukung terhubung.</p></section>
   {:else}
    <div class="heading"><div><p class="eyebrow">APPLICATION</p><h1>Settings</h1><p>Konfigurasi keamanan, perangkat, dan penyimpanan per workspace.</p></div></div><div class="settings-grid"><div class="panel setting"><h2>General</h2><p>Appearance, startup, notifications</p></div><div class="panel setting"><h2>Browser & Resources</h2><p>Instance limit, memory/CPU caps, isolation</p></div><div class="panel setting"><h2>Data & Privacy</h2><p>Metadata-only persistence, no stored transcripts</p></div><div class="panel setting"><h2>Keyboard & Accessibility</h2><p>Workspace switching, focus, shortcuts</p></div></div>
   {/if}
   <div class="notice"><span>ⓘ</span>{notice}</div>
  </section>
 </main>
</div>
{#if showCreate}<div class="overlay" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><h2 id="create-title">New Workspace</h2><p>Create a separate chat workspace identity. No browser will launch.</p><label for="workspace-label">Workspace label</label><input id="workspace-label" placeholder="e.g. Research / Development" maxlength="80" bind:value={draftLabel}/><div class="modal-actions"><button class="secondary" onclick={()=>showCreate=false}>Cancel</button><button class="primary" onclick={addWorkspace}>Create Workspace</button></div></div></div>{/if}
