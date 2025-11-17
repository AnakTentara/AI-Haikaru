export default {
  name: 'ping',
  description: 'Cek responsivitas bot',
  usage: '.ping',
  async execute(message, args, bot) {
    const start = Date.now();
    const sent = await message.reply('🏓 Mengirim ping...');
    const latency = Date.now() - start;
    
    await sent.edit(`🏓 Pong!\n⏱️ Latensi: ${latency}ms`);
  }
};
