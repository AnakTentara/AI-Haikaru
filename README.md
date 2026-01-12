# 🤖 AI-Haikaru (Next-Gen Gemini Agent)

**AI-Haikaru** adalah bot WhatsApp canggih yang ditenagai sepenuhnya oleh **Google Gemini**. Bot ini dirancang untuk menjadi asisten pribadi yang cerdas, memiliki memori jangka panjang, dan mampu menangani tugas berat tanpa biaya mahal (menggunakan strategi rotasi API Key yang cerdas).

## ✨ Sorotan Utama (Highlight)

### 🧠 Arsitektur "Dual-Pool" AI

Sistem ini tidak lagi menggunakan OpenAI. Sebagai gantinya, ia menggunakan **45 API Key Gemini** yang dibagi menjadi dua kolam (pools):

* **Main Pool (Key 1-40):** Menangani percakapan utama, coding, analisis audio, dan tugas berat.
* **Helper Pool (Key 41-45):** Khusus menangani tugas latar belakang seperti **Reaksi Emoji Otomatis**, **Google Search Summary**, dan **Pesan Singkat**.
* *Hasil:* Bot sangat tangguh terhadap *Rate Limit* (Error 429) dan reaksi emoji tidak memakan kuota chat utama.

### 🕒 Context & Time Awareness

Haikaru kini sadar waktu dan identitas lawan bicara secara presisi.

* **Metadata Input:** Pesan diproses dengan format `[JAM, TANGGAL] [Nama] [Nomor] : Pesan`.
* **Smart Tagging:** Bot bisa me-mention user dengan aman menggunakan format internal `@628xxx` yang dikonversi otomatis oleh WA.

---

## 📋 Daftar Fitur Lengkap

### 💬 Kecerdasan Buatan (AI Chat)

* **Percakapan Natural:** Menggunakan persona "Haikaru" yang santai, akrab, dan membantu.
* **Memori Permanen:** Bot bisa mengingat fakta spesifik tentang user (nama, hobi, dll) selamanya via database lokal.
* **Analisis Audio:** Kirim *Voice Note* (VN), Haikaru akan mendengarkan dan merangkum isinya.
* **Analisis Gambar:** Kirim gambar dan tanya "Gambar apa ini?", Haikaru akan menjelaskannya.

### 🛠️ Tools & Utilitas

* **Generate Image:** Membuat gambar AI (via Pollinations/Flux) dari deskripsi teks.
* *Cara:* Chat biasa "Buatkan gambar kucing cyberpunk" atau via command `!img`.


* **Google Search:** Mencari informasi real-time (berita, cuaca, skor bola) langsung dari internet.
* *Cara:* "Siapa pemenang piala dunia terakhir?" atau "Cuaca Jakarta hari ini".


* **Sticker Maker:** Mengubah gambar/video/gif menjadi stiker WhatsApp secara otomatis.
* *Cara:* Kirim gambar dengan caption `!sticker`.



### 👥 Manajemen Grup

* **Tag Everyone:** Mention semua member grup (hanya jika diminta owner/admin atau situasi darurat).
* *Cara:* Command `!everyone` atau minta AI "tag semua orang".


* **Auto Reaction:** Bot memberikan reaksi emoji (👍, ❤️, 😂) pada pesan user secara otomatis sesuai konteks obrolan.
* **Ignore Mode:** Bisa diatur untuk mengabaikan grup tertentu agar tidak spam.

### ⚙️ Sistem & Maintenance

* **Ping Check:** Cek status latensi/responsivitas bot (`!ping`).
* **Bot Info:** Melihat statistik penggunaan token dan status server (`!info`).
* **Multi-Key Rotation:** Otomatis pindah ke API Key cadangan jika Key utama habis limit.

---

## 🚀 Instalasi

### 1. Prasyarat

* Node.js (versi 18 atau lebih baru).
* Google Chrome / Chromium terinstall di server/PC.
* FFmpeg (wajib untuk fitur stiker & media).

### 2. Clone & Install

```bash
git clone https://github.com/AnakTentara/AI-Haikaru.git
cd AI-Haikaru
npm install

```

### 3. Konfigurasi Environment (.env)

Buat file `.env` di root folder. Kamu membutuhkan banyak API Key Gemini (gratis via Google AI Studio) untuk performa maksimal.

Format `.env`:

```env
# --- KONFIGURASI UTAMA ---
OWNER_NUMBER=628xxxxxx

# --- AI KEYS (ROTATION SYSTEM) ---
# Key 1 (Primary)
GEMINI_API_KEY=AIzaSy...

# Key 2 sampai 40 (MAIN POOL - Untuk Chat & Logic)
GEMINI_API_KEY_2=AIzaSy...
GEMINI_API_KEY_3=AIzaSy...
# ... (lanjutkan sampai 40) ...
GEMINI_API_KEY_40=AIzaSy...

# Key 41 sampai 45 (HELPER POOL - Untuk Reaksi & Search)
GEMINI_API_KEY_41=AIzaSy...
GEMINI_API_KEY_42=AIzaSy...
GEMINI_API_KEY_43=AIzaSy...
GEMINI_API_KEY_44=AIzaSy...
GEMINI_API_KEY_45=AIzaSy...

```

> **Tips:** Semakin banyak key yang kamu masukkan, semakin kecil kemungkinan bot terkena *Rate Limit* saat grup ramai.

### 4. Menjalankan Bot

Jalankan bot menggunakan Node:

```bash
node index.js

```

Atau menggunakan PM2 (disarankan untuk server/VPS agar auto-restart):

```bash
pm2 start index.js --name "AI-Haikaru"

```

Scan QR Code yang muncul di terminal menggunakan WhatsApp kamu.

---

## 📂 Struktur File Penting

* **`index.js`**: Entry point, inisialisasi Client & API Pools (Main vs Helper).
* **`handlers/geminiProcessor.js`**: Otak AI. Mengatur rotasi key dan pemilihan model (`flash` vs `flash-lite`).
* **`handlers/aiChatHandler.js`**: Mengatur format pesan masuk (`[TIME] [USER]`) dan function calling.
* **`handlers/persona.js`**: Mengatur kepribadian dan aturan tagging.
* **`functions/`**: Folder berisi logika tools (Search, Image, dll).
* **`commands/`**: Folder perintah manual (Legacy commands seperti `!sticker`).

---

## ⚠️ Disclaimer

Project ini menggunakan **whatsapp-web.js** yang merupakan library *unofficial*. Gunakan dengan bijak. Risiko banned dari WhatsApp ditanggung pengguna jika melakukan spamming atau aktivitas mencurigakan.

---

Built with ❤️ by **Haikal** & **AI**.