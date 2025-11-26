import { getGeminiResponse } from "../handlers/geminiProcessor.js";

export default {
  name: "info",
  description: "Dapatkan informasi tentang bot",
  usage: ".info",
  prefixRequired: true,
  triggers: [".info"],

  async execute(message, args, bot) {
    const chat = await message.getChat();

    let senderId;
    if (chat.isGroup) {
      senderId = message.author;
    } else {
      senderId = message.from;
    }

    let userNumber = senderId ? senderId.split("@")[0] : "Tidak diketahui";

    try {
      if (senderId && senderId.includes('@lid')) {
        const lidWid = await bot.client.pupPage.evaluate((id) => {
          if (id && id.includes('@lid')) {
            const wid = window.Store.WidFactory.createWid(id);
            if (window.Store.LidUtils) {
              return window.Store.LidUtils.getPhoneNumber(wid);
            }
          }
          return null;
        }, senderId);

        if (lidWid && typeof lidWid === 'object' && lidWid.user) {
          userNumber = lidWid.user;
        } else if (lidWid) {
          userNumber = lidWid.toString().split("@")[0];
        }
      }

      if (typeof userNumber === 'string') {
        userNumber = userNumber.replace(/[^0-9]/g, '');
      }
    } catch (e) {
      console.error('Gagal convert LID:', e.message);
      try {
        const contact = await message.getContact();
        userNumber = contact.number || userNumber;
      } catch (contactErr) {
        console.error('Gagal getContact:', contactErr.message);
        userNumber = message._data.notifyName ? message._data.notifyName.match(/\d{10,}/)?.[0] || userNumber : userNumber;
      }
    }

    let userName = message._data.notifyName || "Pengguna";
    try {
      const contact = await message.getContact();
      userName = contact.pushname || contact.name || userName;
    } catch (e) {
      // Ignore error
    }

    const geminiPrompt = "Seseorang telah menjalankan perintah info bot. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan data teknis bot.";
    const aiSalutation = await getGeminiResponse(bot, geminiPrompt);

    let info = `${aiSalutation}\n\n`;
    info += `━━━━━━ *STATISTIK BOT* ━━━━━━\n`;
    info += `🤖 Nama Bot: *${bot.config.botName}*\n`;
    info += `⚙️ Total Perintah: *${bot.commands.size}*\n`;
    info += `⚡ Prefix: *${bot.prefix}*\n`;
    info += `📝 Versi Kernel: *1.6.0*\n`;
    info += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    info += `👤 *INFO ANDA & CHAT INI:*\n`;
    info += `👋 Nama: *${userName}*\n`;
    info += `📞 Nomor Anda: *${userNumber}*\n`;
    info += `💬 Tipe Chat: *${chat.isGroup ? "Grup" : "Pribadi"}*\n`;

    if (chat.isGroup) {
      info += `👥 Nama Grup: *${chat.name || "Tidak diketahui"}*\n`;
      info += `👥 Peserta Grup: *${chat.participants.length}*\n`;
    } else {
      info += `🏠 Status: *Chat Pribadi dengan AI-Haikaru*\n`;
    }
    info += `\n*Kode di-maintenance oleh Haikal.*`;

    await message.reply(info);
  }
};
