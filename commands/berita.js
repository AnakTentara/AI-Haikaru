import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import Logger from "../handlers/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompt files
const configPath = path.join(__dirname, '..', 'config', 'berita');
const newsPrompt = fs.readFileSync(path.join(configPath, 'news.txt'), 'utf8');

// Configuration for remote dataset
const DATASET_BASE_URL = process.env.DATASET_BASE_URL || "https://dataset-man.haikaldev.my.id";
const DATASET_SECRET = process.env.DATASET_SECRET || "default-secret";

// Helper to fetch base text
async function getBaseContext() {
    try {
        const url = `${DATASET_BASE_URL}/api/content`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DATASET_SECRET}`
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const text = data.content;

        if (!text || text.length < 50) throw new Error("Content empty or too short");

        return text;
    } catch (error) {
        Logger.warning("BERITA", `Failed to fetch remote dataset: ${error.message}. Using local fallback if available.`);
        // Fallback to local file checking for .bak just in case user reverted or something (keeping simple)
        try {
            return fs.readFileSync(path.join(configPath, 'base.txt.bak'), 'utf8');
        } catch (filesError) {
            return "Maaf, data informasi sekolah tidak tersedia saat ini.";
        }
    }
}

// Get initial from name (3 letters, capitalized first)
function getInitial(name) {
    if (!name || typeof name !== 'string') return 'Hai';
    const cleanedName = name.trim();
    if (cleanedName.length === 0) return 'Hai';
    const initialPart = cleanedName.substring(0, 3);
    return initialPart.charAt(0).toUpperCase() + initialPart.slice(1).toLowerCase();
}

export default {
    name: "berita",
    description: "Generate berita/news AI untuk MAN 1 Muara Enim berdasarkan informasi yang diberikan",
    usage: ".berita <informasi berita> atau .berita penulis:<nama> <informasi>",
    prefixRequired: true,
    hideFromHelp: true,
    triggers: [".berita"],

    async execute(message, args, bot) {
        // Check if any berita client is available
        const beritaClients = bot.beritaClients || [];
        if (beritaClients.length === 0) {
            return message.reply("❌ Fitur berita tidak tersedia. API key belum dikonfigurasi.");
        }

        if (args.length === 0) {
            return message.reply(
                "📰 *Cara Penggunaan .berita*\n\n" +
                "`.berita <informasi berita>`\n" +
                "`.berita penulis:Haikal <informasi>`\n\n" +
                "_Contoh:_\n" +
                "`.berita Hari ini MAN 1 Muara Enim mengadakan upacara bendera yang diikuti seluruh siswa`"
            );
        }

        const inputText = args.join(' ');

        // Detect author from input
        let authorInitial = '(TJR/Hai)';
        let cleanedInputText = inputText;
        const authorMatch = inputText.match(/penulis:\s*(\w+)/i);
        if (authorMatch && authorMatch[1]) {
            const authorName = authorMatch[1];
            const initial = getInitial(authorName);
            authorInitial = `(TJR/${initial})`;
            cleanedInputText = inputText.replace(/penulis:\s*\w+\s*/i, '').trim();
            Logger.info("BERITA", `Author: ${authorName}, Initial: ${authorInitial}`);
        }

        // Fetch up-to-date base context
        const basePrompt = await getBaseContext();

        // Build system prompt (no history - standalone request)
        const instructionForThisRequest = `\n\nInstruksi Tambahan:\n- Gunakan inisial penulis di akhir berita: ${authorInitial}\n`;
        const systemPrompt = `${basePrompt}\n\n${newsPrompt}\n${instructionForThisRequest}`;

        // Simple messages - no history
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: cleanedInputText }
        ];

        try {
            // Show typing indicator
            const chat = await message.getChat();
            await chat.sendStateTyping();

            Logger.info("BERITA", `Generating news...`);

            // Try each client in fallback chain
            let generatedText = null;
            for (const { client, name: keyName } of beritaClients) {
                try {
                    const completion = await client.chat.completions.create({
                        model: "gemini-2.5-flash",
                        messages: messages,
                        temperature: 0.8,
                    });

                    generatedText = completion.choices[0].message.content;
                    if (generatedText) {
                        Logger.success("BERITA", `[${keyName}] News generated`);
                        break;
                    }
                } catch (error) {
                    if (error.status === 429) {
                        Logger.warn("BERITA", `[${keyName}] Rate limited, trying next...`);
                        continue;
                    }
                    Logger.error("BERITA", `[${keyName}] Error: ${error.message}`);
                    continue;
                }
            }

            // All keys exhausted
            if (!generatedText) {
                return message.reply(
                    "🚫 *Layanan Berita Sedang Istirahat*\n\n" +
                    "Kuota harian tercapai. Layanan akan aktif kembali pada:\n" +
                    "📅 *07:00 WIB (00:00 UTC)*\n\n" +
                    "_Terima kasih atas pengertiannya!_ 🙏"
                );
            }

            // Send the generated news
            await message.reply(`📰 *BERITA AI-HAIKARU*\n\n${generatedText}`);

        } catch (error) {
            Logger.error("BERITA", `Error: ${error.message}`);
            return message.reply(`❌ Gagal menghasilkan berita: ${error.message}`);
        }
    }
};
