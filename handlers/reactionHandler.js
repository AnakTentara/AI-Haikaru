import { analyzeEmojiReaction } from "./geminiProcessor.js";
import { loadChatHistory } from "./dbHandler.js";
import Logger from "./logger.js";

const reactionCooldowns = new Map();

/**
 * Handles automatic emoji reactions based on AI analysis
 */
export async function handleAutoReaction(bot, message, chatId) {
    try {
        const now = Date.now();
        const lastReaction = reactionCooldowns.get(chatId) || 0;
        const cooldownTime = 30000;

        if (now - lastReaction < cooldownTime) return;

        Logger.ai('REACTION_HANDLER', 'Analyzing for potential reaction...');
        const chatHistory = await loadChatHistory(chatId);
        const reactionAnalysis = await analyzeEmojiReaction(bot, chatHistory);

        if (reactionAnalysis && reactionAnalysis.emoji) {
            const { emoji, urgensi } = reactionAnalysis;
            let shouldReact = false;
            const chance = Math.random();

            if (urgensi === "wajib" && chance > 0.2) shouldReact = true;
            else if (urgensi === "penting" && chance > 0.8) shouldReact = true;
            else if (urgensi === "opsional" && chance > 0.9) shouldReact = true;

            if (shouldReact) {
                await message.react(emoji);
                reactionCooldowns.set(chatId, now);
                Logger.outgoing('REACTION_HANDLER', `Reacted with ${emoji}`);
            }
        }
    } catch (err) {
        Logger.error('REACTION_HANDLER', 'Auto reaction failed', { error: err.message });
    }
}
