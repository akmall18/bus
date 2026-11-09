# Laporan Penambahan Halaman Login SmartShuttle

Tanggal: 24 Oktober 2026  
Proyek: `D:\tugasPSAS_bus\smartshuttle`  
Teknologi: HTML, CSS, dan Vanilla JavaScript tanpa backend dan tanpa build system

## 1. Ringkasan

Halaman login telah ditambahkan sebagai halaman terpisah tanpa mengubah alur atau tampilan fitur lama. Halaman dapat dibuka langsung melalui `login.html` atau dari tautan **Masuk** di footer Beranda.

Status autentikasi: **UI demo, bukan autentikasi nyata.** Tidak ada backend autentikasi, verifikasi kredensial, sesi login, cookie sesi, atau status masuk. Password tidak disimpan, tidak dikirim, dan tidak ditempatkan di URL.

## 2. File baru

| File | Fungsi |
|---|---|
| `login.html` | Halaman login dua kolom, form, visual perjalanan, dan tautan kembali |
| `css/login.css` | Seluruh styling login yang terisolasi dengan awalan `login-` |
| `js/login.js` | Validasi, toggle password, loading, pesan demo, dan preferensi ingat identifier |
| `assets/login-journey.svg` | Ilustrasi bus antarkota, jalan raya, dan pegunungan khusus login |

## 3. File lama yang disentuh

Hanya **`index.html`**, tepat satu baris pada navigasi footer:

```html
<li><a href="login.html">Masuk</a></li>
```

Alasan: menyediakan jalur navigasi menuju halaman baru tanpa mengubah header, tombol akun demo, routing hash, atau komponen lama.

Verifikasi integritas file lama: 17 dari 18 file pada bundel kode sebelumnya tetap identik; hanya `index.html` yang berubah. `css/style.css`, semua JavaScript lama, dan aset lama tidak diubah.

## 4. Integrasi yang dipertahankan

- Beranda, pencarian, hasil, detail, kursi, booking, dashboard, tracking, peta, riwayat, profil, dan pengaturan tetap memakai kode lama.
- Tombol **Akun demo** tetap membuka dashboard seperti sebelumnya.
- Halaman login bukan pengganti Beranda dan tidak memaksa pengunjung untuk masuk.
- Tidak ada fitur lama yang dikunci oleh login.
- Routing hash lama tidak diubah.
- Tidak ada library baru. Font Inter memakai sumber Google Fonts yang sama dengan halaman lama.

## 5. Desain

- Layout dua kolom pada desktop, satu kolom pada tablet dan ponsel.
- Palet mengikuti identitas lama: biru `#1264E8`, navy `#10264A`, biru muda `#EAF3FF`, putih, dan aksen oranye `#FF9F43`.
- Panel kiri memuat brand, judul “Perjalanan Impian Dimulai di Sini”, deskripsi, tiga keunggulan, dan ilustrasi perjalanan.
- Kartu kanan memuat judul “Selamat Datang Kembali”, deskripsi, input email/username, password, toggle password, “Ingat saya”, tombol Masuk, pemisah “atau”, dan tautan daftar.
- CSS login terisolasi; tidak ada selector global halaman lama yang diubah.
- Tidak ada ID yang bertabrakan dengan halaman lama.

## 6. Perilaku form

- Email/username dan password wajib diisi.
- Kesalahan tampil inline dengan `role="alert"`, `aria-invalid`, dan `aria-describedby`.
- Fokus berpindah ke input pertama yang tidak valid.
- Tombol menampilkan status “Memeriksa...” dan dinonaktifkan selama proses untuk mencegah pengiriman ganda.
- Setelah validasi, halaman menampilkan pesan bahwa autentikasi belum terhubung dan tidak ada sesi yang dibuat. Pesan ini tidak disebut sebagai login berhasil.
- Toggle password mengubah tipe input dan label aksesibilitas antara “Tampilkan password” dan “Sembunyikan password”.
- **Ingat saya** hanya menyimpan email/username pada key `smartshuttle.login.identifier.v1` di LocalStorage bila dicentang. Password tidak disimpan. Menghapus centang akan menghapus identifier tersimpan.
- Skip link, navigasi Tab, Enter, Escape, dan fokus programatik diuji.
- Tidak ada tombol Google karena autentikasi Google tidak dikonfigurasi.
- Tidak ada tautan “Lupa password?” karena pemulihan password belum tersedia.
- “Daftar sekarang” berupa tombol pemberitahuan, bukan tautan mati; menampilkan pesan bahwa pendaftaran belum tersedia.

## 7. Hasil pengujian

### Pengujian login

**88/88 lulus** menggunakan Chrome headless melalui CDP.

Cakupan:
- Judul halaman dan teks utama.
- Gambar login berhasil dimuat.
- Hanya CSS login yang dimuat; `style.css` lama tidak dimuat di halaman login.
- Tidak ada ID ganda.
- Label, autocomplete, dan nama aksesibel.
- Layout dua kolom desktop dan satu kolom tablet/ponsel.
- Validasi kosong, validasi password saja, fokus error, dan pembersihan error.
- Toggle password serta ikon mata tunggal.
- Pemberitahuan pendaftaran.
- Status loading dan pencegahan klik ganda.
- Pesan demo tidak mengklaim login berhasil.
- Identifier tersimpan hanya saat dicentang; password tidak tersimpan.
- Identifier terisi kembali setelah reload.
- Tidak ada overflow horizontal pada 320, 390, 768, 1024, 1280, dan 1440 px.
- Tinggi input dan tombol minimal 48 px pada semua viewport.
- Skip link memindahkan fokus ke area form.
- Tautan footer membuka halaman login dan tombol akun lama tetap ada.
- Tidak ada error runtime JavaScript.

### Regresi halaman lama

| Rangkaian | Hasil |
|---|---:|
| Dashboard | 42/42 |
| Booking | 32/32 |
| Tracking | 36/36 |
| Pencarian | 36/36 |
| Pemilihan kursi | 41/41 |
| QA integrasi lama | 115/115 |
| **Total regresi** | **302/302** |

**Total seluruh pemeriksaan: 390/390 lulus.**

Catatan: pengujian pencarian lama tetap mencatat `ERR_FILE_NOT_FOUND` untuk `assets/missing-image.svg`. Itu adalah fixture yang sengaja dipakai untuk menguji fallback gambar, bukan kerusakan baru.

### Screenshot yang diperiksa

- `smartshuttle-login-1440.png`
- `smartshuttle-login-1024.png`
- `smartshuttle-login-768.png`
- `smartshuttle-login-390.png`
- `smartshuttle-login-320.png`
- `smartshuttle-login-390-state.png`

Saat inspeksi visual ditemukan dua ikon mata tampil bersamaan. Penyebabnya adalah aturan `display` dasar SVG yang lebih spesifik. Perbaikan dilakukan di `login.css`, lalu seluruh pengujian login dijalankan ulang dan lulus 88/88.

## 8. Cara membuka

1. Buka `D:\tugasPSAS_bus\smartshuttle\index.html` di Chrome melalui Live Server atau langsung.
2. Gulir ke footer dan klik **Masuk**.
3. Alternatif langsung: buka `D:\tugasPSAS_bus\smartshuttle\login.html`.
4. Klik **Kembali ke beranda** untuk kembali ke aplikasi lama.

## 9. Batasan

- Belum ada autentikasi nyata, server, sesi, cookie, atau otorisasi.
- Halaman tidak boleh dianggap aman untuk produksi.
- Pendaftaran, pemulihan password, verifikasi email, dan Google Sign-In belum tersedia.
- “Ingat saya” hanya mengisi ulang identifier, bukan mempertahankan sesi.
- Pengujian dilakukan pada Chrome headless. Firefox, Safari, pembaca layar fisik, perangkat sentuh fisik, dan zoom browser 200% belum diuji manual.
- Integrasi backend memerlukan endpoint autentikasi, pengelolaan sesi server, proteksi CSRF, rate limiting, dan kebijakan cookie yang sesuai.

## 10. Checklist

| Area | Status |
|---|---|
| Halaman login dapat dibuka | Lulus |
| Navigasi footer menuju login | Lulus |
| Beranda dan fitur lama tetap berjalan | Lulus |
| Pencarian, booking, kursi, dashboard, tracking | Lulus |
| Validasi dan fokus error | Lulus |
| Toggle password | Lulus |
| Loading dan pencegahan submit ganda | Lulus |
| Password tidak disimpan | Lulus |
| Tidak ada klaim autentikasi palsu | Lulus |
| Responsif 320–1440 px | Lulus |
| Tidak ada overflow horizontal | Lulus |
| Tidak ada error runtime baru | Lulus |
| Aset gambar login | Lulus |
| Autentikasi nyata | Belum Diuji / belum tersedia |
| Pembaca layar fisik | Belum Diuji |
| Firefox dan Safari | Belum Diuji |
| Perangkat sentuh fisik | Belum Diuji |
| Zoom browser 200% | Belum Diuji |

**Perlu Perbaikan:** tidak ada temuan otomatis yang tersisa pada cakupan di atas.

## 11. Kode lengkap

Bundel kode lengkap terbaru tersedia di `KODE-LENGKAP-FINAL.md` dan mencakup seluruh file aplikasi lama beserta empat file login baru.
