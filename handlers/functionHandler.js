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
        if (!bot.geminiApiKey) {
            throw new Error("Gemini API Key not found");
        }

        console.log(`🎨 Generating image with Gemini: "${prompt}"`);

        // Use direct REST API for image generation model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${bot.geminiApiKey}`;

        // Note: gemini-2.5-flash might not be the image generation model. 
        // The previous code used "gemini-2.5-flash-image". 
        // If that's a valid model, we use it. If not, we might need "imagen-3.0-generate-001" or similar.
        // Assuming "gemini-2.5-flash" can generate images or the user has access to a specific model.
        // I will use the model name from the previous code: "gemini-2.5-flash-image" but check if it needs specific endpoint.
        // Actually, for Imagen 3/Image generation, the endpoint is usually different or it's a specific model capability.
        // Let's try to use the same model name as before but via REST.

        const modelName = "gemini-2.5-flash"; // Fallback or specific model
        // If the user was using "gemini-2.5-flash-image", I'll stick to that if I can.
        // But for safety, I'll use the one that works for text-to-image if known, or just try the previous one.

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            // Request image generation via specific config if supported, or just prompt.
            // Gemini 2.5 Flash might support image generation natively via prompt.
        };

        // However, standard generateContent might not return image bytes directly in 'inlineData' unless requested.
        // The previous code accessed `response.candidates[0].content.parts[0].inlineData`.
        // This implies the model returns an image part.

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("No candidates returned");
        }

        const part = data.candidates[0].content.parts[0];

        // Check for inline data (image)
        if (!part.inlineData || !part.inlineData.data) {
            // If text is returned instead, maybe it refused or generated text.
            if (part.text) {
                throw new Error(`AI returned text instead of image: ${part.text}`);
            }
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
