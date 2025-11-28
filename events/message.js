import { getGeminiChatResponse, analyzeEmojiReaction, analyzeContextIntent } from "../handlers/geminiProcessor.js";
import { loadChatHistory, saveChatHistory, appendChatMessage } from "../handlers/dbHandler.js";
import Logger from "../handlers/logger.js";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';

// Import command formatters
import { formatInfoMessage } from '../commands/info.js';
import { formatHelpMessage } from '../commands/help.js';
import { formatPingMessage } from '../commands/ping.js';
import { formatEveryoneMessage } from '../commands/everyone.js';
import { handleImageResponse } from '../commands/img.js';

// Emoji reaction cooldown tracker (chatId -> last reaction timestamp)
const reactionCooldowns = new Map();
const imageSpamTracker = new Map();

/**
 * Handle function calls from AI
 */
async function handleFunctionCalls(bot, message, chat, chatHistory, chatId, functionCalls) {
  const {
    get_bot_info,
    check_ping,
    show_help_menu,
    tag_everyone,
    generate_image,
    perform_google_search
  } = await import('../handlers/functionHandler.js');

  for (const call of functionCalls) {
    try {
      Logger.function('AI_FUNCTION', `Executing function: ${call.name}`, { args: call.args });
      let result;
      let responseText;

      switch (call.name) {
        case 'get_bot_info':
          Logger.function('get_bot_info', 'Fetching bot info...');
          result = await get_bot_info(bot, message, chat);
          Logger.data('get_bot_info', 'Bot info retrieved', { botName: result.botName, version: result.version });
          responseText = formatInfoMessage(result, "🤖 *Info Bot AI-Haikaru*");
          await message.reply(responseText);
          Logger.outgoing('get_bot_info', 'Bot info sent to user');
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'check_ping':
          Logger.function('check_ping', 'Checking bot responsiveness...');
          result = await check_ping(bot, message);
          Logger.data('check_ping', 'Ping result', { latency: result.latency, status: result.status });
          responseText = formatPingMessage(result);
          await message.reply(responseText);
          Logger.outgoing('check_ping', `Ping response sent: ${result.latency}ms`);
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'show_help_menu':
          Logger.function('show_help_menu', 'Generating help menu...');
          result = await show_help_menu(bot);
          Logger.data('show_help_menu', 'Help menu generated', { featureCount: result.features.length });
          responseText = formatHelpMessage(result, "");
          await message.reply(responseText);
          Logger.outgoing('show_help_menu', 'Help menu sent to user');
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'tag_everyone':
          Logger.function('tag_everyone', 'Tagging all members...');
          result = await tag_everyone(bot, message, chat);
          Logger.data('tag_everyone', 'Members tagged', { count: result.participantCount, group: result.groupName });
          responseText = formatEveryoneMessage(result, "");
          await bot.client.sendMessage(chat.id._serialized, responseText, {
            mentions: result.mentions,
            quotedMessageId: message.id._serialized,
          });
          Logger.outgoing('tag_everyone', `Tagged ${result.participantCount} members`);
          chatHistory.push({ role: "model", text: `[Tagged ${result.participantCount} members di grup ${result.groupName}]` });
          break;

        case 'generate_image':
          Logger.function('generate_image', `Generating image: ${call.args.prompt}`);
          await message.reply("Oke siap! tunggu yaa, aku gambar duluu! 🎨✨");
          result = await generate_image(bot, call.args.prompt);
          Logger.data('generate_image', 'Image generation result', { success: result.success, prompt: result.prompt });
          await handleImageResponse(message, result);

          if (result.success) {
            Logger.outgoing('generate_image', `Image sent successfully: ${result.prompt}`);
            chatHistory.push({ role: "model", text: `[Generated image: ${result.prompt}]` });
          } else {
            Logger.error('generate_image', `Image generation failed: ${result.error}`);
            chatHistory.push({ role: "model", text: `[Failed to generate image: ${result.error}]` });
          }
          break;

        case 'perform_google_search':
          Logger.function('perform_google_search', `Searching for: ${call.args.query}`);
          result = await perform_google_search(bot, call.args.query);
          Logger.data('perform_google_search', 'Search results retrieved', { query: result.query });
          responseText = `🔎 *Hasil Pencarian Google:*\n\n${result.result}\n\n_Source: Google Search via Gemini_`;
          await message.reply(responseText);
          Logger.outgoing('perform_google_search', 'Search results sent to user');
          chatHistory.push({ role: "model", text: responseText });
          break;
      }

      Logger.success('AI_FUNCTION', `Function executed: ${call.name}`);
    } catch (error) {
      Logger.error('AI_FUNCTION', `Error executing function ${call.name}`, { error: error.message });
      await message.reply(`Ups, ada error saat menjalankan ${call.name}: ${error.message}`);
    }
  }

  // Save history after all functions executed
  Logger.db('SAVE_HISTORY', `Saving chat history for ${chatId}`);
  await saveChatHistory(chatId, chatHistory);
}

export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    const { body, from, id, mentionedIds, hasQuotedMsg } = message;
    const { prefix, config } = bot;

    // Log incoming message
    Logger.incoming('MESSAGE', `New message from ${from}`, {
      body: body.substring(0, 50) + (body.length > 50 ? '...' : ''),
      chatId: id.remote
    });

    // --- BLOCK 1: Handle Command Prefix ---
    if (body.toLowerCase().trim().startsWith(prefix)) {
      if (from === "status@broadcast") return;

      const args = body.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = bot.commands.get(commandName);

      if (command) {
        try {
          Logger.command('PREFIX_COMMAND', `Executing command: ${commandName}`, { from, args });
          await command.execute(message, args, bot);
          Logger.success('PREFIX_COMMAND', `Command executed: ${commandName}`);
        } catch (error) {
          Logger.error('PREFIX_COMMAND', `Error executing command: ${commandName}`, { error: error.message });
          await message.reply(config.messages.errorExecutingCommand);
        }
      }
      return;
    }

    // --- BLOCK 2: Handle Trigger Commands (No Prefix) ---
    for (const [name, command] of bot.commands) {
      if (
        command.prefixRequired === false &&
        command.triggers?.some((trigger) => body.toLowerCase().includes(trigger.toLowerCase()))
      ) {
        try {
          Logger.command('TRIGGER_COMMAND', `Executing trigger command: ${name}`, { from });
          await command.execute(message, [], bot);
          Logger.success('TRIGGER_COMMAND', `Trigger command executed: ${name}`);
          return; // Exit after executing trigger command
        } catch (error) {
          Logger.error('TRIGGER_COMMAND', `Error executing trigger: ${name}`, { error: error.message });
          await message.reply(config.messages.errorExecutingCommand);
        }
      }
    }

    // --- BLOCK 3: AI Logic & Global Message Handling ---
    const botIdFromSession = bot.client.info.wid.user;
    const targetUserIds = config.targetUserIds || [];

    const chat = await message.getChat();
    const isPrivateChat = !chat.isGroup;
    const chatId = chat.id._serialized;

    // 1. Prepare Message Object
    const senderWID = message.author || from;
    const senderIdentifier = message._data.notifyName || senderWID.split("@")[0];

    // Hapus mention dari pesan user agar bersih untuk AI
    const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
    const userText = body.replace(mentionRegex, "").trim();

    const timeString = new Date(message.timestamp * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    const formattedUserMessage = `[${timeString}] [${senderIdentifier}]: ${userText}`;
    const newMessage = { role: "user", text: formattedUserMessage };

    // --- IMAGE HANDLING LOGIC ---
    if (message.hasMedia) {
      try {
        Logger.info('IMAGE', 'Downloading image from message...');
        const media = await message.downloadMedia();
        if (media && media.mimetype.startsWith("image/")) {
          // Anti-spam: Check if user is spamming images
          const now = Date.now();
          const senderId = senderWID;

          if (!imageSpamTracker.has(senderId)) {
            imageSpamTracker.set(senderId, []);
          }

          const timestamps = imageSpamTracker.get(senderId);
          // Remove timestamps older than 60 seconds
          const recentTimestamps = timestamps.filter(t => now - t < 60000);

          if (recentTimestamps.length >= 5) {
            // User has sent 5+ images in the last 60 seconds - SPAM!
            Logger.warning('IMAGE_SPAM', `User ${senderIdentifier} is spamming images (${recentTimestamps.length + 1} images). Ignoring this image.`);
            return; // Exit early, don't process this message at all
          }

          // Not spam, add timestamp and continue
          recentTimestamps.push(now);
          imageSpamTracker.set(senderId, recentTimestamps);

          newMessage.image = {
            mimeType: media.mimetype,
            data: media.data
          };
          Logger.success('IMAGE', 'Image downloaded and added to message', { mimeType: media.mimetype });
        }
      } catch (err) {
        Logger.error('IMAGE', 'Failed to download media', { error: err.message });
      }
    }

    // 2. Save Message to History (Global)
    Logger.db('APPEND_MESSAGE', `Appending message to history: ${chatId}`);
    await appendChatMessage(chatId, newMessage);

    // Cek apakah bot di-mention atau direply
    const isMentioned = mentionedIds.some((mentionedId) =>
      targetUserIds.some((targetId) => mentionedId.startsWith(targetId))
    );

    let isReplyToBot = false;
    if (hasQuotedMsg) {
      const quotedMsg = await message.getQuotedMessage();
      if (
        quotedMsg.fromMe ||
        (quotedMsg.author && quotedMsg.author.startsWith(botIdFromSession)) ||
        (quotedMsg.from && quotedMsg.from.startsWith(botIdFromSession))
      ) {
        isReplyToBot = true;
      }
    }

    const shouldRespond = isPrivateChat || isMentioned || isReplyToBot;

    // 3. Logic Reaksi Emoji (Hanya jika TIDAK merespons dengan teks)
    if (!shouldRespond && !message.fromMe) {
      try {
        // Check cooldown - minimum 30 detik antara reaksi per chat
        const now = Date.now();
        const lastReaction = reactionCooldowns.get(chatId) || 0;
        const cooldownTime = 30000; // 30 detik
        const timeSinceLastReaction = now - lastReaction;

        if (timeSinceLastReaction < cooldownTime) {
          const remainingTime = Math.ceil((cooldownTime - timeSinceLastReaction) / 1000);
          Logger.info('EMOJI_REACTION', `Cooldown active, skipping reaction (${remainingTime}s remaining)`);
        } else {
          Logger.ai('EMOJI_REACTION', 'Analyzing message for emoji reaction...');
          const historyForReaction = await loadChatHistory(chatId);
          const reactionAnalysis = await analyzeEmojiReaction(bot, historyForReaction);

          if (reactionAnalysis && reactionAnalysis.emoji) {
            const { emoji, urgensi } = reactionAnalysis;
            Logger.data('EMOJI_REACTION', 'Reaction analysis complete', { emoji, urgensi });
            let shouldReact = false;

            const chance = Math.random();
            // Adjusted probabilities to reduce spam:
            if (urgensi === "wajib" && chance > 0.2) shouldReact = true; // 80%
            else if (urgensi === "penting" && chance > 0.8) shouldReact = true; // 20%
            else if (urgensi === "opsional" && chance > 0.9) shouldReact = true; // 10%

            if (shouldReact) {
              await message.react(emoji);
              reactionCooldowns.set(chatId, now); // Update cooldown timestamp
              Logger.outgoing('EMOJI_REACTION', `Reacted with ${emoji}`, { urgensi, chance: chance.toFixed(2) });
            } else {
              Logger.info('EMOJI_REACTION', `Skipped reaction (${urgensi})`, { chance: chance.toFixed(2) });
            }
          }
        }
      } catch (err) {
        Logger.error('EMOJI_REACTION', 'Failed to process emoji reaction', { error: err.message });
      }
    }

    // 4. Logic Respons Teks (AI Chat)
    if (shouldRespond) {
      try {
        let typingTimeIndicator = 700;

        // Smart Context Logic (AI Intent Analysis)
        Logger.ai('SMART_CONTEXT', 'Analyzing context intent...');
        const requiresMemory = await analyzeContextIntent(bot, body);

        const historyLimit = requiresMemory ? 9999 : 30; // 30 (Fast) vs 9999 (Deep)

        if (requiresMemory) {
          Logger.info('SMART_CONTEXT', `Deep memory required! Loading ${historyLimit} messages.`);
        } else {
          Logger.info('SMART_CONTEXT', `Standard context sufficient. Loading ${historyLimit} messages.`);
        }

        Logger.db('LOAD_HISTORY', `Loading chat history for ${chatId} (Limit: ${historyLimit})`);
        const chatHistory = await loadChatHistory(chatId, historyLimit);

        const thinkingStart = Date.now();

        Logger.ai('AI_CHAT', 'Calling Gemini API...');
        const aiResponse = await getGeminiChatResponse(bot, chatHistory, "gemini-2.5-flash");

        if (aiResponse.type === 'function_call') {
          Logger.ai('AI_CHAT', 'AI requested function calls', { count: aiResponse.functionCalls.length });
          await handleFunctionCalls(bot, message, chat, chatHistory, chatId, aiResponse.functionCalls);
          return;
        }

        const aggressivePrefixRegex = /^(\[.*?\]\s*(\[.*?\]:\s*)?)+/i;
        let cleanedResponse = aiResponse.replace(aggressivePrefixRegex, "").trim();
        if (!cleanedResponse) cleanedResponse = aiResponse.trim();

        Logger.data('AI_CHAT', 'AI response ready', { length: cleanedResponse.length });

        const chatObj = await message.getChat();
        chatObj.sendStateTyping();

        await new Promise(resolve => setTimeout(resolve, typingTimeIndicator));

        chatObj.clearState();
        Logger.outgoing('AI_CHAT', `Sending AI response (${typingTimeIndicator / 1000}-second typing effect)`);
        const finalResponse = await message.reply(cleanedResponse);

        chatHistory.push({ role: "model", text: finalResponse.body });
        Logger.db('SAVE_HISTORY', `Saving chat history for ${chatId}`);
        await saveChatHistory(chatId, chatHistory);

        Logger.success('AI_CHAT', `AI response sent with ${(Date.now() - thinkingStart) / 1000}s`);

      } catch (error) {
        Logger.error('AI_CHAT', 'Error during AI chat processing', { error: error.message });
        await message.reply("Maaf, AI-Haikaru sedang gangguan. Coba lagi nanti ya!");
      }
    }
  },
};