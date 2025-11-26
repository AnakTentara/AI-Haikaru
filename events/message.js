import { getGeminiChatResponse, generateImageWithImagen } from "../handlers/geminiProcessor.js";
import { loadChatHistory, saveChatHistory } from "../handlers/dbHandler.js";

export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    // --- BLOCK 1: Handle Command Prefix ---
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

    // --- BLOCK 2: Handle Trigger Commands (No Prefix) ---
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

    // --- BLOCK 3: AI Logic (Modified) ---
    const botIdFromSession = bot.client.info.wid.user;
    const targetUserIds = ["263801807044691", "628816197519"];

    const isMentioned = message.mentionedIds.some((mentionedId) =>
      targetUserIds.some((targetId) => mentionedId.startsWith(targetId))
    );

    const chat = await message.getChat();
    const isPrivateChat = !chat.isGroup;

    let isReplyToBot = false;

    if (message.hasQuotedMsg) {
      const quotedMsg = await message.getQuotedMessage();
      if (
        quotedMsg.fromMe ||
        (quotedMsg.author && quotedMsg.author.startsWith(botIdFromSession)) ||
        (quotedMsg.from && quotedMsg.from.startsWith(botIdFromSession))
      ) {
        isReplyToBot = true;
      }
    }

    let debug = true;

    if (debug) {
      if (
        chat.isGroup &&
        message.body.length > 0 &&
        message.body.includes("@")
      ) {
        console.log(`[DEBUG AI] DEBUG MODE AKTIF`);
        console.log(`[DEBUG AI] Pesan diterima di grup: ${message.body}`);
        console.log(`[DEBUG AI] ID TARGET LIST: ${targetUserIds.join(", ")}`);
        console.log(`[DEBUG AI] ID Bot (Sesi Aktif): ${botIdFromSession}`);
        console.log(
          `[DEBUG AI] message.mentionedIds (Ditemukan): ${message.mentionedIds.join(", ")}`,
        );
        console.log(`[DEBUG AI] Hasil Cek isMentioned: ${isMentioned}`);
      }
    }

    if (isPrivateChat || isMentioned || isReplyToBot) {
      try {
        const chatId = chat.id._serialized;

        let chatHistory = await loadChatHistory(chatId);

        const senderWID = message.author || message.from;
        let senderIdentifier =
          message._data.notifyName || senderWID.split("@")[0];

        // Hasil regex akan menjadi: /@(263801807044691|628816197519)/g
        const mentionRegex = new RegExp(`@(${targetUserIds.join("|")})`, "g");
        let userText = message.body.replace(mentionRegex, "").trim();

        const date = new Date(message.timestamp * 1000);
        const timeString = date.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jakarta",
        });
        const timestampPrefix = `[${timeString}]`;

        const formattedUserMessage = `${timestampPrefix} [${senderIdentifier}]: ${userText}`;

        chatHistory.push({ role: "user", text: formattedUserMessage });

        const aiResponse = await getGeminiChatResponse(bot, chatHistory);

        const gambarMatch = aiResponse.match(/\[GAMBAR_PROMPT:\s*(.*?)\]/i);
        if (gambarMatch) {
          const imagePrompt = gambarMatch[1].trim();
          const cleanedText = aiResponse.replace(/\[GAMBAR_PROMPT:.*?\]/i, '').trim();
          try {
            // Generate image
            const imagePath = await generateImageWithImagen(bot, imagePrompt);

            // Kirim image + caption (kalau ada text)
            const caption = cleanedText || `🖼️ Gambar buat lo: "${imagePrompt}"`;
            const media = await MessageMedia.fromFilePath(imagePath);  // Import MessageMedia dari whatsapp-web.js
            await message.reply(media, undefined, { caption });

            // Cleanup temp file
            fs.unlinkSync(imagePath);

            // Update history dengan prompt gambar
            chatHistory.push({ role: "model", text: `[Generated image for: ${imagePrompt}]` });
            await saveChatHistory(chatId, chatHistory);

            console.log(`🖼️ Image sent for prompt: ${imagePrompt}`);
            return;  // Stop di sini, jangan reply text lagi
          } catch (imgError) {
            console.error("❌ Image generation failed:", imgError);
            await message.reply("Waduh, gagal bikin gambar nih 😭. Coba deskripsi yang lebih detail yuk! Error: " + imgError.message);
            return;
          }
        }

        const aggressivePrefixRegex = /^(\[.*?\]\s*(\[.*?\]:\s*)?)+/i;

        let cleanedResponse = aiResponse;

        cleanedResponse = cleanedResponse
          .replace(aggressivePrefixRegex, "")
          .trim();
        cleanedResponse = cleanedResponse
          .replace(aggressivePrefixRegex, "")
          .trim();

        if (cleanedResponse.length === 0) {
          cleanedResponse = aiResponse.trim();
        }

        const finalResponse = await message.reply(cleanedResponse);

        chatHistory.push({ role: "model", text: finalResponse.body });

        await saveChatHistory(chatId, chatHistory);
        console.log(`\n${formattedUserMessage}`);
        console.log("🟢 AI Chat Response:\n", cleanedResponse);
      } catch (error) {
        console.error("❌ Kesalahan saat menjalankan AI Chat:", error);
        await message.reply(
          "Maaf, AI-Haikaru mengalami kendala saat memproses riwayat chat. (Cek koneksi MongoDB).",
        );
      }
    }
  },
};