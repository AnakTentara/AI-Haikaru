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
        'update_memory': 'update_memory',
        'schedule_task': 'schedule_task'
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
            } else if (commandName === 'schedule_task') {
                console.log('DEBUG Scheduler Args:', call.args); // DEBUGGING

                // Flexible parsing in case AI hallucinates param names
                const type = call.args.type || call.args.task_type || 'reminder';
                const content = call.args.content || call.args.text || call.args.prompt || "Pengingat";
                let delay = call.args.delay_seconds || call.args.delay || call.args.seconds || 10;

                // Ensure delay is number
                if (typeof delay === 'string') delay = parseInt(delay);
                if (isNaN(delay)) delay = 10;

                const executeAt = Date.now() + (delay * 1000);

                bot.scheduler.addTask({
                    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    chatId: chatId,
                    type: type,
                    payload: type === 'image_generation' ? { prompt: content } : { text: content },
                    executeAt: executeAt,
                    createdAt: Date.now()
                });

                chatHistory.push({ role: "model", text: `[Tugas Dijadwalkan: ${type} dalam ${delay} detik]` });

                // Confirmation message
                const actionText = type === 'image_generation' ? 'buat gambar' : 'ingetin kamu';
                await message.reply(`Oke siap! ${delay} detik lagi aku ${actionText} ya! 👌⏰`);

            } else if (commandName) {
                const command = bot.commands.get(commandName);
                if (command) {
                    const argsArray = call.args.prompt ? [call.args.prompt] :
                        call.args.text ? [call.args.text] :
                            call.args.query ? [call.args.query] : [];

                    await command.execute(message, argsArray, bot, chatHistory);
                    chatHistory.push({ role: "model", text: `[Executed .${commandName}]` });
                }
            } else {
                const func = bot.functions.get(call.name);
                if (func) await func.execute(bot, message, chat, chatHistory, call.args);
            }
        } catch (error) {
            Logger.error('AI_FUNCTION', `Error in ${call.name}`, { error: error.message });
            // Notify user about function failure
            await message.reply(`⚠️ Waduh, gagal jalankan fungsi "${call.name}". Error: ${error.message}`);
            chatHistory.push({ role: "model", text: `[Function Error: ${call.name}]` });
        }
    }
    await saveChatHistory(chatId, chatHistory);
}
