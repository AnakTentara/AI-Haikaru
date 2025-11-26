import { getGeminiResponse } from "../handlers/geminiProcessor.js";

export default {
  name: "everyone",
  description: "Tag semua orang di grup",
  usage: "@everyone",
  prefixRequired: false,
  triggers: ["@everyone"],

  async execute(message, args, bot) {
    try {
      const chat = await message.getChat();
      if (!chat.isGroup) {
        return message.reply("@everyone hanya dapat digunakan di grup.");
      }
      const participants = chat.participants;
      const mentions = participants.map((p) => p.id._serialized);

      const geminiPrompt = `seseorang telah menjalankan perintah tag everyone, yang artinya kamu akan membalas pesan tersebut dengan balasan + tag semua orang yang ada di dalam grup. buatlah 1 kalimat nya untuk orang yang menjalankan perintah tersebut.
`;
      const aiResponseText = await getGeminiResponse(bot, geminiPrompt);
      let teks = `${aiResponseText}\n\n`;

      participants.forEach((p) => {
        if (p.id && p.id.user) {
          teks += `@${p.id.user} `;
        }
      });

      await bot.client.sendMessage(chat.id._serialized, teks, {
        mentions: mentions,
        quotedMessageId: message.id._serialized,
      });
    } catch (error) {
      console.error("Kesalahan Tag Semua:", error);
      message.reply("Terjadi kesalahan saat mencoba tag semua orang.");
    }
  },
};
