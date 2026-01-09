import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ModelManager {
    constructor() {
        this.configPath = join(__dirname, '../config/models.json');
        this.models = [];
        this.usage = new Map(); // modelID -> { usedRPM, usedTPM, usedRPD, lastResetMin, lastResetDay }
        this.loadConfig();
        this.setupResets();
    }

    loadConfig() {
        try {
            const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            this.models = data.models;

            // Initialize usage tracking
            const now = new Date();
            this.models.forEach(m => {
                this.usage.set(m.id, {
                    usedRPM: 0,
                    usedTPM: 0,
                    usedRPD: 0,
                    lastResetMin: now.getMinutes(),
                    lastResetDay: now.getDate()
                });
            });
            Logger.info('MODEL_MANAGER', `Loaded ${this.models.length} models for dynamic switching.`);
        } catch (error) {
            Logger.error('MODEL_MANAGER', 'Failed to load models.json', { error: error.message });
        }
    }

    setupResets() {
        // Reset RPM and TPM every minute
        setInterval(() => {
            const now = new Date();
            this.usage.forEach((val, key) => {
                val.usedRPM = 0;
                val.usedTPM = 0;
                // If day changed, reset RPD
                if (now.getDate() !== val.lastResetDay) {
                    val.usedRPD = 0;
                    val.lastResetDay = now.getDate();
                }
            });
            Logger.info('MODEL_MANAGER', 'Usage counters reset (Minute cycle)');
        }, 60000);
    }

    /**
     * Get a list of models to try in order (Fallback Chain)
     */
    getFallbackChain(taskType = 'chat') {
        let chain = [];

        if (taskType === 'coding' || taskType === 'complex') {
            chain = [
                'gemini-3-flash',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite',
                'gemma-3-27b'
            ];
        } else if (taskType === 'short' || taskType === 'emoji') {
            chain = [
                'gemini-2.5-flash-lite',
                'gemma-3-4b',
                'gemma-3-27b' // Upgrade fallback to 27b
            ];
        } else if (taskType === 'audio') {
            chain = [
                'gemini-2.5-flash', // Best for multimodal analysis
                'gemini-2.5-flash-lite' // Fallback
            ];
        } else { // default 'chat'
            chain = [
                'gemini-2.5-flash-lite',
                'gemini-3-flash',
                'gemma-3-27b',
                'gemma-3-12b'
            ];
        }

        // Filter out models that are completely exhausted (RPD hit)
        return chain.filter(modelId => {
            const u = this.usage.get(modelId);
            const modelInfo = this.models.find(m => m.id === modelId);
            if (!u || !modelInfo) return false;
            return u.usedRPD < modelInfo.rpd;
        });
    }

    /**
     * Select best model based on task type
     * @param {string} taskType - 'chat', 'coding', 'short', 'emoji', etc.
     */
    selectModel(taskType = 'chat') {
        const chain = this.getFallbackChain(taskType);
        return chain[0] || this.models[0].id;
    }

    /**
     * Update usage after successful request
     */
    updateUsage(modelId, tokens = 0) {
        const u = this.usage.get(modelId);
        const modelInfo = this.models.find(m => m.id === modelId);

        if (u) {
            u.usedRPM += 1;
            u.usedRPD += 1;
            u.usedTPM += tokens;

            Logger.info('MODEL_MANAGER', `Usage updated for ${modelId}`, {
                RPM: `${u.usedRPM}/${modelInfo.rpm}`,
                RPD: `${u.usedRPD}/${modelInfo.rpd}`,
                TPM: `${u.usedTPM}/${modelInfo.tpm}`
            });
        }
    }
}

export const modelManager = new ModelManager();
export default modelManager;
