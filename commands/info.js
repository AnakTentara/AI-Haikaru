import { getGeminiResponse } from "../handlers/geminiProcessor.js";

export default {
  name: "info",
  description: "Dapatkan informasi tentang bot",
  usage: ".info",
  prefixRequired: true,
  triggers: [".info"],
  async execute(message, args, bot) {
    const chat = await message.getChat();
    const contact = await message.getContact();

    const geminiPrompt =
      "Seseorang telah menjalankan perintah info bot. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan data teknis bot.";

    const aiSalutation = await getGeminiResponse(bot, geminiPrompt);

    let info = `> [INFO]\n${aiSalutation}\n\n`;

    info += `━━━━━━ *STATISTIK BOT* ━━━━━━\n`;
    info += `🤖 Nama Bot: *${bot.config.botName}*\n`;
    info += `⚙️ Total Perintah: *${bot.commands.size}*\n`;
    info += `⚡ Prefix: *${bot.prefix}*\n`;
    info += `📝 Versi Kernel: *1.5.0*\n`;
    info += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    info += `👤 *INFO ANDA & CHAT INI:*\n`;
    info += `📞 Nomor Anda: *${contact.number}*\n`;
    info += `💬 Tipe Chat: *${chat.isGroup ? "Grup" : "Pribadi"}*\n`;

    if (chat.isGroup) {
      info += `👥 Nama Grup: *${chat.name}*\n`;
      info += `👥 Peserta Grup: *${chat.participants.length}*\n`;
    } else {
      info += `🏠 Status: *Chat Pribadi dengan AI-Haikaru*\n`;
    }
    info += `\n*Kode di-maintenance oleh Haikal.*`;

    await message.reply(info);
  },
};
