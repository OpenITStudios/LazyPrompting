# Pengujian Windows dan feedback perbaikan · 21 November 2026

**Kesiapan harian 2/10.** Pengguna berhasil memakai login lama dan memperoleh balasan dengan pengiriman manual di Browser 01. Pada laporan terakhir, percakapan sudah terbuka, tetapi toolbar dan akses ke Settings tetap hilang. Pengiriman dari Codex dan kembalinya balasan yang cocok ke Codex belum terbukti. [Kronologi dan rubrik penilaian](../../operations/history/2026-11-21-serah-terima-windows.md).

## Cara mempersingkat pekerjaan berikutnya

| Urutan | Pekerjaan | Bukti yang menentukan kapan lanjut |
|---|---|---|
| 1 | Reproduksi pada instalasi biasa, memakai profil lama dan satu workspace. Dalam peluncuran yang sama periksa opt-in yang diterima proses, hasil registrasi WebView2, inisialisasi skrip dan keberadaan strip di atas composer. Simpan hasil struktural tanpa isi chat. | Beranda dan satu percakapan uji menampilkan strip. Gear membuka Settings dan editor ambang peringatan dapat dijangkau. Jika satu tahap gagal, perbaiki tahap itu dahulu. |
| 2 | Dari satu chat Codex, gunakan satu prompt sintetis pada percakapan uji yang disetujui. Catat pemilihan target, pengiriman, jumlah pesan terkirim, dan penerimaan balasan melalui integrasi yang didukung. | Tepat satu pesan mencapai target dan balasan yang cocok tersedia bagi Codex. Jika langkah tertentu masih manual atau transport belum tersedia, tulis langkah tersebut di hasil. |
| 3 | Setelah putaran pertama berhasil, ulangi dengan dua workspace dan satu restart. Periksa sesi lama, target dan duplikasi. Baru perluas ke sepuluh workspace. | Target yang sama pulih, slot kedua tidak mengubah slot pertama, dan tidak ada pengiriman ganda. |

Untuk menilai efisiensi, hitung **klik manual, permintaan login ulang dan jumlah rebuild** untuk satu putaran berhasil. Target awal yang diinginkan pengguna ialah nol login ulang, nol salin-tempel prompt/balasan, dan tanpa Computer Use untuk pekerjaan rutin. Pertahankan persetujuan operator yang diwajibkan. Catat waktu dari draft sampai balasan dapat dipakai Codex. Belum ada pengukuran durasi alur lengkap maupun penghematan konteks AI. Kelompokkan perbaikan yang memiliki satu akar masalah dalam satu build, dan lakukan satu pemeriksaan pada instalasi itu sebelum meminta pengguna mengulang tindakan.

## Data yang bisa diperiksa

- [Matriks A01–D32](../windows-localtest-scenarios-2026-11-19.md) mencatat tahapan yang gagal, lulus, parsial dan belum dijalankan. Perbedaan antarhasil mencerminkan putaran, fixture dan executable yang berbeda.
- [Hasil dari 36 log](hasil-log.jsonl) memuat satu objek per log dengan nama relatif, ukuran, SHA-256 berkas asli dan baris hasil teknis yang dapat dibagikan, termasuk kegagalan awal. Sebagian tes muncul beberapa kali. Jumlah baris bukan jumlah tes unik. Tiga log hanya memiliki metadata dalam ekstrak. Cargo check selesai dalam 11,62 detik dengan 84 peringatan. Log rustfmt memuat diff format. Log pendaftaran hanya berisi peringatan Windows 1412 terkait kelas jendela, tanpa hasil callback pendaftaran.
- [Hasil installer offline](smoke.json) memuat exit code kedua installer, 49 file gateway, 11 aset Companion, empat tool MCP dan respons lokasi dari sepuluh workspace. [Checksum Companion](companion-checks.json) dan [manifest gateway paket uji](gateway-manifest.json) mengidentifikasi aset putaran offline tersebut.
- [Benchmark numerik WebView2](benchmark.json) memuat lima ukuran workspace, 30 sampel switch per ukuran, CPU satu core, memori dan p50/p95. Pada 10 workspace fixture, p95 panggilan switch 1,68 ms. Angka ini tidak mengukur latensi tampilan ChatGPT, biaya token atau putaran prompt dan balasan.

Data berasal dari sesi Windows pada basis `830ed6b2679abd48bf24d0239ad1ed8f677d00b5` dengan perubahan lokal saat masing-masing tes. Commit publikasi mencatat bukti historis. Ekspor memeriksa integritas berkas tanpa menjalankan ulang aplikasi. Transkrip asli, tujuh screenshot akun, patch working tree, dan log mentah tersedia di paket privat pada PC pemilik: `artifacts/runtime/data-uji-windows-2026-11-21.zip`.
