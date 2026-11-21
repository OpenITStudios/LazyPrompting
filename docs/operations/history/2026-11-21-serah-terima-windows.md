# Serah terima LazyPrompting di Windows · 21 November 2026

**Penilaian kesiapan pemakaian harian: 2/10 (buruk).** Browser dan sesi lama dapat dipakai secara manual. Dua hasil yang seharusnya langsung terasa bagi pengguna masih gagal atau belum terbukti: toolbar di atas kotak prompt dan satu putaran kerja yang dikendalikan dari Codex. Ini penilaian pengalaman pengguna, bukan persentase tes yang lulus.

Kritik pengguna: “kalau kritik dari saya, hasil sekarang terlalu ribet dan membuang-buang waktu karena tidak praktis dan efisien”.

## Yang sebenarnya diminta

Satu chat dan satu Goal di Codex. Sepuluh workspace untuk percakapan ChatGPT biasa. Codex membantu menulis prompt dan menindaklanjuti jawaban pada percakapan yang tepat. Pengguna menginginkan sesi login lama, sedikit langkah manual, hemat konteks AI, dan pekerjaan normal tanpa Computer Use. Toolbar ringkas berada tepat di atas composer, termasuk di beranda. Editor ambang peringatan dipertahankan. Contoh SelectorsHub menjadi acuan posisi dan kepadatan visual. Tidak ada permintaan untuk menebak kuota akun.

## Kronologi dan batas hasil

| WIB | Peristiwa | Arti bagi pekerjaan berikutnya |
|---|---|---|
| 15.52–16.26 | Checkout Local diperiksa. Preflight, build, installer offline dan fixture Windows dijalankan. Jendela QA menggunakan identitas aplikasi berbeda. | Membuktikan sebagian fondasi. Pengguna meminta pengujian di instalasi Windows dengan profil lamanya. |
| 16.33–16.59 | Pengguna mempertanyakan login ulang. Instalasi utama membuka Browser 01 dengan sesi lama. Pengguna mengizinkan satu prompt sintetis di percakapan uji. Identifikasi beranda vs percakapan masih menyita beberapa interaksi. | Ada bukti sesi lama bisa digunakan kembali. Pemulihan percakapan yang persis sama setelah rangkaian restart belum diterima. |
| 17.00–17.25 | Jalur MCP sempat menunjuk instalasi lama. Pemeriksaan menemukan beberapa klien aktif. Build dan koneksi diuji ulang. Skenario D07 membuka dialog Goal native; pengguna mengoreksi bahwa Goal yang dimaksud adalah Goal Codex. | Skenario fixture mengambil waktu pengguna. Jangan masukkan dialog Goal kedua ke alur prompting harian. |
| 17.26–17.46 | Target produk ditegaskan menjadi satu pengendali. Satu pesan sintetis disalin dan dikirim manual, lalu ChatGPT membalas penanda yang diharapkan. Laporan sebelumnya menyebut Goal selesai. | Hasil manual sah. Penerimaan produk tetap terbuka karena pengiriman terarah dan balasan kembali ke Codex melalui integrasi belum terbukti. |
| 17.46–18.15 | Pengguna menghentikan Computer Use, meminta panel Work, Connections dan indikator yang membingungkan dirapikan. Shell disederhanakan. Target beranda, percakapan dan tab pendukung dibedakan. Probe Browser 01 ditemukan dengan kemampuan bind dan pelaporan numerik. Koneksi chat Codex pernah gagal dengan `Transport closed` meski executable langsung merespons. Tiga isu diurutkan di dokumen status. | Ketersediaan probe, executable atau skema tool masing-masing belum membuktikan jalur produksi untuk balasan umum. Daftar di dokumen status merupakan backlog lokal; audit ini tidak menyatakan tiket GitHub ditutup. |
| 18.15–18.23 | Pengguna mempertahankan editor Context Warnings lalu meminta rebuild. Build dan tes layout lulus. Installer dibuka secara interaktif. Pengguna menunjukkan toolbar hilang di beranda. Pemeriksaan menemukan bundle dan entri pendaftaran WebView2. Kode saat itu melepas toolbar di luar percakapan. | Instruksi mencari ikon gear terlalu dini. Membuka installer juga belum membuktikan proses aktif menjalankan UI baru. |
| 18.24–18.26 | Aturan beranda diubah agar logo dan Settings dapat muncul; kontrol percakapan tetap untuk chat tersimpan. Edge dengan halaman sintetis lulus untuk pemasangan strip, gear, transisi ke chat, dan pengecualian temporary chat. Build NSIS selesai setelah PATH Cargo dibetulkan. | Fixture menjalankan skrip pada HTML buatan dan menyediakan storage pengganti. Ia tidak menguji pendaftaran atau injeksi ekstensi dalam WebView2 terpasang. |
| 18.26–18.28 | Tangkapan layar terakhir sudah menunjukkan percakapan nyata dengan balasan dan composer. Toolbar tetap absen. CLI melaporkan Browser 01 sebagai CONVERSATION. Diagnosis dihentikan atas permintaan pengguna untuk serah terima. | **FAIL pada layar target.** Alasan “masih di beranda” gugur. Penyebab di WebView2 belum diketahui. |

## Penilaian dan biaya alur

Setiap aspek bernilai 0 jika gagal atau belum terbukti di target, 1 jika sebagian hasil bisa dipakai, 2 jika kriteria pengguna telah diperagakan pada instalasi sasaran.

| Aspek | Nilai | Dasar |
|---|---:|---|
| Menjaga sesi dan workspace | 1/2 | Profil lama dikenali; pulih ke chat yang sama dan isolasi pekerjaan antarslot belum diterima. |
| Instalasi dan pemakaian dasar | 1/2 | Aplikasi membuka ChatGPT dan chat manual mendapat balasan. Peluncuran normal beserta integrasi masih belum konsisten terbukti. |
| Codex mengendalikan satu putaran | 0/2 | Salin-tempel manual dan probe numerik belum memenuhi pengiriman serta pengembalian balasan umum. |
| Companion dan akses ke pengaturan | 0/2 | Toolbar absen pada percakapan nyata. Editor ada di source tetapi pengguna belum dapat menjangkaunya di layar tersebut. |
| Praktis tanpa pendamping teknis | 0/2 | Pengguna berulang kali membuka installer, mengoreksi sasaran QA dan mengirim gambar untuk menunjukkan gejala yang sama. |

| Prioritas | Pemborosan teramati | Perubahan cara kerja yang disarankan |
|---|---|---|
| 1 | Pengujian paket, hash dan fixture dilanjutkan saat bukti yang hilang justru tampilan di aplikasi nyata. | Jadikan satu reproduksi pada instalasi biasa sebagai awal dan akhir diagnosis. Berhenti menyebut UI berhasil sampai gear teramati di atas composer dan panelnya bisa dibuka. |
| 2 | Profile QA, instalasi utama, proses MCP dan shell peluncur memberi hasil berbeda. Operator harus memahami perbedaan lingkungan untuk tugas sederhana. | Catat identitas executable, profile, workspace dan hasil registrasi **untuk peluncuran yang sama**. Pakai kembali sesi lama. Lakukan rebuild hanya setelah penyebab di jalur itu dipersempit. |
| 3 | Goal native, Work, status RAM/GitHub/plugin dan dialog pengikatan pernah masuk ke alur utama. | Pertahankan workspace dan chat sebagai tampilan utama. Pertahankan pengaturan yang diminta, termasuk ambang peringatan. Ukur jumlah aksi manual pada satu pekerjaan nyata sebelum menambah kontrol. |
| 4 | Pelaporan “berfungsi” mencakup lapisan yang belum diuji. Operator menjadi pihak yang berulang kali membuktikan kegagalan. | Setiap hasil harus menyebut target, tindakan, dan hasil teramati. Build, pendaftaran, UI terlihat, dan pertukaran pesan mempunyai kriteria tersendiri. |
| 5 | Riwayat panjang, konteks berulang dan tes fitur lain menggeser perhatian dari satu chat yang berfungsi. | Baca status singkat dahulu. Gunakan transkrip untuk menelusuri keputusan tertentu. Belum ada pengukuran token atau waktu baku per pekerjaan; biaya tidak dinyatakan dalam angka perkiraan. |

## Bukti untuk diagnosis di luar Codex

- Basis pekerjaan `OpenITStudios/LazyPrompting`, branch `Local`, HEAD sebelum serah terima `830ed6b2679abd48bf24d0239ad1ed8f677d00b5`. Working tree sebelum dokumen serah terima berisi 39 file berubah (+1642/−2217). Diff mencakup pekerjaan sebelumnya; baris berubah bukan ukuran kemajuan.
- Loader Windows berada di `apps/desktop/src-tauri/src/embedded_webview.rs`. Ia memeriksa opt-in `LAZY_OPERATOR_COMPOSER_ENABLE`, memverifikasi aset lalu menggunakan callback asinkron `AddBrowserExtension`. Pengaturan pada lingkup user ditemukan bernilai 1. Nilai yang diwarisi proses aktif dan keberhasilan callback pada peluncuran terakhir belum terekam.
- `apps/desktop/browser-extension/chatgpt-composer/companion/core.js` memvalidasi URL percakapan. Di `toolbar.js`, inisialisasi memerlukan modul Companion dan storage ekstensi. Fungsi `sync()` mencari editor, menentukan anchor dan memasang strip. Tanpa bukti dari proses aktif belum dapat dipilih antara kegagalan pemuatan, inisialisasi, pencarian anchor, atau rendering.
- Hash SHA-256 toolbar terpasang dan salinan build debug pada pemeriksaan terakhir sama, `0A1AAB2BEDDAA2D5F3C4BE715F7C4D159CC1035C0C3628740C48447F23488287`. Hash executable instalasi diawali `D16F7D4F`; executable di target/debug diawali `6EA8FA0C`. Perbedaan ini perlu dicocokkan ke payload installer sebelum menyimpulkan salah versi. Hash file tidak menunjukkan bahwa content script pernah berjalan.
- Jalur diagnostik `operator_companion_status` di `chat_operator_send.rs` dibatasi ke percakapan yang sudah terikat. Hasil unavailable memiliki beberapa kemungkinan penyebab. Jangan gunakan hasil itu sebagai bukti tunggal bahwa toolbar terpasang atau gagal.
- Rincian Windows, Svelte, Rust, gateway, dan fixture terdahulu ada pada [status operasi](../current-state.md) dan [matriks validasi](../../validation/windows-localtest-scenarios-2026-11-19.md). Angka 162 tes Rust lulus, 9 diabaikan, dan 48 file staging gateway berasal dari putaran yang dicatat di sana. Tes tersebut tidak diulang sewaktu mengarsipkan sesi. Penghematan RAM, ketahanan sepuluh percakapan nyata, serta pause/resume/STOP menyeluruh belum terukur pada kondisi terakhir.

## Urutan penerimaan jika perbaikan diteruskan

1. Buka instalasi biasa di profil lama. Pada peluncuran yang sama, rekam hasil registrasi ekstensi, apakah strip terpasang dan terlihat, dan apakah Settings terbuka dari strip. Uji beranda dan satu chat uji. Cukup simpan hasil struktural tanpa isi chat. Berhenti pada lapisan pertama yang gagal.
2. Dari koneksi Codex yang memang akan dipakai pengguna, baca identitas workspace dan target. Di percakapan uji yang disetujui, cocokkan satu draft, satu pengiriman yang dikonfirmasi, dan satu balasan yang kembali ke Codex lewat transport yang didukung. Jika transport balasan umum belum tersedia, catat batas produk itu secara eksplisit.
3. Uji dua slot dan satu restart. Pastikan chat dan draft tidak tertukar, login bertahan, dan retry tidak menggandakan pengiriman. Setelah itu periksa seluruh sepuluh slot. Pertahankan pembatasan pengiriman, STOP, dan izin yang tercatat di kebijakan proyek.

## Isi serah terima lokal

Folder privat `artifacts/runtime/serah-terima-2026-11-21/` di checkout memuat transkrip pesan pengguna dan balasan Codex, dialog, tujuh lampiran asli, indeks aktivitas teknis dan patch working tree sebelum serah terima. ZIP berdampingan memudahkan pemindahan. Screenshot memuat informasi akun pengguna; folder tersebut diabaikan Git. Commit dokumentasi membawa audit ini dan rujukannya. Untuk melanjutkan di mesin lain, bawa juga ZIP secara privat.

Patch dibuat dengan `git diff --binary HEAD` terhadap basis di atas. Pada checkout bersih di SHA basis, periksa dengan `git apply --check perubahan.patch` sebelum menerapkan. Workspace asal sudah berisi perubahan. Jangan menerapkan patch lagi di sana. Paket tidak menyertakan profil browser, data login, installer, dependensi atau instruksi internal model.
