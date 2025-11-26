import { generate_image } from "../handlers/functionHandler.js";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';

export default {
    name: "img",
    description: "Generate gambar dari deskripsi teks menggunakan AI",
    usage: ".img <deskripsi gambar>",
    prefixRequired: true,
    triggers: [],

    async execute(message, args, bot) {
        if (args.length === 0) {
            return message.reply("⚠️ Harap masukkan deskripsi gambar! Contoh: `.img kucing terbang`");
        }

        const prompt = args.join(" ");

        // Waiting message
        await message.reply("Oke siap! tunggu yaa, aku gambar duluu! 🎨✨");

        try {
            const result = await generate_image(prompt);

            if (result.success) {
                const media = MessageMedia.fromFilePath(result.imagePath);
                const caption = `Nih gambarnya udah jadi! 🎨✨\n\n_Generated: ${result.prompt}_`;

                await message.reply(media, undefined, { caption: caption });

                // Cleanup temp file
                try {
                    fs.unlinkSync(result.imagePath);
                } catch (e) {
                    console.error("Gagal hapus temp file:", e);
                }
            } else {
                await message.reply(`Waduh, gagal bikin gambar nih 😭\nError: ${result.error}`);
            }
        } catch (error) {
            console.error("Error executing .img command:", error);
            console.error("Full error stack:", error.stack);
            await message.reply(`Terjadi kesalahan saat membuat gambar:\n${error.message}`);
        }
    }
};
