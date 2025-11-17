# Bot WhatsApp

Bot WhatsApp modular yang dibangun dengan whatsapp-web.js dengan struktur workspace yang bersih dan dinamis dengan pemisahan command dan event handler.

## Struktur Proyek

```
whatsapp-bot/
├── config.json        # Konfigurasi bot (prefix, dll)
├── index.js           # File utama bot dengan dynamic loaders
├── commands/          # File perintah (setiap perintah dalam file terpisah)
│   ├── ping.js       # Cek responsivitas bot
│   ├── help.js       # Tampilkan semua perintah
│   └── info.js       # Dapatkan info bot dan chat
├── events/            # File event handler
│   ├── ready.js      # Event bot siap
│   ├── qr.js         # Event tampilkan QR code
│   └── message.js    # Handler pesan dan router perintah
└── utils/             # Fungsi utilitas (untuk penggunaan masa depan)
```

## Fitur

- **Dynamic Command Loading**: Otomatis memuat semua perintah dari folder `commands/`
- **Modular Event System**: Setiap event dalam file terpisah di folder `events/`
- **Clean Architecture**: Mudah menambah perintah dan event baru
- **Configurable**: Prefix dan pengaturan lain dapat dikonfigurasi via `config.json`
- **Dukungan API**: Siap untuk integrasi dengan Gemini API dan layanan lainnya

## Memulai

1. **Jalankan bot**:
   ```bash
   npm start
   ```

2. **Pindai kode QR** dengan aplikasi WhatsApp di ponsel Anda:
   - Buka WhatsApp di ponsel
   - Pergi ke Pengaturan > Perangkat Tertaut
   - Ketuk "Tautkan Perangkat"
   - Pindai kode QR yang ditampilkan di konsol

3. **Uji bot** dengan mengirim pesan:
   ```
   .ping
   .help
   .info
   ```

## Konfigurasi

Edit file `config.json` untuk mengubah pengaturan bot:

```json
{
  "prefix": ".",
  "botName": "WhatsApp Bot",
  "language": "id",
  "features": {
    "enableLogging": true,
    "enableGemini": false
  }
}
```

### Pengaturan API Key

Untuk API key seperti `GEMINI_API_KEY`, gunakan environment variables untuk keamanan:

1. Klik tab "Secrets" di sidebar Replit
2. Tambahkan secret baru dengan nama `GEMINI_API_KEY`
3. Masukkan API key Anda
4. Bot akan otomatis membaca dari environment variable

**Jangan pernah menyimpan API key di config.json atau commit ke repository!**

## Menambah Perintah Baru

Buat file baru di folder `commands/`:

```javascript
// commands/contoh.js
export default {
  name: 'contoh',
  description: 'Deskripsi perintah contoh',
  usage: '.contoh [argumen]',
  async execute(message, args, bot) {
    // Logika perintah Anda di sini
    await message.reply('Ini adalah perintah contoh!');
  }
};
```

Perintah akan otomatis dimuat saat bot dimulai.

## Menambah Event Baru

Buat file baru di folder `events/`:

```javascript
// events/contoh.js
export default {
  name: 'nama_event',
  once: false, // Set true jika event hanya dipicu sekali
  execute(bot, ...args) {
    // Logika event Anda di sini
    console.log('Event dipicu!');
  }
};
```

## Perintah yang Tersedia

- **.ping** - Cek apakah bot responsif dan lihat latensi
- **.help** - Tampilkan semua perintah atau bantuan untuk perintah tertentu
- **.info** - Dapatkan informasi tentang bot dan chat saat ini

## Catatan

- Bot menggunakan strategi `LocalAuth`, jadi autentikasi bertahan antar restart
- Data sesi disimpan di folder `.wwebjs_auth/`
- Bot berjalan di workflow console untuk output

## Keamanan

- **Jangan** simpan API key di file konfigurasi
- **Gunakan** environment variables atau Replit Secrets untuk API key
- **Jangan** commit file `.env` atau credentials ke repository
- File `.gitignore` sudah dikonfigurasi untuk melindungi data sensitif
