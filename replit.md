# Proyek Bot WhatsApp

## Ringkasan
Bot WhatsApp modular yang dibangun dengan whatsapp-web.js dengan fitur dynamic command dan event loading. Proyek menggunakan struktur file yang bersih dan terpisah untuk kemudahan pemeliharaan dan skalabilitas.

## Perubahan Terbaru (17 November 2025)
- Setup awal proyek dengan Node.js dan ES modules
- Membuat arsitektur modular dengan folder commands/, events/, dan utils/
- Implementasi sistem dynamic command dan event loader di index.js
- Menambahkan tiga perintah contoh: ping, help, info
- Menambahkan tiga event handler: ready, qr, message
- Konfigurasi system Chromium untuk kompatibilitas whatsapp-web.js/puppeteer
- Peningkatan deteksi path Chromium dinamis dengan environment variable fallback
- Menambahkan error handling untuk kegagalan loading command/event
- Berhasil di-deploy dengan autentikasi bekerja
- **Menerjemahkan semua teks ke bahasa Indonesia**
- **Mengubah prefix dari `!` menjadi `.`**
- **Membuat config.json untuk pengaturan bot (prefix, botName, dll)**
- **Menambahkan dukungan GEMINI_API_KEY via environment variables**
- Bot terotentikasi dan siap menerima perintah

## Project Architecture

### Core Structure
```
index.js - Main bot class with dynamic loaders
commands/ - Individual command files (auto-loaded)
events/ - Individual event handlers (auto-loaded)
utils/ - Utility functions (for future use)
```

### Key Design Patterns
- **Command Pattern**: Each command is a separate module with name, description, usage, and execute function
- **Event-Driven**: Events are dynamically loaded and registered with the WhatsApp client
- **Modular**: New commands/events can be added by simply creating new files

### Dependencies
- whatsapp-web.js: WhatsApp Web API wrapper
- qrcode-terminal: QR code display in console
- puppeteer (bundled): Browser automation for WhatsApp Web
- System Chromium: Used instead of bundled Chromium for Nix compatibility

## Technical Decisions
- **ES Modules**: Using "type": "module" in package.json for modern JavaScript
- **CommonJS Compatibility**: whatsapp-web.js is CommonJS, using default import with destructuring
- **System Chromium**: Configured executablePath to use Nix-provided Chromium to avoid dependency issues
- **LocalAuth Strategy**: Persists authentication between restarts

## User Preferences
- Clean, modular code structure with separated concerns
- Dynamic loading of commands and events
- No preferences specified yet for coding style

## Current State
- Bot is fully functional and running
- QR code authentication works correctly
- Three example commands working
- Ready for extension with more commands and features
