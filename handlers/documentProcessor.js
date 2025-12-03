let pdf, mammoth;
import Logger from './logger.js';

/**
 * Mengekstrak teks dari buffer dokumen
 * @param {Buffer} buffer - Buffer file
 * @param {string} mimetype - Tipe MIME file
 * @returns {Promise<string|null>} Teks yang diekstrak atau null jika gagal/tidak didukung
 */
export async function extractTextFromDocument(buffer, mimetype) {
    // Lazy load dependencies only when needed
    if (!pdf) {
        pdf = (await import('pdf-parse')).default;
    }
    if (!mammoth) {
        mammoth = (await import('mammoth')).default;
    }

    try {
        Logger.info('DOC_PROCESSOR', `Processing document: ${mimetype}`);

        // 1. Handle PDF
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        }

        // 2. Handle Word (.docx)
        else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: buffer });
            return result.value;
        }

        // 3. Handle Text File (.txt)
        else if (mimetype === 'text/plain') {
            return buffer.toString('utf-8');
        }

        return null;
    } catch (error) {
        Logger.error('DOC_PROCESSOR', 'Failed to extract text', { error: error.message });
        return null;
    }
}