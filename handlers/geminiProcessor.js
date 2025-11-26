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
	if (!bot.geminiApi) {
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	const systemInstruction = HAIKARU_PERSONA;

	const generationConfig = {
		temperature: 0.8,
		systemInstruction: systemInstruction,
		tools: [
			{
				functionDeclarations: [
					{
						name: "get_bot_info",
						description: "Dapatkan informasi tentang bot, statistik, dan info user/chat saat ini. Gunakan saat user tanya tentang bot, nomor mereka, info grup, atau statistik.",
						parameters: {
							type: "OBJECT",
							properties: {},
							required: []
						}
					},
					{
						name: "check_ping",
						description: "Cek responsivitas dan latency bot. Gunakan saat user tanya 'masih hidup?', 'cek ping', 'cepat ga?', 'bot responsif?', atau sejenisnya.",
						parameters: {
							type: "OBJECT",
							properties: {},
							required: []
						}
					},
					{
						name: "show_help_menu",
						description: "Tampilkan daftar fitur dan kemampuan BOT. HANYA gunakan saat user EKSPLISIT tanya tentang fitur/command/kapabilitas bot (e.g., 'fitur apa aja?', 'bisa ngapain aja?', 'tunjukin command'). JANGAN gunakan untuk request 'bantuin dong' yang generic (itu normal chat).",
						parameters: {
							type: "OBJECT",
							properties: {},
							required: []
						}
					},
					{
						name: "tag_everyone",
						description: "Tag/mention semua member di grup. HANYA gunakan di grup, dan saat user EKSPLISIT minta tag/panggil semua orang (e.g., 'tag semua', 'mention all', 'panggil semua member'). JANGAN gunakan untuk greeting biasa.",
						parameters: {
							type: "OBJECT",
							properties: {},
							required: []
						}
					},
					{
						name: "generate_image",
						description: "Generate/buat gambar dari deskripsi text. Gunakan saat user minta buatkan/bikinin/generate gambar.",
						parameters: {
							type: "OBJECT",
							properties: {
								prompt: {
									type: "STRING",
									description: "Deskripsi gambar dalam bahasa Inggris (translate dari request user jika perlu)"
								}
							},
							required: ["prompt"]
						}
					},
					{
						name: "perform_google_search",
						description: "Lakukan pencarian Google untuk info terkini/real-time (berita, cuaca, info publik, fakta terbaru). Gunakan saat user tanya hal yang butuh akses internet.",
						parameters: {
							type: "OBJECT",
							properties: {
								query: {
									type: "STRING",
									description: "Query pencarian yang spesifik"
								}
							},
							required: ["query"]
						}
					}
				]
			}
		],
	};

	const contents = chatHistory.map((msg) => {
		const content = {
			role: msg.role,
			parts: [{ text: msg.text }],
		};

		// Jika pesan memiliki data gambar yang tersimpan
		if (msg.image && msg.image.data && msg.image.mimeType) {
			content.parts.push({
				inlineData: {
					mimeType: msg.image.mimeType,
					data: msg.image.data
				}
			});
		}

		return content;
	});

	try {
		const response = await bot.geminiApi.models.generateContent({
			model: modelName,
			contents: contents,
			config: generationConfig,
		});

		// Check if AI wants to call function(s)
		if (response.functionCalls && response.functionCalls.length > 0) {
			console.log(`🔧 AI calling ${response.functionCalls.length} function(s):`,
				response.functionCalls.map(fc => fc.name).join(', '));

			return {
				type: 'function_call',
				functionCalls: response.functionCalls
			};
		}

		// Normal text response
		if (!response.text) {
			return "Ups, respons AI kosong. Coba tanyakan lagi.";
		}
		return response.text.trim();
	} catch (error) {
		console.error("Kesalahan panggilan Gemini Chat API:", error);
		return "Aduh, AI-Haikaru sedang gagal mengingat. Ada apa ya? Coba tanyakan lagi.";
	}
}

export async function getGeminiResponse(
	bot,
	userPrompt,
	modelName = "gemini-flash-latest",
) {
	if (!bot.geminiApi) {
		console.error("Gemini API tidak diinisialisasi.");
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	const systemInstruction = HELPER_PERSONA;

	const generationConfig = {
		temperature: 1.7,
		systemInstruction: systemInstruction,
	};

	try {
		const response = await bot.geminiApi.models.generateContent({
			model: modelName,
			contents: userPrompt,
			config: generationConfig,
		});

		return response.text.trim();
	} catch (error) {
		console.error("Kesalahan panggilan Gemini API:", error);
		return "Aduh, AI-Haikaru sedang sakit kepala! Coba ulangi sebentar lagi, ya.";
	}
}

/**
 * Helper function untuk melakukan Google Search via Gemini Grounding
 * Ini dipanggil oleh functionHandler saat AI memilih 'perform_google_search'
 */
export async function getGroundedResponse(bot, query) {
	if (!bot.geminiApi) {
		throw new Error("Gemini API not initialized");
	}

	const generationConfig = {
		temperature: 0.7,
		tools: [{ googleSearch: {} }], // Hanya aktifkan Google Search
	};

	try {
		const response = await bot.geminiApi.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [{ role: "user", parts: [{ text: query }] }],
			config: generationConfig,
		});

		if (!response.text) {
			console.warn("Grounded Search: Respons text dari Gemini kosong.");
			return "Ups, hasil pencarian kosong atau tidak ditemukan."; // Pesan yang lebih user-friendly
		}

		return response.text.trim();
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
	if (!bot.geminiApi) return null;

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

	const generationConfig = {
		temperature: 1.0, // Sedikit lebih kreatif untuk variasi emoji
		responseMimeType: "application/json",
		systemInstruction: systemInstruction,
	};

	const contents = recentHistory.map((msg) => ({
		role: msg.role === "user" ? "user" : "model",
		parts: [{ text: msg.text }],
	}));

	try {
		const response = await bot.geminiApi.models.generateContent({
			model: "gemini-2.5-flash", // Gunakan model cepat
			contents: contents,
			config: generationConfig,
		});

		if (!response.text) {
			return null;
		}

		const responseText = response.text;
		const result = JSON.parse(responseText);
		return result;
	} catch (error) {
		console.error("❌ Gagal menganalisis reaksi emoji:", error);
		return null;
	}
}