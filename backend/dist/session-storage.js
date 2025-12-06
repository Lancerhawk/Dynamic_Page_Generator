"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSession = setSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
exports.setIntents = setIntents;
exports.getIntents = getIntents;
exports.deleteIntents = deleteIntents;
exports.setThemeColors = setThemeColors;
exports.getThemeColors = getThemeColors;
exports.deleteThemeColors = deleteThemeColors;
exports.clearSession = clearSession;
// Session storage using Vercel KV (Redis) in production, in-memory Map in development
let kv = null;
// Try to initialize Vercel KV if available
try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const vercelKv = require('@vercel/kv');
        // Handle both v2 (named export) and v3+ (default export) styles
        kv = vercelKv.kv || vercelKv.default || vercelKv;
        if (kv) {
            console.log('Using Vercel KV for session storage');
        }
    }
}
catch (error) {
    console.log('Vercel KV not available, using in-memory storage');
}
// Fallback to in-memory storage
const memoryStore = new Map();
const memoryIntentStore = new Map();
const memoryThemeStore = new Map();
const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
async function setSession(sessionId, siteData) {
    if (kv) {
        await kv.set(`session:${sessionId}`, JSON.stringify(siteData), { ex: SESSION_TTL });
    }
    else {
        memoryStore.set(sessionId, siteData);
    }
}
async function getSession(sessionId) {
    if (kv) {
        const data = await kv.get(`session:${sessionId}`);
        return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
    }
    else {
        return memoryStore.get(sessionId) || null;
    }
}
async function deleteSession(sessionId) {
    if (kv) {
        await kv.del(`session:${sessionId}`);
    }
    else {
        memoryStore.delete(sessionId);
    }
}
async function setIntents(sessionId, intents) {
    if (kv) {
        await kv.set(`intents:${sessionId}`, JSON.stringify(intents), { ex: SESSION_TTL });
    }
    else {
        memoryIntentStore.set(sessionId, intents);
    }
}
async function getIntents(sessionId) {
    if (kv) {
        const data = await kv.get(`intents:${sessionId}`);
        return data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
    }
    else {
        return memoryIntentStore.get(sessionId) || [];
    }
}
async function deleteIntents(sessionId) {
    if (kv) {
        await kv.del(`intents:${sessionId}`);
    }
    else {
        memoryIntentStore.delete(sessionId);
    }
}
async function setThemeColors(sessionId, themeColors) {
    if (kv) {
        await kv.set(`theme:${sessionId}`, JSON.stringify(themeColors), { ex: SESSION_TTL });
    }
    else {
        memoryThemeStore.set(sessionId, themeColors);
    }
}
async function getThemeColors(sessionId) {
    if (kv) {
        const data = await kv.get(`theme:${sessionId}`);
        return data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};
    }
    else {
        return memoryThemeStore.get(sessionId) || {};
    }
}
async function deleteThemeColors(sessionId) {
    if (kv) {
        await kv.del(`theme:${sessionId}`);
    }
    else {
        memoryThemeStore.delete(sessionId);
    }
}
async function clearSession(sessionId) {
    await Promise.all([
        deleteSession(sessionId),
        deleteIntents(sessionId),
        deleteThemeColors(sessionId)
    ]);
}
