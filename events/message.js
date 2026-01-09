import Logger from "../handlers/logger.js";
import { appendChatMessage } from "../handlers/dbHandler.js";
import { handleCommands } from "../handlers/commandHandler.js";
import { processIncomingMedia } from "../handlers/mediaHandler.js";
import { handleAutoReaction } from "../handlers/reactionHandler.js";
import { orchestrateAIResponse } from "../handlers/aiChatHandler.js";

/**
 * Main Message Event Handler
 * Refactored for elegance and modularity.
 */
export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    const { body, from, id, mentionedIds, hasQuotedMsg } = message;
    const { config } = bot;
    const chatId = id.remote;

    // 1. Log incoming message
    Logger.incoming('MESSAGE', `New from ${from}`, {
      body: body.substring(0, 50) + (body.length > 50 ? '...' : '')
    });

    // 2. Handle Commands (Prefix & Triggers)
    const isCommand = await handleCommands(bot, message);
    if (isCommand) return;

    // 3. Prepare AI Context
    const senderWID = message.author || from;
    let senderName = "Unknown";

    // Bypass getContact() to avoid "windows.Store.ContactMethods.getIsMyContact is not a function" error
    // We rely on the notifyName (PushName) that came with the message packet.
    if (message._data && (message._data.notifyName || message._data.pushname)) {
      senderName = message._data.notifyName || message._data.pushname;
    }

    const senderPhone = senderWID.split("@")[0];
    const identityTag = `[${senderName}/${senderPhone}/${senderWID}]`;
    const timeStr = new Date(message.timestamp * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta"
    });

    const targetUserIds = config.targetUserIds || [];
    const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
    const cleanText = body.replace(mentionRegex, "").trim();
    let fullText = `${cleanText}`;

    // 4. Determine Response Logic & Context (Quote)
    const botId = bot.client.info.wid.user;
    const chatObj = await message.getChat();
    const isPrivateChat = !chatObj.isGroup;
    const isMentioned = mentionedIds.some(m => targetUserIds.some(t => m.startsWith(t)));

    let isReplyToBot = false;
    if (hasQuotedMsg) {
      const quoted = await message.getQuotedMessage();
      isReplyToBot = quoted.fromMe || quoted.author?.startsWith(botId) || quoted.from?.startsWith(botId);

      const quotedBody = quoted.body.substring(0, 100).replace(/\n/g, " ");
      fullText += `\n[Replying to: "${quotedBody}"]`;
    }

    // 5. Construct Message Object
    const newMessage = {
      role: "user",
      text: `[${timeStr}] ${identityTag}: ${fullText}`
    };

    // 6. Process Media (Images, Docs, Audio) - May update newMessage
    const mediaData = await processIncomingMedia(bot, message);
    if (mediaData) {
      if (mediaData.image) newMessage.image = mediaData.image;
      if (mediaData.systemNote) newMessage.text += mediaData.systemNote;
    }

    // 7. Save to History
    await appendChatMessage(chatId, newMessage);

    // 8. Execute Response or Reaction
    const shouldRespond = isPrivateChat || isMentioned || isReplyToBot;

    if (shouldRespond) {
      await orchestrateAIResponse(bot, message, chatObj, chatId, newMessage);
    } else if (!message.fromMe) {
      await handleAutoReaction(bot, message, chatId);
    }

    // 9. Start Autonomous Monitoring (if Group)
    if (!isPrivateChat && bot.autonomous) {
      bot.autonomous.startMonitoring(chatId);
    }
  },
};
