# Format baku Report C2

Kedua pilihan unduh hanya tersedia untuk periode tervalidasi, menggunakan filter perusahaan yang aktif, dan mencatat format serta identitas pembuat di riwayat laporan. Angka tidak dihitung kembali dari tarif pajak. Nama dan kode perusahaan mengikuti data tersimpan.

## CSV — rincian Company Sales Report

Nama file: `company-sales-report-Juni-2026.csv` (periode mengikuti pilihan). Encoding UTF-8 dengan BOM, delimiter koma, newline CRLF, semua sel diapit tanda kutip. Nominal memakai titik desimal, tepat dua angka desimal, tanpa pemisah ribuan. Nol tetap `0.00`; nilai kosong tidak diubah menjadi nol.

Urutan tepat 14 kolom yang juga diterima Data Upload:

```csv
"Periode","Job Number","Company","MAWB No.","CW","DEST","Invoice Nominal","Sub Total","VAT","Cost PPH 23","Others","DIP IATA","Total Cost","Profit"
```

Satu baris mewakili satu rincian sumber, bukan agregasi perusahaan. `Periode` berisi nama bulan dan tahun pada setiap baris; input YYYY-MM juga dinormalisasi ke bulan Indonesia. Customer code tidak menjadi kolom ke-15: relasi customer tetap diselesaikan database berdasarkan entitas resmi.

CSV dapat dibaca ulang oleh parser upload tanpa mengubah nilai. Ini **bukan izin mengunggah ulang ke periode tervalidasi**: penguncian periode tetap menolak mutasi. Identitas yang diawali karakter formula spreadsheet ditolak saat ekspor dengan pesan validasi, bukan diam-diam diubah. Dokumen PDF/format laporan bertingkat harus disiapkan sebagai tabel datar; aplikasi tidak menebak isi kosong.

## Excel — laporan keuangan 3 sheet

Nama file: `company-sales-report-Juni-2026.xlsx`. Tepat tiga worksheet:

| Sheet | Kolom |
|---|---|
| Ringkasan & Persentase | Customer Code, Perusahaan, Periode, Total Cost (Rp), Porsi Perusahaan, Profit (Rp) |
| Breakdown Cost & Pajak | Customer Code, Perusahaan, Invoice Nominal (Rp), Sub Total (Rp), VAT / PPN 11% (Rp), Cost PPh 23 (Rp), Others (Rp), DIP IATA (Rp), Total Cost (Rp) |
| Evidence & Validation | Nama Dokumen, Periode, Waktu Unggah (UTC), Diunggah Oleh, Status Validation, Divalidasi Oleh, Waktu Validasi (UTC) |

Nominal Excel berupa angka dengan format `#,##0`; nilai asli hingga dua desimal tetap tersimpan. Persentase berupa fraksi numerik dan format `0.00%`. Porsi perusahaan tetap terhadap keseluruhan periode, bukan diubah menjadi 100% ketika hanya satu perusahaan dipilih. Timestamp adalah sel tanggal Excel berlabel UTC; halaman aplikasi menampilkan WIB.

Header navy, freeze baris pertama, filter kolom, border, dan pengaturan cetak landscape konsisten pada setiap sheet. Workbook tiga sheet merupakan laporan teragregasi dan bukan format input Data Upload. Gunakan CSV rincian untuk pertukaran data yang memakai skema upload.
