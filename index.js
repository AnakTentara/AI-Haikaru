import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

import { puppeteerConfig } from './config/puppeteer.js';
import { startServer } from './server.js';

import dotenv from 'dotenv';
dotenv.config(); // Default to ./.env

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = JSON.parse(
    fs.readFileSync(join(__dirname, "config.json"), "utf8"),
);

import OpenAI from 'openai';

import modelManager from './handlers/modelManager.js';

import AutonomousHandler from './handlers/autonomousHandler.js';
import SchedulerHandler from './handlers/schedulerHandler.js';

class WhatsAppBot {
    constructor() {
        // ... (existing config)
        this.modelManager = modelManager;
        const clientConfig = {
            authStrategy: new LocalAuth(),
            puppeteer: puppeteerConfig,
        };

        this.client = new Client(clientConfig);
        this.commands = new Map();
        this.events = new Map();
        this.functions = new Map();
        this.prefix = config.prefix;
        this.config = config;
        this.version = config.version;

        // New Autonomous Handler
        this.autonomous = new AutonomousHandler(this);

        // New Scheduler Handler
        this.scheduler = new SchedulerHandler(this);

        // AI Configuration from config.json
        const geminiBaseURL = config.ai?.gemini?.baseURL || "https://generativelanguage.googleapis.com/v1beta/openai/";
        const openaiBaseURL = config.ai?.openai?.baseURL || "https://api.openai.com/v1";

        // Main AI - Build fallback chain from all available Gemini keys (up to 10)
        this.geminiClients = [];

        // Primary key
        if (process.env.GEMINI_API_KEY) {
            this.geminiClients.push({
                client: new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: geminiBaseURL }),
                name: "Primary"
            });
            console.log("✅ Main AI Primary (GEMINI_API_KEY)");
        }

        // Secondary keys (2 to 25)
        for (let i = 2; i <= 25; i++) {
            const keyName = `GEMINI_API_KEY_${i}`;
            const keyValue = process.env[keyName];

            if (keyValue) {
                this.geminiClients.push({
                    client: new OpenAI({ apiKey: keyValue, baseURL: geminiBaseURL }),
                    name: `Key_${i}`
                });
                console.log(`✅ Main AI Key ${i} (${keyName})`);
            }
        }

        if (this.geminiClients.length === 0) {
            console.error("❌ CRITICAL: No GEMINI_API_KEY found in .env! AI features will be disabled.");
        } else {
            console.log(`✅ Loaded ${this.geminiClients.length} Gemini API Clients.`);
        }

        // OpenAI - Context/Helper/Reaction/Grounding (OPENAI_API_KEY)
        if (process.env.OPENAI_API_KEY) {
            this.openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: openaiBaseURL
            });
            console.log("✅ OpenAI Client (Context/Helper/Reaction/Grounding)");
        }

    } // End of constructor

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

    async loadFunctions() {
        const functionsPath = join(__dirname, "functions");

        try {
            const functionFiles = fs
                .readdirSync(functionsPath)
                .filter((file) => file.endsWith(".js"));

            console.log(`Ditemukan ${functionFiles.length} file di folder functions: ${functionFiles.join(", ")}`);

            for (const file of functionFiles) {
                try {
                    const filePath = join(functionsPath, file);
                    const functionModule = await import(`file://${filePath}?update=${Date.now()}`);

                    const func = functionModule.default;

                    if (func && typeof func === 'object' && func.name) {
                        this.functions.set(func.name, func);
                        console.log(`✓ Function loaded: ${func.name} ← dari ${file}`);
                    } else {
                        console.error(`File ${file} tidak memiliki export default yang valid!`);
                    }
                } catch (error) {
                    console.error(`GAGAL memuat ${file}:`, error.message);
                    console.error(error.stack);
                }
            }

            console.log(`Total functions berhasil dimuat: ${this.functions.size}`);
        } catch (error) {
            console.error("Gagal membaca direktori functions:", error.message);
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
        await this.loadFunctions();
        await this.loadEvents();

        console.log("\n✨ Bot berhasil diinisialisasi!");
        console.log("📱 Memulai klien WhatsApp...\n");

        this.client.initialize();
        this.scheduler.start();
    }
}

const bot = new WhatsAppBot();

startServer();

bot.initialize().catch(console.error);
