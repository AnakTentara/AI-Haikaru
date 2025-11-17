export default {
  name: 'help',
  description: 'Show all available commands',
  usage: '!help [command]',
  async execute(message, args, bot) {
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      const command = bot.commands.get(commandName);

      if (!command) {
        return message.reply(`❌ Command \`${commandName}\` not found.`);
      }

      let reply = `📖 *Command: ${command.name}*\n\n`;
      reply += `📝 Description: ${command.description || 'No description available'}\n`;
      reply += `💡 Usage: ${command.usage || `!${command.name}`}`;

      return message.reply(reply);
    }

    let helpText = `🤖 *WhatsApp Bot - Command List*\n\n`;
    helpText += `Prefix: *${bot.prefix}*\n\n`;

    bot.commands.forEach(command => {
      helpText += `*${bot.prefix}${command.name}*\n`;
      helpText += `${command.description || 'No description'}\n\n`;
    });

    helpText += `\nUse *${bot.prefix}help [command]* for detailed info`;

    await message.reply(helpText);
  }
};
