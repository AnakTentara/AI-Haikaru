module.exports = {
    apps: [
        {
            name: "AI-Haikaru",
            script: "./index.js",
            watch: true,
            // PENTING: Ignore folder data agar bot tidak restart saat ada edit berita/token baru
            ignore_watch: [
                "node_modules",
                "config/berita",
                "data",
                "frontend",
                ".git",
                ".wwebjs_auth",
                ".wwebjs_cache",
                "logs"
            ],
            env: {
                NODE_ENV: "production",
            }
        },
        {
            name: "backend-editor",
            script: "npx",
            args: "tsx server.ts",
            watch: true,
            // Backend juga tidak perlu restart saat data berubah (karena dia yang nulis)
            ignore_watch: [
                "node_modules",
                "config/berita",
                "data",
                "frontend",
                ".git"
            ]
        }
    ]
};
