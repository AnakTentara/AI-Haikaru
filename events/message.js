export default {
  name: "message",
  once: false,
  async execute(bot, message) {
    if (message.body.toLowerCase().trim().startsWith(bot.prefix)) {
      if (message.from === "status@broadcast") return;

      const args = message.body.slice(bot.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = bot.commands.get(commandName);

      if (command) {
        try {
          console.log(
            `🔵 Perintah: ${commandName} | Dari: ${message.from} | Chat: ${message.id.remote}`,
          );
          await command.execute(message, args, bot);
        } catch (error) {
          console.error(
            `❌ Kesalahan saat menjalankan perintah ${commandName}:`,
            error,
          );
          await message.reply(bot.config.messages.errorExecutingCommand);
        }
      }
      return;
    }

    for (const [name, command] of bot.commands) {
      if (
        command.prefixRequired === false &&
        command.triggers &&
        Array.isArray(command.triggers) &&
        command.triggers.some((trigger) =>
          message.body.toLowerCase().includes(trigger.toLowerCase()),
        )
      ) {
        try {
          console.log(
            `🔵 Perintah: ${name} | Dari: ${message.from} | Chat: ${message.id.remote}`,
          );
          await command.execute(message, [], bot);
          break;
        } catch (error) {
          console.error(
            `❌ Kesalahan saat menjalankan perintah ${name}:`,
            error,
          );
          await message.reply(bot.config.messages.errorExecutingCommand);
        }
      }
    }
  },
};
