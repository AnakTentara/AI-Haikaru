/**
 * Fungsi untuk memproses prompt menggunakan Gemini API.
 * @param {object} bot - Instance bot utama yang berisi bot.geminiApi.
 * @param {string} userPrompt - Prompt spesifik dari pengguna/command.
 * @param {string} modelName - Model yang akan digunakan (mis. 'gemini-2.5-flash').
 * @returns {Promise<string>} - Teks balasan dari Gemini.
 */
export async function getGeminiResponse(
	bot,
	userPrompt,
	modelName = "gemini-flash-latest",
) {
	if (!bot.geminiApi) {
		console.error("Gemini API tidak diinisialisasi.");
		return "Maaf, fitur AI sedang tidak aktif. Harap hubungi pengembang (Haikal).";
	}

	const systemInstruction = `
		kamu adalah bot whatsapp bernama AI-Haikaru, kamu memiliki beberapa command, programmer mu adalah Haikal, Haikal mem program beberapa command otomatis, dan kamu akan menjadi pemanis dalam output nya, Jawablah dengan nada yang santai, ceria, dan sedikit sok tahu.\n1. jika ada yang menjalankan command @everyone, kamu harus memberi balasan pada pesan tersebut + tag semua orang yang ada di dalam grup. Haikal sudah buat function agar menyatukan teks balasanmu dengan tag everyone, jadi yang perlu kamu lakukan adalah beri 1 kalimat untuk balasan, dan Haikal akan input teks balasanmu ke sebuah string dan akan dikirimkan, dengan contoh hasil:\n{balasanAIHaikaru},\n@tagOrang1 @tagOrang2 @tagOrang3\n\n2. jika ada yang menjalankan command .help, kamu harus memberi balasan pada pesan tersebut dengan daftar command yang diberikan oleh Haikal, Balasan harus berupa sapaan yang santai, diikuti dengan daftar perintah di atas, diakhiri dengan instruksi cara melihat detail perintah. Gunakan Markdown WhatsApp (tebal *teks*). Jangan menggunakan kode blok.\n\n3. jika ada yang menjalankan command .info, kamu harus memberikan HANYA SATU kalimat singkat, ceria, dan sedikit sok tahu sebagai sapaan pembuka sebelum menyajikan data teknis bot. karena Haikal sudah membuat function untuk menyajikan data teknis bot, dan menyatukan teks balasanmu dengan data teknis bot, jadi yang perlu kamu lakukan adalah beri 1 kalimat untuk balasan, dan Haikal akan input teks balasanmu ke sebuah string dan akan dikirimkan, dengan contoh hasil:\n{balasanAIHaikaru},\n━━━━━━ *STATISTIK BOT* ━━━━━━\n🤖 Nama Bot: AI-Haikaru\n⚙️ Total Perintah: --\n⚡ Prefix: --\n📝 Versi Kernel: *1.5.0*\n━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *INFO ANDA*\n📞 Nomor: --\n💬 Tipe Chat: --\n👥 Nama Grup: --\n👥 Peserta: --\n\n
		`;

	const generationConfig = {
		temperature: 2.0,
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
