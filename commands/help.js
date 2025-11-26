import { getGeminiResponse } from "../handlers/geminiProcessor.js";

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

    const geminiPrompt = "Seseorang telah menjalankan perintah help. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan daftar perintah.";
    const aiSalutation = await getGeminiResponse(bot, geminiPrompt);

    let helpMessage = `${aiSalutation}\n\n`;
    helpMessage += `╭───「 *MENU UTAMA* 」\n`;
    helpMessage += `│\n`;
    helpMessage += `│ 🛠️ *UTILITY*\n`;
    helpMessage += `│ • *.help* - Tampilkan menu ini\n`;
    helpMessage += `│ • *.info* - Info statistik bot\n`;
    helpMessage += `│ • *.ping* - Cek kecepatan respon\n`;
    helpMessage += `│\n`;
    helpMessage += `│ 👥 *GROUP*\n`;
    helpMessage += `│ • *@everyone* - Tag semua member\n`;
    helpMessage += `│\n`;
    helpMessage += `╰──────────────────`;

    await message.reply(helpMessage);
  },
};
