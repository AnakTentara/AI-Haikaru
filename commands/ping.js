import { check_ping } from "../handlers/functionHandler.js";

export function formatPingMessage(data) {
  let responseText = `🏓 Pong! Gue masih responsif kok bro :v\n\n`;
  responseText += `⚡ Latency: *${data.latency}ms*\n`;
  responseText += `📊 Status: *${data.status}*`;
  return responseText;
}

export default {
  name: "ping",
  description: "Cek responsivitas bot",
  usage: ".ping",
  prefixRequired: true,
  triggers: [".ping"],
  async execute(message, args, bot) {
    // Send first message
    await message.reply("🏓 Pinging...");

    // Get ping data and send second message
    const data = await check_ping(bot, message);
    const responseText = formatPingMessage(data);
    await message.reply(responseText);
  },
};
