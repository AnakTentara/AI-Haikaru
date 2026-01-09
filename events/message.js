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

    let senderName = "Unknown";
    try {
      const contact = await message.getContact();
      senderName = contact.name || message._data.notifyName || "Unknown";
    } catch (error) {
      // Fallback if contact fetch fails (common in wwebjs)
      senderName = message._data.notifyName || "Unknown";
    }

    const senderPhone = senderWID.split("@")[0];

    // Identity format: [Name/Phone/JID]
    // Example: [Haikal/6289675732001/6289675732001@c.us]
    const identityTag = `[${senderName}/${senderPhone}/${senderWID}]`;

    const timeStr = new Date(message.timestamp * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta"
    });

    // Clean user text from mentions (only for cleanText processing, raw text might be needed)
    const targetUserIds = config.targetUserIds || [];
    const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
    const cleanText = body.replace(mentionRegex, "").trim();

    let fullText = `${cleanText}`;

    // Handle Quoted Message (Reply Context)
    let isReplyToBot = false;
    let quotedBody = "";
    if (hasQuotedMsg) {
      const quoted = await message.getQuotedMessage();
      isReplyToBot = quoted.fromMe || quoted.author?.startsWith(botId) || quoted.from?.startsWith(botId);

      // Limit quoted text length for sanity
      quotedBody = quoted.body.substring(0, 100).replace(/\n/g, " ");
      fullText += `\n[Replying to: "${quotedBody}"]`;
    }

    const newMessage = {
      role: "user",
      text: `[${timeStr}] ${identityTag}: ${fullText}`
    };

    const shouldRespond = isPrivate || isMentioned || isReplyToBot;

    if (shouldRespond) {
      // Orchestrate AI Response Flow
      const chat = await message.getChat();
      await orchestrateAIResponse(bot, message, chat, chatId, newMessage);
    } else if (!message.fromMe) {
      // Auto-reaction logic if not responding
      await handleAutoReaction(bot, message, chatId);
    }

    // 6. Start Autonomous Monitoring (if Group)
    const chatObj = await message.getChat();
    const isPrivateChat = !chatObj.isGroup;

    if (!isPrivateChat && bot.autonomous) {
      bot.autonomous.startMonitoring(chatId);
    }
  },
};
