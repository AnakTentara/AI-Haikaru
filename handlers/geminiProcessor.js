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
	modelName = "gemini-2.5-flash",
) {
	if (!bot.openai) {
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	const systemInstruction = HAIKARU_PERSONA;

	// Convert chat history to OpenAI format
	const messages = [
		{ role: "system", content: systemInstruction }
	];

	for (const msg of chatHistory) {
		const role = msg.role === "model" ? "assistant" : "user";
		let content = msg.text;

		// Handle images if present (using OpenAI's image_url format if supported by Gemini via OpenAI endpoint, 
		// or inline base64 if that's how Gemini OpenAI compat works. 
		// Gemini OpenAI compat supports standard OpenAI image_url.
		// However, our msg.image.data is base64.
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

	try {
		const completion = await bot.openai.chat.completions.create({
			model: modelName,
			messages: messages,
			temperature: 0.8,
			tools: tools,
			tool_choice: "auto",
		});

		const responseMessage = completion.choices[0].message;

		// Check if AI wants to call function(s)
		if (responseMessage.tool_calls) {
			console.log(`🔧 AI calling ${responseMessage.tool_calls.length} function(s):`,
				responseMessage.tool_calls.map(fc => fc.function.name).join(', '));

			// Map OpenAI tool_calls to our internal functionCalls format
			// Our internal format expects: { name, args }
			// OpenAI format: { id, type, function: { name, arguments } }
			const functionCalls = responseMessage.tool_calls.map(tc => ({
				name: tc.function.name,
				args: JSON.parse(tc.function.arguments),
				id: tc.id // Keep ID if needed for tool_output later (though we currently just execute and reply)
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
		return responseMessage.content.trim();
	} catch (error) {
		console.error("Kesalahan panggilan Gemini Chat API (OpenAI SDK):", error);
		return "Aduh, AI-Haikaru sedang gagal mengingat. Ada apa ya? Coba tanyakan lagi.";
	}
}

export async function getGeminiResponse(
	bot,
	userPrompt,
	modelName = "gemini-flash-latest",
) {
	if (!bot.openai) {
		console.error("Gemini API (OpenAI) tidak diinisialisasi.");
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	const systemInstruction = HELPER_PERSONA;

	try {
		const completion = await bot.openai.chat.completions.create({
			model: modelName,
			messages: [
				{ role: "system", content: systemInstruction },
				{ role: "user", content: userPrompt }
			],
			temperature: 1.7,
		});

		return completion.choices[0].message.content.trim();
	} catch (error) {
		console.error("Kesalahan panggilan Gemini API (OpenAI SDK):", error);
		return "Aduh, AI-Haikaru sedang sakit kepala! Coba ulangi sebentar lagi, ya.";
	}
}

/**
 * Helper function untuk melakukan Google Search via Gemini Grounding
 * Ini dipanggil oleh functionHandler saat AI memilih 'perform_google_search'
 * NOTE: Karena OpenAI SDK tidak support native grounding, kita gunakan fetch langsung ke endpoint Gemini.
 */
import fetch from 'node-fetch';

export async function getGroundedResponse(bot, query) {
	if (!bot.geminiApiKey) {
		throw new Error("Gemini API Key not found");
	}

	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${bot.geminiApiKey}`;

	const payload = {
		contents: [{ parts: [{ text: query }] }],
		tools: [{ googleSearch: {} }], // Native grounding
		generationConfig: { temperature: 0.7 }
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Extract text from Gemini REST response
		if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
			return data.candidates[0].content.parts.map(p => p.text).join('').trim();
		}

		console.warn("Grounded Search: Respons text dari Gemini kosong.", JSON.stringify(data));
		return "Ups, hasil pencarian kosong atau tidak ditemukan.";
	} catch (error) {
		console.error("Grounded Search Error:", error);
		return `Gagal melakukan pencarian: ${error.message}`;
	}
}

/**
 * Menganalisis history chat untuk menentukan reaksi emoji yang tepat.
 * Menggunakan mode JSON untuk output terstruktur.
 */
export async function analyzeEmojiReaction(bot, chatHistory) {
	// Use secondary API key if available for cost savings  
	const openaiClient = bot.openai2 || bot.openai;
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
		const completion = await openaiClient.chat.completions.create({
			model: "gemini-2.0-flash-lite-preview-02-05", // Gunakan model lite untuk hemat token
			messages: messages,
			temperature: 1.0,
			response_format: { type: "json_object" }
		});

		const responseText = completion.choices[0].message.content;
		if (!responseText) return null;

		const result = JSON.parse(responseText);
		return result;
	} catch (error) {
		console.error("❌ Gagal menganalisis reaksi emoji (OpenAI SDK):", error);
		return null;
	}
}

/**
 * Menganalisis intent pesan untuk menentukan apakah butuh deep context (history panjang).
 * Menggunakan model cepat (Flash) untuk keputusan instan.
 */
export async function analyzeContextIntent(bot, messageBody) {
	if (!bot.openai) return false;

	const systemInstruction = `
Kamu adalah AI classifier. Tugasmu hanya satu: Menentukan apakah pesan user membutuhkan ingatan masa lalu (long-term memory) atau konteks percakapan yang panjang.

Kriteria "requiresMemory":
- TRUE jika: User bertanya tentang masa lalu ("kemarin kita bahas apa?"), menagih janji ("mana gambarnya?"), merujuk topik sebelumnya ("lanjutin yang tadi"), atau pertanyaan implisit yang butuh konteks ("siapa dia?").
- FALSE jika: Sapaan ("halo"), pertanyaan umum ("siapa presiden RI?"), perintah baru ("buatkan gambar kucing"), atau obrolan ringan yang berdiri sendiri.

Output WAJIB JSON:
{ "requiresMemory": boolean }
`;

	try {
		const completion = await bot.openai.chat.completions.create({
			model: "gemini-2.5-flash",
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
		return result.requiresMemory || false;
	} catch (error) {
		console.error("⚠️ Gagal analisis intent context (OpenAI SDK):", error.message);
		return false; // Default to fast mode on error
	}
}