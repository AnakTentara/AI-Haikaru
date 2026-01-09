import Logger from './logger.js';
import { extractTextFromDocument } from './documentProcessor.js';
import { analyzeAudio } from './geminiProcessor.js';

/**
 * Centrally handles all incoming media (Images, Documents, Audio)
 */
export async function processIncomingMedia(bot, message) {
    if (!message.hasMedia) return null;

    try {
        Logger.info('MEDIA_HANDLER', 'Processing incoming media...');
        const media = await message.downloadMedia();
        if (!media) return null;

        const buffer = Buffer.from(media.data, 'base64');
        const mediaContext = {
            image: null,
            systemNote: "",
            mimeType: media.mimetype
        };

        // 1. IMAGE HANDLING
        if (media.mimetype.startsWith("image/")) {
            mediaContext.image = {
                mimeType: media.mimetype,
                data: media.data
            };
            Logger.success('MEDIA_HANDLER', 'Image processed');
        }

        // 2. DOCUMENT HANDLING
        else if (
            media.mimetype === 'application/pdf' ||
            media.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            media.mimetype === 'text/plain'
        ) {
            await message.reply("Sebentar ya, aku baca dulu dokumennya... 📄🤓");
            const extractedText = await extractTextFromDocument(buffer, media.mimetype);

            if (extractedText) {
                const truncatedText = extractedText.length > 200000
                    ? extractedText.substring(0, 200000) + "...[dipotong karena terlalu panjang]"
                    : extractedText;

                mediaContext.systemNote = `\n\n[SYSTEM: User melampirkan dokumen. Berikut isinya:]\n---\n${truncatedText}\n---\n[Instruksi: Jawab pertanyaan user berdasarkan isi dokumen di atas]`;
                Logger.success('MEDIA_HANDLER', 'Document text extracted');
            } else {
                await message.reply("Waduh, aku gagal baca isinya. Mungkin file rusak.");
            }
        }

        // 3. AUDIO HANDLING
        else if (media.mimetype.startsWith("audio/")) {
            await message.reply("Bentar, gue dengerin dulu ya... 🎧");
            const soundscapeAnalysis = await analyzeAudio(bot, media.data, media.mimetype);

            if (soundscapeAnalysis) {
                mediaContext.systemNote = `\n\n[SYSTEM: User mengirim pesan suara. Berikut analisis audio mendalam:]\n---\n${soundscapeAnalysis}\n---\n[Instruksi: Respon pesan suara ini sesuai dengan isi transkrip dan suasana yang dijelaskan di atas]`;
                Logger.success('MEDIA_HANDLER', 'Audio soundscape analyzed');
            } else {
                await message.reply("Aduh, telinga gue lagi pengang. Gagal dengerin VN-nya.");
            }
        }

        return mediaContext;
    } catch (error) {
        Logger.error('MEDIA_HANDLER', 'Error processing media', { error: error.message });
        return null;
    }
}
