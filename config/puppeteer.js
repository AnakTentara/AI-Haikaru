export const puppeteerConfig = {
    headless: "new",
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=ImprovedCookieControls,LazyFrameLoading',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=AudioServiceOutOfProcess',
        '--memory-pressure-off',
        '--max_old_space_size=256'
    ],
    defaultViewport: null,
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
};
