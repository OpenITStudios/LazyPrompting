<script lang="ts">
 import {onMount} from "svelte";
 import {readWebviewProviderStatus} from "./app/bridge/runtime";
 type Workspace={id:string;label:string};
 let workspaces:Workspace[]=$state(Array.from({length:4},(_,i)=>({id:`chat-${i+1}`,label:`Chat ${String(i+1).padStart(2,"0")}`})));
 let selected=$state("chat-1");
 let showCreate=$state(false),draftLabel=$state("");
 let browserStatus=$state("Belum terhubung");
 let filter=$state("");
 const visibleWorkspaces=$derived(workspaces.filter(w=>w.label.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())));
 const current=$derived(workspaces.find(w=>w.id===selected));
 onMount(()=>{void readWebviewProviderStatus().then(x=>{browserStatus=x?.runtimeUsableVerified?"Runtime terverifikasi · Belum terhubung":"Belum terhubung";});});
 function addWorkspace(){
  if(workspaces.length>=10)return;
  const n=Math.max(0,...workspaces.map(w=>Number(w.id.split("-")[1])||0))+1;
  const id=`chat-${n}`;
  workspaces=[...workspaces,{id,label:draftLabel.trim().slice(0,80)||`Chat ${String(n).padStart(2,"0")}`}];
  selected=id;draftLabel="";showCreate=false;
 }
</script>
<svelte:head><title>LazyPrompting · Workspace</title><meta name="description" content="Satu halaman untuk workspace ChatGPT dengan satu profil browser bersama"/></svelte:head>
<div class="lp-app">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">L</span><strong>LazyPrompting</strong><span class="lp-version">v0.1 · Preview</span></div><span class="lp-connection"><span class="lp-dot"></span>{browserStatus}</span></header>
 <main class="lp-main">
  <div class="lp-page-header"><div><span class="lp-eyebrow">CONTROL CENTER</span><h1>Workspace</h1><p>Kelola percakapan ChatGPT dalam satu tampilan.</p></div><button class="lp-primary" onclick={()=>showCreate=true} disabled={workspaces.length>=10}><span aria-hidden="true">＋</span> Workspace baru</button></div>
  <div class="lp-toolbar"><span class="lp-toolbar-stat"><strong>{workspaces.length}</strong><span>/ 10 workspace</span></span><span class="lp-toolbar-divider"></span><span class="lp-toolbar-status"><span class="lp-dot"></span>Satu profil browser bersama</span><label class="lp-search"><span aria-hidden="true">⌕</span><span class="lp-sr-only">Cari workspace</span><input type="search" placeholder="Cari workspace..." bind:value={filter}/></label></div>
  <div class="lp-layout">
   <section class="lp-panel lp-list-panel"><div class="lp-section-header"><h2>Daftar workspace</h2><span>{visibleWorkspaces.length} ditampilkan</span></div><div class="lp-workspace-list">{#each visibleWorkspaces as w,i(w.id)}<button class="lp-workspace-row" class:selected={selected===w.id} onclick={()=>selected=w.id}><span class="lp-index">{String(i+1).padStart(2,"0")}</span><span class="lp-workspace-name"><strong>{w.label}</strong><small>Belum terhubung</small></span><span class="lp-state">Idle</span><span class="lp-chevron" aria-hidden="true">›</span></button>{/each}{#if visibleWorkspaces.length===0}<p class="lp-empty-search">Tidak ada workspace yang cocok.</p>{/if}</div></section>
   <aside class="lp-panel lp-detail"><div class="lp-section-header"><h2>Detail</h2><span>Workspace terpilih</span></div>{#if current}<div class="lp-detail-heading"><span class="lp-detail-icon">▣</span><div><h3>{current.label}</h3><small>{current.id} · Preview</small></div></div><div class="lp-detail-row"><span>ChatGPT</span><strong>Belum terhubung</strong></div><div class="lp-detail-row"><span>Antrean</span><strong>Kosong</strong></div><div class="lp-detail-row"><span>Otomatisasi</span><strong>Nonaktif</strong></div>{/if}<div class="lp-note"><strong>Mode preview</strong><span>Browser dan pengiriman pesan belum aktif.</span></div></aside>
  </div>
 </main>
 {#if showCreate}<div class="lp-overlay" role="presentation"><div class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-dialog-title"><h2 id="lp-dialog-title">Tambah workspace</h2><p>Workspace baru hanya dibuat pada tampilan sementara.</p><label for="lp-name">Nama workspace</label><input id="lp-name" maxlength="80" placeholder="Contoh: Project A" bind:value={draftLabel}/><div class="lp-dialog-actions"><button class="lp-secondary" onclick={()=>showCreate=false}>Batal</button><button class="lp-primary" onclick={addWorkspace}>Tambah</button></div></div></div>{/if}
</div>
