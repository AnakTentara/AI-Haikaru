import Logger from "../handlers/logger.js";

/**
 * AI Function: get_bot_info
 * Triggered when AI detects user asking about bot info
 * Executes the .info command handler
 */
export default {
    name: 'get_bot_info',
    description: 'Get bot information and statistics',

    async execute(bot, message, chat, chatHistory) {
        Logger.function('get_bot_info', 'AI triggered info command. Executing .info command handler...');

        const infoCommand = bot.commands.get('info');

        if (infoCommand && infoCommand.execute) {
            await infoCommand.execute(message, [], bot);
            chatHistory.push({ role: "model", text: "[Executed .info command to show bot stats]" });
        } else {
            await message.reply("❌ Maaf, info command tidak ditemukan.");
        }
    }
};
