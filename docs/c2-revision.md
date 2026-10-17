# Revisi lokal CCR C2 — 17 Oktober 2026

Branch: `C2-001-revisi-ccr-1510`. Seluruh perubahan hanya di working tree lokal. Tidak ada commit, push, PR, deploy, atau mutasi pada Supabase bersama.

## Sumber dan keputusan implementasi

FR/TR-1510-001–005 menjadi acuan utama. FR/TR-2909-001–005 dipakai sebagai pembanding, bukan untuk mengaktifkan kembali exception atau pagu. PDF Company Sales Report Mei/Juni/Juli, contoh invoice/reimbursement, dan CSV database yang diberikan tersedia. Nominal tidak dihitung ulang dari tarif pajak: VAT/PPh23 yang tampil berasal dari sumber. Identitas customer memakai kode tersimpan dari `c2_customers` melalui view v2; tidak dibuat dari urutan hasil pencarian.

Permintaan tambahan pengguna: Report menyediakan CSV selain Excel. CSV adalah rincian 14 kolom yang kompatibel dengan skema Data Upload. Excel tetap laporan teragregasi tiga sheet sesuai FR/TR05; workbook laporan tersebut bukan input upload. Keduanya memakai periode tervalidasi dan filter perusahaan yang sama.

## Pemetaan FR/TR

| Kebutuhan | Halaman | API utama `/api/v1/` | Database dan implementasi |
|---|---|---|---|
| FR01/TR01 upload, preview, confirm | `/data-upload` | `cost-ingestion/upload`, `confirm`, `history` | Parser PapaParse/Zod/ExcelJS, tepat 14 kolom; draft di `c2_upload_drafts`, sumber privat bucket `c2-company-sales-reports`, SHA-256 dan owner. Confirm membaca ulang file, memverifikasi hash lalu memanggil `c2_commit_upload(p_draft_id,p_rows)` sekali untuk records + history atomik. |
| FR02/TR02 dashboard/customer read-only | `/dashboard`, `/customer-cost` | `cost-analytics/dashboard-summary`, `customers`, `customer-detail/[id]`, `periods` | `vw_c2_company_monthly_summary_v2`, `c2_monthly_cost_records`. Lima KPI: customer aktif, subtotal, VAT+PPh23, total cost, profit. Donut memakai porsi seluruh periode termasuk saat filter aktif; bar chart menampilkan biaya sumber. |
| FR03/TR03 tax/evidence | `/tax-tracing`, `/evidence` | `cost-tax/company-tracing`, `cost-evidence/history`, `history/[uploadId]` GET/DELETE | `vw_c2_company_tax_tracing_v2`, `vw_c2_evidence_history_v2`; aggregate dan rincian memakai filter period/company/dest sama. Hapus hanya Manager, memakai `c2_delete_upload(p_upload_id,p_actor_id)` dan `c2_evidence_deletion_audit`. Preview adalah rincian yang tersimpan, bukan URL dokumen palsu. |
| FR04/TR04 validation/locking | `/monthly-closing` bertajuk Validation | `cost-validation/summary`, `lock`, `audit-logs` | `c2_period_validations`, `c2_validation_audit_logs`; `c2_validate_period(p_period,p_notes,p_actor_id)`, catatan maksimal 1000 karakter. Validasi hanya Manager of Accounting, Tax Manager, Director of FAT / nama direktur lengkap. Cash Manager dapat menghapus evidence terbuka tetapi tidak memvalidasi. |
| FR05/TR05 report + tambahan CSV | `/export-report` bertajuk Report | `cost-report/preview`, `export-xlsx`, `export-csv`, `history` | Periode wajib `is_validated=true`; preview dan file memakai dataset/filter sama. XLSX tepat 3 sheet; CSV rincian 14 kolom. `c2_report_history` mencatat identitas pengguna dan format sebelum unduhan dikirim. Ada unduh ulang berdasarkan filter riwayat. |

Detail format: [c2-report-format.md](c2-report-format.md). Implementasi utama: `lib/c2/server.ts`, `parser.ts`, `report.ts`, `roles.ts`; UI bersama `components/c2-workspace.tsx` dan `lib/c2-client.ts`.

## Autentikasi dan pensiun fitur lama

- Browser memakai `createBrowserClient`, server memakai `createServerClient` dengan cookie, dan `proxy.ts` memperbarui sesi. Server selalu memanggil `auth.getUser()` dan membaca **hanya `app_metadata.role`** untuk otorisasi.
- Service role hanya dibaca dalam modul `server-only`, setelah autentikasi/otorisasi berhasil. Tidak ada kredensial contoh atau service role dalam kode browser. Jalur login hardcoded lama dihapus.
- Pemanggil UI sudah memakai endpoint revisi. `/cost-exception` dan `/priority-exception` mengalihkan ke `/tax-tracing`.
- `cost-exceptions/evaluate-tags`, `cost-exceptions/priority-list`, `cost-export/queue` mengembalikan HTTP 410 setelah autentikasi; tidak menulis tabel lama atau memberi URL palsu.
- `cost-closing/status`, `approve-lock`, `audit-logs` menjadi alias handler validation baru; `cost-analytics/monthly-summary` alias dashboard revisi. Tidak ada pemanggil UI lokal ke API lama.
- Helper `lib/c2MockData.ts` yang membaca `c2_cost_transactions` dipensiunkan. Helper kompatibilitas `cost-summary.ts`/`cost-records.ts` memakai API revisi; fallback DENSE_RANK/kode rekaan dihapus.
- Tidak ada tabel/view/RPC lama yang dihapus dari database. Pencabutan EXECUTE overload lama dan pengamanan view harus ditinjau lintas kelompok melalui SQL terpisah.

## Hal yang harus diverifikasi sebelum operasi produksi

1. `.env.local` yang diaudit hanya memiliki konfigurasi publik Supabase. `SUPABASE_SERVICE_ROLE_KEY` belum tersedia. Upload/confirm/delete/validasi/ekspor yang menulis history akan mengembalikan 503 sampai konfigurasi server yang sah disiapkan. Jangan menggunakan variabel `NEXT_PUBLIC_` untuk service role.
2. Jalankan **preflight baca saja** pada Supabase dengan akses katalog yang sesuai. RLS, grant overload lama, trigger, dan bucket tidak boleh dinyatakan aman hanya dari SQL migrasi yang dilampirkan. Rincian ada pada laporan audit database terpisah.
3. Uji transaksi rollback, konkurensi confirm vs validate vs delete, Storage, RLS, dan audit append-only di staging. Unit test mock memverifikasi pemanggilan atomik, bukan membuktikan eksekusi PostgreSQL di produksi.
4. Contoh PDF asli memiliki periode di judul laporan, header bertingkat, serta MAWB/DEST kosong pada sebagian baris. Tidak ada XLSX/CSV asli pada lampiran tersebut. API saat ini menerima tabel datar dengan 14 kolom dan identitas wajib sesuai RPC migrasi yang sudah dijalankan. Keputusan mengizinkan MAWB/DEST kosong membutuhkan perubahan kontrak database yang disepakati; aplikasi tidak mengisi nilai pengganti.
5. TR01 menyebut streaming XLSX. ExcelJS 4.4 streaming reader gagal pada urutan ZIP workbook valid dalam pengujian. Implementasi memakai document reader ExcelJS dengan batas input 25 MB, expanded archive 32 MB dan 100.000 baris, sementara CSV dibaca melalui streaming PapaParse. Target 1000 baris diuji; batas RAM <120 MB untuk semua ukuran sampai 25 MB belum terbukti. Untuk volume besar, uji staging atau gunakan worker dengan batas memori.
6. Hash/ID pengguna historis yang kosong dibiarkan. Dua selisih log Agustus: Wulan log 46.678.597 vs rincian 46.678.601 (−Rp4), Aida log 81.211.100 vs rincian 81.211.096 (+Rp4). Total Agustus tetap 127.889.697. Tidak ada koreksi nominal atau dummy data.

## Pemeriksaan lokal

- `npm test`: pengujian offline parser CSV/XLSX, schema/nominal, duplikasi, autentikasi/peran, owner/hash draft, periode terkunci, filter tax, workbook tepat 3 sheet, CSV round-trip, dan pencatatan history ekspor. Tidak menghubungi Supabase.
- `npm run typecheck` dan `npm run lint`. Enam warning lama berasal dari elemen img/variabel tidak terpakai; tidak ada error setelah perbaikan.
- `npm run build`: Webpack. Turbopack sempat crash subprocess CSS pada Windows, sehingga script dev/build memilih Webpack. Build memerlukan Google Fonts sebagaimana layout repo sebelumnya; tidak ada akses database pada prerender halaman.
- Node minimum 22.13. Node global pada mesin awal 20.17 tidak memenuhi engine dependensi Supabase; pemeriksaan memakai Node bundled 24.19.

## Menjalankan dari PowerShell

```powershell
Set-Location -LiteralPath 'C:\Users\hp\OneDrive\Dokumen\Andima-CCR'
# Untuk mesin ini, gunakan Node 24 yang tersedia; alternatifnya pasang Node >=22.13.
$env:Path = 'C:\Users\hp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
node --version
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Buka `http://localhost:3000/login` dan gunakan akun Supabase yang benar dengan `app_metadata.role` FAT. Jangan mengetes aksi tulis pada project bersama; gunakan staging yang benar-benar terpisah. Jangan mengubah nilai environment untuk menunjuk project lain tanpa memeriksa tujuannya.

## Paket lokal, backup dan rollback

Perubahan sudah diterapkan langsung di working tree. Mode apply tidak perlu dijalankan lagi. Paket lokal berada di `.c2-local-backup/c2-revision`, tidak ikut Git dan tidak memuat `.env`. Snapshot awal menyimpan perubahan pengguna sebelum revisi. Script memeriksa branch, hash, path dan symlink; menolak menimpa perubahan baru di luar baseline/paket.

```powershell
node scripts/c2-local-package.mjs plan      # daftar/rencana, tanpa menulis
node scripts/c2-local-package.mjs check     # verifikasi hasil terhadap paket
node scripts/c2-local-package.mjs backup    # salin kondisi sekarang ke snapshot baru
node scripts/c2-local-package.mjs apply     # hanya jika ingin memasang kembali paket
node scripts/c2-local-package.mjs rollback  # hanya bila ingin kembali ke kondisi sebelum revisi
```

Rollback memulihkan perubahan lokal awal pengguna, bukan reset ke HEAD. Script tidak mengubah Git index, remote, database, atau dependency `node_modules`. Sesudah apply/rollback yang mengubah package.json, jalankan `npm ci`. Jangan menjalankan `pack` sesudah mengubah hasil revisi kecuali memang ingin mengganti isi paket lokal.
