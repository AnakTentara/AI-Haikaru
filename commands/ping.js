import { check_ping } from "../handlers/functionHandler.js";
import { getGeminiResponse } from "../handlers/geminiProcessor.js";
import Logger from "../handlers/logger.js";

export function formatPingMessage(data, aiSalutation) {
  let responseText = `${aiSalutation}\n\n`;
  responseText += `⚡ Latency: *${data.latency}ms*\n`;
  responseText += `📊 Status: *${data.status}*`;
  return responseText;
}

export default {
  // ...
  async execute(message, args, bot, chatHistory) {
    Logger.function('check_ping', `Executing function: check_ping`);

    const data = await check_ping(bot, message);

    const geminiPrompt = "Seseorang telah menjalankan perintah ping untuk cek kecepatan bot. Berikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka.";
    const aiSalutation = await getGeminiResponse(bot, geminiPrompt, chatHistory);

    const responseText = formatPingMessage(data, aiSalutation);

    if (chatHistory) {
      chatHistory.push({ role: "model", text: "[Executed .ping command]" });
    }

    await message.reply(responseText);
  },
};
