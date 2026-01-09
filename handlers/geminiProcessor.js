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
import modelManager from './modelManager.js';

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

export async function getGeminiChatResponse(
	bot,
	chatHistory,
	permanentMemory = "",
	requestedModel = null,
) {
	// 1. Get ordered fallback chain of models
	const taskType = detectTaskType(chatHistory);
	const modelChain = requestedModel ? [requestedModel] : modelManager.getFallbackChain(taskType);

	const clients = bot.geminiClients || [];
	if (clients.length === 0) {
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	// 2. Prepare System Instruction with Memory
	let systemInstruction = HAIKARU_PERSONA;
	if (permanentMemory) {
		systemInstruction += `\n\n[MEMORI PERMANEN USER/GRUP INI]:\n${permanentMemory}\n(Gunakan memori ini untuk mengingat detail penting tentang user. Jika ada informasi baru yang penting untuk diingat selamanya, gunakan tool update_memory)`;
	}

	// Convert chat history to OpenAI format
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

	const tools = [
		// ... (tools remain the same)
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
				description: "Tag/mention semua member di grup. HANYA gunakan jika user SECARA EKSPLISIT meminta untuk 'tag semua', 'mention all', atau sejenisnya. JANGAN gunakan untuk sapaan biasa.",
				parameters: { type: "object", properties: {}, required: [] }
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
				description: "Simpan informasi/fakta penting tentang user ke memori permanen agar kamu ingat selamanya.",
				parameters: {
					type: "object",
					properties: {
						fact: { type: "string", description: "Fakta baru yang ingin diingat" }
					},
					required: ["fact"]
				}
			}
		}
	];

	// 3. Nested Fallback Logic: Model Loop -> Key Loop
	for (const modelId of modelChain) {
		console.log(`📡 Trying model: ${modelId} (${taskType})`);

		for (const { client, name: keyName } of clients) {
			try {
				console.log(`🤖 [${keyName}] Requesting Gemini with ${modelId}...`);

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
				continue; // Try next key
			}
		}
		console.warn(`🚩 All keys failed for ${modelId}. Falling back to next model...`);
	}

	return "🚫 *AI-Haikaru sedang istirahat!*\n\nSemua model dan kunci API telah mencapai limit hari ini.";
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

export async function getGeminiResponse(
	bot,
	userPrompt,
	chatHistory = [],
	modelName = null,
) {
	// 1. Determine model (Prefer Gemini via Manager for consistency)
	const modelId = modelName || modelManager.selectModel('short');

	// 2. Prepare Messages
	const systemInstruction = HAIKARU_PERSONA;
	const messages = [{ role: "system", content: systemInstruction }];

	// Add context from history if provided
	if (chatHistory && chatHistory.length > 0) {
		for (const msg of chatHistory.slice(-10)) { // Just 10 messages for helper context
			const role = msg.role === "model" ? "assistant" : "user";
			messages.push({ role, content: msg.text });
		}
	}

	messages.push({ role: "user", content: userPrompt });

	// 3. Try Gemini Clients first (fallback chain)
	const clients = bot.geminiClients || [];
	for (const { client, name: keyName } of clients) {
		try {
			const completion = await client.chat.completions.create({
				model: modelId,
				messages: messages,
				temperature: 1.0,
			});

			const response = completion.choices[0].message.content.trim();
			modelManager.updateUsage(modelId, completion.usage?.total_tokens || 0);
			return response;
		} catch (error) {
			console.warn(`⚠️ [${keyName}] Helper AI (Gemini) failed: ${error.message}`);
			continue;
		}
	}

	// 4. Final Fallback to OpenAI
	const openaiClient = bot.openaiClient || bot.openai;
	if (!openaiClient) return "⚠️ Maaf, AI-Haikaru sedang lelah.";

	try {
		const completion = await openaiClient.chat.completions.create({
			model: "gpt-4o-mini",
			messages: messages,
			temperature: 1.0,
		});
		return completion.choices[0].message.content.trim();
	} catch (error) {
		console.error("❌ Helper AI total failure:", error.message);
		return "Aduh, aku pusing banget. Coba lagi nanti ya!";
	}
}

/**
 * Menganalisis audio/VN untuk transkrip dan deskripsi suasana (soundscape).
 * Menggunakan direct fetch ke Gemini API karena SDK OpenAI-compatible belum tentu dukung input_audio.
 */
export async function analyzeAudio(bot, audioData, mimeType) {
	const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
	if (!apiKey) return null;

	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

	const systemPrompt = `
Kamu adalah pakar analisis audio. Tugasmu adalah mendengarkan audio yang diberikan dan memberikan laporan super lengkap dalam format teks agar AI lain bisa "membayangkan" apa yang terjadi.

WAJIB SERTAKAN:
1. TRANSKRIP LENGKAP: Apa yang diucapkan (jika ada suara manusia).
2. LOKASI/SUASANA: Di mana user berada? (misal: di jalan raya, cafe berisik, kamar sunyi, dsb).
3. NOISE & GANGGUAN: Terdengar suara angin, klakson, gesekan mic, atau statis?
4. SOUND EVENTS: Apakah ada suara mendadak? (misal: benda jatuh, orang teriak di jauh, suara binatang, dsb).
5. EMOSI & NADA: Bagaimana nada bicara user? (misal: terburu-buru, santai, sedih, marah).

Output harus berupa paragraf deskriptif yang informatif dalam Bahasa Indonesia.
`;

	const requestBody = {
		contents: [{
			parts: [
				{ text: systemPrompt },
				{
					inlineData: {
						mimeType: mimeType,
						data: audioData
					}
				}
			]
		}],
		generationConfig: {
			temperature: 0.4,
			topP: 0.95,
			topK: 64,
			maxOutputTokens: 1024,
		}
	};

	try {
		console.log(`🤖 Analyzing audio soundscape with Gemini 1.5 Flash...`);
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody)
		});

		const data = await response.json();

		if (data.candidates && data.candidates[0] && data.candidates[0].content) {
			const result = data.candidates[0].content.parts[0].text.trim();
			return result;
		} else {
			console.error("❌ Gemini Audio analysis failed:", JSON.stringify(data));
			return null;
		}
	} catch (error) {
		console.error("❌ Audio analysis error:", error.message);
		return null;
	}
}