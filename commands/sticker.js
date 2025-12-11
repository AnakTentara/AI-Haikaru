import { create_text_sticker, create_image_sticker } from "../handlers/functionHandler.js";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import Logger from "../handlers/logger.js";
import fs from 'fs';

export default {
    name: "sticker",
    description: "Bikin sticker dari foto atau text",
    usage: ".sticker <text> atau reply gambar dengan .sticker",
    prefixRequired: true,
    triggers: [".sticker", ".stiker"],

    async execute(message, args, bot, chatHistory) {
        // Check if replying to a message with media (image)
        const quotedMsg = await message.getQuotedMessage();

        // Mode 1: Image to Sticker (if quoted/replied message has image)
        if (quotedMsg && quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();

            if (!media.mimetype.startsWith('image/')) {
                return message.reply("❌ Maaf, cuma bisa bikin sticker dari gambar ya! Kirim foto/gambar dulu.");
            }

            await message.reply("⏳ Tunggu sebentar ya, lagi bikin sticker...");

            try {
                const sticker = await create_image_sticker(media);
                await message.reply(sticker, undefined, { sendMediaAsSticker: true });
            } catch (error) {
                Logger.error('create_image_sticker', 'Error creating image sticker', { error: error.message });
                await message.reply(`❌ Gagal bikin sticker dari gambar: ${error.message}`);
            }
            return;
        }

        // Mode 2: Text to Sticker (if args provided)
        if (args.length > 0) {
            const text = args.join(" ");

            if (text.length > 500) {
                return message.reply("❌ Teks terlalu panjang! Maksimal 500 karakter ya.");
            }

            await message.reply("⏳ Tunggu sebentar ya, lagi bikin sticker dari text...");

            try {
                const imagePath = await create_text_sticker(text);
                const sticker = MessageMedia.fromFilePath(imagePath);
                await message.reply(sticker, undefined, { sendMediaAsSticker: true });

                // Cleanup temp file
                try {
                    fs.unlinkSync(imagePath);
                } catch (e) {
                    Logger.error('cleanup', 'Failed to delete temp file', { error: e.message });
                }
            } catch (error) {
                Logger.error('create_text_sticker', 'Error creating text sticker', { error: error.message });
                await message.reply(`❌ Gagal bikin sticker dari text: ${error.message}`);
            }
            return;
        }

        // No input provided
        await message.reply("⚠️ Caranya:\n\n1️⃣ Reply gambar dengan `.sticker` untuk bikin sticker dari foto\n2️⃣ Kirim `.sticker <text>` untuk bikin sticker dari text\n\nContoh: `.sticker Hello World!`");
    },
};
