# Skenario Localtest Windows — LazyPrompting

**Status dokumen:** SOURCE_REVIEWED / TEST_PLAN_AUTHORED_NOT_RUN (19 November 2026).
**Repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Baseline source saat disusun:** `80c4df338f7e9559622224164ba88842e4e4f534`.
**Revision yang diuji:** WAJIB isi dari `git rev-parse HEAD` di PC; jangan menganggap baseline atau tanggal dokumen sebagai hasil tes.
**Otoritas:** [Gate Windows](localtest-readiness.md), [desktop acceptance](desktop-acceptance-gates.md), [checkpoint aktif](../operations/current-state.md), [panduan build](../../apps/desktop/README.md).
**Tujuan:** membuktikan source, installer, MCP, batas izin, STOP/recovery dan performa di Windows **sebelum** mempertimbangkan release. Bukan uji produksi atau izin otomatisasi ChatGPT Web.

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

### Gate B — otomatis, tanpa API berbayar

Setelah A lulus dan Node pengembangan **22.16.0** serta Rust **MSVC** tersedia:

```powershell
npm ci --no-audit --no-fund
npm ci --prefix apps/desktop --no-audit --no-fund
npm run test:desktop-source
npm run test:existing-chat-transport-gate
npm run test:prompt-recovery-policy
npm run test:prompt-budget-context
npm run preflight:localtest
```

`preflight:localtest` adalah **satu perintah utama** untuk rangkaian test repository/gateway/desktop, build frontend, `cargo fmt --check`, `cargo check`, dan `cargo test`. Versi source saat dokumen ini disusun **sudah** memasukkan `test:prompt-outbox`, `test:browser-action-outbox`, `test:code-mode`, `test:code-mode-usage` dan `test:goal-run-scope-fingerprint`. Jangan wajibkan semuanya dua kali tanpa alasan. Empat `test:*` eksplisit di atas menambah cakupan yang belum termasuk matriks itu.

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
| D16 | Explicit New Chat on disposable Chat A | Clicking New Chat opens blank composer; **does not delete A yet**. First trusted message creates a distinct saved Chat B, then a single exact-Chat-A sidebar options → Delete → confirmation UI sequence is attempted. A must be absent from account view before any UI-level success is reported. Do **not** claim permanent server deletion. |
| D17 | Fail-closed negative cases | Navigating to an existing chat, missing/duplicate A link, hidden sidebar, unmatched menu/modal, failed storage, wrong tab/nonce, timed-out send receipt and interrupted deletion must **not** delete another chat or retry the destructive action. Record actual old-chat retention or unverified outcome. |
| D18 | Native Work-owned WebView2 safety hold | **BLOCKED / NOT_EXECUTED** until the host can attest checkpoint, pending outbox and chat rebind before irreversible deletion. The browser content script does **not** implement this native attestation. Do not use a real Work-bound Chat A to test this. |

Run relevant Node source fixtures only on the **authorized PC** before
attempting D16. If a real delete request fails or becomes ambiguous,
**STOP without retrying**. Delete testing must be specifically authorized
for the disposable test chat; never interpret a source commit as consent
to delete production account history.

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
| D21 | New Chat recovery under interruption | Verify no pending rollover causes repeated storage polling while idle. Use a disposable chat for interrupted first-send, return/navigation, stale nonce and reload around DELETE_ATTEMPTED; no second destructive click or assertion of server deletion. Work-bound auto-delete remains held by native checkpoint/outbox authorization. |

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
