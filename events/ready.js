export default {
  name: 'ready',
  once: true,
  execute(bot) {
    console.log('═══════════════════════════════════════');
    console.log('✅ WhatsApp Bot is ready!');
    console.log(`📱 Logged in as: ${bot.client.info.pushname}`);
    console.log(`📞 Phone: ${bot.client.info.wid.user}`);
    console.log(`📋 Commands loaded: ${bot.commands.size}`);
    console.log(`⚡ Prefix: ${bot.prefix}`);
    console.log('═══════════════════════════════════════');
  }
};
