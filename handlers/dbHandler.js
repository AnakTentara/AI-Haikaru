import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI; 
if (!uri) {
	console.error("❌ MONGODB_URI tidak ditemukan! Harap set environment variable.");
}
const client = new MongoClient(uri);

const DB_NAME = process.env.DB_NAME || "ai_bot_database";
const COLLECTION_NAME = "chatHistory";

let dbConnection = null;

async function connectToDB() {
	if (dbConnection) return dbConnection;

	try {
		await client.connect();
		dbConnection = client.db(DB_NAME);
		console.log("✅ Berhasil terhubung ke MongoDB!");
		return dbConnection;
	} catch (error) {
		console.error("❌ Gagal terhubung ke MongoDB:", error);
		throw error;
	}
}

export async function loadChatHistory(chatId) {
	const db = await connectToDB();
	const collection = db.collection(COLLECTION_NAME);

	try {
		const document = await collection.findOne({ _id: chatId });
		return document ? document.history : [];
	} catch (error) {
		console.error(`Gagal memuat riwayat chat ${chatId}:`, error);
		return [];
	}
}

export async function saveChatHistory(chatId, history) {
	const db = await connectToDB();
	const collection = db.collection(COLLECTION_NAME);

	if (history.length > 99999) {
		history = history.slice(history.length - 99999);
	}

	try {
		await collection.updateOne(
			{ _id: chatId },
			{ $set: { history: history, lastUpdated: new Date() } },
			{ upsert: true } 
		);

	} catch (error) {
		console.error(`Gagal menyimpan riwayat chat ${chatId}:`, error);
	}
}