export default {
  name: 'ping',
  description: 'Check if the bot is responsive',
  usage: '!ping',
  async execute(message, args, bot) {
    const start = Date.now();
    const sent = await message.reply('🏓 Pinging...');
    const latency = Date.now() - start;
    
    await sent.edit(`🏓 Pong!\n⏱️ Latency: ${latency}ms`);
  }
};
