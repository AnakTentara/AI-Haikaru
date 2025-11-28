import Logger from "../handlers/logger.js";

/**
 * AI Function: tag_everyone
 * Triggered when AI detects user wants to tag all members
 * Calls functionHandler, formats message, and sends with mentions
 */
export default {
    name: 'tag_everyone',
    description: 'Tag all members in a group chat',

    async execute(bot, message, chat, chatHistory, args) {
        Logger.function('tag_everyone', 'Tagging all members...');

        // Import function handler dynamically
        const { tag_everyone } = await import('../handlers/functionHandler.js');
        const { formatEveryoneMessage } = await import('../commands/everyone.js');

        const result = await tag_everyone(bot, message, chat);

        Logger.data('tag_everyone', 'Members tagged', {
            count: result.participantCount,
            group: result.groupName
        });

        const responseText = formatEveryoneMessage(result, "");

        await bot.client.sendMessage(chat.id._serialized, responseText, {
            mentions: result.mentions,
            quotedMessageId: message.id._serialized,
        });

        Logger.outgoing('tag_everyone', `Tagged ${result.participantCount} members`);
        chatHistory.push({
            role: "model",
            text: `[Tagged ${result.participantCount} members di grup ${result.groupName}]`
        });
    }
};
