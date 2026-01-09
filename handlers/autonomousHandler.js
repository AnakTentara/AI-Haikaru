import modelManager from './modelManager.js';
import { loadChatHistory } from './dbHandler.js';
import Logger from './logger.js';

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

            const lastMsg = history[history.length - 1];
            const lastMsgTime = new Date(); // Need to parse timestamp from text if possible, or just assume recent
            // For simplicity, we just check if the last message passed some time ago via DB if we stored timestamp?
            // Since we store string text, we rely on "Is the group dead?" logic from AI.

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

            const modelId = modelManager.selectModel('short'); // Use cheap model for thinking
            const clientObj = this.bot.geminiClients[0]; // Use primary key for now logic needs refine

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
