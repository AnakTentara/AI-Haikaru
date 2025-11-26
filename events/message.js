import { getGeminiChatResponse } from "../handlers/geminiProcessor.js";
import { loadChatHistory, saveChatHistory } from "../handlers/dbHandler.js";

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

    // Debug Log (Simplified)
    if (chat.isGroup && body.includes("@")) {
      // console.log(`[DEBUG AI] Group Mention Check: ${isMentioned}`);
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
        chatHistory.push({ role: "user", text: formattedUserMessage });

        const aiResponse = await getGeminiChatResponse(bot, chatHistory);

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
        // await message.reply("Maaf, AI-Haikaru sedang gangguan."); // Optional error reply
      }
    }
  },
};