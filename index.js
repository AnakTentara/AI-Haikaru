import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = JSON.parse(fs.readFileSync(join(__dirname, 'config.json'), 'utf8'));

function getChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  try {
    return execSync('which chromium', { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

class WhatsAppBot {
  constructor() {
    const chromiumPath = getChromiumPath();
    
    const clientConfig = {
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      }
    };

    if (chromiumPath) {
      clientConfig.puppeteer.executablePath = chromiumPath;
      console.log(`Menggunakan Chromium di: ${chromiumPath}`);
    }

    this.client = new Client(clientConfig);
    this.commands = new Map();
    this.events = new Map();
    this.prefix = config.prefix;
    this.config = config;
    
    if (process.env.GEMINI_API_KEY) {
      this.geminiApiKey = process.env.GEMINI_API_KEY;
    }
  }

  async loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    
    try {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        try {
          const filePath = join(commandsPath, file);
          const command = await import(`file://${filePath}`);
          
          if (command.default && command.default.name) {
            this.commands.set(command.default.name, command.default);
            console.log(`✓ Perintah dimuat: ${command.default.name}`);
          }
        } catch (error) {
          console.error(`❌ Gagal memuat perintah ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Gagal membaca direktori perintah:', error.message);
    }
  }

  async loadEvents() {
    const eventsPath = join(__dirname, 'events');
    
    try {
      const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

      for (const file of eventFiles) {
        try {
          const filePath = join(eventsPath, file);
          const event = await import(`file://${filePath}`);
          
          if (event.default && event.default.name && event.default.execute) {
            this.events.set(event.default.name, event.default);
            
            if (event.default.once) {
              this.client.once(event.default.name, (...args) => event.default.execute(this, ...args));
            } else {
              this.client.on(event.default.name, (...args) => event.default.execute(this, ...args));
            }
            
            console.log(`✓ Event dimuat: ${event.default.name}`);
          }
        } catch (error) {
          console.error(`❌ Gagal memuat event ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Gagal membaca direktori events:', error.message);
    }
  }

  async initialize() {
    console.log('🤖 Bot WhatsApp Memulai...');
    console.log('📂 Memuat perintah dan event...\n');

    await this.loadCommands();
    await this.loadEvents();

    console.log('\n✨ Bot berhasil diinisialisasi!');
    console.log('📱 Memulai klien WhatsApp...\n');

    this.client.initialize();
  }
}

const bot = new WhatsAppBot();
bot.initialize().catch(console.error);
