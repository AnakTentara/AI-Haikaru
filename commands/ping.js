export default {
  name: "ping",
  description: "Cek responsivitas bot",
  usage: ".ping",
  prefixRequired: true,
  triggers: [".ping"],
  async execute(message, args, bot) {
    const start = Date.now();
    await message.reply("🏓 Mengirim ping...");
    const latency = Date.now() - start;
    await message.reply(`🏓 Pong!\n⏱️ Latensi: ${latency}ms`);
  },
};
