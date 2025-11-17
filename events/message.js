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
      console.log(`🔵 Command: ${commandName} | From: ${message.from} | Chat: ${message.id.remote}`);
      await command.execute(message, args, bot);
    } catch (error) {
      console.error(`❌ Error executing command ${commandName}:`, error);
      await message.reply('❌ There was an error executing that command.');
    }
  }
};
