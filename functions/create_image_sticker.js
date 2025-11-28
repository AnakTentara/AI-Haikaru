import Logger from "../handlers/logger.js";

/**
 * AI Function: create_image_sticker
 * Triggered when AI detects user wants to convert image to sticker
 * Detects media source (quoted or current), creates and sends sticker
 */
export default {
    name: 'create_image_sticker',
    description: 'Create sticker from image',

    async execute(bot, message, chat, chatHistory, args) {
        Logger.function('create_image_sticker', 'Creating image sticker...');

        // Determine media source (quoted or current message)
        let mediaToConvert = null;
        if (message.hasMedia) {
            mediaToConvert = await message.downloadMedia();
        } else if (message.hasQuotedMsg) {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                mediaToConvert = await quotedMsg.downloadMedia();
            }
        }

        if (!mediaToConvert || !mediaToConvert.mimetype.startsWith('image/')) {
            await message.reply("❌ Harap kirim gambar atau reply gambar untuk dijadikan sticker!");
            chatHistory.push({ role: "model", text: "[Error: No image found for sticker conversion]" });
            return;
        }

        await message.reply("⏳ Tunggu sebentar ya, lagi bikin sticker...");

        try {
            // Import function handler dynamically
            const { create_image_sticker } = await import('../handlers/functionHandler.js');

            const sticker = await create_image_sticker(mediaToConvert);
            await message.reply(sticker, undefined, { sendMediaAsSticker: true });

            Logger.outgoing('create_image_sticker', 'Image sticker sent to user');
            chatHistory.push({ role: "model", text: "[Sent image sticker]" });
        } catch (error) {
            Logger.error('create_image_sticker', 'Failed to create image sticker', { error: error.message });
            await message.reply(`❌ Gagal bikin sticker: ${error.message}`);
        }
    }
};
