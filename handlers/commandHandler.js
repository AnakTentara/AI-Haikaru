import Logger from "./logger.js";
import { loadChatHistory, saveChatHistory } from "./dbHandler.js";

/**
 * Handles command execution (Prefix and Triggers)
 */
export async function handleCommands(bot, message) {
    const { body, from, id } = message;
    const { prefix } = bot;
    const bodyLower = body.toLowerCase().trim();

    // 1. PREFIX COMMANDS
    if (bodyLower.startsWith(prefix)) {
        if (from === "status@broadcast") return true;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = bot.commands.get(commandName);

        if (command) {
            try {
                Logger.command('COMMAND_HANDLER', `Executing: ${commandName}`);
                const chatId = id.remote;
                const chatHistory = await loadChatHistory(chatId);
                await command.execute(message, args, bot, chatHistory);
                await saveChatHistory(chatId, chatHistory);
                return true;
            } catch (error) {
                Logger.error('COMMAND_HANDLER', `Error: ${commandName}`, { error: error.message });
                await message.reply("Waduh, perintah itu lagi error bro. 🙏");
                return true;
            }
        }
    }

    // 2. TRIGGER COMMANDS
    for (const [name, command] of bot.commands) {
        if (
            command.prefixRequired === false &&
            command.triggers?.some((trigger) => {
                const regex = new RegExp(`\\b${trigger.toLowerCase()}\\b`, 'i');
                return regex.test(bodyLower);
            })
        ) {
            try {
                Logger.command('COMMAND_HANDLER', `Executing trigger: ${name}`);
                const chatId = id.remote;
                const chatHistory = await loadChatHistory(chatId);
                await command.execute(message, [], bot, chatHistory);
                await saveChatHistory(chatId, chatHistory);
                return true;
            } catch (error) {
                Logger.error('COMMAND_HANDLER', `Trigger Error: ${name}`, { error: error.message });
                return true;
            }
        }
    }

    return false;
}
