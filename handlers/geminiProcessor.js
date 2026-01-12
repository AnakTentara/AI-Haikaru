/**
 * Fungsi untuk memproses prompt menggunakan Gemini API dengan Function Calling support.
 * @param {object} bot - Instance bot utama yang berisi bot.geminiApi.
 * @param {array} chatHistory - Riwayat chat untuk context.
/**
 * Fungsi untuk memproses prompt menggunakan Gemini API dengan Function Calling support.
 * @param {object} bot - Instance bot utama yang berisi bot.geminiApi.
 * @param {array} chatHistory - Riwayat chat untuk context.
 * @param {string} modelName - Model yang akan digunakan (mis. 'gemini-2.5-flash').
 * @returns {Promise<string|object>} - Teks balasan atau function call object.
 */

import { HAIKARU_PERSONA } from './persona.js';
import modelManager from './modelManager.js';
import fetch from 'node-fetch';

/**
 * Detect task type based on message content
 */
function detectTaskType(chatHistory) {
    const lastMessage = chatHistory[chatHistory.length - 1]?.text || "";
    const lower = lastMessage.toLowerCase();

    if (lower.length < 20 && !lower.includes('?')) return 'short';
    if (lower.includes('code') || lower.includes('program') || lower.includes('javascript') || lower.includes('python')) return 'coding';
    if (lower.includes('buatkan') || lower.includes('analisis') || lower.includes('jelaskan')) return 'complex';

    return 'chat';
}

/**
 * MAIN CHAT PROCESSOR (Uses Keys 1-40)
 */
export async function getGeminiChatResponse(bot, chatHistory, permanentMemory = "", requestedModel = null) {
    // 1. Get ordered fallback chain of models
    const taskType = detectTaskType(chatHistory);
    const modelChain = requestedModel ? [requestedModel] : modelManager.getFallbackChain(taskType);

    // USE MAIN CLIENTS (1-40)
    const clients = bot.geminiClients || [];
    if (clients.length === 0) {
        return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
    }

    // 2. Prepare System Instruction with Memory
    let systemInstruction = HAIKARU_PERSONA;
    if (permanentMemory) {
        systemInstruction += `\n\n[MEMORI PERMANEN USER/GRUP INI]:\n${permanentMemory}\n(Gunakan memori ini untuk mengingat detail penting tentang user. Jika ada informasi baru yang penting untuk diingat selamanya, gunakan tool update_memory)`;
    }

    // Convert chat history
    const messages = [{ role: "system", content: systemInstruction }];

    for (const msg of chatHistory) {
        const role = msg.role === "model" ? "assistant" : "user";
        let content = msg.text;

        if (msg.image && msg.image.data && msg.image.mimeType) {
            content = [
                { type: "text", text: msg.text },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${msg.image.mimeType};base64,${msg.image.data}`
                    }
                }
            ];
        }
        messages.push({ role, content });
    }

    // Tools Definition (Standard)
    const tools = [
        {
            type: "function",
            function: {
                name: "get_bot_info",
                description: "Dapatkan informasi tentang bot, statistik, dan info user/chat saat ini.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "check_ping",
                description: "Cek responsivitas dan latency bot.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "show_help_menu",
                description: "Tampilkan daftar fitur dan kemampuan BOT.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "tag_everyone",
                description: "Tag/mention semua member di grup. Gunakan HANYA jika diminta eksplisit.",
                parameters: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "Pesan yang ingin disampaikan bersamaan dengan tag" }
                    },
                    required: []
                }
            }
        },
        {
            type: "function",
            function: {
                name: "generate_image",
                description: "Generate/buat gambar dari deskripsi text.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: "Deskripsi gambar dalam bahasa Inggris" }
                    },
                    required: ["prompt"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "perform_google_search",
                description: "Lakukan pencarian Google untuk info terkini/real-time.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Query pencarian yang spesifik" }
                    },
                    required: ["query"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "update_memory",
                description: "Simpan informasi/fakta penting tentang user ke memori permanen.",
                parameters: {
                    type: "object",
                    properties: {
                        fact: { type: "string", description: "Fakta baru yang ingin diingat" }
                    },
                    required: ["fact"]
                }
            }
        },
         {
            type: "function",
            function: {
                name: "schedule_task",
                description: "Jadwalkan pengingat atau tugas di masa depan.",
                parameters: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["reminder", "image_generation"], description: "Jenis tugas" },
                        content: { type: "string", description: "Isi pesan pengingat atau prompt gambar" },
                        delay_seconds: { type: "number", description: "Waktu tunda dalam detik" }
                    },
                    required: ["type", "content", "delay_seconds"]
                }
            }
        }
    ];

    // 3. Fallback Logic: Model Loop -> Key Loop
    for (const modelId of modelChain) {
        // console.log(`📡 Trying model: ${modelId} (${taskType})`);

        for (const { client, name: keyName } of clients) {
            try {
                // console.log(`🤖 [${keyName}] Requesting Gemini with ${modelId}...`);

                const completion = await client.chat.completions.create({
                    model: modelId,
                    messages: messages,
                    temperature: 0.8,
                    tools: tools,
                    tool_choice: "auto",
                });

                const responseMessage = completion.choices[0].message;
                modelManager.updateUsage(modelId, completion.usage?.total_tokens || 0);

                if (responseMessage.tool_calls) {
                    const functionCalls = responseMessage.tool_calls.map(tc => ({
                        name: tc.function.name,
                        args: JSON.parse(tc.function.arguments),
                        id: tc.id
                    }));
                    return { type: 'function_call', functionCalls: functionCalls };
                }

                if (!responseMessage.content) return "Ups, respons AI kosong.";
                return responseMessage.content.trim();

            } catch (error) {
                if (error.status === 429) {
                    console.warn(`⚠️ [${keyName}] Model ${modelId} hit limit. Trying next key...`);
                    continue;
                }
                console.error(`❌ [${keyName}] Error with model ${modelId}:`, error.message);
                continue; 
            }
        }
    }

    return "🚫 *AI-Haikaru sedang istirahat!*\n\nSemua model dan kunci API telah mencapai limit hari ini.";
}

/**
 * REPLACEMENT FOR OPENAI GROUNDING
 * Uses Helper Clients (Keys 41-45)
 */
export async function getGroundedResponse(bot, query) {
    // Gunakan Helper Clients, fallback ke Main Clients
    const clients = (bot.helperClients && bot.helperClients.length > 0) ? bot.helperClients : bot.geminiClients;
    
    if (!clients || clients.length === 0) return "Maaf, layanan pencarian tidak tersedia.";

    // Gunakan 'gemini-2.5-flash' untuk keseimbangan kecepatan & akurasi summary
    const modelId = "gemini-2.5-flash"; 

    for (const { client, name: keyName } of clients) {
        try {
            const completion = await client.chat.completions.create({
                model: modelId,
                messages: [
                    { role: "system", content: "Kamu adalah asisten pencari informasi. Jawab pertanyaan user dengan singkat, padat, dan akurat berdasarkan pengetahuanmu." },
                    { role: "user", content: query }
                ],
                temperature: 0.7
            });
            console.log(`✅ [${keyName}] Grounding/Search response successful`);
            return completion.choices[0].message.content.trim();
        } catch (error) {
            if (error.status === 429) continue;
            console.error(`❌ [${keyName}] Grounding error:`, error.message);
        }
    }
    return "Gagal melakukan pencarian (All Keys Limited).";
}

/**
 * EMOJI REACTION (Uses Helper Clients 41-45)
 * Model: gemini-2.5-flash-lite (Fastest)
 */
export async function analyzeEmojiReaction(bot, chatHistory) {
    const modelId = "gemini-2.5-flash-lite"; 

    // Prioritaskan Helper Clients
    const clients = (bot.helperClients && bot.helperClients.length > 0) ? bot.helperClients : bot.geminiClients;

    const recentHistory = chatHistory.slice(-15);
    const systemInstruction = `
Kamu adalah AI penentu reaksi emoji.
Tugas: Analisis pesan TERAKHIR user dan tentukan emoji yang cocok.
Output WAJIB JSON: { "emoji": "👍", "urgensi": "opsional|penting|wajib", "alasan": "..." }
`;

    const messages = [
        { role: "system", content: systemInstruction },
        ...recentHistory.map(m => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text
        }))
    ];

    for (const { client } of clients) {
        try {
            const completion = await client.chat.completions.create({
                model: modelId,
                messages: messages,
                temperature: 0.5,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            continue;
        }
    }
    return null;
}

/**
 * HELPER/SHORT RESPONSE (Uses Helper Clients 41-45)
 * Model: gemini-2.5-flash-lite
 */
export async function getGeminiResponse(bot, userPrompt, chatHistory = [], modelName = null) {
    const modelId = modelName || "gemini-2.5-flash-lite";
    
    // Gunakan Helper Clients
    const clients = (bot.helperClients && bot.helperClients.length > 0) ? bot.helperClients : bot.geminiClients;

    const messages = [{ role: "system", content: HAIKARU_PERSONA }];
    if (chatHistory.length > 0) {
        for (const msg of chatHistory.slice(-5)) {
            messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.text });
        }
    }
    messages.push({ role: "user", content: userPrompt });

    for (const { client, name } of clients) {
        try {
            const completion = await client.chat.completions.create({
                model: modelId,
                messages: messages,
                temperature: 0.9,
            });
            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.warn(`⚠️ [${name}] Helper AI failed:`, error.message);
            continue;
        }
    }
    return "Maaf, AI Helper sedang sibuk.";
}

/**
 * AUDIO ANALYSIS (Direct REST API)
 * Updated to support keys up to 40 (Main Pool)
 * Model: gemini-2.5-flash
 */
export async function analyzeAudio(bot, audioData, mimeType) {
    const modelChain = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]; // Fallback chain specific for audio

    for (const modelId of modelChain) {
        // Loop through MAIN keys (1 to 40)
        for (let i = 1; i <= 40; i++) {
            const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
            const apiKey = process.env[keyName];

            if (!apiKey) continue;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const systemPrompt = `
Kamu adalah pakar analisis audio. Dengarkan audio ini dan buat laporan:
1. TRANSKRIP LENGKAP.
2. LOKASI/SUASANA.
3. EMOSI & NADA.
Output Bahasa Indonesia.
`;
            const requestBody = {
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inlineData: { mimeType: mimeType, data: audioData } }
                    ]
                }]
            };

            try {
                // console.log(`🤖 [Key_${i}] Audio Analysis ${modelId}...`);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.status === 429) continue;
                if (response.status === 404) break; // Model not found, skip keys

                const data = await response.json();
                if (data.candidates?.[0]?.content) {
                    return data.candidates[0].content.parts[0].text.trim();
                }
            } catch (e) {
                continue;
            }
        }
    }
    return null;
}