import { getGeminiChatResponse } from "../handlers/geminiProcessor.js";
import { loadChatHistory, saveChatHistory } from "../handlers/dbHandler.js";

export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    if (message.body.toLowerCase().trim().startsWith(bot.prefix)) {
      if (message.from === "status@broadcast") return;

      const args = message.body.slice(bot.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = bot.commands.get(commandName);

      if (command) {
        try {
          console.log(
            `🔵 Perintah: ${commandName} | Dari: ${message.from} | Chat: ${message.id.remote}`,
          );
          await command.execute(message, args, bot);
        } catch (error) {
          console.error(
            `❌ Kesalahan saat menjalankan perintah ${commandName}:`,
            error,
          );
          await message.reply(bot.config.messages.errorExecutingCommand);
        }
      }
      return;
    }

    for (const [name, command] of bot.commands) {
      if (
        command.prefixRequired === false &&
        command.triggers &&
        Array.isArray(command.triggers) &&
        command.triggers.some((trigger) =>
          message.body.toLowerCase().includes(trigger.toLowerCase()),
        )
      ) {
        try {
          console.log(
            `🔵 Perintah: ${name} | Dari: ${message.from} | Chat: ${message.id.remote}`,
          );
          await command.execute(message, [], bot);
          break;
        } catch (error) {
          console.error(
            `❌ Kesalahan saat menjalankan perintah ${name}:`,
            error,
          );
          await message.reply(bot.config.messages.errorExecutingCommand);
        }
        return;
      }
    }

    const botIdFromSession = bot.client.info.wid.user;
    const targetUserId = "263801807044691";
    const isMentioned = message.mentionedIds.some((id) =>
      id.startsWith(targetUserId),
    );

    const chat = await message.getChat();
    const isPrivateChat = !chat.isGroup;

    let debug = false;

    if (debug) {
      console.log(`[DEBUG AI] DEBUG MODE AKTIF`);
      if (
        chat.isGroup &&
        message.body.length > 0 &&
        message.body.includes("@")
      ) {
        console.log(`[DEBUG AI] Pesan diterima di grup: ${message.body}`);
        console.log(`[DEBUG AI] ID TARGET UJI COBA: ${targetUserId}`);
        console.log(`[DEBUG AI] ID Bot (Sesi Aktif): ${botIdFromSession}`);
        console.log(
          `[DEBUG AI] message.mentionedIds (Ditemukan): ${message.mentionedIds.join(", ")}`,
        );
        console.log(`[DEBUG AI] Hasil Cek isMentioned: ${isMentioned}`);
      }
    } else return;

if (isPrivateChat || isMentioned) {
      try {
        const chatId = chat.id._serialized;

        let chatHistory = await loadChatHistory(chatId); 

        const senderWID = message.author || message.from;
        let senderIdentifier = message._data.notifyName || senderWID.split('@')[0];

        const mentionRegex = new RegExp(`@${targetUserId}`, 'g');
        let userText = message.body.replace(mentionRegex, '').trim();

        const date = new Date(message.timestamp * 1000);
        const timeString = date.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta'
        });
        const timestampPrefix = `[${timeString}]`;

        const formattedUserMessage = `${timestampPrefix} [${senderIdentifier}]: ${userText}`;

        chatHistory.push({ role: 'user', text: formattedUserMessage });
        
        const aiResponse = await getGeminiChatResponse(bot, chatHistory);

        const aggressivePrefixRegex = /^(\[.*?\]\s*(\[.*?\]:\s*)?)+/i;

        let cleanedResponse = aiResponse;

        cleanedResponse = cleanedResponse.replace(aggressivePrefixRegex, '').trim();
        cleanedResponse = cleanedResponse.replace(aggressivePrefixRegex, '').trim(); 

        if (cleanedResponse.length === 0) {
            cleanedResponse = aiResponse.trim();
        }

        const finalResponse = await message.reply(cleanedResponse);

        chatHistory.push({ role: 'model', text: finalResponse.body });

        await saveChatHistory(chatId, chatHistory);

        console.log("🟢 AI Chat Response:", cleanedResponse);
      } catch (error) {
        console.error("❌ Kesalahan saat menjalankan AI Chat:", error);
        await message.reply(
          "Maaf, AI-Haikaru mengalami kendala saat memproses riwayat chat. (Cek koneksi MongoDB).",
        );
      }
    }
  },
};