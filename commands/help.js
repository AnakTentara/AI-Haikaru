export default {
  name: 'help',
  description: 'Tampilkan semua perintah yang tersedia',
  usage: '.help [perintah]',
  async execute(message, args, bot) {
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      const command = bot.commands.get(commandName);

      if (!command) {
        return message.reply(`❌ Perintah \`${commandName}\` tidak ditemukan.`);
      }

      let reply = `📖 *Perintah: ${command.name}*\n\n`;
      reply += `📝 Deskripsi: ${command.description || 'Tidak ada deskripsi'}\n`;
      reply += `💡 Penggunaan: ${command.usage || `${bot.prefix}${command.name}`}`;

      return message.reply(reply);
    }

    let helpText = `🤖 *Bot WhatsApp - Daftar Perintah*\n\n`;
    helpText += `Prefix: *${bot.prefix}*\n\n`;

    bot.commands.forEach(command => {
      helpText += `*${bot.prefix}${command.name}*\n`;
      helpText += `${command.description || 'Tidak ada deskripsi'}\n\n`;
    });

    helpText += `\nGunakan *${bot.prefix}help [perintah]* untuk info detail`;

    await message.reply(helpText);
  }
};
