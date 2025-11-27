/**
 * Rate Limiting Helper
 * Add this logic at the START of "4. Logic Respons Teks (AI Chat)" block
 * (around line 312 in events/message.js)
 */

export function checkRateLimit(chatId, senderId, senderIdentifier, aiChatRateLimiter, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW, RATE_LIMIT_WHITELIST) {
    // Check if user is whitelisted
    const userPhone = senderId.split('@')[0];
    if (RATE_LIMIT_WHITELIST.includes(userPhone)) {
        return { allowed: true, reason: 'whitelisted' };
    }

    const now = Date.now();

    // Get or initialize rate limit tracker
    if (!aiChatRateLimiter.has(chatId)) {
        aiChatRateLimiter.set(chatId, []);
    }

    const requestHistory = aiChatRateLimiter.get(chatId);

    // Remove requests older than the time window
    const recentRequests = requestHistory.filter(req => now - req.timestamp < RATE_LIMIT_WINDOW);

    // Count requests from this specific user
    const userRequestCount = recentRequests.filter(req => req.userId === senderId).length;

    // Check if user exceeded limit
    if (userRequestCount >= RATE_LIMIT_REQUESTS) {
        const oldestRequest = recentRequests
            .filter(req => req.userId === senderId)
            .sort((a, b) => a.timestamp - b.timestamp)[0];

        const resetTime = Math.ceil((RATE_LIMIT_WINDOW - (now - oldestRequest.timestamp)) / 1000);

        return {
            allowed: false,
            reason: 'rate_limit_exceeded',
            userRequestCount,
            resetTime,
            senderIdentifier
        };
    }

    // Add this request to history
    recentRequests.push({ timestamp: now, userId: senderId });
    aiChatRateLimiter.set(chatId, recentRequests);

    return { allowed: true, requestCount: userRequestCount + 1 };
}

/**
 * Improved Error Handling for Emoji Reaction
 * Replace the emoji reaction try-catch block (around line 268-308)
 */

export async function handleEmojiReactionWithErrorHandling(
    shouldRespond,
    message,
    chatId,
    reactionCooldowns,
    loadChatHistory,
    analyzeEmojiReaction,
    bot,
    Logger
) {
    if (shouldRespond || message.fromMe) {
        return; // Skip if should respond with text or message from bot
    }

    try {
        // Check cooldown - minimum 30 detik antara reaksi per chat
        const now = Date.now();
        const lastReaction = reactionCooldowns.get(chatId) || 0;
        const cool downTime = 30000; // 30 detik
        const timeSinceLastReaction = now - lastReaction;

        if (timeSinceLastReaction < cooldownTime) {
            const remainingTime = Math.ceil((cooldownTime - timeSinceLastReaction) / 1000);
            Logger.info('EMOJI_REACTION', `Cooldown active, skipping reaction (${remainingTime}s remaining)`);
            return;
        }

        Logger.ai('EMOJI_REACTION', 'Analyzing message for emoji reaction...');

        // Load history with error handling
        let historyForReaction;
        try {
            historyForReaction = await loadChatHistory(chatId);
        } catch (dbError) {
            Logger.error('EMOJI_REACTION', 'Failed to load chat history from DB, using empty history', {
                error: dbError.message
            });
            historyForReaction = []; // Graceful degradation
        }

        // Analyze emoji with error handling
        let reactionAnalysis;
        try {
            reactionAnalysis = await analyzeEmojiReaction(bot, historyForReaction);
        } catch (aiError) {
            Logger.error('EMOJI_REACTION', 'Gemini API failed for emoji analysis', {
                error: aiError.message,
                type: aiError.name
            });
            return; // Skip emoji reaction on AI error
        }

        if (reactionAnalysis && reactionAnalysis.emoji) {
            const { emoji, urgensi } = reactionAnalysis;
            Logger.data('EMOJI_REACTION', 'Reaction analysis complete', { emoji, urgensi });
            let shouldReact = false;

            const chance = Math.random();
            // Adjusted probabilities to reduce spam:
            // wajib: 100% (very important emotional messages)
            // penting: 30% (reduced from 80%)
            // opsional: 15% (reduced from 50%)
            if (urgensi === "wajib") shouldReact = true;
            else if (urgensi === "penting" && chance > 0.7) shouldReact = true; // 30%
            else if (urgensi === "opsional" && chance > 0.85) shouldReact = true; // 15%

            if (shouldReact) {
                try {
                    await message.react(emoji);
                    reactionCooldowns.set(chatId, now); // Update cooldown timestamp
                    Logger.outgoing('EMOJI_REACTION', `Reacted with ${emoji}`, { urgensi, chance: chance.toFixed(2) });
                } catch (reactError) {
                    // WhatsApp API error (message deleted, blocked, etc.)
                    Logger.error('EMOJI_REACTION', 'Failed to send reaction to message', {
                        error: reactError.message,
                        emoji
                    });
                }
            } else {
                Logger.info('EMOJI_REACTION', `Skipped reaction (${urgensi})`, { chance: chance.toFixed(2) });
            }
        }
    } catch (err) {
        // Fallback for unexpected errors
        Logger.error('EMOJI_REACTION', 'Unexpected error in emoji reaction logic', {
            error: err.message,
            stack: err.stack
        });
    }
}
