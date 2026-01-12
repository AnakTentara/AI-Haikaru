import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const HISTORY_DIR = join(__dirname, '../data/history');
const MEMORY_DIR = join(__dirname, '../data/memory');
const CACHE_LIMIT = 5000; // Max number of chats to keep in RAM

// In-Memory Cache (chatId -> { history: [], memory: "" })
const cache = new Map();

// Ensure directories exist
[HISTORY_DIR, MEMORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Load chat history
 * Priority: Cache -> JSON File -> Empty Array
 */
export async function loadChatHistory(chatId, limit = 30) {
    // 1. Check Cache
    if (cache.has(chatId)) {
        const data = cache.get(chatId);
        return data.history.slice(-limit);
    }

    // 2. Load from File
    const filePath = join(HISTORY_DIR, `${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const history = data.history || [];

            // Add to cache (Init with empty memory if not loaded yet)
            if (!cache.has(chatId)) {
                cache.set(chatId, { history, memory: "" });
            } else {
                cache.get(chatId).history = history;
            }

            // Manage cache size
            if (cache.size > CACHE_LIMIT) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }

            return history.slice(-limit);
        }
    } catch (error) {
        Logger.error('DB_HANDLER', `Failed to load history file for ${chatId}`, { error: error.message });
    }

    return [];
}

/**
 * Save chat history (Full overwrite)
 */
export async function saveChatHistory(chatId, history) {
    // 1. Update Cache
    if (cache.has(chatId)) {
        cache.get(chatId).history = history;
    } else {
        cache.set(chatId, { history, memory: "" });
    }

    // 2. Save to File (Async)
    const filePath = join(HISTORY_DIR, `${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

    // We use a promise wrapper but don't 'await' it if we want it to be background
    // However, usually it's safer to ensure it's written.
    setImmediate(() => {
        try {
            const data = {
                chatId: chatId,
                history: history,
                messageCount: history.length,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            Logger.db('SAVE_HISTORY', `Saved ${history.length} messages for ${chatId}`);
        } catch (error) {
            Logger.error('DB_HANDLER', `Failed to save history file for ${chatId}`, { error: error.message });
        }
    });
}

/**
 * Append a single message to history
 */
export async function appendChatMessage(chatId, message) {
    // 1. Ensure history is loaded in cache
    let data = { history: [], memory: "" };
    if (cache.has(chatId)) {
        data = cache.get(chatId);
    } else {
        const history = await loadChatHistory(chatId, 99999);
        const memory = await loadMemory(chatId);
        data = { history, memory };
    }

    // 2. Append and Limit (Keep last 1000 messages, rotate older ones)
    data.history.push(message);
    const MAX_HISTORY_SIZE = 1000; // Reduced from 99999 for better performance
    if (data.history.length > MAX_HISTORY_SIZE) {
        data.history = data.history.slice(-MAX_HISTORY_SIZE);
        Logger.info('DB_HANDLER', `History rotated for ${chatId}: ${data.history.length} messages kept`);
    }

    // 3. Save
    await saveChatHistory(chatId, data.history);
}

/**
 * Load Permanent Memory
 */
export async function loadMemory(chatId) {
    // 1. Check Cache
    if (cache.has(chatId)) {
        return cache.get(chatId).memory || "";
    }

    // 2. Load from File
    const filePath = join(MEMORY_DIR, `${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data.memory || "";
        }
    } catch (e) {
        Logger.error('DB_HANDLER', `Failed to load memory file for ${chatId}`, { error: e.message });
    }

    return "";
}

/**
 * Save Permanent Memory
 */
export async function saveMemory(chatId, memory) {
    // 1. Update Cache
    if (cache.has(chatId)) {
        cache.get(chatId).memory = memory;
    } else {
        cache.set(chatId, { history: [], memory: memory });
    }

    // 2. Save to File
    const filePath = join(MEMORY_DIR, `${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    setImmediate(() => {
        try {
            fs.writeFileSync(filePath, JSON.stringify({ chatId, memory, lastUpdated: new Date().toISOString() }, null, 2));
            Logger.db('SAVE_MEMORY', `Permanent memory updated: ${chatId}`);
        } catch (e) {
            Logger.error('DB_HANDLER', `Failed to save memory file for ${chatId}`, { error: e.message });
        }
    });
}

// --- NEW EXPORTS FOR COMPATIBILITY ---
// Ini adalah "jembatan" agar kode baru bisa jalan tanpa mengubah logika aslimu

/**
 * Alias for loadMemory to match AI handler naming
 */
export async function getPermanentMemory(chatId) {
    return loadMemory(chatId);
}

/**
 * Appends a new fact to the existing memory
 */
export async function updatePermanentMemory(chatId, newFact) {
    try {
        const currentMemory = await loadMemory(chatId);
        const timestamp = new Date().toLocaleDateString('id-ID');
        const updatedMemory = currentMemory + `\n[${timestamp}] ${newFact}`;
        
        await saveMemory(chatId, updatedMemory);
        return true;
    } catch (error) {
        Logger.error('DB_HANDLER', `Failed to update permanent memory for ${chatId}`, { error: error.message });
        return false;
    }
}