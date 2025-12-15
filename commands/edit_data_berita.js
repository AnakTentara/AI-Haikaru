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
        // CPanel Deployment: API and Web are on the same domain
        const baseUrl = process.env.DATASET_BASE_URL || "http://dataset-man.haikaldev.my.id:3001";

        // Both API and Web User Link use the same base
        const apiUrl = baseUrl;
        const webUrlBase = baseUrl;

        const adminSecret = process.env.DATASET_SECRET || "1420057752Delapan823062025Haikal";

        Logger.info("EDIT_DATA", `Requesting token from API: ${apiUrl}`);

        try {
            // Request dynamic token from VPS Backend (Localhost)
            const response = await fetch(`${apiUrl}/api/admin/generate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminSecret}`
                },
                body: JSON.stringify({
                    expires_in: '24h'
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                Logger.error("EDIT_DATA", `Failed to generate token: ${response.status} - ${errText}`);
                throw new Error("Server menolak permintaan token. Cek DATASET_SECRET.");
            }

            const data = await response.json();
            const token = data.token;

            // Construct Web URL for User (Pointing to CPanel Frontend)
            const finalLink = `${webUrlBase}/?token=${token}`;

            return message.reply(
                "📝 *Editor Data Sekolah (Secure Link)*\n\n" +
                "Klik link berikut untuk akses editor (Valid 24 Jam):\n" +
                `${finalLink}\n\n` +
                "⚠️ *Link ini bersifat rahasia dan sekali pakai.*"
            );
        } catch (error) {
            Logger.error("EDIT_DATA", `Error: ${error.message}`);
            return message.reply(`❌ Gagal membuat sesi editor: ${error.message}`);
        }
    }
};
