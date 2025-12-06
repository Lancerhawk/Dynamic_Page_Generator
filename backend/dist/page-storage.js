"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePage = storePage;
exports.getPage = getPage;
exports.clearAllPages = clearAllPages;
// Page storage using Vercel KV (Redis) in production, in-memory Map in development
let kv = null;
// Try to initialize Vercel KV if available
try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const vercelKv = require('@vercel/kv');
        // Handle both v2 (named export) and v3+ (default export) styles
        kv = vercelKv.kv || vercelKv.default || vercelKv;
        if (kv) {
            console.log('Using Vercel KV for page storage');
        }
    }
}
catch (error) {
    console.log('Vercel KV not available, using in-memory storage for pages');
}
// Fallback to in-memory storage
const memoryPageStore = new Map();
const PAGE_TTL = 60 * 60 * 24; // 24 hours in seconds
async function storePage(intentId, html) {
    const pageData = {
        html,
        timestamp: Date.now()
    };
    if (kv) {
        await kv.set(`page:${intentId}`, JSON.stringify(pageData), { ex: PAGE_TTL });
    }
    else {
        memoryPageStore.set(intentId, pageData);
    }
}
async function getPage(intentId) {
    let pageData = null;
    if (kv) {
        const data = await kv.get(`page:${intentId}`);
        pageData = data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
    }
    else {
        pageData = memoryPageStore.get(intentId) || null;
    }
    return pageData ? pageData.html : null;
}
async function clearAllPages() {
    if (kv) {
        // For KV, we need to get all page keys and delete them
        // This is a simplified version - in production you might want to track keys
        // For now, pages will expire on their own with TTL
        console.log('Note: Individual page cleanup in KV requires key tracking');
    }
    else {
        memoryPageStore.clear();
    }
}
