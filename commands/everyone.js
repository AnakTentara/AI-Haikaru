import { getGeminiResponse } from "../handlers/geminiProcessor.js";
import { tag_everyone } from "../handlers/functionHandler.js";

export function formatEveryoneMessage(result, aiResponseText) {
  return `${aiResponseText}\n\n${result.mentionText}`;
}

export default {
  name: "everyone",
  description: "Tag semua orang di grup",
  usage: "@everyone",
  prefixRequired: false,
  triggers: ["@everyone"],

  async execute(message, args, bot) {
    try {
      const chat = await message.getChat();

      // Use handler logic
      const result = await tag_everyone(bot, message, chat);

      const geminiPrompt = `seseorang telah menjalankan perintah tag everyone, yang artinya kamu akan membalas pesan tersebut dengan balasan + tag semua orang yang ada di dalam grup. buatlah 1 kalimat nya untuk orang yang menjalankan perintah tersebut.
`;
      const aiResponseText = await getGeminiResponse(bot, geminiPrompt);
      const teks = formatEveryoneMessage(result, aiResponseText);

      await bot.client.sendMessage(chat.id._serialized, teks, {
        mentions: result.mentions,
        quotedMessageId: message.id._serialized,
      });
    } catch (error) {
      console.error("Kesalahan Tag Semua:", error);
      message.reply(error.message);
    }
  },
};
