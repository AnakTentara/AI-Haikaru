# 🤖 AI-Haikaru

> **WhatsApp AI Bot** dengan Google Gemini AI - Teman chatting yang asik, pintar, dan siap bantu 24/7!

[![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)](https://github.com/AnakTentara/AI-Haikaru)
[![Node.js](https://img.shields.io/badge/node.js-v18+-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-ISC-orange.svg)](LICENSE)

Bot WhatsApp modular berbasis **whatsapp-web.js** dan **Google Gemini AI** dengan fitur AI chat yang cerdas, support image processing, dan persistent chat history menggunakan MongoDB.

---

## ✨ Fitur Utama

### 🧠 **AI Chat dengan Gemini**
- Percakapan natural dengan personality santai & gaul ala gen Z
- Context-aware chat history (tersimpan per chat ID)
- Support image analysis (kirim gambar + pertanyaan)
- Smart mention detection di grup
- Reply-to-bot detection

### 🛠️ **Sistem Modular**
- Dynamic command loading dari folder `commands/`
- Event-driven architecture
- Clean & maintainable code structure
- Easy to extend dengan command baru

### 💾 **Database Integration**
- MongoDB untuk persistent chat history
- Auto-save conversation context
- Support multi-chat management

### 🎨 **Personality Custom**
- WhatsApp-formatted responses (*bold*, _italic_, ```code```)
- Emoji-rich replies (😭, :v, 🔥)
- Persona "Haikaru" yang friendly & helpful

---

## 📁 Struktur Proyek

```
AI-Haikaru/
├── 📝 index.js              # Entry point & WhatsAppBot class
├── 🔧 config.json           # Bot configuration
├── 📦 package.json          # Dependencies & scripts
├── 🌐 server.js             # Express server (uptime monitoring)
│
├── 📂 commands/             # Bot commands (auto-loaded)
│   ├── ping.js             # Cek responsivitas
│   ├── help.js             # Menu bantuan
│   ├── info.js             # Info bot & statistik
│   └── everyone.js         # Tag semua member grup
│
├── 📂 events/               # WhatsApp event handlers
│   ├── ready.js            # Bot ready event
│   ├── qr.js               # QR code display
│   └── message.js          # ⚡ Main message router & AI logic
│
├── 📂 handlers/             # Business logic processors
│   ├── geminiProcessor.js  # Gemini AI integration
│   ├── dbHandler.js        # MongoDB operations
│   └── persona.js          # AI personality definitions
│
└── 📂 config/
    └── puppeteer.js        # Puppeteer configuration
```

---

## 🚀 Quick Start

### 1️⃣ **Prerequisites**

- **Node.js** v18 atau lebih baru
- **MongoDB** (local atau cloud - MongoDB Atlas)
- **Google Gemini API Key** ([Dapatkan gratis di sini](https://aistudio.google.com/app/apikey))
- **Google Chrome** (untuk Puppeteer/WhatsApp Web)

### 2️⃣ **Installation**

```bash
# Clone repository
git clone https://github.com/AnakTentara/AI-Haikaru.git
cd AI-Haikaru

# Install dependencies
npm install
```

### 3️⃣ **Environment Setup**

Buat file `.env` di **parent directory** (`d:\code\waweb\.env`) dengan isi:

```env
# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=ai_bot_database

# Server (Optional)
PORT=3000

# Chrome Path (Optional - auto-detect jika kosong)
CHROME_PATH=
```

> **⚠️ Penting**: Jangan commit file `.env` ke repository!

### 4️⃣ **Jalankan Bot**

```bash
npm start
```

### 5️⃣ **Login WhatsApp**

1. Bot akan menampilkan **QR Code** di terminal
2. Buka WhatsApp di ponsel → **Pengaturan** → **Perangkat Tertaut**
3. Tap **"Tautkan Perangkat"**
4. Scan QR Code yang muncul di terminal
5. Bot siap digunakan! ✅

---

## 📱 Penggunaan

### **Commands dengan Prefix** (default: `.`)

| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `.ping` | Cek responsivitas & latency bot | `.ping` |
| `.help` | Tampilkan menu bantuan | `.help` atau `.help ping` |
| `.info` | Info statistik bot & chat | `.info` |

### **Trigger Commands** (tanpa prefix)

| Trigger | Deskripsi | Cara Pakai |
|---------|-----------|------------|
| `@everyone` | Tag semua member di grup | Ketik `@everyone` di grup |

### **AI Chat**

Bot akan **otomatis merespon** ketika:
- ✅ Chat **pribadi** (semua pesan)
- ✅ Di-**mention** di grup (`@628816197519` atau `@263801807044691`)
- ✅ **Reply** ke pesan bot

**Contoh percakapan:**

```
User: Haikaru, jelasin dong apa itu AI?
Bot: Woi! AI itu singkatan dari Artificial Intelligence, intinya komputer 
     yang bisa "mikir" kayak manusia gitu deh. Bisa belajar, ngobrol, 
     sampe ngerjain tugas lo :v Gue sendiri salah satunya! 😎🔥

User: [kirim foto kucing] ini binatang apa?
Bot: Wahh itu kucing lucu banget bro 😭 Kayaknya jenis tabby gitu deh, 
     gemesin parah! 🐱
```

---

## ⚙️ Konfigurasi

### `config.json`

```json
{
  "prefix": ".",                    // Command prefix
  "botName": "AI-Haikaru",          // Nama bot
  "language": "id",                 // Bahasa default
  "features": {
    "enableLogging": true,          // Enable console logging
    "enableGemini": true            // Enable AI chat
  },
  "messages": {
    "errorExecutingCommand": "❌ Terjadi kesalahan saat menjalankan perintah tersebut.",
    "commandNotFound": "❌ Perintah tidak ditemukan."
  },
  "targetUserIds": [
    "263801807044691",              // Bot Number (LID)
    "628816197519"                  // Bot Number (normal)
  ]
}
```

---

## 🔧 Development

### **Menambah Command Baru**

Buat file di `commands/namacommand.js`:

```javascript
export default {
  name: 'contoh',
  description: 'Deskripsi command',
  usage: '.contoh [args]',
  prefixRequired: true,           // true = perlu prefix, false = trigger words
  triggers: ['.contoh'],         // Kata pemicu (jika prefixRequired: false)
  
  async execute(message, args, bot) {
    // Logic command di sini
    await message.reply('Halo dari command baru! 🎉');
  }
};
```

Command akan **otomatis dimuat** saat bot restart!

### **Menambah Event Handler**

Buat file di `events/namaevent.js`:

```javascript
export default {
  name: 'nama_event',             // Nama WhatsApp event (e.g., 'message_create')
  once: false,                    // true = sekali, false = setiap kali
  
  execute(bot, ...args) {
    // Logic event handler
    console.log('Event triggered!');
  }
};
```

---

## 🎭 AI Personality

Bot menggunakan 2 persona:

1. **HAIKARU_PERSONA** (`handlers/persona.js`)
   - Untuk AI chat normal
   - Gaya santai, gaul, gen Z
   - Temperature: 0.7 (balanced)

2. **HELPER_PERSONA** (`handlers/persona.js`)
   - Untuk command responses (help, info, everyone)
   - Lebih ringkas & to-the-point
   - Temperature: 1.7 (creative)

Customize personality di file `handlers/persona.js`!

---

## 📊 Tech Stack

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| **Node.js** | v18+ | Runtime JavaScript |
| **whatsapp-web.js** | ^1.34.2 | WhatsApp Web automation |
| **@google/genai** | ^1.30.0 | Google Gemini AI SDK |
| **MongoDB** | ^7.0.0 | Database (chat history) |
| **Express** | ^5.1.0 | Web server (health check) |
| **Puppeteer** | (bundled) | Chrome automation |

---

## 🔒 Keamanan & Best Practices

✅ **DO:**
- Simpan API key di `.env` (JANGAN di code!)
- Update dependencies secara berkala
- Monitor log errors untuk debugging
- Backup database MongoDB

❌ **DON'T:**
- Commit `.env` atau `.local/` ke Git
- Share API key di public
- Gunakan bot untuk spam/violasi ToS WhatsApp

---

## 🐛 Troubleshooting

### **Bot tidak bisa login / QR tidak muncul**
- Pastikan Google Chrome terinstall
- Check `config/puppeteer.js` → set `CHROME_PATH` di `.env` jika perlu

### **Error: GEMINI_API_KEY not found**
- Cek file `.env` di parent directory
- Pastikan `dotenv.config()` load dengan benar di `index.js`

### **Chat history tidak tersimpan**
- Cek koneksi MongoDB di `.env`
- Test koneksi: `mongosh "MONGODB_URI"`
- Check logs untuk error database

### **Bot tidak merespon mention**
- Update `targetUserIds` di `config.json` dengan nomor bot yang benar
- Cek format: `"628xxxxxxxxxx"` (tanpa +, dengan kode negara)

---

## 📝 Changelog

### **v1.6.0** (Current)
- ✨ Image processing support (send image to AI)
- ✨ Smart mention detection dengan LID support
- ✨ MongoDB chat history persistent
- ✨ Improved persona system
- ✨ Cross-platform Puppeteer config
- 🐛 Bug fixes & performance improvements

---

## 👨‍💻 Developer

**Haikal Mabrur** (AnakTentara / Haikaru)
- 📱 WhatsApp: 089675732001
- 🎓 Student at MAN 1 Muara Enim
- 💻 Passionate about AI, Programming & Arduino

---

## 📄 License

ISC License - Free to use & modify

---

## 🙏 Credits

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web API
- [Google Gemini](https://ai.google.dev/) - AI Engine
- [MongoDB](https://www.mongodb.com/) - Database

---

**Made with ❤️ by Haikal | AI-Haikaru v1.6.0**
