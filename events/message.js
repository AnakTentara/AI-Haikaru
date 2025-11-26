import { getGeminiChatResponse } from "../handlers/geminiProcessor.js";
import { loadChatHistory, saveChatHistory } from "../handlers/dbHandler.js";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';

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
      let result;
      let responseText;

      switch (call.name) {
        case 'get_bot_info':
          result = await get_bot_info(bot, message, chat);
          responseText = `🤖 *Info Bot AI-Haikaru*\n\n`;
          responseText += `━━━━━━ *STATISTIK BOT* ━━━━━━\n`;
          responseText += `🤖 Nama Bot: *${result.botName}*\n`;
          responseText += `⚙️ Total Commands: *${result.totalCommands}*\n`;
          responseText += `⚡ Prefix: *${result.prefix}*\n`;
          responseText += `📝 Versi: *${result.version}*\n`;
          responseText += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          responseText += `👤 *INFO ANDA & CHAT INI:*\n`;
          responseText += `👋 Nama: *${result.userName}*\n`;
          responseText += `📞 Nomor: *${result.userNumber}*\n`;
          responseText += `💬 Tipe Chat: *${result.chatType}*\n`;
          if (result.groupName) {
            responseText += `👥 Nama Grup: *${result.groupName}*\n`;
            responseText += `👥 Peserta: *${result.groupParticipants}*\n`;
          }
          await message.reply(responseText);
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'check_ping':
          result = await check_ping(bot, message);
          responseText = `🏓 Pong! Gue masih responsif kok bro :v\n\n`;
          responseText += `⚡ Latency: *${result.latency}ms*\n`;
          responseText += `📊 Status: *${result.status}*`;
          await message.reply(responseText);
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'show_help_menu':
          result = await show_help_menu(bot);
          responseText = `🎯 *Fitur AI-Haikaru v${result.version}*\n\n`;
          result.features.forEach(category => {
            responseText += `${category.category}\n`;
            category.items.forEach(item => {
              responseText += `• ${item}\n`;
            });
            responseText += `\n`;
          });
          responseText += `💡 *Contoh Penggunaan Natural Language:*\n`;
          result.naturalLanguageExamples.forEach(example => {
            responseText += `${example}\n`;
          });
          responseText += `\n_Prefix: ${result.prefix} (masih bisa dipakai juga!)_`;
          await message.reply(responseText);
          chatHistory.push({ role: "model", text: responseText });
          break;

        case 'tag_everyone':
          result = await tag_everyone(bot, message, chat);
          responseText = `Oke nih, gue panggil semua member! 👥\n\n${result.mentionText}`;
          await bot.client.sendMessage(chat.id._serialized, responseText, {
            mentions: result.mentions,
            quotedMessageId: message.id._serialized,
          });
          chatHistory.push({ role: "model", text: `[Tagged ${result.participantCount} members di grup ${result.groupName}]` });
          break;

        case 'generate_image':
          result = await generate_image(call.args.prompt);
          if (result.success) {
            const media = MessageMedia.fromFilePath(result.imagePath);
            responseText = `Nih gambarnya udah jadi! 🎨✨\n\n_Generated: ${result.prompt}_`;
            await message.reply(media, undefined, { caption: responseText });
            // Cleanup temp file
            fs.unlinkSync(result.imagePath);
            chatHistory.push({ role: "model", text: `[Generated image: ${result.prompt}]` });
          } else {
            responseText = `Waduh, gagal bikin gambar nih 😭\nError: ${result.error}`;
            await message.reply(responseText);
            chatHistory.push({ role: "model", text: responseText });
          }
          break;

        case 'perform_google_search':
          result = await perform_google_search(bot, call.args.query);
          responseText = `🔎 *Hasil Pencarian Google:*\n\n${result.result}\n\n_Source: Google Search via Gemini_`;
          await message.reply(responseText);
          chatHistory.push({ role: "model", text: responseText });
          break;
      }

      console.log(`✅ Function executed: ${call.name}`);
    } catch (error) {
      console.error(`❌ Error executing function ${call.name}:`, error);
      await message.reply(`Ups, ada error saat menjalankan ${call.name}: ${error.message}`);
    }
  }

  // Save history after all functions executed
  await saveChatHistory(chatId, chatHistory);
}

export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    const { body, from, id, mentionedIds, hasQuotedMsg } = message;
    const { prefix, config } = bot;

    // --- BLOCK 1: Handle Command Prefix ---
    if (body.toLowerCase().trim().startsWith(prefix)) {
      if (from === "status@broadcast") return;

      const args = body.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = bot.commands.get(commandName);

      if (command) {
        try {
          console.log(`🔵 Perintah: ${commandName} | Dari: ${from} | Chat: ${id.remote}`);
          await command.execute(message, args, bot);
        } catch (error) {
          console.error(`❌ Kesalahan saat menjalankan perintah ${commandName}:`, error);
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
          console.log(`🔵 Perintah: ${name} | Dari: ${from} | Chat: ${id.remote}`);
          await command.execute(message, [], bot);
          return; // Exit after executing trigger command
        } catch (error) {
          console.error(`❌ Kesalahan saat menjalankan perintah ${name}:`, error);
          await message.reply(config.messages.errorExecutingCommand);
        }
      }
    }

    // --- BLOCK 3: AI Logic ---
    const botIdFromSession = bot.client.info.wid.user;
    const targetUserIds = config.targetUserIds || [];

    // Cek apakah salah satu dari ID target di-mention
    const isMentioned = mentionedIds.some((mentionedId) =>
      targetUserIds.some((targetId) => mentionedId.startsWith(targetId))
    );

    const chat = await message.getChat();
    const isPrivateChat = !chat.isGroup;

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

    if (isPrivateChat || isMentioned || isReplyToBot) {
      try {
        const chatId = chat.id._serialized;
        const chatHistory = await loadChatHistory(chatId);

        const senderWID = message.author || from;
        const senderIdentifier = message._data.notifyName || senderWID.split("@")[0];

        // Hapus mention dari pesan user agar bersih
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
            const media = await message.downloadMedia();
            if (media && media.mimetype.startsWith("image/")) {
              newMessage.image = {
                mimeType: media.mimetype,
                data: media.data
              };
              console.log("📸 Gambar diterima dari user & disimpan ke history.");
            }
          } catch (err) {
            console.error("Gagal download media:", err);
          }
        } else if (hasQuotedMsg) {
          try {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg.hasMedia) {
              const media = await quotedMsg.downloadMedia();
              if (media && media.mimetype.startsWith("image/")) {
                newMessage.image = {
                  mimeType: media.mimetype,
                  data: media.data
                };
                console.log("📸 Gambar diterima dari quoted message & disimpan ke history.");
              }
            }
          } catch (err) {
            console.error("Gagal download quoted media:", err);
          }
        }

        chatHistory.push(newMessage);

        const aiResponse = await getGeminiChatResponse(bot, chatHistory, "gemini-2.5-flash");

        // Handle function calls from AI
        if (aiResponse.type === 'function_call') {
          await handleFunctionCalls(bot, message, chat, chatHistory, chatId, aiResponse.functionCalls);
          return;
        }

        // Normal text response
        // Bersihkan respons AI dari prefix yang tidak diinginkan (jika ada)
        const aggressivePrefixRegex = /^(\[.*?\]\s*(\[.*?\]:\s*)?)+/i;
        let cleanedResponse = aiResponse.replace(aggressivePrefixRegex, "").trim();

        if (!cleanedResponse) cleanedResponse = aiResponse.trim();

        const finalResponse = await message.reply(cleanedResponse);

        chatHistory.push({ role: "model", text: finalResponse.body });
        await saveChatHistory(chatId, chatHistory);

        console.log(`\n${formattedUserMessage}`);
        console.log("🟢 AI Chat Response:\n", cleanedResponse);
      } catch (error) {
        console.error("❌ Kesalahan saat menjalankan AI Chat:", error);
        await message.reply("Maaf, AI-Haikaru sedang gangguan. Coba lagi nanti ya!");
      }
    }
  },
};