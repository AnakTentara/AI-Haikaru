export default {
  name: 'ready',
  once: true,
  execute(bot) {
    console.log('═══════════════════════════════════════');
    console.log('✅ Bot WhatsApp siap digunakan!');
    console.log(`📱 Login sebagai: ${bot.client.info.pushname}`);
    console.log(`📞 Nomor: ${bot.client.info.wid.user}`);
    console.log(`📋 Perintah dimuat: ${bot.commands.size}`);
    console.log(`⚡ Prefix: ${bot.prefix}`);
    console.log('═══════════════════════════════════════');
  }
};
