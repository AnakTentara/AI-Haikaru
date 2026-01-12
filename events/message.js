/**
 * FILE: AI-Haikaru/events/message.js
 */

import Logger from "../handlers/logger.js";
import { appendChatMessage } from "../handlers/dbHandler.js";
import { handleCommands } from "../handlers/commandHandler.js";
import { processIncomingMedia } from "../handlers/mediaHandler.js";
import { handleAutoReaction } from "../handlers/reactionHandler.js";
// Menggunakan 'handleMessage' dari aiChatHandler untuk logic utama chat AI
import { handleMessage as orchestrateAIResponse } from "../handlers/aiChatHandler.js"; 
// Impor 'areGroupsIgnored' yang sudah kita perbaiki di autonomousHandler.js
import { areGroupsIgnored } from "../handlers/autonomousHandler.js";

/**
 * Main Message Event Handler
 * Refactored for elegance and modularity.
 */
export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    // 0. Preliminary Checks (Ignore status messages, etc.)
    if (message.body === "" && !message.hasMedia) return;
    if (message.type === 'e2e_notification' || message.type === 'call_log') return;

    const { body, from, id, mentionedIds, hasQuotedMsg } = message;
    const { config } = bot;
    const chatId = id.remote;

    // 1. Log incoming message
    Logger.incoming('MESSAGE', `New from ${from}`, {
      body: body.substring(0, 50) + (body.length > 50 ? '...' : '')
    });

    // 2. Handle Commands (Prefix & Triggers)
    // Jika command tereksekusi, stop proses selanjutnya.
    const isCommand = await handleCommands(bot, message);
    if (isCommand) return;

    // 3. Prepare AI Context & Metadata
    const senderWID = message.author || from;
    let senderName = "Unknown";

    // Bypass getContact() crash risk (Window.Store error)
    // We rely on the notifyName (PushName) that came with the message packet first.
    if (message._data && (message._data.notifyName || message._data.pushname)) {
      senderName = message._data.notifyName || message._data.pushname;
    } else {
      // Fallback: Try getContact if pushname is missing (wrapped in try-catch)
      try {
          const contact = await message.getContact();
          if (contact) {
              senderName = contact.name || contact.pushname || contact.number;
          }
      } catch (e) {
          // Ignore contact fetch error
      }
    }

    const senderPhone = senderWID.split("@")[0];
    const lid = senderWID.includes('@lid') ? senderWID : "N/A";
    
    // Format Waktu: [HH:MM:SS, DD/MM/YYYY]
    // Kita gunakan waktu lokal saat pesan diterima bot (agar konsisten)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = now.toLocaleDateString('id-ID');
    const timestamp = `${timeStr}, ${dateStr}`;

    // Identity Tag baru sesuai request
    // [HH:MM:SS, DD/MM/YYYY] [ContactName] [Number: <ContactNumber> ; Lid: <LidNumber>] : <message>
    const identityHeader = `[${timestamp}] [${senderName}] [Number: ${senderPhone} ; Lid: ${lid}]`;

    // Clean up mentions from body text
    const targetUserIds = config.targetUserIds || []; // Bot's ID usually
    const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
    const cleanText = body.replace(mentionRegex, "").trim();
    
    let fullText = cleanText;

    // 4. Determine Response Logic & Context (Quote)
    const botId = bot.client.info.wid.user;
    const chatObj = await message.getChat();
    const isPrivateChat = !chatObj.isGroup;
    
    // Check if bot is mentioned
    const isMentioned = mentionedIds.includes(bot.client.info.wid._serialized) || 
                        mentionedIds.some(id => id.user === botId);

    let isReplyToBot = false;
    if (hasQuotedMsg) {
      try {
          const quoted = await message.getQuotedMessage();
          if (quoted) {
              isReplyToBot = quoted.fromMe; // Reply ke pesan bot sendiri
              
              const quotedBody = quoted.body.substring(0, 100).replace(/\n/g, " ");
              fullText += `\n[Replying to: "${quotedBody}"]`;
          }
      } catch (e) {
          // Ignore quote fetch error
      }
    }

    // 5. Construct Message Object (Standardized Format)
    // Kita simpan format lengkap ini ke DB agar AI 'ingat' konteks siapa bicara apa
    const finalUserMessage = `${identityHeader} : ${fullText}`;

    const newMessageEntry = {
      role: "user",
      text: finalUserMessage
    };

    // 6. Process Media (Images, Docs, Audio)
    const mediaData = await processIncomingMedia(bot, message);
    if (mediaData) {
      if (mediaData.image) newMessageEntry.image = mediaData.image;
      if (mediaData.systemNote) newMessageEntry.text += `\n[System Note: ${mediaData.systemNote}]`;
    }

    // 7. Save to History (DB)
    // Note: aiChatHandler (orchestrateAIResponse) usually appends message too. 
    // But since we split logic, let's append here IF we are not calling orchestrate immediately?
    // Actually, 'orchestrateAIResponse' (handleMessage from aiChatHandler) does appending.
    // So we ONLY append if we DON'T call the AI handler immediately to avoid double entry.
    
    const shouldRespond = isPrivateChat || isMentioned || isReplyToBot;

    // Cek Ignore List sebelum merespons di grup
    let isIgnored = false;
    if (!isPrivateChat) {
        isIgnored = await areGroupsIgnored(chatId);
    }

    // 8. Execute Response Logic
    if (shouldRespond && !isIgnored) {
        // Panggil Logic Utama AI
        // Kita pass message object asli karena handler butuh method reply()
        await orchestrateAIResponse(bot, message); 
    } else {
        // Jika tidak merespons (Passive Mode), kita tetap simpan log chat agar AI punya konteks masa lalu
        // saat nanti dipanggil.
        await appendChatMessage(chatId, newMessageEntry);

        // Cek Auto Reaction (hanya jika pesan bukan dari bot sendiri)
        if (!message.fromMe && !isIgnored) {
            await handleAutoReaction(bot, message, chatId);
        }
    }

    // 9. Start Autonomous Monitoring (if Group)
    // Bot mulai 'memantau' grup ini untuk inisiatif chat di masa depan
    if (!isPrivateChat && bot.autonomous && !isIgnored) {
      bot.autonomous.startMonitoring(chatId);
    }
  },
};