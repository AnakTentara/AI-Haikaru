import Logger from "../handlers/logger.js";

/**
 * AI Function: generate_image
 * Triggered when AI detects user wants to generate an image
 * Sends waiting message, generates image, handles response
 */
export default {
    name: 'generate_image',
    description: 'Generate image from text prompt',

    async execute(bot, message, chat, chatHistory, args) {
        Logger.function('generate_image', `Generating image: ${args.prompt}`);

        await message.reply("Oke siap! tunggu yaa, aku gambar duluu! 🎨✨");

        // Import function handler dynamically
        const { generate_image } = await import('../handlers/functionHandler.js');
        const { handleImageResponse } = await import('../commands/img.js');

        const result = await generate_image(bot, args.prompt);

        Logger.data('generate_image', 'Image generation result', {
            success: result.success,
            prompt: result.prompt
        });

        await handleImageResponse(message, result);

        if (result.success) {
            Logger.outgoing('generate_image', `Image sent successfully: ${result.prompt}`);
            chatHistory.push({ role: "model", text: `[Generated image: ${result.prompt}]` });
        } else {
            Logger.error('generate_image', `Image generation failed: ${result.error}`);
            chatHistory.push({ role: "model", text: `[Failed to generate image: ${result.error}]` });
        }
    }
};
