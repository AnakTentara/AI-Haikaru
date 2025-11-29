import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import fs from 'fs';
import sharp from 'sharp';

/**
 * Helper function to escape XML special characters
 */
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

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
    
    // Get all participant IDs for mentions
    const mentions = participants.map(p => p.id._serialized);
    const mentionText = mentions.map(id => `@${id.split('@')[0]}`).join(' ');

    return {
        mentions: mentions,
        participantCount: participants.length,
        groupName: chat.name,
        mentionText: mentionText // ← Sekarang ada isinya!
    };
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
 * Improved layout: Justified text (left-aligned with spacing), Vertical Fill, Dynamic Sizing, Dynamic Spacing
 */
export async function create_text_sticker(text) {

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.error("Error: Invalid or empty text provided for the sticker. Cannot create sticker.");
        throw new Error("A non-empty string 'text' is required to create a sticker.");
    }

    console.log(`🎨 Creating text sticker: "${text}"`);

    // Configuration Awal
    const canvasSize = 256;
    const initialPadding = 20;

    // Menghitung Padding Dinamis
    // Semakin panjang teksnya (misalnya, semakin banyak baris), padding semakin kecil
    const textLength = text.trim().length;
    // Padding minimum yang diinginkan, misalnya 5
    const minPadding = 5;
    // Rumus sederhana: padding berkurang secara linear (atau logaritmik) seiring bertambahnya panjang teks
    let padding = Math.max(minPadding, initialPadding - Math.floor(textLength / 10));
    padding = Math.min(initialPadding, padding); // Pastikan tidak melebihi initialPadding

    const maxWidth = canvasSize - (padding * 2);
    const maxHeight = canvasSize - (padding * 2);

    // Split text into words
    const words = text.trim().split(/\s+/);
    let lines = [];

    // Asumsi batas karakter per baris, ini akan diuji coba kemudian
    // Untuk teks yang sangat panjang, kita mulai dengan batas 15-20 karakter untuk mencoba memuat
    // Batas ini akan disesuaikan saat kita menghitung ukuran font
    const baseTargetCharsPerLine = 15;

    // --- Layout Logic (Word Wrapping Berdasarkan Target Karakter) ---
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        // Coba wrapping sederhana berdasarkan target karakter per baris
        if (testLine.length <= baseTargetCharsPerLine || !currentLine) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Jika target karakter terlalu ketat (misal hanya 1 baris panjang), ulangi dengan batas yang lebih longgar.
    // Ini membantu jika ada satu kata yang sangat panjang.
    if (lines.length === 1 && lines[0].length > baseTargetCharsPerLine) {
        lines = [];
        let tempLine = '';
        for (const word of words) {
            const testLine = tempLine ? `${tempLine} ${word}` : word;
            // Gunakan batas lebar yang lebih longgar
            if (testLine.length <= 25 || !tempLine) {
                tempLine = testLine;
            } else {
                lines.push(tempLine);
                tempLine = word;
            }
        }
        if (tempLine) lines.push(tempLine);
    }

    // Jika masih ada baris yang terlalu panjang, kita harus bergantung pada pengecilan font.
    const maxLineChars = Math.max(...lines.map(l => l.length));
    const numLines = lines.length;

    // --- Dynamic Font Size Calculation ---
    const fontAspectRatio = 0.55; // Width / Height

    // Rasio Ketinggian Baris Dinamis: Semakin banyak baris, semakin ketat/dempet
    // Mulai dari 1.2 untuk 1 baris, turun ke 0.9 untuk banyak baris.
    const maxLineRatio = 1.2;
    const minLineRatio = 0.9;
    const lineHeightRatio = Math.max(minLineRatio, maxLineRatio - (numLines * 0.1));

    // Calculate max font size constrained by width
    const fontSizeByWidth = maxWidth / (maxLineChars * fontAspectRatio);

    // Calculate max font size constrained by height
    const fontSizeByHeight = maxHeight / (numLines * lineHeightRatio);

    // Choose the smaller constraint for the base font size
    let fontSize = Math.min(fontSizeByWidth, fontSizeByHeight);

    fontSize = Math.min(fontSize, 200);

    const minFinalFontSize = 10;
    fontSize = Math.max(fontSize, minFinalFontSize);

    let linePositions = [];
    const totalTextHeight = numLines * fontSize * lineHeightRatio;

    let currentY = padding + (maxHeight - totalTextHeight) / 2;

    for (let i = 0; i < numLines; i++) {
        currentY += fontSize * lineHeightRatio;
        linePositions.push(currentY - (fontSize * 0.35));
    }

    const textBlockHeight = numLines * fontSize * lineHeightRatio;
    let yStart = (canvasSize / 2) - (textBlockHeight / 2) + (fontSize * 0.75);

    linePositions = [];
    for (let i = 0; i < numLines; i++) {
        linePositions.push(yStart + (i * fontSize * lineHeightRatio));
    }


    // --- SVG Generation ---
    const svgText = lines.map((line, i) => {
        const y = linePositions[i];

        let attributes = `x="${padding}" y="${y}" font-size="${fontSize}" font-family="Open Sans, sans-serif" font-weight="400" fill="#000000"`;

        if (line.includes(' ')) {
            // Full Justify for lines with multiple words
            attributes += ` text-anchor="start" textLength="${maxWidth}" lengthAdjust="spacing"`;
        } else {
            // Left align for single words (standard justify behavior)
            attributes += ` text-anchor="start"`;
        }

        return `<text ${attributes}>${escapeXml(line)}</text>`;
    }).join('\n');

    const svg = `
        <svg width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${canvasSize}" height="${canvasSize}" fill="#FFFFFF"/>
            ${svgText}
        </svg>
    `;

    // Ensure .local directory exists (Asumsi fungsi fs dan sharp tersedia)
    if (!fs.existsSync('.local')) {
        fs.mkdirSync('.local', { recursive: true });
    }

    // Generate image using sharp
    const tempPath = `.local/text_sticker_${Date.now()}.png`;

    await sharp(Buffer.from(svg))
        .resize(canvasSize, canvasSize, {
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

    const resizedBuffer = await sharp(buffer)
        .resize(256, 256, {
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