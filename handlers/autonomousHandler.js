import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import modelManager from './modelManager.js';
import { loadChatHistory } from './dbHandler.js';
import Logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IGNORE_FILE = join(__dirname, '../data/ignored_groups.json');

// --- Helper Functions for Ignore List (Exported) ---
export async function areGroupsIgnored(chatId) {
    try {
        if (!fs.existsSync(IGNORE_FILE)) return false;
        const data = fs.readFileSync(IGNORE_FILE, 'utf8');
        const ignoredList = JSON.parse(data);
        return ignoredList.includes(chatId);
    } catch (error) {
        console.error("Error checking ignore list:", error);
        return false;
    }
}

/**
 * AutonomousHandler
 * Manages the AI's ability to initiate conversations and 'think' about groups.
 */
class AutonomousHandler {
    constructor(bot) {
        this.bot = bot;
        this.intervals = new Map(); // chatId -> IntervalID
        this.config = {
            minInterval: 60 * 60 * 1000, // 1 hour (default)
            chance: 0.1 // 10% chance to chat when thinking
        };
        this.ensureFileExists();
    }

    ensureFileExists() {
        // Buat folder data jika belum ada
        const dataDir = dirname(IGNORE_FILE);
        if (!fs.existsSync(dataDir)){
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        if (!fs.existsSync(IGNORE_FILE)) {
            fs.writeFileSync(IGNORE_FILE, JSON.stringify([]));
        }
    }

    async addToIgnore(chatId) {
        const list = this.getIgnoreList();
        if (!list.includes(chatId)) {
            list.push(chatId);
            this.saveIgnoreList(list);
            return true;
        }
        return false;
    }

    async removeFromIgnore(chatId) {
        let list = this.getIgnoreList();
        if (list.includes(chatId)) {
            list = list.filter(id => id !== chatId);
            this.saveIgnoreList(list);
            return true;
        }
        return false;
    }

    getIgnoreList() {
        try {
            if (!fs.existsSync(IGNORE_FILE)) return [];
            return JSON.parse(fs.readFileSync(IGNORE_FILE, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    saveIgnoreList(list) {
        fs.writeFileSync(IGNORE_FILE, JSON.stringify(list, null, 2));
    }

    /**
     * Initialize autonomous behavior for a specific chat (group)
     */
    startMonitoring(chatId) {
        if (this.intervals.has(chatId)) return;

        Logger.info('AUTO_HANDLER', `Started monitoring ${chatId} for autonomous chats`);

        // Check every 15-30 minutes randomly
        const checkInterval = 15 * 60 * 1000 + Math.random() * 15 * 60 * 1000;

        const interval = setInterval(() => {
            this.think(chatId);
        }, checkInterval);

        this.intervals.set(chatId, interval);
    }

    stopMonitoring(chatId) {
        if (this.intervals.has(chatId)) {
            clearInterval(this.intervals.get(chatId));
            this.intervals.delete(chatId);
            Logger.info('AUTO_HANDLER', `Stopped monitoring ${chatId}`);
        }
    }

    /**
     * The "Brain" process to decide whether to chat
     */
    async think(chatId) {
        try {
            // Cek dulu apakah grup ini di-ignore
            if (await areGroupsIgnored(chatId)) {
                return;
            }

            const chat = await this.bot.client.getChatById(chatId);
            if (!chat.isGroup) return; // Only for groups for now

            // 1. Context Gathering
            const now = new Date();
            const hour = now.getHours();

            // Bias: More active during day (07:00 - 22:00)
            if (hour < 7 || hour > 22) return;

            // Load History
            const history = await loadChatHistory(chatId, 20);
            if (history.length === 0) return;

            // 2. Decision Making via AI
            const decisionPrompt = `
Kamu adalah AI-Haikaru, member grup whatsapp.
Analisis history chat berikut dari grup "${chat.name}".
Grup Deskripsi: "${chat.description || 'Tidak ada deskripsi'}".

History Terakhir:
${history.map(m => m.text).join('\n')}

Tugasmu:
Putuskan apakah kamu perlu mengirim pesan SENDIRI secara inisiatif (tanpa ditag).
Pesan harus natural, seperti manusia yang iseng nyeletuk, menyapa, atau menghidupkan suasana.

Rules:
- JANGAN chat jika percakapan masih aktif dan tidak ada celah.
- JANGAN spam.
- Jika grup sepi > 6 jam, boleh sapa "Sepi amat" atau kirim meme/topik menarik.
- Jika ada topik menarik di history lama yang belum selesai, boleh dibahas lagi.

Output JSON:
{
  "shouldChat": true/false,
  "reason": "Alasan kenapa mau chat",
  "message": "Isi pesan kamu (kalau true)"
}
`;

            // Gunakan Helper Clients jika tersedia untuk 'thinking' agar hemat kuota utama
            // Fallback ke Main Clients jika helper tidak ada
            let clientObj;
            if (this.bot.helperClients && this.bot.helperClients.length > 0) {
                 clientObj = this.bot.helperClients[Math.floor(Math.random() * this.bot.helperClients.length)];
            } else {
                 clientObj = this.bot.geminiClients[0];
            }

            const modelId = "gemini-2.5-flash-lite"; // Hemat token & cepat

            const completion = await clientObj.client.chat.completions.create({
                model: modelId,
                messages: [{ role: "user", content: decisionPrompt }],
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content);

            if (result.shouldChat && result.message) {
                Logger.ai('AUTO_CHAT', `Decided to chat in ${chat.name}: ${result.reason}`);

                // Simulate typing
                await chat.sendStateTyping();
                await new Promise(r => setTimeout(r, 2000));
                await chat.clearState();

                await chat.sendMessage(result.message);
            } else {
                Logger.info('AUTO_CHAT', `Decided NOT to chat in ${chat.name}: ${result.reason}`);
            }

        } catch (error) {
            Logger.error('AUTO_HANDLER', `Error in thinking process for ${chatId}`, { error: error.message });
        }
    }
}

export default AutonomousHandler;