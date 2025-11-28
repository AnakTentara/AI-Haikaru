import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';
import sharp from 'sharp';

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
    await message.reply("🏓 Pinging...");

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
                    "Bikin sticker dari foto atau text (.sticker)",
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
            "\"bikinin gambar sunset\" → Generate image",
            "\"bikin sticker dari gambar ini\" → Image to sticker (reply gambar)",
            "\"jadiin sticker: Hello World\" → Text to sticker"
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
    const mentions = participants.map((p));

    const response = await fetch(url);

    if (!response.ok) {
        let data = {
            mentionText: mentionText,
            participantCount: participants.length,
            groupName: chat.name
        };

        throw new Error(`HTTP Error: ${data}`);
    }
}

export async function generate_image(bot, prompt) {
    try {
        console.log(`🎨 Generating image with Pollinations (Free): "${prompt}"`);

        let enhancedPrompt = prompt;

        // Enhance prompt using AI if available
        const openaiClient = bot.openai2 || bot.openai; // Use secondary key for cost savings
        if (openaiClient) {
            try {
                console.log("✨ Enhancing prompt with AI...");
                const enhancementResponse = await openaiClient.chat.completions.create({
                    model: "gemini-2.5-flash", // Use a fast model for this
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert prompt engineer for AI image generation. Your task is to take a short user prompt and expand it into a detailed, high-quality, descriptive paragraph (at least 3-4 sentences) suitable for generating a stunning image. Focus on lighting, texture, mood, and composition. Output ONLY the enhanced prompt, no intro/outro."
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 1.3,
                });

                if (enhancementResponse.choices && enhancementResponse.choices[0] && enhancementResponse.choices[0].message) {
                    enhancedPrompt = enhancementResponse.choices[0].message.content.trim();
                    console.log(`✨ Enhanced Prompt: "${enhancedPrompt}"`);
                }
            } catch (enhancementError) {
                console.warn("⚠️ Failed to enhance prompt, using original:", enhancementError.message);
            }
        }

        // Pollinations.ai - Free, No Key
        // URL format: https://image.pollinations.ai/prompt/{prompt}?width={width}&height={height}&model={model}&nologo=true
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        // Using 'flux' model for better quality, or 'any' to let it decide. 'flux' is popular now.
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
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

/**
 * Create text-based sticker
 * Generate image from text with white background, black text, word wrapping, and padding
 */
export async function create_text_sticker(text) {
    console.log(`🎨 Creating text sticker: "${text}"`);

    // Configuration
    const padding = 10;
    const maxWidth = 512 - (padding * 2);  // 512px is WhatsApp sticker size
    const fontSize = text.length > 100 ? 24 : text.length > 50 ? 32 : 40;
    const lineHeight = fontSize * 1.4;

    // Word wrapping logic
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    // Estimate character width (rough approximation)
    const charWidth = fontSize * 0.6;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Calculate image height based on number of lines
    const textHeight = lines.length * lineHeight;
    const imageHeight = Math.max(512, textHeight + (padding * 2));

    // Create SVG with text
    const svgText = lines.map((line, i) => {
        const y = padding + (i * lineHeight) + fontSize;
        return `<text x="50%" y="${y}" text-anchor="middle" font-size="${fontSize}" font-family="Arial, sans-serif" fill="#000000">${escapeXml(line)}</text>`;
    }).join('\n');

    const svg = `
        <svg width="512" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="${imageHeight}" fill="#FFFFFF"/>
            ${svgText}
        </svg>
    `;

    // Ensure .local directory exists
    if (!fs.existsSync('.local')) {
        fs.mkdirSync('.local', { recursive: true });
    }

    // Generate image using sharp
    const tempPath = `.local/text_sticker_${Date.now()}.png`;

    await sharp(Buffer.from(svg))
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(tempPath);

    console.log(`✅ Text sticker created: ${tempPath}`);
    return tempPath;
}

/**
 * Create image-based sticker
 * Convert MessageMedia to sticker format with proper resizing
 */
export async function create_image_sticker(media) {
    console.log(`🎨 Creating image sticker from media`);

    // Decode base64 image
    const buffer = Buffer.from(media.data, 'base64');

    // Resize to WhatsApp sticker specs (512x512, maintain aspect ratio)
    const resizedBuffer = await sharp(buffer)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();

    // Convert back to MessageMedia
    const base64 = resizedBuffer.toString('base64');
    const sticker = new MessageMedia('image/png', base64);

    console.log(`✅ Image sticker created`);
    return sticker;
}

/**
 * Helper function to escape XML special characters
 */
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
