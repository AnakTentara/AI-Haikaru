import { getGeminiResponse } from "../handlers/geminiProcessor.js";
import { show_help_menu } from "../handlers/functionHandler.js";
import Logger from "../handlers/logger.js";

export function formatHelpMessage(data, aiSalutation) {
  let helpMessage = `${aiSalutation}\n\n`;
  helpMessage += `🎯 *Fitur AI-Haikaru v${data.version}*\n\n`;

  data.features.forEach(category => {
    helpMessage += `${category.category}\n`;
    category.items.forEach(item => {
      helpMessage += `• ${item}\n`;
    });
    helpMessage += `\n`;
  });

  helpMessage += `💡 *Contoh Penggunaan Natural Language:*\n`;
  data.naturalLanguageExamples.forEach(example => {
    helpMessage += `${example}\n`;
  });

  helpMessage += `\n_Prefix: ${data.prefix} (masih bisa dipakai juga!)_`;
  return helpMessage;
}

export default {
  name: "help",
  description: "Tampilkan semua perintah yang tersedia",
  usage: ".help [perintah]",
  prefixRequired: true,
  triggers: [".help"],
  async execute(message, args, bot) {
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      const command = bot.commands.get(commandName);

      if (!command) {
        return message.reply(
          `❌ Perintah \`${commandName}\` tidak ditemukan. Coba ketik *${bot.prefix}help* untuk daftar lengkap.`,
        );
      }

      let reply = `📚 *Detail Perintah: ${command.name}*\n`;
      reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      reply += `📝 *Deskripsi:*\n${command.description || "Tidak ada deskripsi yang terperinci."}\n\n`;
      reply += `💡 *Cara Penggunaan:*\n\`${command.usage || `${bot.prefix}${command.name}`}\`\n`;

      if (
        command.prefixRequired === false &&
        command.triggers &&
        command.triggers.length > 0
      ) {
        reply += `\n🗣️ *Panggilan Cepat:*\nBot merespons jika pesan berisi: \`${command.triggers.join(", ")}\``;
      }
      return message.reply(reply);
    }

    // Get data using handler
    const data = await show_help_menu(bot);

    const geminiPrompt = "Seseorang telah menjalankan perintah help. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan daftar perintah.";
    const aiSalutation = await getGeminiResponse(bot, geminiPrompt, chatHistory);

    const helpMessage = formatHelpMessage(data, aiSalutation);

    await message.reply(helpMessage);
  },
};
