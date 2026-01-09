import { getGeminiResponse } from "../handlers/geminiProcessor.js";
import { tag_everyone } from "../handlers/functionHandler.js";
import Logger from "../handlers/logger.js";

export function formatEveryoneMessage(result, aiResponseText) {
  return `${aiResponseText}\n\n${result.mentionText}`;
}

export default {
  name: "everyone",
  description: "Tag semua orang di grup",
  usage: "@everyone",
  prefixRequired: false,
  triggers: ["@everyone"],

  async execute(message, args, bot, chatHistory) {
    if (chatHistory) {
      chatHistory.push({ role: "model", text: "[Executed command]" });
    }

    try {
      Logger.function('tag_everyone', 'Tagging all members...');
      const chat = await message.getChat();

      // Use handler logic
      const result = await tag_everyone(bot, message, chat);
      Logger.data('tag_everyone', 'Members tagged', {
        count: result.participantCount,
        group: result.groupName
      });
      // Custom message from AI Tool Call (args[0])
      const customMessage = args && args[0] ? args[0] : null;

      let aiResponseText = "";
      if (customMessage) {
        // Direct message from AI
        aiResponseText = `📢 ${customMessage}`;
      } else {
        // Fallback: Generate generic hype message
        const geminiPrompt = `seseorang telah menjalankan perintah tag everyone, yang artinya kamu akan membalas pesan tersebut dengan balasan + tag semua orang yang ada di dalam grup. buatlah 1 kalimat nya untuk orang yang menjalankan perintah tersebut.`;
        aiResponseText = await getGeminiResponse(bot, geminiPrompt, chatHistory);
      }

      const teks = formatEveryoneMessage(result, aiResponseText);

      await bot.client.sendMessage(chat.id._serialized, teks, {
        mentions: result.mentions,
        quotedMessageId: message.id._serialized,
      });
      Logger.outgoing('tag_everyone', `Tagged ${result.participantCount} members`);
      if (chatHistory) {
        chatHistory.push({ role: "model", text: `[Tagged ${result.participantCount} members di grup ${result.groupName}]` });
      }
    } catch (error) {
      console.error("Kesalahan Tag Semua:", error);
      message.reply(error.message);
    }
  },
};
