import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';

/**
 * Get bot info & statistics
 * Digunakan saat user tanya tentang bot, nomor mereka, info grup, atau statistik
 */
export async function get_bot_info(bot, message, chat) {
    const senderId = message.author || message.from;
    let userNumber = senderId ? senderId.split("@")[0] : "Tidak diketahui";

    // Handle LID (Linked ID) conversion - WhatsApp privacy feature
    try {
        if (senderId && senderId.includes('@lid')) {
            const lidWid = await bot.client.pupPage.evaluate((id) => {
                if (id && id.includes('@lid')) {
                    const wid = window.Store.WidFactory.createWid(id);
                    if (window.Store.LidUtils) {
                        return window.Store.LidUtils.getPhoneNumber(wid);
                    }
                }
                return null;
            }, senderId);

            if (lidWid && typeof lidWid === 'object' && lidWid.user) {
                userNumber = lidWid.user;
            } else if (lidWid) {
                userNumber = lidWid.toString().split("@")[0];
            }
        }

        if (typeof userNumber === 'string') {
            userNumber = userNumber.replace(/[^0-9]/g, '');
        }
    } catch (e) {
        console.error('Gagal convert LID:', e.message);
        try {
            const contact = await message.getContact();
            userNumber = contact.number || userNumber;
        } catch (contactErr) {
            console.error('Gagal getContact:', contactErr.message);
            userNumber = message._data.notifyName ? message._data.notifyName.match(/\d{10,}/)?.[0] || userNumber : userNumber;
        }
    }

    let userName = message._data.notifyName || "Pengguna";
    try {
        const contact = await message.getContact();
        userName = contact.pushname || contact.name || userName;
    } catch (e) {
        // Ignore error
    }

    return {
        botName: bot.config.botName,
        totalCommands: bot.commands.size,
        prefix: bot.prefix,
        version: bot.version,
        userNumber: userNumber,
        userName: userName,
        chatType: chat.isGroup ? "Grup" : "Pribadi",
        groupName: chat.isGroup ? chat.name : null,
        groupParticipants: chat.isGroup ? chat.participants.length : null
    };
}

/**
 * Check bot responsiveness (ping)
 * Digunakan saat user tanya "masih hidup?", "cek ping", "cepat ga?", dll
 */
export async function check_ping(bot, message) {
    const startTime = Date.now();
    // Simulate network check
    await new Promise(resolve => setTimeout(resolve, 10));
    const latency = Date.now() - startTime;

    return {
        latency: latency,
        status: "online",
        timestamp: new Date().toISOString()
    };
}

/**
 * Show help menu - daftar fitur bot
 * HANYA untuk query tentang fitur/command bot, bukan life help
 */
export async function show_help_menu(bot) {
    return {
        botName: bot.config.botName,
        version: bot.version,
        prefix: bot.prefix,
        features: [
            {
                category: "🛠️ Utility",
                items: [
                    "Cek ping/responsivitas bot (.ping)",
                    "Info statistik bot & chat (.info)",
                    "Generate gambar dari deskripsi (.img)",
                ]
            },
            {
                category: "👥 Group",
                items: [
                    "Tag semua member grup (@everyone)",
                ]
            },
            {
                category: "🧠 AI Chat",
                items: [
                    "Jawab pertanyaan apapun",
                    "Analisis gambar (kirim foto + pertanyaan)",
                    "Ngobrol santai kayak teman",
                    "Bantu tugas sekolah/coding",
                    "Cari info dengan Google Search"
                ]
            }
        ],
        naturalLanguageExamples: [
            "\"info dong\" → Info bot",
            "\"nomor ku berapa?\" → Nomor kamu",
            "\"cek ping\" → Responsivitas",
            "\"tag semua orang\" → Mention all (grup only)",
            "\"bikinin gambar sunset\" → Generate image"
        ]
    };
}

/**
 * Tag everyone in group
 * HANYA di grup, dan HARUS eksplisit diminta!
 */
export async function tag_everyone(bot, message, chat) {
    if (!chat.isGroup) {
        throw new Error("Tag everyone hanya bisa digunakan di grup");
    }

    const participants = chat.participants;
    const mentions = participants.map((p) => p.id._serialized);
    const mentionText = participants.map(p => `@${p.id.user}`).join(' ');

    return {
        mentions: mentions,
        mentionText: mentionText,
        participantCount: participants.length,
        groupName: chat.name
    };
}

export async function generate_image(bot, prompt) {
    try {
        if (!bot.geminiApi) {
            throw new Error("Gemini API not initialized");
        }

        console.log(`🎨 Generating image with Gemini: "${prompt}"`);

        // Gunakan model Imagen 3 (gemini-3-pro-image-preview / imagen-3.0-generate-001)
        const model = bot.geminiApi.getGenerativeModel({ model: "imagen-3.0-generate-001" });

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new Error("No image generated");
        }

        const part = response.candidates[0].content.parts[0];

        if (!part.inlineData || !part.inlineData.data) {
            throw new Error("Invalid image response format");
        }

        const buffer = Buffer.from(part.inlineData.data, 'base64');

        // Ensure .local directory exists
        if (!fs.existsSync('.local')) {
            fs.mkdirSync('.local', { recursive: true });
        }

        // Save to temp file
        const tempPath = `.local/temp_${Date.now()}.png`;
        fs.writeFileSync(tempPath, buffer);

        console.log(`✅ Image generated successfully: ${tempPath}`);

        return {
            success: true,
            imagePath: tempPath,
            prompt: prompt,
            size: buffer.length
        };
    } catch (error) {
        console.error('❌ Image generation failed:', error);
        return {
            success: false,
            error: error.message,
            prompt: prompt
        };
    }
}

/**
 * Perform Google Search via Gemini Grounding Proxy
 * Dipanggil saat user tanya info terkini/real-time
 */
export async function perform_google_search(bot, query) {
    console.log(`🔍 Performing Google Search for: "${query}"`);

    // Import helper secara dinamis untuk menghindari circular dependency saat init
    const { getGroundedResponse } = await import('./geminiProcessor.js');

    const searchResult = await getGroundedResponse(bot, query);

    return {
        query: query,
        result: searchResult,
        timestamp: new Date().toISOString()
    };
}
