import { check_ping } from "../handlers/functionHandler.js";
import Logger from "../handlers/logger.js";

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
  async execute(message, args, bot, chatHistory) {
    Logger.function('check_ping', `Executing function: check_ping`);

    const data = await check_ping(bot, message);
    const responseText = formatPingMessage(data);

    chatHistory.push({ role: "model", text: "[Executed .ping command to check responsiveness]" });

    await message.reply(responseText);
  },
};
