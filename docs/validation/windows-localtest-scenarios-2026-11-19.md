# Skenario Localtest Windows — LazyPrompting

**Status dokumen:** SOURCE_REVIEWED / TEST_PLAN_AUTHORED_NOT_RUN (19 November 2026).
**Repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Baseline source saat disusun:** `80c4df338f7e9559622224164ba88842e4e4f534`.
**Revision yang diuji:** WAJIB isi dari `git rev-parse HEAD` di PC; jangan menganggap baseline atau tanggal dokumen sebagai hasil tes.
**Otoritas:** [Gate Windows](localtest-readiness.md), [desktop acceptance](desktop-acceptance-gates.md), [checkpoint aktif](../operations/current-state.md), [panduan build](../../apps/desktop/README.md).
**Tujuan:** membuktikan source, installer, MCP, batas izin, STOP/recovery dan performa di Windows **sebelum** mempertimbangkan release. Bukan uji produksi atau izin otomatisasi ChatGPT Web.

## Hasil matriks langsung di Windows — 21 November 2026

**Koreksi akhir D15.** Pada Browser 01 di instalasi utama, pengguna menunjukkan percakapan ChatGPT biasa yang sudah berisi balasan. Strip Companion tetap tidak terlihat di atas composer. Penerimaan tampilan pada target ini **GAGAL**. Penyebab belum ditentukan. D12 tetap parsial. [Data uji lokal dan prioritas perbaikan](windows-evidence-2026-11-21/README.md).

Runner Codex desktop pada PC Windows pengguna, branch `Local`, HEAD
`830ed6b2679abd48bf24d0239ad1ed8f677d00b5` dengan perbaikan lokal. Bukti
di bawah membedakan pemeriksaan fixture, build, dan penerimaan di akun uji.
Sesi WebView2 asli tetap aktif. Tidak ada percakapan pribadi yang dipakai
sebagai fixture.

Dengan persetujuan operator, 11 proses MCP lama ditutup dan NSIS memperbarui
instalasi utama dengan exit 0. Profil Browser 01 tetap tersedia. Registrasi
Codex tetap pada executable instalasi utama; `node scripts/setup-local.mjs
--apply --client codex` memverifikasi handshake empat tool, dan `codex mcp get`
melaporkan transport stdio yang sama. Uji native pertama menemukan dua modul
gateway hilang pada direktori resource yang dipakai proses Windows. Setelah
kedua modul dipulihkan dari paket dengan hash cocok, verifikasi 49 aset gateway
serta 11 aset Companion lulus pada direktori itu. `code_mode.catalog`, eksekusi
read-only, dan `workspace_goal.status` lulus melalui instalasi utama.
`tunnel-client` tidak ditemukan di PATH. Plugin goal hosted belum memiliki
endpoint OAuth/native yang terpasang.

Konfigurasi worker sebelumnya menunjuk executable Codex yang sudah hilang.
Paket resmi `@openai/codex@0.167.0-alpha.3.2-win32-x64` dipulihkan ke direktori
runtime lokal dengan layout vendor lengkap dan SHA-512 cocok dengan metadata
registry. `LAZYPROMPTING_CODEX_EXE` menunjuk worker yang dipatok oleh `Local`;
`--version` cocok dan `login status` mengonfirmasi sign-in ChatGPT. Ini baru
verifikasi prasyarat worker. Codex CLI yang dipakai pengguna tetap pada
versi sebelumnya.

| ID | Status dan bukti |
| --- | --- |
| A01–A02 | PASS. Windows x64 24H2, checkout `Local`, Node 22.16.0, Rust MSVC 1.96.0, dan WebView2 terverifikasi. |
| B01–B05 | PASS. Kedua lockfile terpasang. Preflight final lulus 81 langkah, termasuk 162 tes Rust, 9 diabaikan secara default, dan build Svelte/Vite. Regresi katalog Code Mode dan Retry Companion lulus. |
| C01 | PASS pada staging terpisah dengan Node 24.14.1 yang dipin. Verifier memeriksa 48 file. Manifest SHA-256 `4f24ef0be9809c2222a4c4ec6a99e280203cdf69b5000feeba318122a716ad02`. |
| C02 | PASS. NSIS debug x64 `LazyPrompting_0.1.0_x64-setup.exe` selesai. SHA-256 `b0a8e0b1a1e2078e32ca6d99c1fef5e93ea581e38a19a5cf6d9608d6b732cf92`. |
| C03 | NSIS final berhasil memperbarui instalasi utama langsung di Windows. Executable cocok dengan paket dan aplikasi terbuka. Resource gateway yang efektif terverifikasi setelah pemulihan dua file. |
| C04 | PASS discovery serta transaksi native read-only pada executable instalasi yang dipakai konfigurasi Codex CLI. Empat tool publik, backend `WEBVIEW2`, dua skema goal, dan Code Mode. |
| D01 | PASS di build QA. Satu owner, draft `sent=false`, klien asing ditolak, release dan reclaim lulus. |
| D02 | Fixture native WebView2 10 workspace dan perlindungan navigasi tab utama PASS. Lifecycle semua tab dengan percakapan live belum lengkap. |
| D03 | Fixture bookmark dan riwayat tersanitasi PASS. Simpan/pulihkan tautan percakapan uji di akun live belum dilakukan. |
| D04 | NOT_EXECUTED. Supporting-tab HTTPS disposable dan konfirmasi grant native diperlukan. |
| D05 | Fixture deny/limit lulus pada preflight. Dialog dan aksi download disposable belum dilakukan. |
| D06 | PASS untuk katalog dan read-only lewat MCP pada executable final. Aksi browser tetap ditolak. Fixture gateway terpaket dan regresi lease draft lulus. Manual draft Code Mode melalui aplikasi final belum diuji. |
| D07 | Kasus penolakan pada instalasi utama berakhir `DECLINED`, revisi 1, nol task. Kasus persetujuan terpisah tetap `NOT_EXECUTED`. Ini pengujian worker lama, di luar alur Codex standar. |
| D08 | Fixture pause/recovery/replay lulus. Pause/resume/STOP dan restart pada run terpasang belum dilakukan. |
| D09 | Windows native fixture menutup child Node terisolasi yang tidak membaca stdin dan melepas pipe write dalam 320 ms. Callback deadline dan frame lulus pada preflight. Gangguan pada proses terpasang belum disuntikkan. |
| D10 | Lightpanda 1.0.3, fixture localhost interaktif dan isolasi 10 workspace PASS. Click/fill dengan grant operator belum dilakukan. |
| D11 | Fixture V2 source/STOP lulus. Review sumber pada dialog native belum dilakukan. |
| D12 | Parsial. Di Browser 01, draf disalin manual dan ChatGPT membalas `LP-UJI-47`. Tombol native Send once dan balasan kembali ke Codex belum terverifikasi. |
| D13 | Baseline Windows WebView2 sintetis terukur untuk 1/2/4/5/10 workspace. Beban percakapan live dan proses lintas host belum diukur. |
| D14 | Start/stop gateway terpaket lulus. Shutdown normal instalasi final juga menghentikan child Node milik gateway, dan Browser 01 tetap memakai profil lama setelah restart. Crash/restart dengan efek pending pada aplikasi disposable belum dilakukan. |
| D15 | Setelah perbaikan loader Windows, profil WebView2 Browser 01 mencatat tepat satu LazyPrompting Companion 0.1.0 dengan daftar alasan penonaktifan kosong. Semua 11 berkas pada path terdaftar cocok dengan source. Browser 01 dan 02 kembali ke ChatGPT. Perbandingan toolbar live dengan Helium belum dilakukan. |
| D16 | Helium fixture: New Chat terpercaya menavigasi ke composer kosong dan URL lama masih dapat dibuka. Kasus akun live belum dilakukan. |
| D17 | Helium fixture mengabaikan klik sintetis. Fixture sumber melarang alur delete/legacy. Kasus live yang salah/tidak tersimpan belum dilakukan. |
| D18 | BLOCKED sesuai kebijakan produk. Belum tersedia kontrak host terautentikasi untuk penghapusan otomatis. |
| D19 | NOT_EXECUTED. Perlu percakapan panjang disposable dan pengukuran A/B dengan beban identik. |
| D20 | Fixture mutasi lulus. Streaming dan performa browser dengan respons nyata belum diukur. |
| D21 | Helium fixture melewati reload setelah New Chat tanpa resend atau delete. Pemulihan live belum dilakukan. |
| D22 | Helium fixture menjalankan tepat satu Regenerate sintetis tanpa Send. Kegagalan respons nyata belum diuji. |
| D23 | Regresi diperbaiki. Helium fixture mengabaikan error lama dan tidak menawarkan Retry saat usage limit bersamaan. Kasus live belum diuji. |
| D24 | PASS pada simulasi Helium. Prioritas limit, error, kemungkinan batas, dan ambang diproyeksikan pada satu slot. |
| D25 | PASS pada simulasi Helium. Peringatan kembali setelah error hilang dan tombol tetap sejajar pada lebar sempit. |
| D26 | Work terlihat pada build QA dengan draf sintetis dan kondisi unbound. Status lengkap dalam percakapan bound belum dilakukan. |
| D27 | Fixture native/Node menahan keadaan plugin yang tidak pasti. Jalur plugin hosted live masih bergantung pada OAuth/admission. |
| D28 | Fixture Helium mengabaikan error historis. Perbandingan native WebView2 dan Companion pada percakapan live belum dilakukan. |
| D29 | Discovery goal status dan label Codex app-wide diamati. Korelasi run live di layar yang sama belum dilakukan. |
| D30 | NOT_EXECUTED. Perlu bookmark yang cocok dengan percakapan uji aktif di WebView2. |
| D31 | Kondisi unbound diamati sebagai `unavailable`. Reload, URL berbeda, dan lifecycle malformed di host live belum lengkap. |
| D32 | Helium memuat ekstensi kanonik dan menghasilkan status-kind pada fixture. Native readback Helium tetap di luar dukungan. |

### D13 — baseline WebView2 lokal

Fixture loopback terisolasi memakai ukuran 320 × 240, jeda idle satu detik,
dan 30 panggilan switch native per jumlah workspace dengan jeda 35 ms. Sampel
mencakup proses dari environment WebView2 profil fixture saja. CPU dinyatakan
sebagai persen satu core dan latensi mencakup panggilan native, bukan waktu
render halaman. Sampel idle CPU tercatat 0% pada resolusi pengukuran ini.

| Workspace | Private commit idle / aktif (MiB) | Working set idle / aktif (MiB) | CPU aktif (% satu core) | Switch p50 / p95 (ms) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 126 / 130 | 263 / 274 | 23.0 | 0.36 / 1.05 |
| 2 | 155 / 155 | 287 / 240 | 27.5 | 0.56 / 1.04 |
| 4 | 201 / 202 | 274 / 251 | 35.2 | 0.61 / 1.60 |
| 5 | 225 / 224 | 280 / 257 | 41.4 | 0.83 / 1.82 |
| 10 | 341 / 341 | 381 / 287 | 40.3 | 0.98 / 1.68 |

## Handoff integrasi Companion + Plugin/MCP + Work (21 November 2026)

**Kandidat:** branch `Local`; **SHA target harus diambil ulang dari checkout PC**.
Dokumen ini mempersiapkan Localtest, **bukan bukti bahwa source sudah
dikompilasi, installer berhasil, atau ChatGPT terhubung end-to-end**.

**Cakupan source yang perlu dibuktikan:** satu Companion MV3 dipakai oleh
Helium/WebView2; indikator dinamis Error/Retry/Limit/New Chat; native
WebView2 `operator_companion_status` membaca enum status pada bookmark chat
yang tepat dan menyajikannya di Work bersama status
`operator_chat_attempt_status`, `chat_plugin_pending_status`, serta
ringkasan Codex V1 **app-wide**. Observasi UI tetap `UNVERIFIED`,
`nextPromptAllowed:false`, bukan bukti pengiriman/hasil kerja.

**Urutan paling ringkas:** A01–A02 (host & source) →
B01–B05 (satu `npm run preflight:localtest`) →
C01–C04 (stage, build, instalasi, MCP) →
D (uji fungsi terpilih pada profil/chat disposable).
Pada D, prioritaskan D15–D17, D19–D20, D21–D25, D26–D32 sesuai prasyarat
dan izin operator. D16–D17 dan D21 kini menguji navigasi tanpa auto-delete.
D18 (penghapusan otomatis yang terikat native Work) tetap BLOCKED.
Jangan menguji penghapusan pada chat proyek nyata.

**Ekspektasi yang wajib jujur:** WebView2 punya pembacaan status oleh
native host, **bukan** jembatan perintah extension↔host yang
terautentikasi. Helium belum mempunyai koneksi native yang diterima.
Plugin ChatGPT-hosted masih menunggu OAuth/native admission. Tidak ada
consumer-Web auto-send, auto-retry tanpa operator, atau Intelligent
Auto-prompt end-to-end yang diberi izin. Kasus-kasus tersebut
`BLOCKED / NOT_EXECUTED`, bukan FAIL untuk kemampuan yang sengaja
belum diaktifkan. STOP jika ada efek ganda, target workspace salah,
hasil pengiriman tidak pasti, atau perubahan chat tanpa izin.

**Output hasil:** satu laporan dengan SHA, versi toolchain, ID kasus
PASS/FAIL/BLOCKED/NOT_EXECUTED, actual-vs-expected, exit code atau
tangkapan layar tersanitasi, masalah pertama, dan keputusan STOP.
Laporan untuk source revision lama tidak berlaku sebagai PASS baru.

## Cara memakai

1. Hanya `LOCAL_PC_AGENT` yang benar-benar bekerja pada PC Windows pengguna dan secara eksplisit dipilih boleh mengeksekusi langkah localtest. Dokumen ini sendiri tidak menjalankan tes. GitHub Chat, cloud CI, Actions dan sandbox remote **bukan** pengganti bukti PC.
2. Gunakan akun Windows/profil WebView2, repository fixture, dan percakapan disposable. Jangan menggunakan credential, cookie, percakapan pribadi atau repository produksi. Pastikan operator hadir untuk persetujuan dan pengujian efek.
3. Jalankan **A → B → C → D** sesuai urutan. Hentikan gate berikutnya jika gate sebelumnya gagal. Jangan menyamakan PASS mock/source dengan PASS native terpasang.
4. Catat `PASS`, `FAIL`, `BLOCKED`, `NOT_EXECUTED` atau `OPTED_OUT` **per ID skenario**; tanda PASS hanya untuk langkah yang benar-benar diamati. Setiap pengujian harus mencatat commit SHA, PC/runner, perintah/aksi, hasil faktual, dan lokasi bukti yang sudah disanitasi.

### Perintah awal (PowerShell, dari root repository)

Periksa perubahan lokal **sebelum** melakukan switch/pull. Jika kotor atau berada di branch yang salah, jangan `reset --hard`, `clean -fd`, atau membuang perubahan untuk memaksakan tes. Pilih checkout terpisah yang aman atau rekonsiliasi dengan operator.

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
Get-Content .node-version
node --version
npm --version
cargo --version
rustc --version
```

Jika repository belum pada `Local` yang bersih dan operator mengizinkan sinkronisasi, gunakan prosedur branch saat ini dari [panduan lokal](localtest-readiness.md). Setelah sinkronisasi, **catat ulang full SHA**; jangan melanjutkan dengan hasil yang berbeda SHA.

### Gate B — satu pemeriksaan source/native utama

Setelah A lulus dan Node pengembangan **22.16.0** serta Rust **MSVC** tersedia:

```powershell
npm ci --no-audit --no-fund
npm ci --prefix apps/desktop --no-audit --no-fund
npm run preflight:localtest
```

`preflight:localtest` berhenti pada kegagalan pertama (Node, build atau Cargo) dan kini sudah memasukkan `test:chat-companion`,
`test:helium-companion`, `test:desktop-source`,
`test:existing-chat-transport-gate`, `test:prompt-recovery-policy`,
`test:prompt-budget-context`, dan `test:work-admission` (termasuk
`browser-work-summary.test.mjs`). Ini juga menjalankan pemeriksaan Node
lain, build frontend Svelte/Vite, `cargo fmt --check`, `cargo check`,
dan `cargo test`. **Jangan menjalankan tes yang sama dua kali** tanpa
kegagalan spesifik yang perlu diisolasi. Jika satu subtes gagal, catat
perintah, hasil, dan file pertama yang salah; hentikan gate berikutnya.
Pada tahap ini semua tes/source di HEAD baru masih **NOT_EXECUTED**.

`test:code-mode-usage` hanya mengukur JSON-byte dan putaran MCP, **bukan token model**. `cargo test` default **tidak** menjalankan native test yang `#[ignore]`; ujilah secara terpisah dengan persetujuan dan fixture yang benar pada Gate D.

## Matriks skenario dan kriteria lulus

| ID | Skenario / langkah | PASS hanya jika | Bukti minimal |
| --- | --- | --- | --- |
| A01 | Identifikasi host dan checkout: Windows x64 asli, PC-local agent, `git status --short`, `git branch --show-current`, `git rev-parse HEAD` | Host PC terverifikasi, branch `Local`, revisi diketahui, tidak ada perubahan yang berisiko tertimpa | OS, agent host, full SHA dan status Git |
| A02 | Audit toolchain: Node 22.16.0, Rust MSVC, C++ Build Tools, SDK dan WebView2 Runtime | Semua prasyarat nyata ada; Node 24.14.1 **hanya** untuk gateway terpaket | Perintah versi, target Rust dan catatan runtime |
| B01 | `npm ci` kedua lockfile dan empat test fokus tambahan | Semua exit 0, tanpa versi paket yang diam-diam diubah | Nama perintah, exit code, log tersanitasi |
| B02 | `npm run preflight:localtest` penuh | Semua test Node, Svelte/Vite, Cargo fmt/check/test lulus pada SHA yang sama | Output preflight dan jumlah test aktual |
| B03 | Regresi bounded state: scope 64 KiB, report 4 MiB, task outbox 8 MiB, decision 64 B, PromptOutbox 16 MiB; fixture hilang/oversize/rusak | Record besar/korup ditolak, file asli tidak diganti, tidak diubah menjadi izin atau status kosong yang melepaskan hold | Hasil Rust dan `test:prompt-outbox`; nama fixture |
| B04 | Regresi IPC: RequestTracker, watchdog write, budget callback, token/grant, frame invalid, STOP/teardown | Timeout/disarm dan invalid-frame tests lulus; tidak ada retry otomatis | Nama unit test Rust dan exit code |
| B05 | Regresi Codex V1, Code Mode, V2 source-only, receipt correlation, authorization | Scope salah, klien asing, QA palsu, draft effect berulang ditolak | Nama suite dan kasus penolakan |
| C01 | Staging gateway dari official Node 24.14.1 win-x64 dan license yang dipin SHA; jalankan `preflight:gateway-stage` | Staging baru cocok source, manifest dan hash cocok; file lama tidak ditimpa diam-diam | Hash Node, hasil stage dan source SHA |
| C02 | Build debug NSIS `build:app` dengan konfigurasi gateway | File installer nyata dihasilkan; build tidak menutupi error | Exit, lokasi installer, SHA-256 installer |
| C03 | Install pada Windows disposable yang WebView2-nya tersedia; jalankan aplikasi | Startup tidak gagal, gateway packaged cocok; tidak ada izin/akun real yang diam-diam digunakan | Versi OS/runtime, lokasi instalasi, log tanpa secret |
| C04 | MCP stdio terinstal: `initialize`, `tools/list`, `status`, `search_capabilities`, `describe_capability` | Tepat empat nama tool publik, startup tidak mint izin, katalog native tidak keliru menjadi gateway Node | Receipt JSON yang disanitasi, executable terpasang |
| D01 | Dua MCP client terpisah pada workspace-10 disposable: ownership, read-only draft, release/reclaim | Klien asing ditolak; satu pemilik; draft `sent=false` dan tidak berisi QA PASS | Script manual `native-mcp-two-clients.mjs` dan hasilnya |
| D02 | WebView2: 1/2/5/10 workspace, pilih/switch, open/close, browser reload, tab dukungan | Identitas conversation dan tab tidak tertukar; main ChatGPT tidak dapat dinavigasi/diubah oleh MCP sebagai tab dukungan | Hasil setiap workspace, proses host/child |
| D03 | Browser saved chat link, tab snapshots/bookmarks, URL/history sanitization | Yang disimpan hanya URL yang diizinkan; tidak ada cookie/teks private; restart tidak dianggap authenticated result | Langkah UI dan receipt yang disanitasi |
| D04 | One-shot observasi HTTPS supporting tab: izin native, delta/compact, ganti tab/URL lalu coba lagi | Snapshot hanya saat izin/identitas cocok, grant sekali pakai, stale/tab asing ditolak; protected main tidak dibaca | ID tab nonrahasia, alasan penolakan |
| D05 | Download dan browser site permissions: arm/cancel, blocked case, dialog denial | Izin sekali pakai, URL lintas situs/permintaan site berbahaya ditolak; download tidak diklaim aman otomatis | Jenis permintaan, hasil deny/allow, tanpa isi file |
| D06 | Code Mode installed: bounded read, hasil tanpa QA, manual draft hanya dengan owner lease | Hasil hanya data sesuai izin; JS tidak dapat mengakses filesystem, shell, page contents, model send atau grant; tidak ada klaim QA palsu | Program pendek yang disetujui dan hasil tersanitasi |
| D07 | Native Codex V1: operator menyetujui satu goal read-only pada repo fixture. Uji penolakan pada permintaan terpisah tanpa urutan wajib. | Goal yang disetujui selesai dalam scope, tanpa perubahan repo. Upaya yang ditolak tidak meluncurkan worker. | Dialog dan receipt run/scope, tanpa teks privat |
| D08 | Codex V1 pause/resume/STOP, restart di tengah turn, kehilangan ACK/response | STOP mengalahkan pause; resume hanya dari quiescent state; receipt persisten dan tidak ada turn ganda; hasil tidak pasti menjadi `RECONCILE_REQUIRED` | Perubahan state, ID receipt, hash outbox, tanda STOP |
| D09 | IPC terpasang saat child stalled/no stdout, write pipe blocking, callback terlambat/child gagal | Watchdog berupaya menghentikan child; tidak ada callback baru setelah deadline; tidak ada auto-retry; kegagalan kill dilaporkan sebagai kegagalan, **bukan PASS** | Waktu aktual, cara gangguan pada fixture, proses sebelum/sesudah |
| D10 | Lightpanda WSL2 pinned, **localhost fixture saja**, read index, operator-confirmed checkbox click dan search fill | Binary terverifikasi, native grant tepat sekali, readback independen cocok; stale target/timeout menahan hasil tanpa replay | Versi binary, target fixture, consent dan receipt |
| D11 | Agent V2 source preparation/review/STOP (tanpa dispatch worker) | `executionReady=false`, scope/hash benar, STOP berfungsi, tidak ada worker baru | State native dan daftar proses |
| D12 | Operator-reviewed ordinary ChatGPT: existing non-temporary disposable conversation, `Send once`, input manual, review reply manual | Tidak ada scraping/autosend; chat link tepat; percobaan kedua ditolak ketika pending; tampilan tidak mengklaim hasil terverifikasi | Timestamp, status native, screenshot redacted |
| D13 | Benchmark idle/aktif untuk 1/2/4/5/10 workspace, switching, CPU/memori, latency p50/p95 | Pengukuran nyata berlabel workload; tidak mencampur contoh idle historis dan hasil aktif; tidak mengklaim penghematan tanpa baseline | CSV/tabel CPU, private commit, RAM, latency, Node/WebView2 |
| D14 | Shutdown normal, restart/crash disposable, recovery aman, tidak ada proses bocor | Host + Node child berhenti sesuai kebijakan; state hold tidak hilang atau dipromosikan menjadi sukses | Proses sebelum/sesudah, pending ledger |

### Cara menjalankan C01–C02 (hanya setelah A dan B PASS)

Ikuti [panduan staging resmi repo](../../apps/desktop/README.md#build-the-windows-installer). Lokasi berikut **harus diisi dengan file resmi yang telah diverifikasi**; jangan menebak nama, hash atau menimpa staged gateway lama.

```powershell
$node24 = "C:\absolute\path\to\node-v24.14.1-win-x64\node.exe"
$license24 = "C:\absolute\path\to\verified-node-license.txt"
node scripts/stage-gateway-resources.mjs $node24 $license24
npm run preflight:gateway-stage
npm --prefix apps/desktop run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
Get-ChildItem apps/desktop/src-tauri/target/debug/bundle/nsis/*.exe |
  Get-FileHash -Algorithm SHA256
```

**Jangan jalankan perintah di atas** jika `resources/gateway` sudah ada dari staging sebelumnya tanpa keputusan operator tentang isolasi/pemindahannya. Script sengaja menolak overwrite. C01 PASS tidak otomatis berarti C02/C03 PASS.

### Cara menjalankan D01 (manual, perlu persetujuan operator)

Pada instalasi disposable yang sudah lulus Gate C, script repository berikut menguji dua klien MCP terpasang, ownership workspace-10 dan draft. Script **tidak** menguji semua tindakan UI.

```powershell
$env:LAZY_MCP_OPERATOR_QA = "yes"
node tests/manual/native-mcp-two-clients.mjs
Remove-Item Env:\LAZY_MCP_OPERATOR_QA
```

Script memerlukan installed `$env:LOCALAPPDATA\LazyPrompting\lazyprompting-desktop.exe`, membuka workspace-10 dan menghasilkan draft manual; jangan digunakan di profil produksi. Jangan jalankan bila persetujuan operator atau prasyarat terpasang tidak tersedia.

### D07–D14 adalah acceptance operator, bukan npm preflight

- Untuk pemakaian biasa, kirim satu scope dan tunggu satu keputusan operator.
  Biarkan goal yang disetujui selesai. Uji penolakan adalah skenario QA yang
  independen dan tidak menghalangi jalur persetujuan.
- Uji efek hanya pada fixture disposable dan di hadapan operator. Untuk tes Rust bertanda `#[ignore]` yang membutuhkan staging/Codex signed-in, pilih kasus satu per satu setelah memeriksa prasyarat serta implikasi biaya/model. Jangan memakai `cargo test -- --ignored` secara massal tanpa audit.
- Pada gangguan IPC D09, gunakan **gateway fixture terisolasi**; jangan membunuh proses produksi, memalsukan consent, atau menulis ke private outbox. Bila fixture belum tersedia, catat `BLOCKED / NOT_EXECUTED`, bukan PASS.
- Uji Lightpanda D10 hanya dengan binary dan localhost fixture yang terverifikasi; jika belum terpasang/diizinkan, catat `NOT_EXECUTED` secara terpisah.
- D12 memerlukan persetujuan khusus mengirim prompt disposable secara manual. Jika tidak diizinkan, `OPTED_OUT` untuk tindakan itu; bukan izin otomatis.
- D13 gunakan profil/mesin yang sama dan sumber data native tepercaya. Bandingkan idle dan aktivitas per workspace; jangan gunakan angka historis pada commit lain sebagai baseline hasil sekarang.

## Kondisi STOP (wajib)

Hentikan **aksi yang terdampak** dan pertahankan bukti saat terjadi: SHA berbeda, working tree tidak dipahami, toolchain/izin tidak tersedia, build/fixture gagal, autentikasi atau consent tidak sah, kebocoran token/credential/private chat, error tanpa batas, child tidak berhenti, STOP diabaikan, action/billed turn terkirim ulang, outbox `RECONCILE_REQUIRED` dibersihkan otomatis, atau status model ditampilkan sebagai QA PASS tanpa bukti independen. Jangan melakukan retry otomatis terhadap efek yang statusnya tidak pasti.

Tidak ada permintaan melakukan GitHub Actions, cloud CI, promosi `main`, release, dari dokumen ini. Otomatisasi pengambilan jawaban ChatGPT Web melalui DOM/private endpoint **tetap dilarang**, bukan target tes.

## Addendum — shared Companion New Chat rollover (SOURCE-ONLY, 21 Nov 2026)

The following cases are **not** pre-approved deletion operations. Only the
operator-selected LOCAL_PC_AGENT may test them on freshly created
**disposable** ChatGPT conversations in a designated account/profile.
Never try on real project chats or a Work-bound conversation with a
nonempty PromptOutbox, pending handoff or unreviewed checkpoint.

| ID | Localtest scenario | Required observation / fail condition |
| --- | --- | --- |
| D15 | Helium + WebView2 unpacked/bundled asset parity | Same strip, Settings, New Chat event; manifest, pinned native assets and settings identical in actual runtimes. |
| D16 | Explicit New Chat on disposable Chat A | Trusted New Chat click navigates to blank ChatGPT composer only. Chat A stays in account; no Delete menu/confirmation, prompt send, or native Work rebind occurs. |
| D17 | Negative and pre-upgrade states | Wrong/unsaved Chat A, synthetic click, navigation failure, interrupted action or stale DELETE_ATTEMPTED extension storage must not delete, send, or silently replace a bookmark. |
| D18 | Native Work auto-delete future hold | **BLOCKED / NOT_EXECUTED** without an authenticated native checkpoint/outbox/rebind contract. Navigation-only New Chat is not authorized cleanup; manual Work review remains. |

Run relevant Node source fixtures on an authorized PC before D16. Observe
no automatic deletion. Work's Previous Chat Cleanup is a separate manual
review; no source commit authorizes deletion of project conversations.

## Addendum — Compact History A/B performance and recovery (SOURCE-ONLY)

**Research basis (21 November 2026):** Chrome Web Store product descriptions
for AutoGPT Autojourney (batch queue), ChatGPT Automation (queue status,
manual error recovery) and ChatGPT Slow Fix – Speed Booster (recent-message
visibility). These are feature descriptions, not proof of source
implementation, licensing rights or a measured speedup. Independent
MDN documentation supports CSS `content-visibility: auto` as a rendering
hint, **not** DOM removal or a guaranteed reduction of RAM.
No third-party extension source/assets were imported.

| ID | Localtest scenario | Required observation / hold |
| --- | --- | --- |
| D19 | A/B Compact workload on **one disposable long chat** | Compare Compact Off, On + Last 10, and On + Unlimited with identical window size, turn count and workload. Record baseline and 3–5 repetitions of input responsiveness, scroll stability, browser-process RAM and DevTools main-thread layout/paint time. No invented RAM saved percentage. |
| D20 | Observer/streaming stress | While ChatGPT streams a reply, verify Companion's own status writes and turn-body churn do not trigger repeated full scans or extension-local storage polling. A newly mounted turn, ChatGPT UI notice, or Usage Meter scalar update must still refresh the strip. |
| D21 | New Chat navigation recovery | Interrupted navigation, reload and stale pre-upgrade DELETE_ATTEMPTED storage cannot resume deletion, poll stored rollover intent or send a message. No native rebind is inferred. |

**Decision criteria:** If Compact On consistently increases latency, layout
work or memory for the same chat, record regression and leave local
performance acceptance blocked. If the initial host/browser source is
not measurable, record NOT_EXECUTED, not a pass. No GitHub Actions or
ChatGPT production-account deletion tests.

## Addendum — current response Error / Retry (source-only)

| ID | Scenario | PASS / hold evidence |
| --- | --- | --- |
| D22 | Disposable ChatGPT response error | One compact **Error · Retry** appears only for the newest failure; operator click invokes exactly the original Regenerate/Retry once, not Send or Continue. |
| D23 | Negative cases | Old errors, generating states, usage/chat limits, duplicate/missing/hidden Retry controls, and unrelated error text do not cause a retry. No unattended replay or native Work bypass. |

Only an explicitly selected PC-local agent with a disposable account/chat
may attempt the live cases. The extension has no server-side delivery
receipt, so do not claim successful generation or automatic restart
from source assertions alone.

## Addendum — single dynamic status priority (source only)

| ID | Localtest scenario | Required observation |
| --- | --- | --- |
| D24 | Simulate coincident Limit hit, response error, possible limit and estimated context thresholds | A single status uses precedence **Limit hit → Error/Retry → Possible limit → Switch chat → New chat soon**. The winning state is shown once, never stacked or converted into a toast. |
| D25 | Clear an error and compare normal/narrow layouts | If a context threshold is still met, its warning returns after Error disappears. Otherwise status is hidden. Context/Chat remain at the left; New Chat/Settings remain anchored right when label lengths change. Retry remains accessible only when the original control is safely present. |

These scenarios are authored but NOT_EXECUTED. Real ChatGPT UI,
Helium/WebView2 responsiveness and provider outcomes require
an authorized PC-local run with disposable chat fixtures.

## Addendum — integrated Work status and native error parity (source-only)

| ID | Scenario | PASS / hold condition |
| --- | --- | --- |
| D26 | Open Work on an authorized disposable native workspace | Exactly one existing Work summary displays native operator status, plugin pending status and clearly **app-wide, not chat-linked** Codex V1 count; no second queue or new popup is created. Missing native reads display unknown/hold rather than ready. |
| D27 | Plugin unknown/RECONCILE_REQUIRED with an otherwise idle chat | Native plugin hold outranks UI readiness; no automatic retry, prompt send, or clearing the PromptOutbox. STOP after mismatched/unknown host receipt. |
| D28 | Newest versus historical ChatGPT errors | Native WebView2 reports ERROR only when the **latest mounted** response has its error marker; a prior failed message with a newer normal reply does not hold the current chat. Compare Companion single Error status. |
| D29 | Same-screen native status and MCP contract | Query `goal_run.status` under an existing authorized native owner, then refresh Work; consistent app-wide native goal states but no invented ChatGPT conversation binding, QA proof, or host↔extension permission. Plugin OAuth and Helium host bridge remain BLOCKED until separately authenticated. |

All are NOT_EXECUTED until an authorized LOCAL_PC_AGENT on the real
user PC observes them. Use disposable chats and native read-only
status calls only; never use Cloud CI as a substitute or test destructive
chat deletion on real work.

## Addendum — host-controlled Companion status readback (source-only)

| ID | Scenario | PASS condition |
| --- | --- | --- |
| D30 | Work-open on exact native-bookmarked disposable ChatGPT chat with Companion installed in WebView2 | Exactly one read-only status (none, error, limit, warning, cleanup) appears in existing Work summary and matches the Companion's own status-kind. Native reply includes no chat text, URL, cookie or prompt. `deliveryVerified`, `resultVerified`, and `nextPromptAllowed` remain false. |
| D31 | Missing Companion, unbound/different ChatGPT URL, reload/recreated WebView, malformed status-kind, hidden-state mismatch, stale/closed workspace | Status becomes `UNAVAILABLE` or is cleared; no previous page status remains. No send/retry/deletion and no extra MCP/Chrome permission. |
| D32 | Helium compatibility boundary | The canonical unpacked extension exposes the same status-kind in the page. The native readback is **WebView2-only**; Helium must not claim a connected host or automatic task execution without a separate authenticated adapter and PC evidence. |

All results remain NOT_EXECUTED until a selected LOCAL_PC_AGENT
validates on the user's actual Windows host and disposable ChatGPT chat.
The WebView2 DOM read is never an extension authorization channel.

## Template laporan lokal (jangan commit data sensitif)

```text
Repository / branch / full HEAD:
PC host / agent application (bukan model saja):
OS build / Node / npm / Rust / WebView2 / gateway Node:
Working tree sebelum tes:
A01–A02: PASS | FAIL | BLOCKED | NOT_EXECUTED
B01–B05: PASS | FAIL | BLOCKED | NOT_EXECUTED
C01–C04: PASS | FAIL | BLOCKED | NOT_EXECUTED
D01–D32: PASS | FAIL | BLOCKED | NOT_EXECUTED | OPTED_OUT (per ID)
Kasus pertama gagal + perintah/aksi + exit code:
Expected / observed (tanpa credential atau chat pribadi):
Bukti file/log/screenshot redacted:
Proses sebelum/sesudah & keputusan STOP/recovery:
Benchmark workload dan hasil aktual (atau NOT_EXECUTED):
Penilaian: SOURCE-only | B_PASS | C_PASS | D_PARTIAL | D_PASS | BLOCKED
Permintaan koreksi source (jika ada): path/line/kontrak/acceptance
```

Tidak ada PASS yang diprasetel. Jika ada kegagalan, hentikan pada **first wrong owner**, laporkan penyebab dengan bukti, lalu hanya lakukan koreksi sesuai izin repository dan ulangi pengujian konsumen yang terpengaruh pada HEAD baru.

## Instruksi siap pakai untuk agen di PC

> Baca `docs/validation/windows-localtest-scenarios-2026-11-19.md` dan aturan repo pada checkout `Local` saat ini. Verifikasi bahwa Anda benar-benar bekerja di PC Windows saya, catat branch, working tree, full HEAD dan toolchain. Jalankan skenario A dan B dalam urutan dokumen, lalu C dan D hanya jika gate pendahulunya lulus dan persetujuan operator tersedia. Jangan jalankan GitHub Actions/cloud CI, API berbayar, efek ChatGPT Web otomatis, atau tes `#[ignore]` secara massal. STOP pada masalah pertama, jangan reset repo atau retry efek tidak pasti. Catat hasil per ID, bukti redacted, batas yang belum diuji, dan tindak lanjut source yang diperlukan.
