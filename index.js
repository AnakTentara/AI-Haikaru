import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { GoogleGenAI } from '@google/genai';
import { puppeteerConfig } from './config/puppeteer.js';
import { startServer } from './server.js';

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = JSON.parse(
    fs.readFileSync(join(__dirname, "config.json"), "utf8"),
);

class WhatsAppBot {
    constructor() {
        const clientConfig = {
            authStrategy: new LocalAuth(),
            puppeteer: puppeteerConfig,
        };

        this.client = new Client(clientConfig);
        this.commands = new Map();
        this.events = new Map();
        this.prefix = config.prefix;
        this.config = config;

        if (process.env.GEMINI_API_KEY) {
            this.geminiApiKey = process.env.GEMINI_API_KEY;
            this.geminiApi = new GoogleGenAI({ apiKey: this.geminiApiKey });
        }
    }

    async loadCommands() {
        const commandsPath = join(__dirname, "commands");

        try {
            const commandFiles = fs
                .readdirSync(commandsPath)
                .filter((file) => file.endsWith(".js"));

            console.log(`Ditemukan ${commandFiles.length} file di folder commands: ${commandFiles.join(", ")}`);

            for (const file of commandFiles) {
                try {
                    const filePath = join(commandsPath, file);
                    const commandModule = await import(`file://${filePath}?update=${Date.now()}`);

                    const command = commandModule.default;

                    if (command && typeof command === 'object' && command.name) {
                        this.commands.set(command.name.toLowerCase(), command);
                        console.log(`✓ Perintah dimuat: ${command.name} ← dari ${file}`);
                    } else {
                        console.error(`File ${file} tidak memiliki export default yang valid!`);
                    }
                } catch (error) {
                    console.error(`GAGAL memuat ${file}:`, error.message);
                    console.error(error.stack);
                }
            }

            console.log(`Total perintah berhasil dimuat: ${this.commands.size}`);
        } catch (error) {
            console.error("Gagal membaca direktori perintah:", error.message);
        }
    }
    async loadEvents() {
        const eventsPath = join(__dirname, "events");

        try {
            const eventFiles = fs
                .readdirSync(eventsPath)
                .filter((file) => file.endsWith(".js"));

            for (const file of eventFiles) {
                try {
                    const filePath = join(eventsPath, file);
                    const event = await import(`file://${filePath}`);

                    if (event.default && event.default.name && event.default.execute) {
                        this.events.set(event.default.name, event.default);

                        if (event.default.once) {
                            this.client.once(event.default.name, (...args) =>
                                event.default.execute(this, ...args),
                            );
                        } else {
                            this.client.on(event.default.name, (...args) =>
                                event.default.execute(this, ...args),
                            );
                        }

                        console.log(`✓ Event dimuat: ${event.default.name}`);
                    }
                } catch (error) {
                    console.error(`❌ Gagal memuat event ${file}:`, error.message);
                }
            }
        } catch (error) {
            console.error("❌ Gagal membaca direktori events:", error.message);
        }
    }

    async initialize() {
        console.log("🤖 Bot WhatsApp Memulai...");
        console.log("📂 Memuat perintah dan event...\n");

        await this.loadCommands();
        await this.loadEvents();

        console.log("\n✨ Bot berhasil diinisialisasi!");
        console.log("📱 Memulai klien WhatsApp...\n");

        this.client.initialize();
    }
}

const bot = new WhatsAppBot();

startServer();

bot.initialize().catch(console.error);
