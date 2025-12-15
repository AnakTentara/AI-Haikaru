import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Backend runs on VPS, so it MUST point to the Bot's real data to be useful
const BERITA_CONFIG_DIR = path.join(__dirname, 'config', 'berita');
const BASE_FILE = path.join(BERITA_CONFIG_DIR, 'base.txt');
const BACKUP_DIR = path.join(BERITA_CONFIG_DIR, 'backups');
const TOKENS_FILE = path.join(BERITA_CONFIG_DIR, 'tokens.json'); // Keep tokens with data

// Admin Secret for Token Generation
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.DATASET_SECRET || "default_secret_change_me";

app.use(express.json());
app.use(cors()); // Allow CORS for CPanel Frontend

// Helper to read tokens
function getTokens() {
    try {
        if (!fs.existsSync(TOKENS_FILE)) return [];
        const data = fs.readFileSync(TOKENS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading tokens:", e);
        return [];
    }
}

// Helper to save tokens
function saveToken(tokenData: any) {
    try {
        const tokens = getTokens();
        tokens.push(tokenData);
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
    } catch (e) {
        console.error("Error saving token:", e);
    }
}

// Auth Middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    // Format: "Bearer <token>" or just "<token>"
    const token = authHeader.replace('Bearer ', '').trim();
    const tokens = getTokens();
    const valid = tokens.find((t: any) => t.token === token);

    // Simple expiry check can be added here
    if (!valid) {
        res.status(403).json({ error: 'Invalid token' });
        return;
    }

    // Check expiry
    if (valid.expires_at && Date.now() > valid.expires_at) {
        res.status(403).json({ error: 'Token expired' });
        return;
    }

    next();
};

// --- API ROUTES ---

// 1. Generate Token (Admin Only)
app.post('/api/admin/generate-token', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        // Check Admin Secret
        if (!authHeader || authHeader.replace('Bearer ', '').trim() !== ADMIN_SECRET) {
            res.status(401).json({ error: 'Invalid Admin Secret' });
            return;
        }

        const { expires_in } = req.body; // e.g. "24h"

        // Generate Random Token
        const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

        // Expiry logic
        let expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Default 24h
        if (expires_in === '1h') expiresAt = Date.now() + 60 * 60 * 1000;
        if (expires_in === '7d') expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

        const tokenData = {
            token,
            created_at: Date.now(),
            expires_at: expiresAt,
            name: 'Generated via API'
        };

        saveToken(tokenData);
        res.json({ token, expiresAt });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

app.get('/api/content', (req, res) => {
    try {
        if (!fs.existsSync(BASE_FILE)) {
            fs.writeFileSync(BASE_FILE, '', 'utf-8');
        }
        const content = fs.readFileSync(BASE_FILE, 'utf-8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read content' });
    }
});

app.post('/api/save', authMiddleware, (req, res) => {
    try {
        const { content } = req.body;
        if (typeof content !== 'string') {
            res.status(400).json({ error: 'Invalid content' });
            return;
        }

        // Backup
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `base-${timestamp}.txt`);

        if (fs.existsSync(BASE_FILE)) {
            fs.copyFileSync(BASE_FILE, backupPath);
        }

        // Write new
        fs.writeFileSync(BASE_FILE, content, 'utf-8');

        // Cleanup backups > 20
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('base-') && f.endsWith('.txt'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time); // Newest first

        if (files.length > 20) {
            const toDelete = files.slice(20);
            toDelete.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f.name)));
        }

        res.json({ success: true, backup: backupPath });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to save' });
    }
});

app.get('/api/backups', authMiddleware, (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            res.json({ backups: [] });
            return;
        }
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('base-') && f.endsWith('.txt'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return { name: f, created_at: stat.mtime };
            })
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        res.json({ backups: files });
    } catch (e) {
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

app.post('/api/restore', authMiddleware, (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            res.status(400).json({ error: 'Filename required' });
            return;
        }
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'Backup not found' });
            return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        fs.writeFileSync(BASE_FILE, content, 'utf-8'); // Overwrite base

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to restore' });
    }
});

app.get('/', (req, res) => {
    res.send('AI-Haikaru Backend API is running.');
});

export function startServer() {
    app.listen(3001, '0.0.0.0', () => {
        console.log(`[Editor App] Server running on port 3001`);
    });
}
// Start immediately if executed directly
import { fileURLToPath as _fileURLToPath } from 'url';
if (process.argv[1] === _fileURLToPath(import.meta.url)) {
    startServer();
}
