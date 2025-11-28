/**
 * Logging utility with detailed timestamps
 * Provides consistent logging format across the application
 */

export class Logger {
    static getTimestamp() {
        const now = new Date();
        return now.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    static formatLog(level, category, message, data = null) {
        const timestamp = this.getTimestamp();
        const prefix = `[${timestamp}] [${level}] [${category}]`;

        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    static incoming(category, message, data = null) {
        this.formatLog('\n📥 INCOMING', category, message, data);
    }

    static outgoing(category, message, data = null) {
        this.formatLog('📤 OUTGOING', category, message, data);
    }

    static function(category, message, data = null) {
        this.formatLog('⚙️ FUNCTION', category, message, data);
    }

    static data(category, message, data = null) {
        this.formatLog('📊 DATA', category, message, data);
    }

    static info(category, message, data = null) {
        this.formatLog('ℹ️ INFO', category, message, data);
    }

    static success(category, message, data = null) {
        this.formatLog('✅ SUCCESS', category, message, data);
    }

    static error(category, message, data = null) {
        this.formatLog('❌ ERROR', category, message, data);
    }

    static warning(category, message, data = null) {
        this.formatLog('⚠️ WARNING', category, message, data);
    }

    static ai(category, message, data = null) {
        this.formatLog('🤖 AI', category, message, data);
    }

    static db(category, message, data = null) {
        this.formatLog('💾 DATABASE', category, message, data);
    }

    static command(category, message, data = null) {
        this.formatLog('🔵 COMMAND', category, message, data);
    }
}

export default Logger;
