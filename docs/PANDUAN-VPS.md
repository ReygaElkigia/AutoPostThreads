# Panduan Pasang di VPS

Dengan VPS, AutoPostThreads berjalan 24 jam tanpa harus menyalakan laptop. Panduan ini memakai **Ubuntu 24.04** (22.04 juga bisa), dengan perintah yang diketik dari **PowerShell di Windows**. Waktu yang dibutuhkan sekitar 30 menit.

## Yang dibutuhkan

- **VPS Ubuntu 24.04 LTS**: minimal 1 vCPU, 1 GB RAM (plus swap, lihat langkah 2), dan 20 GB disk. 2 GB RAM lebih nyaman. Pilih lokasi Singapura atau Jakarta supaya dekat.
- **Alamat IP publik VPS**, plus **username dan password** (atau file SSH key) untuk login.
- **Token Threads** dan **API key Claude**, sama seperti di [README](../README.md#langkah-1--siapkan-akses-threads-api).
- Opsional: **domain**, kalau ingin membuka n8n lewat `https://` dari HP (lihat langkah 5).

Di panduan ini:
- `IP_VPS` artinya alamat IP publik VPS-mu, misalnya `203.0.113.5`.
- `NAMAUSER` artinya username untuk login. Di IDCloudHost, ini username yang kamu isi saat membuat VM. Penyedia lain kadang langsung memberi `root`.

### Memakai IDCloudHost?

Buat VM di [console.idcloudhost.com](https://console.idcloudhost.com) → **Virtual Machine** → buat VM baru, dengan pengaturan:

| Pilihan | Isi |
| --- | --- |
| Lokasi | Yang terdekat, misalnya Jakarta |
| OS | **Ubuntu 24.04 LTS** (pilih OS biasa, bukan template aplikasi) |
| Ukuran | Minimal 1 vCPU, 2 GB RAM, 20 GB disk |
| Username / Password | Buat sendiri, misalnya `autopost`, dengan password yang kuat. Ini dipakai untuk login (`NAMAUSER`). |
| SSH key | Boleh dikosongkan |
| Resource name | Bebas, misalnya `autopost-threads` |
| Public IPv4 | **Wajib dicentang** (*Create a public IPv4 address*). Tanpa ini, VM tidak bisa diakses dari internet. |

Setelah VM selesai dibuat, buka detail VM dan catat **Public IP**-nya.

Di IDCloudHost, login SSH dengan `root` dimatikan secara bawaan, jadi kamu masuk dengan `NAMAUSER` lalu pindah ke root (langkah 1). Kalau SSH dari PowerShell gagal, console IDCloudHost punya akses SSH lewat browser.

## 1. Masuk ke VPS

Buka PowerShell di Windows, lalu jalankan:

```powershell
ssh NAMAUSER@IP_VPS
```

Ketik `yes` kalau ditanya soal *fingerprint*, lalu masukkan password. Saat mengetik password, huruf memang tidak muncul di layar.

Setelah masuk, pindah ke akun root. Masukkan password `NAMAUSER` sekali lagi kalau diminta:

```bash
sudo -i
```

Tampilan berubah menjadi seperti `root@nama-vps:~#`. Semua perintah di VPS pada panduan ini diketik di sini, sebagai root.

> Kalau penyedia VPS memberi file SSH key, pakai: `ssh -i C:\lokasi\file-key NAMAUSER@IP_VPS`

## 2. Siapkan server (sekali saja)

Perbarui sistem dan pasang git:

```bash
apt update && apt upgrade -y
apt install -y git
```

Tambahkan **swap** 2 GB, supaya n8n tidak kehabisan memori di VPS kecil. Lewati langkah ini kalau `swapon --show` sudah menampilkan swap.

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Nyalakan **firewall**. Hanya SSH dan web (80/443) yang dibuka:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable
```

> Beberapa penyedia VPS, termasuk IDCloudHost, juga punya firewall sendiri di dashboard (sering disebut *Firewall* atau *Security Group*). Kalau VM-mu memakai firewall dari dashboard, tambahkan aturan **inbound TCP** untuk port 22, 80, dan 443 di sana.

Pasang **Docker**:

```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## 3. Ambil programnya

```bash
cd /opt
git clone https://github.com/ReygaElkigia/AutoPostThreads.git
cd AutoPostThreads
```

Kalau repo-nya **private**, git akan meminta username dan password. Isi password dengan **Personal Access Token** GitHub, bukan password akun. Token dibuat di GitHub: **Settings → Developer settings → Personal access tokens**, dengan akses baca ke repo ini.

Cara lain tanpa git: kirim folder dari Windows. Jalankan perintah ini di **PowerShell Windows** (bukan di VPS):

```powershell
scp -r C:\AutoPostThreads NAMAUSER@IP_VPS:~/
```

Lalu di VPS (sebagai root), pindahkan ke `/opt`:

```bash
mv /home/NAMAUSER/AutoPostThreads /opt/ && cd /opt/AutoPostThreads
```

## 4. Isi pengaturan

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Cara memakai `nano`:
- Pindah baris dengan tombol panah.
- Tempel teks dengan **klik kanan** di jendela PowerShell.
- Simpan dengan **Ctrl+O** lalu **Enter**, keluar dengan **Ctrl+X**.

Isi minimal:

```
THREADS_ACCESS_TOKEN=token_threads_kamu
ANTHROPIC_API_KEY=api_key_claude_kamu
WEBHOOK_SECRET=teks-acak-bebas-yang-panjang
```

Biarkan `DRY_RUN=true` dulu untuk uji coba. Jam posting mengikuti `GENERIC_TIMEZONE` (default `Asia/Jakarta`), apa pun zona waktu server-nya.

## 5. Pilih cara membuka n8n

n8n hanya bisa diakses dari dalam VPS itu sendiri, supaya tidak ada orang lain yang bisa membukanya lewat `http://IP_VPS:5678`. Untuk membuka tampilan n8n dari laptop, pilih salah satu cara:

| | **A. SSH tunnel** | **B. HTTPS dengan domain** |
| --- | --- | --- |
| Butuh domain | Tidak | Ya (atau alamat gratis `sslip.io`) |
| Buka n8n dari | Laptop yang menjalankan perintah tunnel | Browser mana saja, termasuk HP |
| Webhook manual dari luar | Tidak bisa | Bisa |
| Link "Lihat di n8n" di Telegram | Tidak bisa diklik | Bisa diklik |
| Posting terjadwal, Telegram, Sheets, gambar | Jalan | Jalan |

Kalau ragu, mulai dari **A**. Kamu bisa pindah ke B kapan saja.

### A. SSH tunnel (tanpa domain)

1. Di VPS, jalankan n8n:

   ```bash
   docker compose up -d
   ```

2. Di **Windows**, buka jendela PowerShell **baru**:

   ```powershell
   ssh -N -L 5678:localhost:5678 NAMAUSER@IP_VPS
   ```

   Setelah password dimasukkan, jendela ini akan terlihat diam. Itu normal; biarkan terbuka selama kamu memakai n8n.
3. Buka **http://localhost:5678** di browser Windows.

Kalau n8n juga sedang jalan di Docker Desktop Windows, matikan dulu (`docker compose down` di folder Windows), atau pakai `-L 5679:localhost:5678` lalu buka `http://localhost:5679`.

### B. HTTPS dengan domain

1. **Siapkan alamatnya.** Pilih salah satu:
   - **Punya domain:** di pengaturan DNS domainmu, buat record **A** `n8n` yang mengarah ke `IP_VPS`. Hasilnya `n8n.domainkamu.com`. Tunggu beberapa menit sampai aktif. (Domain yang dibeli di IDCloudHost diatur DNS-nya dari member area IDCloudHost.)
   - **Tanpa domain:** pakai layanan gratis [sslip.io](https://sslip.io). Tulis IP dengan tanda minus, tidak perlu daftar. Contoh: IP `203.0.113.5` → `n8n.203-0-113-5.sslip.io`.
2. Buka `nano .env`, lalu isi `N8N_DOMAIN` dan hapus tanda `#` di depan baris `COMPOSE_FILE`:

   ```
   N8N_DOMAIN=n8n.domainkamu.com
   COMPOSE_FILE=docker-compose.yml:docker-compose.https.yml
   ```

3. Jalankan:

   ```bash
   docker compose up -d
   ```

   Selain n8n, perintah ini menyalakan **Caddy**. Caddy otomatis membuat dan memperpanjang sertifikat HTTPS dari Let's Encrypt.
4. Tunggu sekitar satu menit, lalu buka **https://n8n.domainkamu.com**.

Kalau halaman tidak terbuka atau browser menyebut sertifikat tidak aman, lihat lognya dengan `docker compose logs caddy`. Penyebab paling umum: DNS belum mengarah ke IP VPS, atau port 80/443 masih tertutup di firewall penyedia VPS. Kalau `sslip.io` gagal karena batas jumlah sertifikat Let's Encrypt, pakai domain sendiri atau subdomain gratis dari [DuckDNS](https://www.duckdns.org).

Karena n8n sekarang bisa dibuka dari internet, pakai **password owner yang kuat** dan aktifkan **verifikasi 2 langkah (2FA)** di pengaturan akun n8n.

## 6. Buat akun, masukkan workflow, uji coba

1. Buka n8n (lewat cara A atau B) dan buat akun owner.
2. Di VPS, masukkan workflow dan cek token Threads:

   ```bash
   docker compose exec n8n n8n import:workflow --input=/workflows/threads-autopost.json
   docker compose exec n8n node /scripts/threads-token.js cek
   ```

3. Di n8n, refresh halaman, buka **Threads AutoPost - Cerita AI**, lalu klik **Publish**.
4. Klik **Execute workflow** (pilih **Tes Manual** kalau diminta), lalu buka node **Pratinjau (Dry Run)** untuk membaca ceritanya.

> Setelah `docker compose up -d` atau restart, tunggu sekitar 30 detik sebelum memakai webhook. n8n butuh waktu untuk mengaktifkan workflow.

## 7. Mulai posting sungguhan

```bash
nano .env          # ubah DRY_RUN=false
docker compose up -d
```

Selesai. Program sekarang posting otomatis sesuai `POST_CRON` selama VPS menyala, dan otomatis jalan lagi setelah VPS di-restart. Karena n8n tidak kamu buka setiap hari, sebaiknya aktifkan [notifikasi Telegram](../README.md#notifikasi-telegram-opsional) supaya langsung tahu kalau ada error.

## Perawatan

Setiap kali masuk lagi ke VPS:

```powershell
ssh NAMAUSER@IP_VPS
```

```bash
sudo -i
cd /opt/AutoPostThreads
```

Semua perintah di bawah dijalankan dari folder itu.

| Keperluan | Perintah |
| --- | --- |
| Cek apakah jalan | `docker compose ps` |
| Lihat log | `docker compose logs -f n8n` (keluar: Ctrl+C) |
| Ubah pengaturan | `nano .env` lalu `docker compose up -d` |
| Restart | `docker compose restart` |
| Matikan | `docker compose down` |

**Update program** ke versi terbaru:

```bash
git pull
docker compose up -d
docker compose exec n8n n8n import:workflow --input=/workflows/threads-autopost.json
```

Setelah itu buka workflow di n8n dan klik **Publish** lagi. Perubahan yang kamu buat sendiri di editor n8n akan tertimpa.

**Backup** data n8n (akun, workflow, token hasil perpanjangan otomatis, riwayat cerita):

```bash
docker compose stop n8n
docker run --rm -v autopostthreads_n8n_data:/data -v /root:/backup alpine tar czf /backup/n8n-backup-$(date +%F).tgz -C /data .
docker compose start n8n
```

Nama volume mengikuti nama folder (`autopostthreads_n8n_data` untuk folder `AutoPostThreads`); cek dengan `docker volume ls`.

Untuk menyalin backup ke Windows, salin dulu ke folder `NAMAUSER` (di VPS, sebagai root):

```bash
cp /root/n8n-backup-*.tgz /home/NAMAUSER/ && chown NAMAUSER /home/NAMAUSER/n8n-backup-*.tgz
```

Lalu di PowerShell Windows:

```powershell
scp NAMAUSER@IP_VPS:~/n8n-backup-*.tgz .
```

File backup berisi data rahasia (akun n8n dan token), jadi simpan baik-baik.

## Masalah yang sering muncul

| Gejala | Solusi |
| --- | --- |
| `ssh: connect to host ... Connection timed out` | IP salah, VM belum punya public IPv4, atau port 22 ditutup firewall penyedia VPS. |
| `Permission denied (password)` saat `ssh root@...` | Login root dimatikan (bawaan IDCloudHost). Login dengan `NAMAUSER`, lalu `sudo -i`. |
| `Permission denied (publickey)` | VPS hanya menerima SSH key. Pakai `ssh -i C:\lokasi\file-key NAMAUSER@IP_VPS`. |
| `required variable N8N_DOMAIN is missing a value` | Baris `COMPOSE_FILE` aktif tapi `N8N_DOMAIN` kosong. Isi domainnya, atau beri `#` lagi di depan `COMPOSE_FILE`. |
| Cara B: halaman tidak terbuka / sertifikat gagal | Cek `docker compose logs caddy`. Pastikan DNS sudah mengarah ke IP VPS dan port 80/443 terbuka. |
| Cara A: `localhost:5678` tidak terbuka di Windows | Jendela `ssh -N -L ...` harus tetap terbuka, dan n8n harus jalan (`docker compose ps` di VPS). |
| Webhook membalas `404 ... not registered` | Workflow belum di-**Publish**, atau n8n baru restart (tunggu 30 detik). |
| n8n sering mati sendiri / sangat lambat | Kemungkinan kehabisan RAM. Pastikan swap aktif (`swapon --show`) atau naikkan RAM VPS. |

## Catatan keamanan

- Jangan membuka port `5678` di firewall. n8n sengaja hanya mendengarkan di `127.0.0.1`, karena port yang dibuka Docker tidak ikut tertutup oleh `ufw`.
- File `.env` berisi semua kunci rahasia. `chmod 600 .env` membuatnya hanya bisa dibaca root.
- Rutin jalankan `apt update && apt upgrade -y` untuk pembaruan keamanan server.
