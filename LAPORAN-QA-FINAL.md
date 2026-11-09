# Laporan QA Final SmartShuttle

Tanggal pemeriksaan: 24 Oktober 2026  
Lokasi proyek: `D:\tugasPSAS_bus\smartshuttle`  
Jenis aplikasi: demo front-end statis, tanpa backend dan tanpa proses build

> Catatan pembaruan 24 Oktober 2026: halaman login ditambahkan setelah laporan ini dibuat. Dokumen ini adalah snapshot QA sebelum login. Hasil login dan regresi terbaru ada di `LAPORAN-LOGIN.md`, sedangkan `KODE-LENGKAP-FINAL.md` sudah mencakup 22 file termasuk halaman login.

## 1. Status akhir

**Lulus untuk demo lokal.**

Seluruh alur utama berjalan di browser nyata melalui pengujian otomatis headless Chrome/CDP. Tidak ada error runtime yang tidak terduga, tidak ada overflow horizontal pada viewport yang diuji, tidak ada ID ganda, dan tidak ada tautan internal atau referensi aset lokal yang rusak.

Total pemeriksaan otomatis final: **302/302 lulus**.

| Rangkaian pengujian | Hasil |
|---|---:|
| Dashboard dan tiket | 42/42 |
| Booking dan validasi | 32/32 |
| Tracking dan simulasi | 36/36 |
| Pencarian, filter, dan sort | 36/36 |
| Pemilihan kursi | 41/41 |
| QA lintas viewport dan integrasi | 115/115 |
| **Total** | **302/302** |

Catatan: rangkaian pencarian sengaja memuat gambar yang tidak ada untuk menguji fallback. Log `ERR_FILE_NOT_FOUND` untuk `assets/missing-image.svg` pada pengujian tersebut adalah hasil yang diharapkan, bukan kegagalan aplikasi.

## 2. Cakupan pengujian

### Viewport
- 320 px
- 390 px
- 768 px
- 1024 px
- 1280 px
- 1440 px

Halaman inti diuji pada semua viewport: beranda, hasil, detail bus, booking, tentang, dashboard, dan tracking. Tiket dashboard diuji khusus pada 320 px dan 390 px.

### Alur integrasi
1. Reset data demo.
2. Cari rute Jakarta → Bandung, tanggal besok, 2 penumpang.
3. Urutkan hasil berdasarkan durasi terpendek.
4. Buka detail bus.
5. Pilih 2 kursi.
6. Isi 2 data penumpang, kontak, e-wallet demo, dan persetujuan.
7. Kirim booking.
8. Buka dashboard dan tiket.
9. Lacak kode booking.
10. Jalankan simulasi 4×, jeda, dan reset.
11. Reload halaman dan pastikan booking tetap ada.
12. Uji notifikasi, profil, pengaturan, dialog reset, storage rusak, dan migrasi data lama.

### Pemeriksaan data
- Total detail = subtotal + biaya layanan.
- Total booking = total detail.
- Total tiket sukses = total dashboard = total tersimpan.
- `busId`, `scheduleId`, tanggal, kursi, penumpang, dan metode pembayaran konsisten.
- Simulasi tracking tidak mengubah booking atau status pembayaran.
- Booking dan notifikasi bertahan setelah reload.
- Data LocalStorage rusak tidak membuat dashboard atau tiket crash.
- Kode booking duplikat dibaca satu kali.
- Migrasi `smartshuttle.bookings.v1` dan `smartshuttle.profile.v1` berjalan dan membersihkan key lama.
- Nama penumpang berisi HTML di-escape pada halaman sukses dan tiket dashboard.
- Tidak ada QR palsu.

### Aksesibilitas otomatis
- Skip link dapat dicapai dengan Tab dan memindahkan fokus ke `main`.
- Semua kontrol yang terlihat memiliki nama aksesibel.
- Semua gambar memiliki atribut `alt`.
- Semua referensi `aria-controls`, `aria-labelledby`, dan `aria-describedby` valid.
- Semua ID unik.
- Judul halaman berubah sesuai rute.
- Error profil dan tracking memakai `role="alert"`, `aria-invalid`, dan `aria-describedby`.
- Dialog reset dapat ditutup dengan Escape tanpa menghapus data.
- Menu mobile dapat dibuka, ditutup dengan Escape, dan fokus kembali ke tombol menu.
- Perpindahan rute tidak lagi menampilkan outline fokus di sekitar heading non-interaktif.

## 3. Perbaikan penting yang dilakukan

1. Teks footer “Pencarian bus menyusul” diganti menjadi “Pencarian dan filter bus demo”.
2. Rumus harga disatukan melalui `SmartShuttleData.calculatePrice()` dan dipakai oleh detail serta booking.
3. Hash bus yang rusak tidak lagi memicu error `decodeURIComponent`.
4. Breakpoint menu JavaScript diselaraskan dengan CSS pada 960/961 px.
5. `readRaw()` memakai memori cadangan secara aman; penulisan LocalStorage yang berhasil membersihkan memori lama.
6. Booking ganda dengan kode sama dibaca satu kali.
7. Validasi profil dan tracking memakai status error aksesibel.
8. Render dashboard ganda setelah simpan profil/pengaturan dihapus.
9. Aksi tiket dashboard ditumpuk pada layar sempit agar tidak overflow.
10. Outline fokus pada heading non-interaktif setelah perpindahan rute dihilangkan tanpa menghapus fokus programatik untuk pembaca layar.
11. Kode modal akun lama yang tidak terpakai dihapus.

## 4. File final dan kode lengkap

Kode lengkap seluruh file aplikasi tersedia di:

`D:\tugasPSAS_bus\smartshuttle\KODE-LENGKAP-FINAL.md`

File sumber final:

```text
smartshuttle/
├── index.html
├── LAPORAN-QA-FINAL.md
├── KODE-LENGKAP-FINAL.md
├── assets/
│   ├── README.txt
│   ├── bus-agra-mas.svg
│   ├── bus-hero.svg
│   ├── bus-nusantara-express.svg
│   ├── bus-rosalia-indah.svg
│   ├── bus-sinar-jaya.svg
│   └── favicon.svg
├── css/
│   └── style.css
└── js/
    ├── app.js
    ├── booking.js
    ├── dashboard.js
    ├── data.js
    ├── notifications.js
    ├── seat-map.js
    ├── storage.js
    ├── tracking-data.js
    └── tracking.js
```

## 5. Cara menjalankan di VS Code

1. Buka folder `D:\tugasPSAS_bus\smartshuttle` di VS Code.
2. Buka `index.html`.
3. Pilih **Open with Live Server** bila ekstensi Live Server tersedia.
4. Alternatif tanpa ekstensi: klik dua kali `index.html` atau buka langsung di Chrome.
5. Gunakan Chrome terbaru. Koneksi internet diperlukan untuk ubin peta Leaflet/OpenStreetMap; bila CDN tidak tersedia, aplikasi otomatis memakai peta SVG fallback.
6. Untuk memulai dari keadaan bersih: **Dashboard → Pengaturan → Hapus Data Demo**.
7. Tidak perlu `npm install`, server backend, atau konfigurasi lingkungan.

## 6. Alur uji manual singkat

1. Di beranda pilih Jakarta, Bandung, tanggal besok, dan 2 penumpang.
2. Klik **Cari Bus**, ubah urutan menjadi durasi terpendek, lalu buka detail.
3. Pilih dua kursi, periksa total, lalu lanjut ke booking.
4. Isi dua nama penumpang, nomor telepon, email, e-wallet demo, dan centang persetujuan.
5. Kirim booking dan catat kode tiket.
6. Buka dashboard, lihat detail tiket, lalu coba tombol cetak.
7. Lacak kode booking, jalankan simulasi, coba 4×, jeda, lanjutkan, dan reset.
8. Buka notifikasi dashboard.
9. Ubah profil dan pengaturan.
10. Muat ulang browser dan pastikan data tetap ada.
11. Uji **Hapus Data Demo** dan pastikan data kembali ke kondisi awal.
12. Ulangi pemeriksaan utama pada lebar 320 px dan 390 px.

## 7. Batasan yang disengaja

- Tidak ada backend, autentikasi, reservasi nyata, pembayaran nyata, GPS, push notification, atau sinkronisasi antarperangkat.
- Data bus, operator, jadwal, harga, terminal, dan posisi bus adalah simulasi.
- Semua data pengguna tersimpan di LocalStorage browser dan hanya untuk origin yang sedang dipakai.
- Notifikasi maksimal 60 entri dan hanya dibuat oleh interaksi di aplikasi.
- Peta memakai Leaflet/OpenStreetMap dari CDN. Tanpa internet, peta SVG fallback tetap berfungsi tetapi bukan peta jalan nyata.
- Tombol cetak memanggil dialog cetak browser; hasil dialog dan pengaturan printer bergantung pada perangkat.
- Aplikasi diuji otomatis di Chrome headless. Firefox, Safari, pembaca layar fisik, perangkat sentuh fisik, dan zoom browser 200% belum diuji manual.

## 8. Checklist final

| Area | Status |
|---|---|
| Struktur file dan aset lokal | Lulus |
| Navigasi dan judul halaman | Lulus |
| Pencarian, filter, reset filter, sort | Lulus |
| Detail bus dan fasilitas | Lulus |
| Pemilihan kursi dan keyboard kursi | Lulus |
| Booking, validasi, dan data penumpang | Lulus |
| Perhitungan harga konsisten | Lulus |
| Dashboard ringkasan dan pesanan | Lulus |
| Tiket, print CSS, dan pemicu cetak | Lulus |
| Notifikasi persisten | Lulus |
| Profil dan pengaturan | Lulus |
| Tracking, simulasi, jeda, reset | Lulus |
| Peta Leaflet dan fallback SVG | Lulus |
| LocalStorage, data rusak, migrasi | Lulus |
| Responsif 320–1440 px | Lulus |
| Aksesibilitas otomatis dan keyboard | Lulus |
| Error runtime | Lulus |
| Dialog cetak nyata di perangkat | Belum Diuji |
| Pembaca layar fisik | Belum Diuji |
| Firefox/Safari | Belum Diuji |
| Perangkat sentuh fisik | Belum Diuji |
| Zoom browser 200% | Belum Diuji |

Tidak ada item **Perlu Perbaikan** yang tersisa dari cakupan otomatis. Item **Belum Diuji** di atas memerlukan lingkungan atau perangkat tambahan dan bukan kegagalan yang ditemukan.

## 9. Arsitektur singkat

- **`index.html`**: satu halaman dengan section per rute, aset SVG inline sprite, form, dashboard, dialog, dan pemuatan skrip berurutan.
- **`app.js`**: hash router, pencarian, detail, state pencarian di `sessionStorage`, menu mobile, skip link, dan orkestrasi halaman.
- **`data.js`**: data demo, format tanggal/uang, dan kalkulasi harga terpusat.
- **`storage.js`**: abstraksi LocalStorage dengan fallback memori, normalisasi, deduplikasi, migrasi, event perubahan, dan reset.
- **`notifications.js`**: toast, dialog, dan notifikasi persisten.
- **`seat-map.js`**: render kursi yang dapat dipakai ulang serta status kursi.
- **`booking.js`**: state pemesanan, validasi, pembuatan tiket, dan penyimpanan.
- **`tracking-data.js`**: rute simulasi, jadwal, dan interpolasi posisi.
- **`tracking.js`**: pencarian kode, peta Leaflet/fallback SVG, timer simulasi, ETA, progres, dan notifikasi perjalanan.
- **`dashboard.js`**: ringkasan, pesanan, tiket, pelacakan, notifikasi, profil, pengaturan, dan reset.
- **Event kustom**: `smartshuttle:bookingschange`, `smartshuttle:notificationschange`, `smartshuttle:profilechange`, `smartshuttle:settingschange`, `smartshuttle:sectionchange`.

## 10. Perintah pengujian yang dipakai

```powershell
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-dashboard-test.js
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-booking-test.js
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-tracking-test.js
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-search-test.js
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-seat-test.js
node C:\Users\LOQ\AppData\Local\Temp\opencode\smartshuttle-qa-test.js
```

Pemeriksaan sintaks JavaScript:

```powershell
Get-ChildItem D:\tugasPSAS_bus\smartshuttle\js -Filter *.js |
  ForEach-Object { node --check $_.FullName }
```
