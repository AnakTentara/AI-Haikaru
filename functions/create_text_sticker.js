import Logger from "../handlers/logger.js";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';

/**
 * AI Function: create_text_sticker
 * Triggered when AI detects user wants to create sticker from text
 * Creates text sticker, sends it, and cleans up temp file
 */
export default {
    name: 'create_text_sticker',
    description: 'Create sticker from text',

    async execute(bot, message, chat, chatHistory, args) {
        Logger.function('create_text_sticker', `Creating text sticker: ${args.text}`);

        await message.reply("⏳ Tunggu sebentar ya, lagi bikin sticker dari text...");

        try {
            // Import function handler dynamically
            const { create_text_sticker } = await import('../handlers/functionHandler.js');

            const imagePath = await create_text_sticker(args.text);
            const sticker = MessageMedia.fromFilePath(imagePath);
            await message.reply(sticker, undefined, { sendMediaAsSticker: true });

            Logger.outgoing('create_text_sticker', 'Text sticker sent to user');
            chatHistory.push({ role: "model", text: `[Sent text sticker: "${args.text}"]` });

            // Cleanup temp file
            try {
                fs.unlinkSync(imagePath);
            } catch (e) {
                Logger.error('create_text_sticker', 'Failed to delete temp file', { error: e.message });
            }
        } catch (error) {
            Logger.error('create_text_sticker', 'Failed to create text sticker', { error: error.message });
            await message.reply(`❌ Gagal bikin sticker: ${error.message}`);
        }
    }
};
