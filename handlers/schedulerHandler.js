import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';
import { getGeminiResponse } from './geminiProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../data');
const TASKS_FILE = join(DATA_DIR, 'scheduler.json');

class SchedulerHandler {
    constructor(bot) {
        this.bot = bot;
        this.tasks = [];
        this.interval = null;
        this.ensureDataDir();
        this.loadTasks();
    }

    ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    loadTasks() {
        try {
            if (fs.existsSync(TASKS_FILE)) {
                this.tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
                Logger.info('SCHEDULER', `Loaded ${this.tasks.length} pending tasks.`);
            }
        } catch (error) {
            Logger.error('SCHEDULER', 'Failed to load tasks', { error: error.message });
            this.tasks = [];
        }
    }

    saveTasks() {
        try {
            fs.writeFileSync(TASKS_FILE, JSON.stringify(this.tasks, null, 2));
        } catch (error) {
            Logger.error('SCHEDULER', 'Failed to save tasks', { error: error.message });
        }
    }

    start() {
        if (this.interval) return;
        Logger.info('SCHEDULER', 'Starting task runner loop (1s tick)...');

        this.interval = setInterval(() => {
            this.checkTasks();
        }, 1000); // Check every 1 second
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            Logger.info('SCHEDULER', 'Task runner stopped.');
        }
    }

    addTask(task) {
        // Task: { id, chatId, type, payload, executeAt, createdAt }
        this.tasks.push(task);
        this.saveTasks();
        Logger.info('SCHEDULER', `Task added: ${task.type} for ${task.chatId} at ${new Date(task.executeAt).toLocaleTimeString()}`);
    }

    async checkTasks() {
        if (this.tasks.length === 0) return;

        const now = Date.now();
        const pending = [];
        const due = [];

        // Separate due tasks
        for (const task of this.tasks) {
            if (task.executeAt <= now) {
                due.push(task);
            } else {
                pending.push(task);
            }
        }

        if (due.length === 0) return;

        // Update task list first to prevent double execution if crash
        this.tasks = pending;
        this.saveTasks();

        // Execute due tasks
        for (const task of due) {
            try {
                await this.executeTask(task);
            } catch (error) {
                Logger.error('SCHEDULER', `Failed to execute task ${task.id}`, { error: error.message });
                // Optional: Retry logic could go here, but for now we drop failed tasks to avoid loops
            }
        }
    }

    async executeTask(task) {
        Logger.info('SCHEDULER', `Executing task ${task.id} (${task.type})`);

        try {
            const chat = await this.bot.client.getChatById(task.chatId);

            if (task.type === 'reminder') {
                const reminderText = task.payload.text;

                // Use AI to humanize the reminder
                const prompt = `User minta diingatkan: "${reminderText}". Sampaikan pengingat ini ke user dengan gaya santai, akrab, dan sedikit lucu khas Haikaru (gunakan emoji). Jangan terlalu panjang.`;
                const aiMessage = await getGeminiResponse(this.bot, prompt, []); // Empty history for now

                await chat.sendMessage(`${aiMessage}\n\n> Pengingat Otomatis`);
            }
            else if (task.type === 'image_generation') {
                await chat.sendMessage(`🎨 *AUTO GENERATE*\nMenjalankan perintah gambar: "${task.payload.prompt}"...`);

                const imgCommand = this.bot.commands.get('img');
                if (imgCommand) {
                    // Mock message object
                    const mockMessage = {
                        reply: async (content, options) => chat.sendMessage(content, options),
                        getChat: async () => chat,
                        author: task.chatId, // Simplified
                        id: { _serialized: `scheduler_${Date.now()}` }
                    };

                    // Call command
                    await imgCommand.execute(mockMessage, task.payload.prompt.split(" "), this.bot, null);
                }
            }
        } catch (error) {
            Logger.error('SCHEDULER', `Exec Error`, { error: error.message });
        }
    }
}

export default SchedulerHandler;
