import { getGeminiResponse } from "../handlers/geminiProcessor.js";
import { get_bot_info } from "../handlers/functionHandler.js";

export function formatInfoMessage(data, aiSalutation) {
  let info = `${aiSalutation}\n\n`;
  info += `━━━━━━ *STATISTIK BOT* ━━━━━━\n`;
  info += `🤖 Nama Bot: *${data.botName}*\n`;
  info += `⚙️ Total Perintah: *${data.totalCommands}*\n`;
  info += `⚡ Prefix: *${data.prefix}*\n`;
  info += `📝 Versi Kernel: *${data.version}*\n`;
  info += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  info += `👤 *INFO ANDA & CHAT INI:*\n`;
  info += `👋 Nama: *${data.userName}*\n`;
  info += `📞 Nomor Anda: *${data.userNumber}*\n`;
  info += `💬 Tipe Chat: *${data.chatType}*\n`;

  if (data.groupName) {
    info += `👥 Nama Grup: *${data.groupName}*\n`;
    info += `👥 Peserta Grup: *${data.groupParticipants}*\n`;
  } else {
    info += `🏠 Status: *Chat Pribadi dengan AI-Haikaru*\n`;
  }
  info += `\n*Kode di-maintenance oleh Haikal.*`;
  return info;
}

export default {
  name: "info",
  description: "Dapatkan informasi tentang bot",
  usage: ".info",
  prefixRequired: true,
  triggers: [".info"],

  async execute(message, args, bot) {
    const chat = await message.getChat();

    // Get data using handler
    const data = await get_bot_info(bot, message, chat);

    const geminiPrompt = "Seseorang telah menjalankan perintah info bot. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan data teknis bot.";
    const aiSalutation = await getGeminiResponse(bot, geminiPrompt);

    const info = formatInfoMessage(data, aiSalutation);

    await message.reply(info);
  }
};
