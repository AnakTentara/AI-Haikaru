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

    // 3. Prepare AI Context & Process Media
    const senderWID = message.author || from;
    const senderName = message._data.notifyName || senderWID.split("@")[0];
    const timeStr = new Date(message.timestamp * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta"
    });

    // Clean user text from mentions
    const targetUserIds = config.targetUserIds || [];
    const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
    const cleanText = body.replace(mentionRegex, "").trim();

    const newMessage = {
      role: "user",
      text: `[${timeStr}] [${senderName}]: ${cleanText}`
    };

    // Process Media (Images, Docs, Audio)
    const mediaData = await processIncomingMedia(bot, message);
    if (mediaData) {
      if (mediaData.image) newMessage.image = mediaData.image;
      if (mediaData.systemNote) newMessage.text += mediaData.systemNote;
    }

    // 4. Save to History
    await appendChatMessage(chatId, newMessage);

    // 5. Determine if we should respond with AI
    const botId = bot.client.info.wid.user;
    const isPrivate = !(await message.getChat()).isGroup;
    const isMentioned = mentionedIds.some(m => targetUserIds.some(t => m.startsWith(t)));

    let isReplyToBot = false;
    if (hasQuotedMsg) {
      const quoted = await message.getQuotedMessage();
      isReplyToBot = quoted.fromMe || quoted.author?.startsWith(botId) || quoted.from?.startsWith(botId);
    }

    const shouldRespond = isPrivate || isMentioned || isReplyToBot;

    if (shouldRespond) {
      // Orchestrate AI Response Flow
      await orchestrateAIResponse(bot, message, chatId, newMessage);
    } else if (!message.fromMe) {
      // Auto-reaction logic if not responding
      await handleAutoReaction(bot, message, chatId);
    }
  },
};