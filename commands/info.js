export default {
  name: 'info',
  description: 'Dapatkan informasi tentang bot',
  usage: '.info',
  async execute(message, args, bot) {
    const chat = await message.getChat();
    const contact = await message.getContact();

    let info = `🤖 *Informasi Bot WhatsApp*\n\n`;
    info += `📱 Nama Bot: ${bot.config.botName}\n`;
    info += `⚙️ Versi: 1.0.0\n`;
    info += `📋 Total Perintah: ${bot.commands.size}\n`;
    info += `⚡ Prefix: ${bot.prefix}\n\n`;
    info += `👤 Info Anda:\n`;
    info += `📞 Nomor: ${contact.number}\n`;
    info += `💬 Tipe Chat: ${chat.isGroup ? 'Grup' : 'Pribadi'}\n`;
    
    if (chat.isGroup) {
      info += `👥 Nama Grup: ${chat.name}\n`;
      info += `👥 Peserta: ${chat.participants.length}`;
    }

    await message.reply(info);
  }
};
