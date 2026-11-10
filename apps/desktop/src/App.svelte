<script lang="ts">
 import {onMount} from "svelte";
 import {readRuntimeStatus,readWebviewProviderStatus} from "./app/bridge/runtime";
 type Page="workspace"|"browser"|"queue"|"settings";
 type Workspace={id:string;label:string};
 let page:Page=$state("workspace");
 let selected=$state("chat-1");
 let workspaces:Workspace[]=$state(Array.from({length:4},(_,i)=>({id:`chat-${i+1}`,label:`Chat ${String(i+1).padStart(2,"0")}`})));
 let showCreate=$state(false),draftLabel=$state("");
 let nativeLabel=$state("Source preview"),providerLabel=$state("Belum diverifikasi");
 const selectedWorkspace=$derived(workspaces.find(w=>w.id===selected));
 onMount(()=>{
  void readRuntimeStatus().then(x=>{nativeLabel=x.mode==="SOURCE_FOUNDATION"?"Source preview":"Tidak terhubung";});
  void readWebviewProviderStatus().then(x=>{providerLabel=x?`System WebView · ${x.runtimeUsableVerified?"Terverifikasi":"Belum diverifikasi"}`:"Belum tersedia";});
 });
 function addWorkspace(){
  if(workspaces.length>=10)return;
  const next=Math.max(0,...workspaces.map(w=>Number(w.id.split("-")[1])||0))+1;
  const id=`chat-${next}`;
  workspaces=[...workspaces,{id,label:draftLabel.trim().slice(0,80)||`Chat ${String(next).padStart(2,"0")}`}];
  selected=id;draftLabel="";showCreate=false;
 }
</script>
<svelte:head><title>LazyPrompting · Workspace</title><meta name="description" content="Workspace ChatGPT dengan satu profil browser bersama"/></svelte:head>
<div class="lp-app">
 <header class="lp-topbar"><div class="lp-brand"><span class="lp-mark">L</span><strong>LazyPrompting</strong><span class="lp-version">v0.1 · Preview</span></div><span class="lp-connection"><span class="lp-dot"></span>Belum terhubung</span></header>
 <nav class="lp-tabs" aria-label="Menu utama">
  <button class:chosen={page==="workspace"} onclick={()=>page="workspace"}>Workspace</button>
  <button class:chosen={page==="browser"} onclick={()=>page="browser"}>Browser</button>
  <button class:chosen={page==="queue"} onclick={()=>page="queue"}>Queue</button>
  <button class:chosen={page==="settings"} onclick={()=>page="settings"}>Settings</button>
 </nav>
 <main class="lp-main">
  {#if page==="workspace"}
   <div class="lp-page-header"><div><h1>Workspace</h1><p>Kelola hingga 10 percakapan dari satu tempat.</p></div><button class="lp-primary" onclick={()=>showCreate=true} disabled={workspaces.length>=10}>+ Tambah workspace</button></div>
   <div class="lp-summary"><span><strong>{workspaces.length}/10</strong> Workspace</span><span><strong>0</strong> Aktif</span><span><strong>0</strong> Dalam antrean</span><span class="lp-muted">Satu profil login bersama</span></div>
   <div class="lp-layout"><section class="lp-panel"><div class="lp-section-title"><h2>Daftar workspace</h2><small>Pilih untuk melihat detail</small></div><div class="lp-workspace-list">{#each workspaces as w,i(w.id)}<button class="lp-workspace-row" class:selected={selected===w.id} onclick={()=>selected=w.id}><span class="lp-index">{String(i+1).padStart(2,"0")}</span><span class="lp-workspace-name"><strong>{w.label}</strong><small>Belum terhubung ke percakapan</small></span><span class="lp-state">Idle</span><span aria-hidden="true">›</span></button>{/each}</div></section>
   <aside class="lp-panel lp-detail"><h2>Detail workspace</h2>{#if selectedWorkspace}<h3>{selectedWorkspace.label}</h3><p>Workspace ini belum memiliki sesi ChatGPT.</p><div class="lp-detail-row"><span>Status</span><strong>Idle</strong></div><div class="lp-detail-row"><span>Browser</span><strong>Belum terhubung</strong></div><div class="lp-detail-row"><span>Otomatisasi</span><strong>Nonaktif</strong></div>{/if}<div class="lp-note">Tampilan ini adalah preview UI. Tidak ada browser atau pesan yang dijalankan.</div></aside></div>
  {:else if page==="browser"}
   <div class="lp-page-header"><div><h1>Browser</h1><p>Satu profil dan satu login untuk seluruh workspace.</p></div></div>
   <section class="lp-panel lp-narrow"><h2>Koneksi browser</h2><p class="lp-muted">Browser belum aktif. Pemasangan dan login belum dilakukan.</p><div class="lp-detail-row"><span>Kandidat</span><strong>{providerLabel}</strong></div><div class="lp-detail-row"><span>Login bersama</span><strong>Belum diuji</strong></div><div class="lp-detail-row"><span>Navigasi otomatis</span><strong>Nonaktif</strong></div><div class="lp-note">Pengaturan browser akan tersedia setelah verifikasi native.</div></section>
  {:else if page==="queue"}
   <div class="lp-page-header"><div><h1>Queue</h1><p>Lihat pekerjaan yang sedang menunggu atau berjalan.</p></div></div><section class="lp-panel lp-empty"><h2>Belum ada pekerjaan</h2><p>Antrean akan muncul ketika host yang didukung telah terhubung.</p></section>
  {:else}
   <div class="lp-page-header"><div><h1>Settings</h1><p>Pengaturan dasar aplikasi.</p></div></div><section class="lp-panel lp-narrow"><h2>Umum</h2><div class="lp-detail-row"><span>Versi</span><strong>0.1 · Preview</strong></div><div class="lp-detail-row"><span>Mode</span><strong>{nativeLabel}</strong></div><h2 class="lp-settings-heading">Browser & data</h2><div class="lp-detail-row"><span>Profil</span><strong>Satu profil bersama</strong></div><div class="lp-detail-row"><span>Penyimpanan percakapan</span><strong>Tidak aktif</strong></div><div class="lp-note">Pengaturan lanjutan belum diaktifkan.</div></section>
  {/if}
 </main>
 {#if showCreate}<div class="lp-overlay" role="presentation"><div class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-dialog-title"><h2 id="lp-dialog-title">Tambah workspace</h2><p>Nama untuk membedakan pekerjaan. Tidak membuka browser.</p><label for="lp-name">Nama workspace</label><input id="lp-name" maxlength="80" placeholder="Contoh: Project A" bind:value={draftLabel}/><div class="lp-dialog-actions"><button class="lp-secondary" onclick={()=>showCreate=false}>Batal</button><button class="lp-primary" onclick={addWorkspace}>Tambah</button></div></div></div>{/if}
</div>
