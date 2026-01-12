import { getGeminiChatResponse } from './geminiProcessor.js';
import { loadChatHistory, saveChatHistory, appendChatMessage, getPermanentMemory, loadMemory, saveMemory } from './dbHandler.js';
import { areGroupsIgnored } from './autonomousHandler.js'; 
import Logger from "./logger.js";

/**
 * Orchestrates the AI response flow
 */
export async function handleMessage(bot, msg) {
    const chatId = msg.from;
    
    // 1. Cek Ignore List (untuk mode autonomous/grup)
    try {
        if (await areGroupsIgnored(chatId)) return;
    } catch (e) {
        // Fallback aman jika cek ignore gagal
    }

    // 2. Typing Indicator
    try {
        const chat = await msg.getChat();
        await chat.sendStateTyping();
    } catch (e) {
        // Ignore typing errors
    }

    // 3. Ambil Detail Pengirim (Name, Number, LID)
    // FIX: Bungkus getContact dengan try-catch untuk menangani bug WA Web terbaru
    let contactName = "Unknown";
    let contactNumber = "";
    let lid = "N/A";

    try {
        const contact = await msg.getContact();
        contactName = contact.name || contact.pushname || contact.number;
        contactNumber = contact.number;
        lid = (contact.id && contact.id._serialized) ? contact.id._serialized : "N/A";
    } catch (error) {
        // Fallback jika getContact gagal (Solusi Anti-Crash)
        const author = msg.author || msg.from;
        contactNumber = author.split('@')[0];
        // Coba ambil notifyName dari raw data message jika ada
        if (msg._data && (msg._data.notifyName || msg._data.pushname)) {
            contactName = msg._data.notifyName || msg._data.pushname;
        } else {
            contactName = contactNumber;
        }
    }
    
    // Pastikan LID terset (fallback)
    if (lid === "N/A") {
         const senderId = msg.author || msg.from;
         if (senderId.includes('@lid')) lid = senderId;
    }

    // 4. Format Waktu: [HH:MM:SS, DD/MM/YYYY]
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = now.toLocaleDateString('id-ID');
    const timestamp = `${timeStr}, ${dateStr}`;

    // 5. Susun Pesan dengan Format Baru
    const userMessageContent = `[${timestamp}] [${contactName}] [Number: ${contactNumber} ; Lid: ${lid}] : ${msg.body}`;

    // 6. Load History & Memory
    const history = await loadChatHistory(chatId);
    let memory = "";
    try {
        memory = await getPermanentMemory(chatId);
    } catch (e) {
        // Ignore memory load error
    }

    // Tambahkan pesan user ke history
    const newMessageEntry = { role: "user", text: userMessageContent };
    await appendChatMessage(chatId, newMessageEntry);
    
    // Update history lokal untuk request kali ini
    const currentHistory = [...history, newMessageEntry];

    try {
        // 7. Kirim ke Gemini
        const response = await getGeminiChatResponse(bot, currentHistory, memory);

        // 8. Handle Function Calls (Jika AI minta tool)
        if (typeof response === 'object' && response.type === 'function_call') {
            Logger.info('AI_CHAT', `Function Call detected: ${response.functionCalls.length} calls`);
            
            // Eksekusi function via functionHandler
            // Gunakan dynamic import untuk menghindari circular dependency
            const { handleFunctionCall } = await import('./functionHandler.js');
            const functionResult = await handleFunctionCall(bot, msg, response.functionCalls);
            
            // Jika function menghasilkan text balasan (misal: hasil search), kirim ke user
            if (functionResult) {
                await msg.reply(functionResult);
                await appendChatMessage(chatId, { role: "model", text: functionResult });
            }
            return; // Selesai
        }

        // 9. Kirim Balasan Biasa (Text)
        if (response) {
            await msg.reply(response);
            await appendChatMessage(chatId, { role: "model", text: response });
        }

    } catch (error) {
        Logger.error('AI_CHAT', 'Error processing message', error);
        // Jangan reply error ke user, cukup log saja agar tidak spam
    }
}

/**
 * Handle function calls from AI
 * (Legacy/Fallback function preserved from workspace)
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
                const type = call.args.type || call.args.task_type || 'reminder';
                const content = call.args.content || call.args.text || call.args.prompt || "Pengingat";
                let delay = call.args.delay_seconds || call.args.delay || call.args.seconds || 10;

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
            await message.reply(`⚠️ Waduh, gagal jalankan fungsi "${call.name}". Error: ${error.message}`);
            chatHistory.push({ role: "model", text: `[Function Error: ${call.name}]` });
        }
    }
    await saveChatHistory(chatId, chatHistory);
}