# PRD / SRD / KAK — TM-7: Filter daftar tugas berdasarkan status

## Status dan sumber
- Kontrak analisis untuk implementasi dan UAT; belum merupakan bukti implementasi atau hasil tes.
- Fitur: TM-7, revisi 1, fase analysis; branch `office/tm-7/a1220d26-3cf7-49ee-acf8-5d121a78fefe`.
- Sumber: empat acceptance criteria dari `feature_current`, serta `src/taskboard.cjs` pada base SHA `75c8fa83e180a9799fe30cff294b33db3daf94b8`.
- Pembacaan vault `01_PRD_&_KAK.md` gagal ENOENT (scope fitur tidak tersedia). Dokumen lengkap ini disimpan di workspace `docs/01_PRD_&_KAK.md`; tidak mengklaim vault telah diperbarui.

## Tujuan dan aktor
Pengguna aplikasi/pemanggil API dapat mengambil subset tugas menurut status tanpa mengubah format respons dan perilaku daftar tanpa filter. Backend memvalidasi filter sebelum membaca hasil; QA menguji kontrak serta regresi; pemilik produk memberi penerimaan UAT.

## Lingkup
Termasuk validasi query status pada GET /api/tasks, filter exact-match, pengurutan id menurun, respons JSON 400 untuk status tidak sah, dan pengujian otomatis. Implementasi ditujukan ke `src/taskboard.cjs` oleh backend; dokumen ini tidak mengubah kode.
Tidak termasuk UI filter, pagination, multi-status, perubahan schema/database, autentikasi/otorisasi, perubahan POST/PATCH, deployment maupun publikasi.

## Kontrak API
### Permintaan
`GET /api/tasks` atau `GET /api/tasks?status=todo|in_progress|done` (pilih satu nilai, tanda `|` bukan bagian nilai).
- Query status opsional; jika tidak ada, ambil semua tugas.
- Jika ada, hanya string persis `todo`, `in_progress`, atau `done` yang diterima setelah decoding query URL standar. Tidak melakukan trim atau normalisasi huruf.
- Filter diterapkan sebelum hasil dikembalikan; pengurutan numerik `id DESC`, bukan menurut title/created_at.

### Sukses
HTTP 200, `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` sesuai perilaku yang ada.
Body berupa array objek tugas, bukan envelope. Field lama dipertahankan: `id`, `title`, `status`, `priority`, `created_at`. Nilai dan tipe mengikuti API lama; jangan mengubah isi field selama proses filter.
Jika tidak ada hasil, termasuk database kosong, respons `[]` dengan HTTP 200.

### Galat
HTTP 400 dan header JSON/cache yang sama untuk nilai status tidak valid.
Body kontrak yang dipilih: `{"error":"Status tidak valid"}`. Pesan mengikuti validasi status PATCH yang sudah ada; tanpa membocorkan SQL atau stack trace. Tidak mengembalikan daftar tugas pada galat.
Gunakan parameter terikat untuk nilai filter, bukan interpolasi SQL.

## Keputusan kasus tepi
Keputusan berikut mengikat kontrak implementasi yang diusulkan; detail yang tidak dinyatakan eksplisit dalam AC ditandai di bagian pertanyaan terbuka.

| Kasus | Hasil |
|---|---|
| Tanpa parameter status | 200, semua tugas, id menurun |
| status=todo / in_progress / done | 200, hanya status terkait, id menurun |
| status= atau ?status tanpa '=' | 400, nilai kosong bukan berarti tanpa filter |
| status=TODO, Done, null, all, atau nilai lain | 400, case-sensitive |
| Spasi di depan/belakang, termasuk hasil decoding %20 atau + | 400, tidak di-trim |
| status=%74odo | 200, ekuivalen todo setelah decoding URL |
| status=todo,done atau status=todo\u007cdone | 400, multi-status tidak didukung |
| Parameter status berulang | 400, termasuk dua nilai identik; hindari ambiguitas pemilihan nilai |
| Query tak dikenal tanpa status, misalnya ?foo=bar | Diabaikan, tetap semua tugas seperti perilaku lama |
| Query tak dikenal bersama satu status valid | Diabaikan; filter status tetap berlaku |
| status[]=todo tanpa parameter status persis | Query tak dikenal; semua tugas, bukan filter array |
| PATCH mengubah status tugas | GET berikutnya mencerminkan status terbaru; tugas keluar/masuk subset terkait |

## Alur pengguna / sistem
1. Pemanggil memilih semua tugas atau satu status.
2. Sistem membaca seluruh kemunculan parameter bernama persis `status`.
3. Jika tidak ada: baca semua tugas; jika lebih dari satu atau nilainya tidak valid: kirim 400 JSON.
4. Untuk tepat satu nilai valid: baca tugas dengan status itu memakai parameter terikat.
5. Urutkan id menurun dan kembalikan array JSON 200; tidak melakukan mutasi data.

## Matriks izin dan dampak
| Aktor/operasi | TM-7 |
|---|---|
| Pemanggil API / GET daftar | Dapat membaca semua tugas atau subset; tidak menambah pembatasan akses baru |
| Pemanggil API / POST dan PATCH | Perilaku dan validasi lama tetap; bukan bagian perubahan filter |
| Analyst | Mendefinisikan kontrak, bukan mengimplementasikan kode atau memberi izin publish |
| Backend | Implementasi satu file src/taskboard.cjs sesuai kontrak |
| QA | Menguji AC dan regresi; hasil harus berasal dari eksekusi nyata |

Tidak ada autentikasi dalam source dasar yang dibaca. Filter adalah pemilihan data, bukan kontrol akses atau isolasi pengguna; jangan mengklaim perlindungan data per pengguna.

## Acceptance criteria resmi
1. GET /api/tasks?status=todo|in_progress|done hanya mengembalikan tugas berstatus tersebut, urutan tetap id menurun.
2. GET /api/tasks tanpa parameter status tetap mengembalikan semua tugas.
3. Nilai status lain ditolak HTTP 400 dengan pesan galat JSON.
4. Tes otomatis mencakup AC 1–3 dan seluruh tes lama tetap lulus.

## Matriks verifikasi untuk QA
| ID | AC | Skenario dan pemeriksaan |
|---|---|---|
| T1 | 1 | Seed minimal dua tugas untuk masing-masing status dengan id berselang dan title/created_at tidak searah id. Panggil setiap status; cocokkan tepat semua id yang diharapkan, tanpa status lain, urutan numerik id menurun. |
| T2 | 1 | Filter status valid tanpa hasil dan database kosong: HTTP 200 dengan array kosong. |
| T3 | 2 | Tanpa status pada dataset campuran: semua id muncul tepat sekali, id menurun, field respons lama utuh. Uji juga database kosong. |
| T4 | 3 | Nilai asing, kosong, huruf besar, spasi, multi-status, dan status berulang: masing-masing HTTP 400, header JSON, body error sesuai kontrak; data tidak berubah. |
| T5 | 1–3 | Nilai percent-encoded yang valid diterima; query tak dikenal diabaikan; kombinasi query tak dikenal dan status valid tetap terfilter. |
| T6 | 1,4 | PATCH tugas dari todo ke done lalu baca kedua filter dan daftar tanpa filter: keanggotaan berubah benar, id tetap diurutkan menurun. |
| T7 | 4 | Jalankan seluruh tes lama, meliputi POST/default todo, prioritas, validasi title/status/JSON, PATCH, 404, batas body, dan route statis yang memang dicakup suite lama; tidak menghapus atau melemahkan assertion. |

Target pemeriksaan pilot: `node --test test/office-pilot.test.cjs` sesuai prosedur proyek. Suite tes belum dibaca atau dieksekusi pada langkah analisis ini; daftar regresi di atas merupakan kebutuhan verifikasi, bukan klaim cakupan suite aktual. QA harus mencatat hasil aktual, termasuk kegagalan, dan memastikan seluruh tes lama tetap lulus. UAT: pengguna dapat membedakan tiap subset dan kembali melihat semua tugas melalui API tanpa perubahan data.

## Pertanyaan terbuka dan asumsi
- AC tidak menentukan teks error, parameter berulang, case/trim, atau query tak dikenal. Kontrak memilih perilaku pada tabel di atas: error konsisten dengan PATCH, exact-match, duplikasi ditolak, query lain diabaikan demi kompatibilitas. Jika backend atau pemilik produk memerlukan pilihan lain, sepakati revisi kontrak sebelum UAT.
- Tidak ada kebutuhan filter UI dalam empat AC; perubahan UI memerlukan perluasan lingkup tersendiri.
- Tidak ada pemblokir analisis API dari sumber yang dibaca. Penyimpanan vault terblokir ENOENT; workspace ini menjadi artefak serah-terima sementara. Implementasi, tes otomatis, review manusia, dan publikasi masih belum dilakukan.

## Serah-terima
Kembali ke Lead-Bima untuk meneruskan implementasi `src/taskboard.cjs` kepada BE-Raka, lalu verifikasi AC 1–4 kepada QA-Tegar. Kerjakan satu file per langkah. Artefak analisis: `docs/01_PRD_&_KAK.md`.
