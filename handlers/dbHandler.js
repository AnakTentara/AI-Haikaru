// LOCAL FILE DATABASE – 50 GB storage available
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Folder penyimpanan chat history (naik satu level dari handlers)
const HISTORY_DIR = path.join(__dirname, '..', 'chat_history');

// Buat folder otomatis saat modul dimuat
(async () => {
	try {
		await fs.mkdir(HISTORY_DIR, { recursive: true });
		console.log(`✅ Folder history siap: ${HISTORY_DIR}`);
	} catch (error) {
		console.error("❌ Gagal membuat folder chat_history:", error);
	}
})();

function getFilePath(chatId) {
	// Sanitize chatId untuk nama file yang aman
	const safeId = chatId.replace(/[^a-zA-Z0-9@.-]/g, '_');
	return path.join(HISTORY_DIR, `${safeId}.json`);
}

export async function loadChatHistory(chatId) {
	const filePath = getFilePath(chatId);
	try {
		const data = await fs.readFile(filePath, 'utf-8');
		const json = JSON.parse(data);
		return json.history || [];
	} catch (error) {
		if (error.code === 'ENOENT') {
			return []; // File belum ada, return empty array
		}
		console.error(`❌ Gagal membaca history ${chatId}:`, error);
		return [];
	}
}

export async function saveChatHistory(chatId, history) {
	const filePath = getFilePath(chatId);

	// Batasi history maksimal 100.000 pesan
	if (history.length > 100000) {
		history = history.slice(history.length - 100000);
	}

	const data = {
		chatId,
		history,
		lastUpdated: new Date().toISOString()
	};

	try {
		// Tulis file JSON (pretty print untuk debug mudah, atau minify untuk hemat space? User minta format rapi di contoh)
		await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch (error) {
		console.error(`❌ Gagal menyimpan history ${chatId}:`, error);
	}
}

export async function appendChatMessage(chatId, message) {
	try {
		// Baca history yang ada
		const history = await loadChatHistory(chatId);

		// Tambahkan pesan baru
		history.push(message);

		// Simpan kembali (saveChatHistory sudah handle limit 100k)
		await saveChatHistory(chatId, history);
	} catch (error) {
		console.error(`❌ Gagal menambahkan pesan ke history ${chatId}:`, error);
	}
}