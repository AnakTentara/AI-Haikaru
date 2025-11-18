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

    await message.reply(
      "⏳ Tunggu sebentar, AI-Haikaru sedang menyiapkan daftar perintah paling keren untukmu...",
    );

    let commandList = "";
    bot.commands.forEach((command) => {
      commandList += ` - ${command.name}: ${command.description || "Tidak ada deskripsi"}\n`;
    });

    const geminiPrompt = `Daftar perintah bot ini adalah:\n\n${commandList}\n\nBerikan balasan untuk perintah '.help'. Balasan harus berupa sapaan yang santai, diikuti dengan daftar perintah di atas, diakhiri dengan instruksi cara melihat detail perintah. Gunakan Markdown WhatsApp (tebal *teks*). Jangan menggunakan kode blok. wajib buat format yang menarik dengan emoji, dan gunakan format styleing font whatsapp, untuk menebalkan hanya gunakan satu bintang (*) di awal dan akhir teks yang ingin ditebalkan, gunakan ( - ) untuk membuat list, dan gunakan (━━━━━━━━━━━━━━━━━━━━) untuk membuat garis pemisah. PALING PENTING tulis '> [HELP]' di baris pertama balasan mu.`;

    const geminiHelpResponse = await getGeminiResponse(bot, geminiPrompt);

    await message.reply(geminiHelpResponse);
  },
};
