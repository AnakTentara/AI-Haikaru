/**
 * Fungsi untuk memproses prompt menggunakan Gemini API.
 * @param {object} bot - Instance bot utama yang berisi bot.geminiApi.
 * @param {string} userPrompt - Prompt spesifik dari pengguna/command.
 * @param {string} modelName - Model yang akan digunakan (mis. 'gemini-2.5-flash').
 * @returns {Promise<string>} - Teks balasan dari Gemini.
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
		temperature: 0.7,
		systemInstruction: systemInstruction,
		tools: [{
			googleSearch: {},
			urlContext: {}
		}],
	};

	const contents = chatHistory.map((msg) => ({
		role: msg.role,
		parts: [{ text: msg.text }],
	}));

	try {
		const response = await bot.geminiApi.models.generateContent({
			model: modelName,
			contents: contents,
			config: generationConfig,
		});

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