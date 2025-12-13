import crypto from 'crypto';
import Logger from "../handlers/logger.js";
import fetch from 'node-fetch';

export default {
    name: "edit_data_berita_man",
    description: "Dapatkan Link Editor Web untuk mengubah data sekolah (requires Server Token)",
    usage: ".edit_data_berita_man",
    prefixRequired: true,
    triggers: [".edit_data_berita_man"],

    async execute(message, args, bot) {
        const baseUrl = process.env.DATASET_BASE_URL || "http://vps.haikaldev.my.id:3001";
        const adminSecret = process.env.DATASET_SECRET || "default-secret";

        try {
            // Request dynamic token from Web App
            const response = await fetch(`${baseUrl}/api/admin/generate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminSecret}`
                },
                body: JSON.stringify({
                    expires_in: '24h' // Matches Bolt API spec
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                Logger.error("EDIT_DATA", `Failed to generate token: ${response.status} - ${errText}`);
                throw new Error("Server menolak permintaan token. Cek DATASET_SECRET.");
            }

            const data = await response.json();
            const token = data.token;

            // Construct Web URL (Login Path)
            const webUrl = `${baseUrl}/login?token=${token}`;

            return message.reply(
                "📝 *Editor Data Sekolah (Self-Hosted)*\n\n" +
                "Klik link berikut untuk akses editor (Valid 24 Jam):\n" +
                `${webUrl}\n\n` +
                "⚠️ *Link ini bersifat rahasia dan sekali pakai.*"
            );
        } catch (error) {
            Logger.error("EDIT_DATA", `Error: ${error.message}`);
            return message.reply(`❌ Gagal membuat sesi editor: ${error.message}`);
        }
    }
};
