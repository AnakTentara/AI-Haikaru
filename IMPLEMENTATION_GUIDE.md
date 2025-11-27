# Medium Priority Improvements - Implementation Guide

## ✅ What Was Done Automatically

1. **✓ Added rate limiter constants** to `events/message.js` (line ~17-22):
   ```javascript
   const aiChatRateLimiter = new Map();
   const RATE_LIMIT_REQUESTS = 10;
   const RATE_LIMIT_WINDOW = 60000;
   const RATE_LIMIT_WHITELIST = ['628816197519'];
   ```

2. **✓ Fixed typo bug** (line 271): `cooldownTiime` → `cooldownTime`

## 🔧 Manual Steps Required (Copy-Paste Code Below)

### Step 1: Add Rate Limiting to AI Chat Block

**Location**: Line ~312 in `events/message.js`, RIGHT AFTER `if (shouldRespond) {`

**Add this code**:

```javascript
    // 4. Logic Respons Teks (AI Chat)
    if (shouldRespond) {
      try {
        // ===== RATE LIMITING CHECK (ADD THIS) =====
        const userPhone = (message.author || from).split('@')[0];
        
        // Skip rate limit for whitelisted users
        if (!RATE_LIMIT_WHITELIST.includes(userPhone)) {
          const now = Date.now();
          
          if (!aiChatRateLimiter.has(chatId)) {
            aiChatRateLimiter.set(chatId, []);
          }
          
          const requestHistory = aiChatRateLimiter.get(chatId);
          const recentRequests = requestHistory.filter(req => now - req.timestamp < RATE_LIMIT_WINDOW);
          const userRequestCount = recentRequests.filter(req => req.userId === (message.author || from)).length;
          
          if (userRequestCount >= RATE_LIMIT_REQUESTS) {
            const oldestRequest = recentRequests
              .filter(req => req.userId === (message.author || from))
              .sort((a, b) => a.timestamp - b.timestamp)[0];
            const resetTime = Math.ceil((RATE_LIMIT_WINDOW - (now - oldestRequest.timestamp)) / 1000);
            
            Logger.warning('AI_RATE_LIMIT', `User ${senderIdentifier} exceeded rate limit`, {
              chatId,
              userRequestCount,
              resetTime
            });
            
            await message.reply(
              `⏱️ *Slow down!* Kamu terlalu banyak kirim pesan ke AI.\n` +
              `Tunggu ~${resetTime} detik lagi ya biar server nggak overload 🙏`
            );
            return;
          }
          
          recentRequests.push({ timestamp: now, userId: message.author || from });
          aiChatRateLimiter.set(chatId, recentRequests);
        }
        // ===== END RATE LIMITING CHECK =====

        let typingTimeIndicator = 700;
        // ... rest of existing code ...
```

### Step 2: Improve Error Handling in Emoji Reaction

**Location**: Line ~268-308 in `events/message.js`

**Replace the existing emoji reaction block with**:

```javascript
    // 3. Logic Reaksi Emoji (Hanya jika TIDAK merespons dengan teks)
    if (!shouldRespond && !message.fromMe) {
      try {
        // Check cooldown - minimum 30 detik antara reaksi per chat
        const now = Date.now();
        const lastReaction = reactionCooldowns.get(chatId) || 0;
        const cooldownTime = 30000; // 30 detik
        const timeSinceLastReaction = now - lastReaction;

        if (timeSinceLastReaction < cooldownTime) {
          const remainingTime = Math.ceil((cooldownTime - timeSinceLastReaction) / 1000);
          Logger.info('EMOJI_REACTION', `Cooldown active, skipping reaction (${remainingTime}s remaining)`);
        } else {
          Logger.ai('EMOJI_REACTION', 'Analyzing message for emoji reaction...');
          
          // Load history with error handling
          let historyForReaction;
          try {
            historyForReaction = await loadChatHistory(chatId);
          } catch (dbError) {
            Logger.error('EMOJI_REACTION', 'Failed to load chat history from DB', { 
              error: dbError.message 
            });
            historyForReaction = []; // Graceful degradation - use empty history
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
            // penting: 30%
            // opsional: 15%
            if (urgensi === "wajib") shouldReact = true;
            else if (urgensi === "penting" && chance > 0.7) shouldReact = true; // 30%
            else if (urgensi === "opsional" && chance > 0.85) shouldReact = true; // 15%

            if (shouldReact) {
              try {
                await message.react(emoji);
                reactionCooldowns.set(chatId, now);
                Logger.outgoing('EMOJI_REACTION', `Reacted with ${emoji}`, { urgensi, chance: chance.toFixed(2) });
              } catch (reactError) {
                // WhatsApp API error (message deleted, blocked, etc.)
                Logger.error('EMOJI_REACTION', 'Failed to send reaction', { 
                  error: reactError.message,
                  emoji 
                });
              }
            } else {
              Logger.info('EMOJI_REACTION', `Skipped reaction (${urgensi})`, { chance: chance.toFixed(2) });
            }
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
```

## 🎯 Testing

After implementing:

1. **Test Rate Limiting**:
   - Send 11 messages quickly to bot → should get rate limit message on 11th
   - Wait 1 minute → should work again

2. **Test Error Handling**:
   - Disconnect MongoDB → emoji reaction should still work with empty history
   - Check logs for specific error messages

## 📝 Configuration

Adjust in `events/message.js` lines 18-21:

```javascript
const RATE_LIMIT_REQUESTS = 10;  // Lower = stricter (try 5 for aggressive)
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const RATE_LIMIT_WHITELIST = ['628816197519']; // Add more phone numbers
```
