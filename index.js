import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WhatsAppBot {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
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
    });

    this.commands = new Map();
    this.events = new Map();
    this.prefix = '!';
  }

  async loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await import(`file://${filePath}`);
      
      if (command.default && command.default.name) {
        this.commands.set(command.default.name, command.default);
        console.log(`✓ Loaded command: ${command.default.name}`);
      }
    }
  }

  async loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      const event = await import(`file://${filePath}`);
      
      if (event.default && event.default.name && event.default.execute) {
        this.events.set(event.default.name, event.default);
        
        if (event.default.once) {
          this.client.once(event.default.name, (...args) => event.default.execute(this, ...args));
        } else {
          this.client.on(event.default.name, (...args) => event.default.execute(this, ...args));
        }
        
        console.log(`✓ Loaded event: ${event.default.name}`);
      }
    }
  }

  async initialize() {
    console.log('🤖 WhatsApp Bot Starting...');
    console.log('📂 Loading commands and events...\n');

    await this.loadCommands();
    await this.loadEvents();

    console.log('\n✨ Bot initialized successfully!');
    console.log('📱 Starting WhatsApp client...\n');

    this.client.initialize();
  }
}

const bot = new WhatsAppBot();
bot.initialize().catch(console.error);
