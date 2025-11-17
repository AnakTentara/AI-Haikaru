export default {
  name: 'message',
  once: false,
  async execute(bot, message) {
    if (!message.body.startsWith(bot.prefix)) return;
    if (message.from === 'status@broadcast') return;

    const args = message.body.slice(bot.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = bot.commands.get(commandName);

    if (!command) return;

    try {
      console.log(`🔵 Perintah: ${commandName} | Dari: ${message.from} | Chat: ${message.id.remote}`);
      await command.execute(message, args, bot);
    } catch (error) {
      console.error(`❌ Kesalahan saat menjalankan perintah ${commandName}:`, error);
      await message.reply(bot.config.messages.errorExecutingCommand);
    }
  }
};
