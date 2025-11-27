// Rate limiting configuration
const RATE_LIMIT_REQUESTS = 10;  // Maximum requests per window
const RATE_LIMIT_WINDOW = 60000;  // Time window in milliseconds (60 seconds)

// Whitelist for users who bypass rate limiting (e.g., bot owner)
const RATE_LIMIT_WHITELIST = [
    '628816197519',  // Bot owner (Haikal)
];
