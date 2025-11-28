import Logger from "../handlers/logger.js";

/**
 * AI Function: perform_google_search
 * Triggered when AI detects user wants current/real-time information
 * Performs Google search and formats results
 */
export default {
    name: 'perform_google_search',
    description: 'Search Google for current information',

    async execute(bot, message, chat, chatHistory, args) {
        Logger.function('perform_google_search', `Searching for: ${args.query}`);

        // Import function handler dynamically
        const { perform_google_search } = await import('../handlers/functionHandler.js');

        const result = await perform_google_search(bot, args.query);

        Logger.data('perform_google_search', 'Search results retrieved', { query: result.query });

        const responseText = `🔎 *Hasil Pencarian Google:*\n\n${result.result}\n\n_Source: Google Search via Gemini_`;

        await message.reply(responseText);
        Logger.outgoing('perform_google_search', 'Search results sent to user');
        chatHistory.push({ role: "model", text: responseText });
    }
};
