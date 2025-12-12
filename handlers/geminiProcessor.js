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

import { HAIKARU_PERSONA, HELPER_PERSONA } from './persona.js';

export async function getGeminiChatResponse(
	bot,
	chatHistory,
	modelName = null,
) {
	// Use all available Gemini clients from fallback chain
	const clients = bot.geminiClients || [];

	if (clients.length === 0) {
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	// Use model from Gemini config or default
	const model = modelName || bot.config.ai?.gemini?.models?.main || "gemini-2.5-flash-lite";

	const systemInstruction = HAIKARU_PERSONA;

	// Convert chat history to OpenAI format
	const messages = [
		{ role: "system", content: systemInstruction }
	];

	for (const msg of chatHistory) {
		const role = msg.role === "model" ? "assistant" : "user";
		let content = msg.text;

		// Handle images if present
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

	const tools = [
		{
			type: "function",
			function: {
				name: "get_bot_info",
				description: "Dapatkan informasi tentang bot, statistik, dan info user/chat saat ini. Gunakan saat user tanya tentang bot, nomor mereka, info grup, atau statistik.",
				parameters: {
					type: "object",
					properties: {},
					required: []
				}
			}
		},
		{
			type: "function",
			function: {
				name: "check_ping",
				description: "Cek responsivitas dan latency bot. Gunakan saat user tanya 'masih hidup?', 'cek ping', 'cepat ga?', 'bot responsif?', atau sejenisnya.",
				parameters: {
					type: "object",
					properties: {},
					required: []
				}
			}
		},
		{
			type: "function",
			function: {
				name: "show_help_menu",
				description: "Tampilkan daftar fitur dan kemampuan BOT. HANYA gunakan saat user EKSPLISIT tanya tentang fitur/command/kapabilitas bot (e.g., 'fitur apa aja?', 'bisa ngapain aja?', 'tunjukin command'). JANGAN gunakan untuk request 'bantuin dong' yang generic (itu normal chat).",
				parameters: {
					type: "object",
					properties: {},
					required: []
				}
			}
		},
		{
			type: "function",
			function: {
				name: "tag_everyone",
				description: "Tag/mention semua member di grup. HANYA gunakan di grup, dan saat user EKSPLISIT minta tag/panggil semua orang (e.g., 'tag semua', 'mention all', 'panggil semua member'). JANGAN gunakan untuk greeting biasa.",
				parameters: {
					type: "object",
					properties: {},
					required: []
				}
			}
		},
		{
			type: "function",
			function: {
				name: "generate_image",
				description: "Generate/buat gambar dari deskripsi text. Gunakan saat user minta buatkan/bikinin/generate gambar.",
				parameters: {
					type: "object",
					properties: {
						prompt: {
							type: "string",
							description: "Deskripsi gambar dalam bahasa Inggris (translate dari request user jika perlu)"
						}
					},
					required: ["prompt"]
				}
			}
		},
		{
			type: "function",
			function: {
				name: "perform_google_search",
				description: "Lakukan pencarian Google untuk info terkini/real-time (berita, cuaca, info publik, fakta terbaru). Gunakan saat user tanya hal yang butuh akses internet.",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "Query pencarian yang spesifik"
						}
					},
					required: ["query"]
				}
			}
		}
	];

	// Try each client in fallback chain
	for (const { client, name: keyName } of clients) {
		try {
			const completion = await client.chat.completions.create({
				model: model,
				messages: messages,
				temperature: 0.8,
				tools: tools,
				tool_choice: "auto",
			});

			const responseMessage = completion.choices[0].message;

			// Check if AI wants to call function(s)
			if (responseMessage.tool_calls) {
				console.log(`🔧 [${keyName}] AI calling ${responseMessage.tool_calls.length} function(s):`,
					responseMessage.tool_calls.map(fc => fc.function.name).join(', '));

				const functionCalls = responseMessage.tool_calls.map(tc => ({
					name: tc.function.name,
					args: JSON.parse(tc.function.arguments),
					id: tc.id
				}));

				return {
					type: 'function_call',
					functionCalls: functionCalls
				};
			}

			// Normal text response
			if (!responseMessage.content) {
				return "Ups, respons AI kosong. Coba tanyakan lagi.";
			}

			console.log(`✅ [${keyName}] Main AI response successful`);
			return responseMessage.content.trim();

		} catch (error) {
			if (error.status === 429) {
				console.warn(`⚠️ [${keyName}] Rate limited (429), trying next key...`);
				continue; // Try next client
			}
			// For other errors, log and continue to next client
			console.error(`❌ [${keyName}] Error:`, error.message || error);
			continue;
		}
	}

	// All keys exhausted - show rate limit message
	console.error("🚫 All Main AI keys exhausted (rate limited)");
	return "🚫 *AI-Haikaru sedang istirahat!*\n\n" +
		"Kuota harian tercapai. Layanan akan aktif kembali pada:\n" +
		"📅 *07:00 WIB (00:00 UTC)*\n\n" +
		"_Terima kasih atas pengertiannya!_ 🙏";
}

export async function getGeminiResponse(
	bot,
	userPrompt,
	modelName = null,
) {
	// Use OpenAI client for Helper AI
	const openaiClient = bot.openaiClient || bot.openai;

	if (!openaiClient) {
		console.error("OpenAI API tidak diinisialisasi.");
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	// Use model from OpenAI config or default
	const model = modelName || bot.config.ai?.openai?.models?.helper || "gpt-oss-120b";
	const systemInstruction = HELPER_PERSONA;

	try {
		const completion = await openaiClient.chat.completions.create({
			model: model,
			messages: [
				{ role: "system", content: systemInstruction },
				{ role: "user", content: userPrompt }
			],
			temperature: 1.7,
		});

		return completion.choices[0].message.content.trim();
	} catch (error) {
		// Graceful handling for rate limit
		if (error.status === 429) {
			console.warn("⚠️ Helper AI rate limited (429), returning fallback message");
			return "✨"; // Return minimal placeholder so command can still work
		}
		console.error("Kesalahan panggilan Gemini API (OpenAI SDK):", error.message || error);
		return "Aduh, AI-Haikaru sedang sakit kepala! Coba ulangi sebentar lagi, ya.";
	}
}

/**
 * Helper function untuk melakukan Google Search via Gemini Grounding
 * Fallback chain: Tertiary → Quaternary → OpenAI (without grounding)
 */
import fetch from 'node-fetch';

export async function getGroundedResponse(bot, query) {
	if (!bot.openaiClient) {
		return "Maaf, layanan pencarian tidak tersedia.";
	}

	const model = bot.config.ai?.openai?.models?.grounding || "gpt-4o-mini";

	try {
		const completion = await bot.openaiClient.chat.completions.create({
			model: model,
			messages: [
				{ role: "system", content: "Kamu adalah asisten yang membantu menjawab pertanyaan. Jawab dengan informatif dan akurat." },
				{ role: "user", content: query }
			],
			temperature: 0.7
		});
		console.log("✅ [OpenAI] Grounding response successful");
		return completion.choices[0].message.content.trim();
	} catch (error) {
		if (error.status === 429) {
			console.warn("⚠️ [OpenAI] Grounding rate limited (429)");
			return "Layanan pencarian sedang sibuk. Coba lagi sebentar.";
		}
		console.error("❌ [OpenAI] Grounding error:", error.message);
		return `Gagal melakukan pencarian: ${error.message}`;
	}
}

/**
 * Menganalisis history chat untuk menentukan reaksi emoji yang tepat.
 * Menggunakan mode JSON untuk output terstruktur.
 */
export async function analyzeEmojiReaction(bot, chatHistory) {
	// Use OpenAI client for Reaction AI
	const openaiClient = bot.openaiClient || bot.openai;
	if (!openaiClient) return null;


	// Ambil 20 pesan terakhir untuk konteks reaksi
	const recentHistory = chatHistory.slice(-20);

	const systemInstruction = `
Kamu adalah AI yang bertugas memberikan reaksi emoji terhadap pesan terakhir dalam percakapan.
Tugasmu:
1. Analisis alur percakapan dari history yang diberikan.
2. Fokus pada pesan TERAKHIR dari user.
3. Tentukan emoji yang paling cocok untuk mereaksikan pesan tersebut.
4. Tentukan tingkat urgensi reaksi:
   - "wajib": Sangat emosional (sedih, marah, kaget, sangat lucu) atau perubahan topik drastis.
   - "penting": Relevan dan menambah nilai percakapan.
   - "opsional": Reaksi standar, tidak terlalu mendesak.
   - "jangan_bereaksi": Topik sensitif, duka cita serius, atau tidak perlu reaksi.

Output WAJIB JSON format:
{
  "emoji": "string (1 emoji saja)",
  "urgensi": "wajib" | "penting" | "opsional" | "jangan_bereaksi"
}
`;

	const messages = [
		{ role: "system", content: systemInstruction }
	];

	for (const msg of recentHistory) {
		const role = msg.role === "model" ? "assistant" : "user";
		messages.push({ role, content: msg.text });
	}

	try {
		// Use model from OpenAI config or default
		const reactionModel = bot.config.ai?.openai?.models?.reaction || "gpt-4o-mini";
		const completion = await openaiClient.chat.completions.create({
			model: reactionModel,
			messages: messages,
			temperature: 1.0,
			response_format: { type: "json_object" }
		});

		const responseText = completion.choices[0].message.content;
		if (!responseText) return null;

		const result = JSON.parse(responseText);
		return result;
	} catch (error) {
		// Graceful handling for rate limit - skip reaction silently
		if (error.status === 429) {
			console.warn("⚠️ Emoji reaction skipped: Rate limit exceeded (429)");
			return null;
		}
		console.error("❌ Gagal menganalisis reaksi emoji (OpenAI SDK):", error.message || error);
		return null;
	}
}

/**
 * Menganalisis intent pesan untuk menentukan apakah butuh deep context (history panjang).
 * Uses OpenAI only
 */
export async function analyzeContextIntent(bot, messageBody) {
	if (!bot.openaiClient) return false;

	const model = bot.config.ai?.openai?.models?.contextAnalyzer || "gpt-4o-mini";

	const systemInstruction = `
Kamu adalah AI classifier. Tugasmu hanya satu: Menentukan apakah pesan user membutuhkan ingatan masa lalu (long-term memory) atau konteks percakapan yang panjang.

Kriteria "requiresMemory":
- TRUE jika: User bertanya tentang masa lalu ("kemarin kita bahas apa?"), menagih janji ("mana gambarnya?"), merujuk topik sebelumnya ("lanjutin yang tadi"), atau pertanyaan implisit yang butuh konteks ("siapa dia?").
- FALSE jika: Sapaan ("halo"), pertanyaan umum ("siapa presiden RI?"), perintah baru ("buatkan gambar kucing"), atau obrolan ringan yang berdiri sendiri.

Output WAJIB JSON:
{ "requiresMemory": boolean }
`;

	try {
		const completion = await bot.openaiClient.chat.completions.create({
			model: model,
			messages: [
				{ role: "system", content: systemInstruction },
				{ role: "user", content: messageBody }
			],
			temperature: 0.5,
			response_format: { type: "json_object" }
		});

		const responseText = completion.choices[0].message.content;
		if (!responseText) return false;

		const result = JSON.parse(responseText);
		console.log("✅ [OpenAI] Context analysis successful");
		return result.requiresMemory || false;
	} catch (error) {
		if (error.status === 429) {
			console.warn("⚠️ [OpenAI] Context analyzer rate limited (429)");
			return false;
		}
		console.error("❌ [OpenAI] Context analyzer error:", error.message);
		return false;
	}
}