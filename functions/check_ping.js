import Logger from "../handlers/logger.js";

/**
 * AI Function: check_ping
 * Triggered when AI detects user asking about bot responsiveness
 * Executes the .ping command handler
 */
export default {
    name: 'check_ping',
    description: 'Check bot responsiveness and latency',

    async execute(bot, message, chat, chatHistory) {
        Logger.function('check_ping', 'AI triggered ping command. Executing .ping command handler...');

        const pingCommand = bot.commands.get('ping');

        if (pingCommand && pingCommand.execute) {
            await pingCommand.execute(message, [], bot);
            chatHistory.push({ role: "model", text: "[Executed .ping command to check responsiveness]" });
        } else {
            await message.reply("❌ Maaf, ping command tidak ditemukan.");
        }
    }
};
