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
	// Build client fallback chain: Primary → Secondary
	const clients = [bot.geminiPrimary, bot.geminiSecondary].filter(Boolean);

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
	for (let i = 0; i < clients.length; i++) {
		const client = clients[i];
		const keyName = i === 0 ? "Primary" : "Secondary";

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
	// Use model from config or default
	const groundingModel = bot.config.ai?.gemini?.models?.grounding || "gemini-2.0-flash-lite";
	const fallbackModel = bot.config.ai?.openai?.models?.fallback || "gpt-4o-mini";

	// Build API key fallback chain for grounding
	const geminiKeys = [
		{ key: bot.geminiApiKey3, name: "Tertiary" },
		{ key: bot.geminiApiKey4, name: "Quaternary" }
	].filter(k => k.key);

	// Try Gemini keys with native grounding
	for (const { key, name } of geminiKeys) {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${groundingModel}:generateContent?key=${key}`;

		const payload = {
			contents: [{ parts: [{ text: query }] }],
			tools: [{ googleSearch: {} }],
			generationConfig: { temperature: 0.7 }
		};

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (response.status === 429) {
				console.warn(`⚠️ [${name}] Grounding rate limited (429), trying next key...`);
				continue;
			}

			if (!response.ok) {
				console.warn(`⚠️ [${name}] Grounding HTTP ${response.status}, trying next key...`);
				continue;
			}

			const data = await response.json();

			if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
				console.log(`✅ [${name}] Grounding successful`);
				return data.candidates[0].content.parts.map(p => p.text).join('').trim();
			}
		} catch (error) {
			console.error(`❌ [${name}] Grounding error:`, error.message);
			continue;
		}
	}

	// Fallback to OpenAI (without grounding - just answer based on training data)
	if (bot.openaiClient) {
		try {
			console.log("⚠️ All Gemini grounding keys exhausted, falling back to OpenAI...");
			const completion = await bot.openaiClient.chat.completions.create({
				model: fallbackModel,
				messages: [
					{ role: "system", content: "Jawab pertanyaan berikut dengan pengetahuan yang kamu miliki. Jika tidak yakin, katakan bahwa informasi mungkin tidak terbaru." },
					{ role: "user", content: query }
				],
				temperature: 0.7
			});
			console.log("✅ [OpenAI Fallback] Response successful");
			return completion.choices[0].message.content.trim();
		} catch (error) {
			console.error("❌ [OpenAI Fallback] Error:", error.message);
		}
	}

	return "Ups, semua layanan pencarian sedang tidak tersedia. Coba lagi nanti.";
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
		const reactionModel = bot.config.ai?.openai?.models?.reaction || "gpt-oss-120b";
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
 * Fallback chain: Tertiary → Quaternary → OpenAI
 */
export async function analyzeContextIntent(bot, messageBody) {
	// Build client fallback chain: Tertiary → Quaternary → OpenAI
	const clients = [
		{ client: bot.geminiTertiary, name: "Tertiary", model: bot.config.ai?.gemini?.models?.contextAnalyzer || "gemini-2.0-flash-lite" },
		{ client: bot.geminiQuaternary, name: "Quaternary", model: bot.config.ai?.gemini?.models?.contextAnalyzer || "gemini-2.0-flash-lite" },
		{ client: bot.openaiClient, name: "OpenAI", model: bot.config.ai?.openai?.models?.fallback || "gpt-4o-mini" }
	].filter(c => c.client);

	if (clients.length === 0) return false;

	const systemInstruction = `
Kamu adalah AI classifier. Tugasmu hanya satu: Menentukan apakah pesan user membutuhkan ingatan masa lalu (long-term memory) atau konteks percakapan yang panjang.

Kriteria "requiresMemory":
- TRUE jika: User bertanya tentang masa lalu ("kemarin kita bahas apa?"), menagih janji ("mana gambarnya?"), merujuk topik sebelumnya ("lanjutin yang tadi"), atau pertanyaan implisit yang butuh konteks ("siapa dia?").
- FALSE jika: Sapaan ("halo"), pertanyaan umum ("siapa presiden RI?"), perintah baru ("buatkan gambar kucing"), atau obrolan ringan yang berdiri sendiri, kalo dia hanya menyuruh untuk menjalankan perintah/command (serperti tag semua orang[@everyone], ping, tampilkan menu help, tampilkan menu info).

Output WAJIB JSON:
{ "requiresMemory": boolean }
`;

	for (const { client, name, model } of clients) {
		try {
			const completion = await client.chat.completions.create({
				model: model,
				messages: [
					{ role: "system", content: systemInstruction },
					{ role: "user", content: messageBody }
				],
				temperature: 0.5,
				response_format: { type: "json_object" }
			});

			const responseText = completion.choices[0].message.content;
			if (!responseText) continue;

			const result = JSON.parse(responseText);
			console.log(`✅ [${name}] Context analysis successful`);
			return result.requiresMemory || false;
		} catch (error) {
			if (error.status === 429) {
				console.warn(`⚠️ [${name}] Context analyzer rate limited (429), trying next...`);
				continue;
			}
			console.error(`❌ [${name}] Context analyzer error:`, error.message);
			continue;
		}
	}

	// All failed, default to fast mode
	console.warn("⚠️ All context analyzer keys exhausted, defaulting to fast mode");
	return false;
}