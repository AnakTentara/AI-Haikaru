export default {
  name: 'info',
  description: 'Get information about the bot',
  usage: '!info',
  async execute(message, args, bot) {
    const chat = await message.getChat();
    const contact = await message.getContact();

    let info = `🤖 *WhatsApp Bot Information*\n\n`;
    info += `📱 Bot Name: WhatsApp Bot\n`;
    info += `⚙️ Version: 1.0.0\n`;
    info += `📋 Total Commands: ${bot.commands.size}\n`;
    info += `⚡ Prefix: ${bot.prefix}\n\n`;
    info += `👤 Your Info:\n`;
    info += `📞 Number: ${contact.number}\n`;
    info += `💬 Chat Type: ${chat.isGroup ? 'Group' : 'Private'}\n`;
    
    if (chat.isGroup) {
      info += `👥 Group Name: ${chat.name}\n`;
      info += `👥 Participants: ${chat.participants.length}`;
    }

    await message.reply(info);
  }
};
