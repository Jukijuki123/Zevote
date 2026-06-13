# Product Requirement Document (PRD)

# E-Voting OSIS TPS Terpusat (MVP v0.1)

---

## 1. Informasi Produk

### Nama Produk

E-Voting OSIS

### Versi

MVP v2.1

### Status

Ready for Design & Development

### Target Pengguna

* Sekolah Menengah (SMP/SMA/SMK)
* Pemilihan Ketua OSIS
* Pemilihan Ketua MPK
* Pemilihan Organisasi Internal Sekolah

### Teknologi

* Next.js
* TypeScript
* Prisma ORM
* PostgreSQL (Supabase)
* Vercel

---

# 2. Latar Belakang

Pemilihan Ketua OSIS secara konvensional masih menggunakan surat suara kertas yang membutuhkan biaya cetak, waktu penghitungan yang lama, serta potensi kesalahan rekapitulasi.

Sistem ini dirancang untuk menggantikan proses tersebut dengan mekanisme pemungutan suara digital yang:

* Efisien
* Murah
* Mudah dioperasikan
* Menjaga anonimitas pemilih
* Dapat dijalankan menggunakan infrastruktur gratis

---

# 3. Model Operasional TPS

## Lingkungan Pemungutan Suara

Pemungutan suara dilakukan pada:

* 1 Ruangan TPS
* 6–10 Laptop Voting
* 1-2 Laptop Admin/Panitia

Karakteristik TPS:

* Siswa tidak menggunakan perangkat pribadi.
* Siswa masuk ke TPS secara bergantian.
* Panitia melakukan verifikasi identitas fisik siswa.
* Panitia mengawasi seluruh proses pemungutan suara.

---

# 4. Tujuan Produk

## Tujuan Utama

Menyediakan sistem voting digital yang:

1. Memastikan satu siswa hanya dapat memilih satu kali.
2. Menjaga kerahasiaan pilihan pemilih.
3. Mempermudah operasional panitia.
4. Menghilangkan kebutuhan distribusi token fisik.
5. Mengurangi penggunaan kertas/kardus/limbah lainnya.

---

# 5. Non Goals

Fitur berikut tidak termasuk MVP:

* Realtime Quick Count
* Selfie Verification
* OTP
* QR Login
* Mobile App
* Multi School SaaS
* Integrasi WhatsApp
* Voting dari luar TPS

---

# 6. User Roles

## Super Admin

Hak akses:

* Membuka pemilihan
* Menutup pemilihan
* Mengelola kandidat
* Mengelola data pemilih
* Melihat hasil akhir
* Melihat audit log

---

## Panitia

Hak akses:

* Melihat antrian login
* Menyetujui pemilih yang mencoba login
* Menolak pemilih yang mencoba login
* Melihat status kehadiran

Tidak dapat:

* Mengubah hasil
* Menghapus suara
* Mengubah kandidat

---

## Pemilih

Hak akses:

* Login
* Melakukan voting satu kali

---

# 7. User Flow

## Tahap 1 - Login

Pada laptop voting siswa mengisi:

* Nama Lengkap
* Kelas/Jurusan

Contoh:

Nama: Ahmad Fauzi
Kelas: XII SIJA 2

Kemudian menekan tombol:
"Login" atau "Minta Akses Voting"

---

## Tahap 2 - Approval Panitia

Permintaan login masuk ke Dashboard Panitia.

Panitia melihat:

* Nama
* Kelas
* Status Pemilih

Panitia melakukan verifikasi fisik.

Jika valid:

Klik "Setujui"

Jika tidak valid:

Klik "Tolak"

---

## Tahap 3 - Pembuatan Session Anonim

Setelah disetujui sistem membuat:

* Anonymous Session ID
* Anonymous Voter UUID

Contoh:

a6c8fd31-12f4-48c9-b912-xxxx (boleh lebih simple/pendek)

UUID hanya digunakan selama sesi voting.
UUID tidak boleh digunakan untuk mengidentifikasi siswa.

---

## Tahap 4 - Voting

Siswa melihat daftar kandidat.

Informasi kandidat:

* Nomor Urut
* Nama Kandidat
* Foto Kandidat

Siswa memilih satu kandidat.

---

## Tahap 5 - Konfirmasi

Sistem menampilkan:

"Apakah Anda yakin memilih kandidat ini? Pilihan tidak dapat diubah."

Pilihan:

* Ya, Pilih
* Kembali

---

## Tahap 6 - Submit Suara

Ketika siswa menekan tombol konfirmasi:

Sistem:

1. Menyimpan suara.
2. Menandai siswa sudah memilih.
3. Mengakhiri sesi.

Semua proses wajib menggunakan database transaction.

---

## Tahap 7 - Logout Otomatis

Setelah sukses:

* Session dihapus.
* Browser kembali ke halaman login.
* Laptop siap digunakan siswa berikutnya.

---

# 8. Functional Requirements

## FR-01 Login Request

Prioritas: Critical

Siswa dapat mengirim permintaan login menggunakan:

* Nama
* Kelas

---

## FR-02 Approval Login

Prioritas: Critical

Panitia dapat:

* Approve
* Reject

permintaan login.

---

## FR-03 Anonymous Session

Prioritas: Critical

Setelah approval sistem wajib membuat session anonim.

Tidak boleh ada identitas siswa pada data voting.

---

## FR-04 Voting

Prioritas: Critical

Ketentuan:

* Satu siswa satu suara.
* Pilihan tidak dapat diubah.
* Voting hanya dapat dilakukan satu kali.

---

## FR-05 Voting Timeout

Prioritas: High

Halaman voting memiliki batas waktu:

3 menit

Countdown wajib ditampilkan secara realtime.

Contoh:

02:59

02:58

02:57

Jika waktu habis:

* Session dihapus.
* Kembali ke halaman login.

---

## FR-06 Login Timeout

Prioritas: Low

Halaman login memiliki timeout:

120 detik

Jika tidak ada aktivitas:

* Form direset.
* Tetap berada di halaman login.

---

## FR-07 Monitoring Kehadiran

Prioritas: High

Panitia dapat melihat:

* Belum Hadir
* Menunggu Approval
* Sedang Voting
* Sudah Memilih

---

## FR-08 Tutup Pemilihan

Prioritas: Critical

Admin dapat mengubah status:

OPEN → CLOSED

Setelah CLOSED:

* Login baru ditolak.
* Voting baru ditolak.
* Hasil dapat ditampilkan.

---

## FR-09 Hasil Pemilihan

Prioritas: Medium

Hanya dapat diakses setelah pemilihan ditutup.

Menampilkan:

* Kandidat
* Jumlah Suara
* Persentase

---

# 9. Non Functional Requirements

## Performance

Target:

* Login Request < 2 detik
* Approval < 1 detik
* Voting Submit < 3 detik

---

## Capacity

Target:

* 2.000 Pemilih dalam waktu kurang dari 4 jam
* 10 Laptop Voting Aktif

---

## Reliability

Target:

99% selama hari pemilihan

---

## Security

* HTTPS wajib aktif.
* Server-side validation wajib.
* RLS Supabase wajib aktif.
* Session terenkripsi.


---

# 10. Data Model

## students

| Field         | Type    |
| ------------- | ------- |
| id            | UUID    |
| nama          | String  |
| kelas         | String  |
| hadir         | Boolean |
| sudah_memilih | Boolean |

---

## login_requests

| Field      | Type      |
| ---------- | --------- |
| id         | UUID      |
| student_id | UUID      |
| status     | PENDING   |
| created_at | Timestamp |

---

## candidates

| Field      | Type    |
| ---------- | ------- |
| id         | UUID    |
| nomor_urut | Integer |
| nama       | String  |
| foto_url   | String  |

---

## votes

| Field        | Type      |
| ------------ | --------- |
| id           | UUID      |
| candidate_id | UUID      |
| created_at   | Timestamp |

Catatan:

Tabel votes tidak boleh menyimpan:

* student_id
* nama
* kelas
* session_id

Tujuannya menjaga anonimitas.

---

## election_settings

| Field           | Type      |
| --------------- | --------- |
| id              | UUID      |
| election_status | ENUM      |
| started_at      | Timestamp |
| ended_at        | Timestamp |

ENUM:

* DRAFT
* OPEN
* CLOSED

---

## audit_logs

| Field      | Type      |
| ---------- | --------- |
| id         | UUID      |
| actor      | String    |
| action     | String    |
| created_at | Timestamp |

---

# 11. Audit Log

Sistem wajib mencatat:

* Login Admin
* Login Panitia
* Approve Pemilih
* Reject Pemilih
* Buka Pemilihan
* Tutup Pemilihan
* Tambah Kandidat
* Edit Kandidat
* Hapus Kandidat

Audit log tidak boleh mencatat pilihan kandidat yang dipilih siswa.

---

# 12. Aturan Integritas Data

Voting wajib menggunakan database transaction.

Proses voting:

1. Insert ke tabel votes.
2. Update student.sudah_memilih = true.
3. Hapus session.

Jika salah satu gagal:

ROLLBACK seluruh transaksi.

---

# 13. Recovery Scenario

## Laptop Mati Sebelum Voting

Siswa dapat login kembali.

---

## Laptop Mati Saat Voting

Siswa login ulang dan melanjutkan proses.

---

## Laptop Mati Setelah Voting Berhasil

Voting kedua ditolak karena status sudah memilih.

---

## Internet Terputus

Pemungutan suara dihentikan sementara hingga koneksi kembali normal.

---

# 14. Success Criteria

## Operasional

Seluruh siswa dapat melakukan voting tanpa hambatan mayor.

## Keamanan

Tidak ada voting ganda.

## Privasi

Pilihan pemilih tidak dapat ditelusuri kembali ke identitas siswa.

## Performa

Rata-rata durasi proses voting kurang dari 90 detik.

## Biaya

Berjalan sepenuhnya menggunakan layanan Free Tier.
