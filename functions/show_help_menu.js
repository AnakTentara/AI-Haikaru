import Logger from "../handlers/logger.js";

/**
 * AI Function: show_help_menu
 * Triggered when AI detects user asking for help or feature list
 * Executes the .help command handler
 */
export default {
    name: 'show_help_menu',
    description: 'Display help menu with bot features',

    async execute(bot, message, chat, chatHistory) {
        Logger.function('show_help_menu', 'AI triggered help menu. Executing .help command handler...');

        const helpCommand = bot.commands.get('help');

        if (helpCommand && helpCommand.execute) {
            await helpCommand.execute(message, [], bot);
            Logger.outgoing('show_help_menu', 'Help menu sent via command handler');
            chatHistory.push({ role: "model", text: "[Executed .help command to show help menu]" });
        } else {
            await message.reply("❌ Maaf, menu bantuan tidak dapat dimuat.");
            chatHistory.push({ role: "model", text: "[Error: Help command handler not found]" });
        }
    }
};
