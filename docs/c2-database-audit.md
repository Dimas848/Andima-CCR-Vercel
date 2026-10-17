# Audit database C2 — 17 Oktober 2026

Tidak ada SQL DDL/DML, RPC mutasi, unggahan Storage, penghapusan, validasi, atau dummy data dijalankan pada Supabase bersama. Probe jaringan hanya HTTP GET memakai konfigurasi publik lokal; tidak ada login pengguna atau service role. Gangguan koneksi sandbox diatasi dengan izin akses jaringan untuk probe baca saja.

## Hasil live yang benar-benar diamati

| Objek/probe | Hasil akses anonim | Kesimpulan terbatas |
|---|---|---|
| `c2_customers`, `c2_monthly_cost_records`, `c2_upload_history_logs`, `c2_period_validations`, `c2_validation_audit_logs`, `c2_report_history` | HTTP 200, nol baris terlihat | Relasi dapat dijangkau, isi tidak terlihat untuk anon. Bukan bukti tabel kosong atau seluruh policy benar. |
| `vw_c2_company_monthly_summary_v2`, `vw_c2_company_tax_tracing_v2`, `vw_c2_evidence_history_v2` | HTTP 200, nol baris terlihat | Ketiga view v2 tersedia melalui REST. Definisi/security_invoker perlu katalog. |
| `c2_upload_drafts`, `c2_evidence_deletion_audit` | HTTP 401, PostgreSQL 42501 permission denied | Akses SELECT anon ditolak. Pesan gateway menyarankan GRANT; **saran itu tidak dijalankan** karena tabel ini memang privat. |
| **`c2_cost_transactions`** | **HTTP 206, satu baris dikembalikan, Content-Range 0-0/68 tanpa sesi pengguna** | **Kebocoran akses anonim terverifikasi, bukan sekadar label UNRESTRICTED.** Baris berisi nominal biaya/pajak, customer/job, uploader dan URL evidence. Source aplikasi lokal sudah tidak memakainya, tetapi akses database masih terbuka. |
| OpenAPI `/rest/v1/` | HTTP 401 “Secret API key required” | Tidak bisa menginventarisasi fungsi/grant dari anon. |
| `storage/v1/bucket/c2-company-sales-reports` | HTTP 400, payload 404/NoSuchBucket | Bucket tidak terlihat oleh anon. Ini belum membuktikan bucket tidak ada karena akses privat dapat menyamarkan keberadaannya. |
| Katalog `pg_class` melalui public REST | HTTP 404/PGRST205 | Katalog tidak diekspos lewat endpoint ini; bukan indikasi objek PostgreSQL hilang. |

Kolom view lama yang terlihat sesuai masalah historis: `planned_cost` dari subtotal, `actual_cost` dari total cost, dan variance merupakan komponen pajak. Tidak dipakai sebagai deviasi anggaran di kode revisi.

## Verifikasi yang masih memerlukan akses katalog

Jalankan `sql/c2/00_preflight_readonly.sql` dalam SQL Editor dengan akun yang memiliki akses katalog. File tersebut memakai transaksi read-only dan ROLLBACK; tidak memanggil RPC mutasi. Output mencakup DDL view/fungsi/trigger, semua overload dan effective EXECUTE grants, RLS/policy, table grants, constraints/index, bucket, dependencies, dan rekonsiliasi biaya.

Signature revisi yang dipakai aplikasi: `c2_commit_upload(uuid,jsonb)`, `c2_delete_upload(uuid,uuid)`, `c2_validate_period(text,text,uuid)`. Lampiran migrasi membatasi semuanya ke service_role; belum diverifikasi secara independen terhadap katalog live. Pengguna melaporkan overload lama `c2_delete_upload(uuid)` dan `c2_validate_period(text,text)` masih SECURITY DEFINER dan dapat dipanggil authenticated. Tidak ada pemanggilnya tersisa di kode lokal revisi. Status grant live belum dapat dibaca dari kredensial yang tersedia.

`02_guard_hardening_PROPOSED.sql` adalah usulan tambahan terhadap DDL lampiran: locking periode untuk mutasi tabel langsung, penguncian metadata provenance termasuk role/path, audit append-only, dan pencabutan grant tulis browser. RPC revisi sudah menggunakan advisory lock periode; trigger asli belum melakukan locking sendiri. Uji race/isolasi transaksi pada staging tetap wajib; SQL usulan bukan bukti jaminan konkurensi live.

`03_retire_legacy_access_PROPOSED.sql` mencabut EXECUTE hanya pada dua signature lama dan akses public/anon/authenticated ke view lama. Tidak menghapus tabel/fungsi. Dapat memutus klien C2 lain atau deployment lama; koordinasikan pemanggil luar repo ini. Kedua file usulan sengaja berakhir **ROLLBACK**, tidak dijalankan dalam pekerjaan ini. Simpan DDL/grants awal untuk rollback DBA sebelum membuat versi COMMIT setelah review staging.

## Audit lima ekspor CSV

| Data | Jumlah |
|---|---:|
| Customer | 20 |
| Rincian biaya | 68 |
| Riwayat unggahan | 9 |
| Status periode | 5 |
| Riwayat laporan | 2 |

Enam riwayat memiliki rincian; tiga riwayat merupakan dua log exception dan satu log export lama tanpa rincian. View evidence v2 mengecualikan ketiganya berdasarkan hubungan records, bukan menghapus sumber.

| Periode | Rincian | Customer aktif | Total Cost (Rp) |
|---|---:|---:|---:|
| Mei 2026 | 18 | 8 | 184.845.256 |
| Juni 2026 | 18 | 11 | 494.078.823 |
| Juli 2026 | 15 | 10 | 356.452.427 |
| Agustus 2026 | 16 | 7 | 127.889.697 |
| September 2026 | 1 | 1 | 744.312 |

Customer antarbulan bisa berulang. Seluruh relasi customer code/name, upload FK, periode dan subtotal/pajak/cost/profit validasi cocok dengan rincian CSV. Dua perbedaan sumber tetap dilaporkan:

- Wulan Agustus: log Rp46.678.597, rincian Rp46.678.601, selisih log–rincian **−Rp4**.
- Aida Agustus: log Rp81.211.100, rincian Rp81.211.096, selisih **+Rp4**.

Akumulasi Agustus tetap sama. `uploaded_by` dan `file_sha256` kosong pada 9 log, `validated_by_user_id` pada 5 validasi, dan `generated_by_user_id` pada 2 laporan. Semuanya dibiarkan. Tidak ada backfill nama/peran/hash berdasarkan dugaan. `c2_upload_drafts` dan `c2_evidence_deletion_audit` kosong menurut kondisi pengguna dan tidak diisi.

URL `/reports/...` pada sumber historis tidak dianggap bukti objek Storage tersedia. Preview revisi menampilkan records yang berelasi; penghapusan URL lama yang tidak masuk bucket memberi peringatan administrator setelah RPC sukses, bukan mengarang URL pengganti.
