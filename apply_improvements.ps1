$file = "events/message.js"
$content = Get-Content $file -Raw

# 1. Add rate limiter after imageSpamTracker
$search1 = "const imageSpamTracker = new Map();"
$replace1 = @"
const imageSpamTracker = new Map();
// AI chat rate limiter (chatId -> [{ timestamp, userId }])
const aiChatRateLimiter = new Map();
const RATE_LIMIT_REQUESTS = 10; // Max requests per minute per user
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const RATE_LIMIT_WHITELIST = ['628816197519']; // Bot owner
"@
$content = $content -replace [regex]::Escape($search1), $replace1

# 2. Fix typo (already done but ensure it's there)
$content = $content -replace 'cooldownTiime - timeSinceLastReacton', 'cooldownTime - timeSinceLastReaction'

# Save with original line endings
$content | Set-Content $file -NoNewline

Write-Host "✅ Applied improvements to message.js"
