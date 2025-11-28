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

async function startTiming() {
    const startTime = Date.now();
    return startTime;
}

export async function check_ping(bot, message) {
    const startTime = startTiming();

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
        text: mentionText
    };
}

/**
 * Analyze prompt to determine optimal image dimensions
 * @param {string} prompt - The image description
 * @returns {Promise<{width: number, height: number, orientation: string}>}
 */
async function analyzeDimensions(prompt) {
    // Default: 1:1 ratio, 4K (3840x3840)
    const defaultDimensions = {
        width: 3840,
        height: 3840,
        orientation: 'square'
    };

    // Common keywords for landscape
    const landscapeKeywords = ['landscape', 'panorama', 'wide', 'horizon', 'cityscape', 'scenery', 'vista', 'banner', 'cover', 'wallpaper'];
    // Common keywords for portrait
    const portraitKeywords = ['portrait', 'tall', 'vertical', 'person', 'model', 'standing', 'selfie', 'poster'];

    const lowerPrompt = prompt.toLowerCase();

    // Check for explicit landscape hints
    const isLandscape = landscapeKeywords.some(keyword => lowerPrompt.includes(keyword));
    // Check for explicit portrait hints
    const isPortrait = portraitKeywords.some(keyword => lowerPrompt.includes(keyword));

    if (isLandscape && !isPortrait) {
        // 16:9 landscape, 4K (3840x2160)
        return {
            width: 3840,
            height: 2160,
            orientation: 'landscape'
        };
    } else if (isPortrait && !isLandscape) {
        // 9:16 portrait, 4K (2160x3840)
        return {
            width: 2160,
            height: 3840,
            orientation: 'portrait'
        };
    }

    // Default to square
    return defaultDimensions;
}

/**
 * Generate image dari prompt
 * Akan enhance prompt terlebih dahulu, lalu request ke API
 */
export async function generate_image(prompt) {
    console.log(`🎨 Generating image for: "${prompt}"`);
    
    // Import getGeminiResponse here to avoid circular dependency
    const { getGeminiResponse } = await import('./geminiProcessor.js');

    // Step 1: Enhance the prompt for better quality
    const enhanceSystemPrompt = `You are a prompt engineer for AI image generation. Your task is to transform a simple image description into a detailed, high-quality prompt that will produce stunning visuals.

Rules:
1. Keep the core concept from the user's request
2. Add artistic details (lighting, composition, style, mood)
3. Specify quality keywords (highly detailed, 4K, professional, cinematic)
4. Keep it under 200 words
5. Output ONLY the enhanced prompt, no explanation

Example:
Input: "sunset beach"
Output: "A breathtaking sunset over a pristine tropical beach, golden hour lighting casting warm orange and pink hues across the sky, gentle waves lapping at the shore, silhouettes of palm trees swaying in the breeze, highly detailed, cinematic composition, professional photography, 4K quality"`;

    let enhancedPrompt = prompt;
    try {
        // Use a simple gemini call to enhance the prompt
        // We'll use the secondary API if available for cost savings
        // Note: getGeminiResponse already handles bot.openai vs bot.openai2
        const enhancement = await getGeminiResponse(null, `Transform this image prompt: "${prompt}"`);
        if (enhancement && enhancement.length > 0) {
            enhancedPrompt = enhancement;
            console.log(`✨ Enhanced prompt: "${enhancedPrompt}"`);
        }
    } catch (error) {
        console.warn('⚠️ Failed to enhance prompt, using original:', error.message);
    }

    // Step 2: Analyze dimensions based on prompt
    const dimensions = await analyzeDimensions(prompt);
    console.log(`📐 Detected orientation: ${dimensions.orientation} (${dimensions.width}x${dimensions.height})`);

    // Step 3: Generate the image using Pollinations.ai
    try {
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&model=flux&nologo=true`;
        
        console.log(`🌐 Requesting image from: ${url}`);

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // node-fetch v3 uses arrayBuffer()
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

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
            prompt: enhancedPrompt, // Return the enhanced prompt so user knows
            originalPrompt: prompt,
            dimensions: dimensions,
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
