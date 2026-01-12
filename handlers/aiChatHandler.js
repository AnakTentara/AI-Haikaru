import { getGeminiChatResponse } from './geminiProcessor.js';
import { loadChatHistory, saveChatHistory, appendChatMessage, getPermanentMemory } from './dbHandler.js';
import { areGroupsIgnored } from './autonomousHandler.js'; 
import * as emoji from 'node-emoji';
import Logger from "./logger.js";

/**
 * Orchestrates the AI response flow
 */
export async function handleMessage(bot, msg) {
    const chatId = msg.from;
    
    // 1. Cek Ignore List (untuk mode autonomous/grup)
    if (await areGroupsIgnored(chatId)) return;

    // 2. Typing Indicator
    const chat = await msg.getChat();
    await chat.sendStateTyping();

    // 3. Ambil Detail Pengirim (Name, Number, LID)
    const contact = await msg.getContact();
    const contactName = contact.name || contact.pushname || contact.number;
    const contactNumber = contact.number;
    
    // Coba ambil LID (Linked Device ID) jika tersedia
    // msg.author biasanya berisi ID pengirim asli di grup (termasuk LID di versi WA baru)
    const senderId = msg.author || msg.from; 
    const lid = senderId.includes('@lid') ? senderId : (contact.id._serialized || "N/A");

    // 4. Format Waktu: [HH:MM:SS, DD/MM/YYYY]
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = now.toLocaleDateString('id-ID');
    const timestamp = `${timeStr}, ${dateStr}`;

    // 5. Susun Pesan dengan Format Baru yang Diminta
    // Format: [HH:MM:SS, DD/MM/YYYY] [ContactName] [Number: <ContactNumber> ; Lid: <LidNumber>] : <message>
    const userMessageContent = `[${timestamp}] [${contactName}] [Number: ${contactNumber} ; Lid: ${lid}] : ${msg.body}`;

    // 6. Load History & Memory
    const history = await loadChatHistory(chatId);
    const memory = await getPermanentMemory(chatId);

    // Tambahkan pesan user ke history (System mencatat format lengkap ini agar AI paham konteks)
    // Kita simpan format lengkapnya ke history agar AI ingat siapa yang bicara sebelumnya
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
            
            // Eksekusi function
            import('./functionHandler.js').then(async ({ handleFunctionCall }) => {
                const functionResult = await handleFunctionCall(bot, msg, response.functionCalls);
                
                // Jika function menghasilkan text balasan (misal: hasil search), kirim ke user
                if (functionResult) {
                    await msg.reply(functionResult);
                    await appendChatMessage(chatId, { role: "model", text: functionResult });
                }
            });
            return; // Selesai, jangan reply double
        }

        // 9. Kirim Balasan Biasa (Text)
        if (response) {
            // Cek apakah ada request tagging di dalam response (format @628xxx)
            // WA Web JS otomatis mengubah @nomor menjadi mention jika formatnya benar.
            await msg.reply(response);
            await appendChatMessage(chatId, { role: "model", text: response });
        }

    } catch (error) {
        Logger.error('AI_CHAT', 'Error processing message', error);
        await msg.reply("Maaf, ada gangguan pada sistem AI-ku. Coba lagi nanti ya.");
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
