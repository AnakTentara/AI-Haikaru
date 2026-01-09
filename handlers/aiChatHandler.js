import { loadChatHistory, saveChatHistory, loadMemory, saveMemory } from "./dbHandler.js";
import { getGeminiChatResponse } from "./geminiProcessor.js";
import * as emoji from 'node-emoji';
import Logger from "./logger.js";

/**
 * Orchestrates the AI response flow
 */
export async function orchestrateAIResponse(bot, message, chat, chatId, newMessage) {
    try {
        const historyLimit = 50;
        const thinkingStart = Date.now();

        // 1. Prepare Context
        const permanentMemory = await loadMemory(chatId);
        const chatHistory = await loadChatHistory(chatId, historyLimit);

        // 2. Get AI Response
        Logger.ai('AI_CHIEF', 'Requesting response from Gemini fallback engine...');
        const aiResponse = await getGeminiChatResponse(bot, chatHistory, permanentMemory);

        // 3. Handle Function Calls
        if (aiResponse.type === 'function_call') {
            Logger.ai('AI_CHIEF', 'Executing AI function calls');
            await handleFunctionCalls(bot, message, chat, chatId, chatHistory, aiResponse.functionCalls);
            return;
        }

        // 4. Clean & Send Response
        // 4. Clean & Send Response
        // Remove Identity Tags, Timestamps, and accidental JSON dumps
        const aggressivePrefixRegex = /^(\[.*?\]\s*)+:?\s*/i;
        let cleanedResponse = aiResponse.replace(aggressivePrefixRegex, "").trim();

        // Anti-Hallucination: If response implies it's sending JSON/History
        if (cleanedResponse.startsWith('{"') || cleanedResponse.includes('"role": "model"')) {
            Logger.warn('AI_CHIEF', 'AI attempted to leak JSON history. Suppressed.');
            cleanedResponse = "Waduh, aku agak error dikit nih. Coba tanya lagi ya? 😅";
        }

        if (!cleanedResponse) cleanedResponse = aiResponse.trim();

        // Convert text emojis (:smile:) to Unicode (😄)
        // Helper function for safe emoji conversion
        const emojify = (str) => {
            try {
                // Dynamic import to avoid issues if dependency is missing during dev
                return emoji.emojify(str);
            } catch (e) {
                return str;
            }
        };
        cleanedResponse = emojify(cleanedResponse);

        const chatObj = await message.getChat();
        chatObj.sendStateTyping();

        const typingTimeIndicator = 1000;
        await new Promise(resolve => setTimeout(resolve, typingTimeIndicator));

        chatObj.clearState();
        const finalResponse = await message.reply(cleanedResponse);

        // 5. Update History
        chatHistory.push({ role: "model", text: finalResponse.body });
        await saveChatHistory(chatId, chatHistory);

        Logger.success('AI_CHIEF', `AI response sent in ${(Date.now() - thinkingStart) / 1000}s`);
    } catch (error) {
        Logger.error('AI_CHIEF', 'Orchestration failed', { error: error.message });
        await message.reply("Maaf, AI-Haikaru sedang pusing. Coba lagi nanti ya! 🙏");
    }
}

/**
 * Handle function calls from AI
 */
async function handleFunctionCalls(bot, message, chat, chatId, chatHistory, functionCalls) {
    const functionToCommandMap = {
        'get_bot_info': 'info',
        'check_ping': 'ping',
        'show_help_menu': 'help',
        'tag_everyone': 'everyone',
        'generate_image': 'img',
        'create_text_sticker': 'sticker',
        'create_image_sticker': 'sticker',
        'update_memory': 'update_memory'
    };

    for (const call of functionCalls) {
        try {
            Logger.function('AI_FUNCTION', `Executing: ${call.name}`, { args: call.args });
            const commandName = functionToCommandMap[call.name];

            if (commandName === 'update_memory') {
                const fact = call.args.fact;
                if (fact) {
                    const currentMemory = await loadMemory(chatId);
                    const newMemory = currentMemory ? `${currentMemory}\n- ${fact}` : `- ${fact}`;
                    await saveMemory(chatId, newMemory);
                    chatHistory.push({ role: "model", text: `[Memori Diperbarui: ${fact}]` });
                }
            } else if (commandName) {
                const command = bot.commands.get(commandName);
                if (command) {
                    const argsArray = call.args.prompt ? [call.args.prompt] :
                        call.args.text ? [call.args.text] : [];
                    await command.execute(message, argsArray, bot, chatHistory);
                    chatHistory.push({ role: "model", text: `[Executed .${commandName}]` });
                }
            } else {
                const func = bot.functions.get(call.name);
                if (func) await func.execute(bot, message, chat, chatHistory, call.args);
            }
        } catch (error) {
            Logger.error('AI_FUNCTION', `Error in ${call.name}`, { error: error.message });
        }
    }
    await saveChatHistory(chatId, chatHistory);
}
