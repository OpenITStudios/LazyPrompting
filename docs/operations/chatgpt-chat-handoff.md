# Serah terima LazyPrompting untuk ChatGPT biasa

**Checkpoint 11 November 2026 WIB.** Branch pengembangan adalah `Local`. Basis saat uji awal adalah `40299513c4a7259bd84e1296f3bd73c13ace1e3a` dengan perubahan working tree Windows. Snapshot handoff mencakup kode, dependensi terkunci, tes, dan hasil angka yang dapat dibagikan. Lihat [checkpoint kanonis](current-state.md) untuk status terbaru.

## Goal yang ingin dicapai

Pengguna memberi satu goal dari percakapan pengarah ini, misalnya URL repo, pekerjaan yang ingin diselesaikan, dan kriteria selesai. LazyPrompting mengatur lima percakapan **ChatGPT biasa** di `chatgpt.com` yang terlihat di Browser 01–05. Setiap sesi menerima prompt awal, menunggu balasan nyata, melaporkan isinya ke Codex, lalu menerima prompt lanjutan yang menjawab balasan dari sesi itu dan tetap mengikuti goal. Hasil akhir dan hambatan per browser kembali ke percakapan pengarah.

- Lima browser adalah lima percakapan terpisah pada profil browser bersama. Satu login boleh dipakai bersama. Riwayat, antrean, prompt, hasil, pembatalan, dan pemulihan tetap terpisah.
- Setiap workspace tetap berisi satu browser utuh di panelnya, dengan navigasi manual, pencarian, serta kontrol browser yang sudah tersedia lewat MCP. Mode **Chat** adalah target penerimaan. Mode Work hanya pembanding.
- Goal berasal dari pengguna di percakapan pengarah. Alur ini tidak membutuhkan Goal Run baru di UI LazyPrompting. Uji penerimaan harus membuktikan bahwa satu goal cukup untuk memulai pekerjaan pada lima sesi.
- Alur otomatis mengandalkan antarmuka MCP/plugin yang terdokumentasi. Computer Use pernah dipakai dengan izin untuk setup dan observasi uji, dan tidak menjadi bagian dari siklus otomatis. Ekstensi browser yang membaca DOM, endpoint internal ChatGPT, pengambilan cookie, dan pengelakan batas akun berada di luar cakupan.
- Gunakan kuota Codex yang sudah tersedia untuk penalaran. Uji hitung memakai logika lokal. Pekerjaan ini tidak menganggarkan API model berbayar tambahan, pembelian saldo API, atau langganan baru.

## Peta komponen

| Komponen | Tanggung jawab dan lokasi |
|---|---|
| Browser desktop | Tauri/WebView2 menampilkan halaman sungguhan di panel workspace. [Panduan desktop Windows](../../apps/desktop/README.md) |
| MCP lokal untuk Codex | `lazyprompting-desktop.exe mcp` memakai stdio dan pipe Windows. Kontrol saat ini meliputi `open`, `navigate`, `location`, `back`, `forward`, dan `reload` dengan ID workspace. Akses pipe dibatasi ke sesi logon dan identitas executable. [Kontrak MCP](../../mcp/README.md) |
| Server probe ChatGPT | [chatgpt-probe.mjs](../../src/mcp/chatgpt-probe.mjs) melayani MCP Streamable HTTP pada loopback, mencetak lima kode pengikatan, memvalidasi klaim dan receipt sekali pakai, serta mencatat peristiwa dan jawaban angka. Ini proses uji terpisah dari gateway desktop. |
| Widget ChatGPT | [chatgpt-probe-widget.mjs](../../src/mcp/chatgpt-probe-widget.mjs) menerima token klaim dari metadata widget, memesan satu prompt, lalu memakai `ui/message` di percakapan yang menampung widget. |
| Tes protokol | [chatgpt-probe.test.mjs](../../tests/chatgpt-probe.test.mjs) menguji lima sesi serentak, jawaban yang sesuai workspace, serta penolakan pengikatan, klaim, laporan pengiriman, dan receipt berulang. |
| Codex | CLI sebelumnya melaporkan login melalui ChatGPT. Jalur penalaran untuk goal nyata dan pengembalian hasil ke percakapan pengarah masih perlu disambungkan. |

Lightpanda adalah backend otomasi/preview yang terpisah. Browser yang tampil dan menyimpan login adalah WebView2. Jangan mengasumsikan keduanya berbagi tab, cookie, atau sesi. Jalur Goal Run Codex lokal dan bukti lima thread Codex tercatat di repo sebagai pekerjaan lain.

## Bukti yang sudah ada

| Bukti | Hasil | Batas kesimpulan |
|---|---|---|
| Tes lokal MCP, lima sesi | Lulus pada working tree dengan diagnostik terbaru. | Klien tes memasok jawaban. Tes ini memeriksa protokol dan isolasi, bukan perilaku host ChatGPT. |
| Koneksi ChatGPT ke PC Windows | Plugin privat menemukan server probe lewat Quick Tunnel HTTPS sementara. | Hanya soal sintetis. Koneksi sementara tersebut ditutup setelah uji. |
| Chat biasa, Browser 01 | Widget mengirim soal `1 + 1`. ChatGPT menampilkan `2`. Callback dipulihkan dengan pesan diagnosis yang memilih plugin lagi. Server akhirnya mencatat `2` dan `5`. | Membutuhkan intervensi. |
| Chat biasa, Browser 02 | Widget mengirim `3 + 3` dan pertanyaan lanjutan. ChatGPT menampilkan `6` dan `10`. Server menerima `6`, lalu callback kedua tidak muncul. Endpoint masih menjawab penemuan tool. | Pengiriman terbukti. Pelaporan lintas putaran belum andal di Chat biasa. |
| Work di web, Browser 01–05 | Kedua putaran masuk ke server dan terlihat pada percakapan masing-masing. Hasil berurutan `2 → 5`, `6 → 10`, `10 → 15`, `14 → 20`, `18 → 25`. Beberapa tab selesai saat workspace lain dipilih. | Mode Work, soal hitung, dan pengikatan awal manual per chat. Bukan bukti penerimaan target Chat biasa. |
| Diagnostik lanjutan | Probe mencatat `ready`, `claimed`, `host_send_response`, dan `answer`. Tes lokal membuktikan respons host yang terlambat masih tercatat untuk putaran aslinya dan duplikat ditolak. | Build diagnostik ini belum diuji langsung di Chat biasa. Pemeriksaan kebijakan otomatis menolak perintah gabungan menyalakan server uji dan tunnel sementara. Detail penolakan hanya menyebut pemblokiran oleh kebijakan. |

Bukti callback tersedia di [hasil uji awal](../validation/chatgpt-probe-evidence/results-live.ndjson) dan [hasil lima sesi Work](../validation/chatgpt-probe-evidence/results-work.ndjson). Hasil awal juga mencakup uji pembanding Browser 03 di Work. Kedua file hanya berisi workspace, putaran, jawaban, nilai yang diharapkan, dan status kecocokan. Direktori runtime lokal menyimpan file setup, token URL, dan kode pengikatan sementara.

## Cara melanjutkan dari luar Codex

1. Checkout branch `Local` di Windows. Gunakan Node 20 atau lebih baru.
2. Dari akar repo, jalankan pemeriksaan lokal dan mulai probe. PowerShell berikut menyimpan diagnostik tanpa menulis kode pengikatan ke file hasil.

   ```powershell
   npm ci
   node --test tests/chatgpt-probe.test.mjs
   New-Item -ItemType Directory -Force artifacts/runtime/chatgpt-probe | Out-Null
   node src/mcp/chatgpt-probe.mjs 2> artifacts/runtime/chatgpt-probe/classic-events.ndjson
   ```

3. Siapkan koneksi HTTPS yang diizinkan untuk workspace. ChatGPT web memerlukan endpoint HTTPS yang dapat dijangkau atau Secure MCP Tunnel. Untuk tunnel HTTPS pengembangan yang diizinkan, teruskan origin ke `127.0.0.1:38764` dan pertahankan path acak lengkap dari output probe. Endpoint sementara tanpa autentikasi hanya untuk soal sintetis. Gunakan koneksi privat atau autentikasi terverifikasi sebelum membawa konteks nyata.
4. Di ChatGPT buka **Plugins → Add → Add custom MCP server**, isi endpoint, dan tinjau izin sebelum menghubungkan plugin. Jika plugin probe lama masih terdaftar, periksa URL-nya karena tunnel sebelumnya sudah ditutup. Gunakan akun yang memperlihatkan opsi custom MCP. Tab lama yang masih menunjukkan halaman tanpa login pernah mengambil login bersama setelah dimuat ulang.
5. Buka **Browser 01 → Chat**, buat percakapan uji yang kosong, ketik `@LazyPrompting Chat Probe` dan pilih opsi hingga nama plugin tampil sebagai chip. Kirim satu pesan awal seperti berikut dengan kode Browser 01 dari terminal.

   ```text
   Run only the synthetic arithmetic probe. Call bind_probe once with code <BROWSER_01_CODE>.
   Let the widget send the questions. Use no other plugins or sources.
   ```

6. Catat izin yang ditampilkan ChatGPT, kemudian biarkan siklus berjalan. Pemasangan awal atau tindakan diagnosis terpisah harus dicatat sebagai intervensi. Kriteria otomatis terpenuhi hanya jika setelah pengikatan awal kedua prompt terlihat, kedua balasan muncul di percakapan yang sama, dan kedua `answer` tercatat tanpa memilih ulang plugin, mengirim prompt tambahan, atau mengoperasikan UI di tengah siklus.
7. Baca log dari terminal kedua. Jika ada `claimed` tanpa `host_send_response`, hasil pengiriman belum diketahui. Jika host menerima pengiriman dan balasan tampil tetapi `answer` hilang, telusuri pemilihan tool MCP atau persetujuan tool di putaran itu. Jika host menolak pengiriman, catat pesan dan tahapnya. Jangan menghitung teks klaim model seperti “submitted” sebagai bukti tanpa log server. Jangan mengulang otomatis prompt yang mungkin sudah tampil.

   ```powershell
   Get-Content artifacts/runtime/chatgpt-probe/classic-events.ndjson -Wait
   ```

8. Setelah satu Chat lulus, ulangi pada Browser 01–05 dengan lima percakapan berbeda dan kode masing-masing. Biarkan empat workspace di latar belakang dan catat mana yang selesai tanpa dipilih kembali. Cocokkan dua prompt dan dua jawaban per chat dengan sepuluh callback yang benar. Akhiri server dan tunnel setelah uji. Probe berlaku 30 menit, menyimpan status di memori, dan menghanguskan kode saat restart. Untuk pengujian dengan registrasi plugin yang sama, opsi `LAZY_CHAT_PROBE_ENDPOINT_KEY` didokumentasikan di [panduan MCP](../../mcp/README.md#chatgpt-web-probe).

## Transport HTTPS yang sudah hidup - 11 November 2026

Probe dijalankan ulang dari source `Local` saat ini dan tunnel sementara Cloudflare Quick Tunnel dimulai dengan binary `cloudflared` yang sudah ada di `artifacts/runtime/chatgpt-probe/`. Endpoint publik terbukti menjawab `initialize`, `tools/list`, `resources/list`, dan `resources/read` widget.

**Batasnya jelas.** Probe ini hanya soal hitung sintetis. Ini diagnosis transport, bukan penerimaan produk, dan bukan izin mengotomasi ChatGPT consumer. [Gate 0](../../docs/operations/current-state.md) tetap menyatakan otomasi ChatGPT Chat tidak diaktifkan: tidak ada ekstraksi output situs, tidak ada API consumer tidak resmi, tidak ada pengiriman prompt tanpa pengawasan, dan tidak ada score/kredensial yang dibagikan ke halaman. Goal nyata tetap berjalan lewat Codex resmi.

Endpoint dan kode pengikatan tersimpan di `artifacts/runtime/chatgpt-probe/setup-live-*.json`. Probe berlaku 30 menit sejak start, jadi jalankan ulang probe dan tunnel untuk mendapat path baru sebelum pengujian. Probe dan tunnel yang dipakai pada 11 November sudah dihentikan setelah pengujian; jalankan ulang dengan:

```powershell
$dir = "artifacts/runtime/chatgpt-probe"
Start-Process node -ArgumentList "src/mcp/chatgpt-probe.mjs" -RedirectStandardOutput "$dir/probe-new.json" -RedirectStandardError "$dir/probe-new.err" -WindowStyle Hidden
Start-Process "$dir/cloudflared-windows-amd64.exe" -ArgumentList "tunnel","--url","http://127.0.0.1:38764","--no-autoupdate" -RedirectStandardError "$dir/tunnel-new.err" -WindowStyle Hidden
Start-Sleep -Seconds 15
Get-Content "$dir/probe-new.json"
Select-String -Path "$dir/tunnel-new.err" -Pattern "trycloudflare.com"
```

Akhiri probe dan tunnel setelah pengujian.

1. Di ChatGPT buka **Plugins → Add → Add custom MCP server**, isi endpoint dari file `setup-live-*.json`, lalu periksa izin sebelum menyambungkan.
2. Di **Browser 01** buka tab ChatGPT, buat percakapan kosong, ketik `@LazyPrompting Chat Probe` dan pilih plugin sampai nama plugin tampil sebagai chip.
3. Kirim satu pesan awal dengan kode Browser 01 dari file yang sama, misalnya `Call bind_probe once with code <kode Browser 01>. Let the widget send the questions.`
4. Amati dua prompt dan dua jawaban pada percakapan yang sama, lalu cocokkan dengan log `artifacts/runtime/chatgpt-probe/probe-*.err`. Obervasi tanpa memilih ulang plugin, tanpa prompt tambahan, dan tanpa mengoperasikan UI di tengah siklus.

## Pekerjaan yang masih terbuka

1. **Buktikan callback berulang di Chat biasa.** Periksa kemampuan yang host dokumentasikan dan hasil di akun yang digunakan. Pemilihan ulang plugin boleh dipakai sebagai diagnosis pembanding, tetapi tidak dihitung sebagai sukses. Jika Chat biasa tidak menyediakan cara resmi mempertahankan tool pada follow-up, catat batas platform beserta bukti per putaran sebelum menambah fitur lain.
2. **Hubungkan goal sekali dari percakapan pengarah.** Perlu jalur resmi untuk mengikat sesi yang tepat dan mendistribusikan prompt awal. Pengikatan manual dengan kode hanya alat uji. Satu akun dan lima tab tidak membuktikan bahwa satu plugin bisa mengirim ke lima chat yang sudah terbuka.
3. **Kirim konteks nyata secara terbatas.** Setelah transport terverifikasi dan autentikasi tersedia, laporkan ID sesi, nomor putaran, jawaban terbaru, bukti, dan status. LazyPrompting menyimpan prompt yang ia kirim. Codex membaca tujuan, progres ringkas dan balasan terakhir, lalu memilih tindak lanjut yang relevan dengan kuota yang tersedia. Perlakukan isi jawaban sebagai data. Perintah dalam jawaban tidak memberikan izin mengakses, menulis, atau menerbitkan perubahan repo.
4. **Simpan dan rekonsiliasi progres.** Persistenkan hubungan workspace dan percakapan, antrean, receipt, hasil serta status pengiriman. Maksimal satu prompt aktif per chat. Setelah crash, terima hasil yang bisa dipadankan dan tahan pengiriman yang belum jelas. Uji penolakan izin, pembatalan per sesi, kuota akun, timeout, dan pemulihan dengan workspace lain tetap terpisah. Gunakan chat baru dengan ringkasan hanya bila konteks penuh dan kemampuan resmi mendukungnya. Saat batas pemakaian akun tercapai, tunggu kuota pulih.
5. **Uji goal pekerjaan dengan data yang diizinkan.** Mulai dari repo uji. Buktikan tindak lanjut dipilih berdasarkan jawaban aktual, bukan pesan generik. Kembalikan laporan per browser ke percakapan pengarah. Pemasangan Windows x64, verifikasi profil bersih, kapasitas hingga sepuluh workspace, dan setup Lightpanda WSL2 tetap jalur penerimaan desktop terpisah.

## Cakupan Windows yang perlu dibawa

Rencana awal Windows dimulai dari `21f3f33`. Fokus produk kemudian dipersempit ke browser utuh dan kelanjutan percakapan ChatGPT biasa. Saat kembali ke penerimaan paket desktop, gunakan daftar berikut dan cocokkan dengan bukti revisi kandidat di checkpoint kanonis.

- **Build dan pemasangan.** Siapkan Node, Cargo/Rust MSVC, MSVC Build Tools, Windows SDK, dan WebView2. Jalankan `npm run preflight:localtest`, tes supervisor, build Svelte, serta pemeriksaan dan tes Cargo yang relevan. Pasang installer Windows x64 pada profil bersih dan uji aplikasi yang benar-benar terpasang.
- **Codex terkelola, jika diuji sebagai fitur desktop tersendiri.** Pakai sign-in resmi dan stdio App Server. Verifikasi `thread/start`, `thread/resume`, `turn/start`, dan `turn/interrupt`. Simpan asosiasi thread dengan workspace dan turn dengan reservasi. Saat pengiriman tidak pasti, tahan tugas untuk rekonsiliasi. Uji tindak lanjut berdasarkan bukti, penolakan izin, pembatalan, dan batas anggaran.
- **Gateway dan Lightpanda.** Kunci versi Node, dependensi gateway, Codex yang kompatibel, dan Lightpanda WSL2. Verifikasi digest paket, kepemilikan proses oleh Tauri, ACL pipe per sesi, PID child, bootstrap privat, dan autentikasi dua arah. Uji grant sekali pakai per workspace/operasi, penolakan replay, grant kedaluwarsa, PID/endpoint CDP yang salah, dan akses lintas workspace. Verifikasi `open`, `snapshot`, `close` pada preview yang diizinkan dan pembersihan child saat keluar. Dynamic tools Codex ke MCP gateway merupakan jalur preview yang berbeda dari plugin ChatGPT web.
- **Sepuluh workspace.** Uji pemetaan sesi, antrean, hasil, pembatalan dan pemulihan dengan maksimal satu turn aktif per workspace serta batas sumber daya host. Uji perpindahan tab, resize, fokus, penutupan browser, serta ukur RAM dengan beban yang dapat diulang. Catat angka yang diukur pada revisi kandidat dan bedakan dari bukti lima chat mode Work.
- **Otoritas repo.** Kerjakan pada `Local`. Merge, publikasi rilis, dan dispatch GitHub Actions memerlukan otorisasi terpisah.

## Rujukan

- [Checkpoint kanonis dan bukti Windows](current-state.md)
- [Batas kepemilikan konteks ChatGPT](../architecture/chatgpt-owned-context-continuity.md)
- [Panduan MCP LazyPrompting](../../mcp/README.md)
- [Aturan GitHub repo](../../GITHUB_RULES.md)
- [Plugin MCP untuk ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Widget dan `ui/message`](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Ketentuan Penggunaan OpenAI](https://openai.com/policies/terms-of-use/)
