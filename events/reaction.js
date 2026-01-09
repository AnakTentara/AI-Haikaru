import Logger from "../handlers/logger.js";
import { loadChatHistory, saveChatHistory, appendChatMessage } from "../handlers/dbHandler.js";

/**
 * Reaction Event Handler
 * Logs reactions to chat history for context awareness.
 */
export default {
    name: "message_reaction",
    once: false,
    async execute(bot, reaction) {
        /*
        reaction object structure (approx):
        {
            id: { fromMe, remote, id, _serialized },
            senderId: '...',
            reaction: '👍',
            timestamp: 123...
            msgId: { ... }
        }
        */

        try {
            const chatId = reaction.id.remote;
            const reactorId = reaction.senderId;
            const emoji = reaction.reaction;
            const targetMsgId = reaction.msgId.id;

            // Log it
            Logger.incoming('REACTION', `${emoji} from ${reactorId} on msg ${targetMsgId}`);

            // 1. Load History
            const history = await loadChatHistory(chatId, 100); // Load enough to find the msg
            let found = false;

            // 2. Find and Update Message in History
            // We append a "system note" style update to the history log, or modify the specific message object?
            // Modifying the object in the array is better if we want to "know" it was reacted to.
            // BUT, our history is simple objects { role, text }.
            // So we will append a special "User X reacted Y to '...'" entry so the AI sees it as an event.

            // Find the text of the message being reacted to for context
            // Since we don't store IDs in our simple history json (only text/role), we might struggle to match EXACTLY.
            // Implementation limitation: our saved history doesn't keep message IDs usually.
            // Let's check dbHandler.js ... yes it saves `newMessage`.
            // Let's rely on appending a new "event" message to history.

            const contact = await bot.client.getContactById(reactorId);
            const reactorName = contact.name || contact.pushname || reactorId.split('@')[0];

            const reactionLog = `[System Event]: ${reactorName} reacted ${emoji} to a message.`;

            // Append this event to history so AI knows
            await appendChatMessage(chatId, {
                role: "system",
                text: reactionLog
            });

        } catch (error) {
            Logger.error('REACTION_HANDLER', 'Failed to process reaction', { error: error.message });
        }
    }
};
