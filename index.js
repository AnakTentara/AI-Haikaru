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

import OpenAI from 'openai'; // Tetap dipakai sebagai SDK client untuk Gemini

import modelManager from './handlers/modelManager.js';

import AutonomousHandler from './handlers/autonomousHandler.js';
import SchedulerHandler from './handlers/schedulerHandler.js';

class WhatsAppBot {
    constructor() {
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

        // Autonomous & Scheduler
        this.autonomous = new AutonomousHandler(this);
        this.scheduler = new SchedulerHandler(this);

        // AI Configuration
        const geminiBaseURL = config.ai?.gemini?.baseURL || "https://generativelanguage.googleapis.com/v1beta/openai/";
        
        // --- SETUP API KEYS (GEMINI ONLY) ---

        // 1. MAIN AI POOL (Keys 1 - 40)
        // Digunakan untuk: Chat Utama, Coding, Function Calling, Audio Analysis
        this.geminiClients = [];

        // Primary Key (Key 1)
        if (process.env.GEMINI_API_KEY) {
            this.geminiClients.push({
                client: new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: geminiBaseURL }),
                name: "Primary"
            });
            console.log("✅ Main AI Primary (GEMINI_API_KEY)");
        }

        // Secondary Keys (Key 2 - 40)
        for (let i = 2; i <= 40; i++) {
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

        // 2. HELPER AI POOL (Keys 41 - 45) - PENGGANTI OPENAI
        // Digunakan untuk: Emoji Reaction, Short Helper, Grounding Summary
        this.helperClients = [];

        for (let i = 41; i <= 45; i++) {
            const keyName = `GEMINI_API_KEY_${i}`;
            const keyValue = process.env[keyName];

            if (keyValue) {
                this.helperClients.push({
                    client: new OpenAI({ apiKey: keyValue, baseURL: geminiBaseURL }),
                    name: `Helper_Key_${i}`
                });
                console.log(`🛡️ Helper AI Key ${i} (${keyName}) - Dedicated for Background Tasks`);
            }
        }

        // Validation
        if (this.geminiClients.length === 0) {
            console.error("❌ CRITICAL: Tidak ada GEMINI_API_KEY (1-40) ditemukan!");
        } else {
            console.log(`🚀 Main AI Ready: ${this.geminiClients.length} Clients loaded.`);
        }

        if (this.helperClients.length === 0) {
            console.warn("⚠️ WARNING: Tidak ada Helper Keys (41-45). Bot akan menggunakan Main Keys untuk tugas helper.");
        } else {
            console.log(`🛡️ Helper AI Ready: ${this.helperClients.length} Clients loaded.`);
        }
        
        // Hapus referensi OpenAI lama agar tidak ada kebingungan
        this.openaiClient = null;

    } // End of constructor

    async loadCommands() {
        const commandsPath = join(__dirname, "commands");
        try {
            const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
            console.log(`Ditemukan ${commandFiles.length} file di folder commands.`);

            for (const file of commandFiles) {
                try {
                    const filePath = join(commandsPath, file);
                    const commandModule = await import(`file://${filePath}?update=${Date.now()}`);
                    const command = commandModule.default;
                    if (command && command.name) {
                        this.commands.set(command.name.toLowerCase(), command);
                    }
                } catch (error) {
                    console.error(`GAGAL memuat ${file}:`, error.message);
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
            const functionFiles = fs.readdirSync(functionsPath).filter((file) => file.endsWith(".js"));
            for (const file of functionFiles) {
                try {
                    const filePath = join(functionsPath, file);
                    const functionModule = await import(`file://${filePath}?update=${Date.now()}`);
                    const func = functionModule.default;
                    if (func && func.name) {
                        this.functions.set(func.name, func);
                    }
                } catch (error) {
                    console.error(`GAGAL memuat function ${file}:`, error.message);
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
            const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));
            for (const file of eventFiles) {
                try {
                    const filePath = join(eventsPath, file);
                    const event = await import(`file://${filePath}`);
                    if (event.default?.name && event.default?.execute) {
                        this.events.set(event.default.name, event.default);
                        if (event.default.once) {
                            this.client.once(event.default.name, (...args) => event.default.execute(this, ...args));
                        } else {
                            this.client.on(event.default.name, (...args) => event.default.execute(this, ...args));
                        }
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
        await this.loadCommands();
        await this.loadFunctions();
        await this.loadEvents();
        console.log("\n✨ Bot berhasil diinisialisasi!");
        this.client.initialize();
        this.scheduler.start();
    }
}

const bot = new WhatsAppBot();
startServer();
bot.initialize().catch(console.error);