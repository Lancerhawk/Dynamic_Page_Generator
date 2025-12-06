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
// Session storage using Redis in production, in-memory Map in development
let kv = null;
let redisConnected = false;
let redisInitializing = false;
let redisInitPromise = null;
// Initialize Redis connection (async)
async function initializeRedis() {
    if (redisInitPromise) {
        return redisInitPromise;
    }
    redisInitPromise = (async () => {
        if (redisInitializing || kv) {
            return; // Already initializing or initialized
        }
        redisInitializing = true;
        try {
            const redisUrl = process.env.REDIS_URL;
            console.log('🔍 Checking Redis environment variables...');
            console.log('REDIS_URL:', redisUrl ? '✅ Set' : '❌ Not set');
            if (redisUrl) {
                try {
                    const Redis = require('ioredis');
                    console.log('📦 Using ioredis with REDIS_URL');
                    const redisOptions = {
                        maxRetriesPerRequest: 3,
                        retryStrategy: (times) => {
                            const delay = Math.min(times * 50, 2000);
                            return delay;
                        },
                        reconnectOnError: (err) => {
                            const targetError = 'READONLY';
                            if (err.message.includes(targetError)) {
                                return true;
                            }
                            return false;
                        },
                        enableReadyCheck: true,
                        connectTimeout: 10000,
                        lazyConnect: false
                    };
                    kv = new Redis(redisUrl, redisOptions);
                    kv.on('connect', () => {
                        console.log('✅ Redis client connected');
                        redisConnected = true;
                    });
                    kv.on('ready', () => {
                        console.log('✅ Redis client ready');
                        redisConnected = true;
                    });
                    kv.on('error', (err) => {
                        console.error('❌ Redis connection error:', err.message);
                        redisConnected = false;
                    });
                    kv.on('close', () => {
                        console.log('⚠️ Redis connection closed');
                        redisConnected = false;
                    });
                    // Wait for connection with timeout
                    await Promise.race([
                        kv.ping(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
                    ]);
                    console.log('✅ Redis PING successful');
                    redisConnected = true;
                }
                catch (error) {
                    console.error('❌ Failed to initialize ioredis:', error.message);
                    kv = null;
                    redisConnected = false;
                }
            }
            else {
                console.log('ℹ️ REDIS_URL not set, using in-memory storage only');
                redisConnected = false;
            }
        }
        catch (error) {
            console.error('⚠️ Redis initialization failed:', error.message);
            console.error('Error stack:', error.stack);
            redisConnected = false;
            kv = null;
        }
        finally {
            redisInitializing = false;
        }
    })();
    return redisInitPromise;
}
// CRITICAL: Initialize Redis immediately at module load
initializeRedis().catch(err => {
    console.error('Failed to initialize Redis at module load:', err);
});
// Fallback to in-memory storage
const memoryStore = new Map();
const memoryIntentStore = new Map();
const memoryThemeStore = new Map();
const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
async function setSession(sessionId, siteData) {
    // Ensure Redis is initialized
    await initializeRedis();
    const key = `session:${sessionId}`;
    // Check actual Redis connection status (not just flag)
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    console.log('[setSession] Storing session:', key, 'kv exists:', !!kv, 'redisConnected:', redisConnected, 'status:', kv?.status, 'isRedisReady:', isRedisReady);
    // ALWAYS write to memory as backup (even if Redis is available)
    memoryStore.set(sessionId, siteData);
    console.log('[setSession] Stored in memory as backup');
    // Also write to Redis if available - try even if flag says no (connection might be ready)
    if (kv && isRedisReady) {
        try {
            // Verify connection with ping first
            await kv.ping();
            const result = await kv.set(key, JSON.stringify(siteData), 'EX', SESSION_TTL);
            console.log('[setSession] Redis set result:', result);
            redisConnected = true; // Update flag on success
        }
        catch (error) {
            console.error('[setSession] Redis error:', error.message);
            redisConnected = false;
            console.log('[setSession] Using memory storage (already stored)');
        }
    }
    else {
        console.log('[setSession] Using memory storage only (no Redis connection)');
    }
}
async function getSession(sessionId) {
    // Ensure Redis is initialized
    await initializeRedis();
    const key = `session:${sessionId}`;
    // Check actual Redis connection status (not just flag)
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    console.log('[getSession] Fetching:', key, 'kv exists:', !!kv, 'redisConnected:', redisConnected, 'status:', kv?.status, 'isRedisReady:', isRedisReady);
    // Try Redis first if available - try even if flag says no (connection might be ready)
    if (kv && isRedisReady) {
        try {
            // Verify connection with ping first
            await kv.ping();
            const data = await kv.get(key);
            console.log('[getSession] Redis get result:', data ? 'Found data' : 'No data');
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                console.log('[getSession] Parsed successfully from Redis');
                // Also update memory cache
                memoryStore.set(sessionId, parsed);
                redisConnected = true; // Update flag on success
                return parsed;
            }
        }
        catch (error) {
            console.error('[getSession] Redis error:', error.message);
            redisConnected = false;
        }
    }
    // Fallback to memory
    const memoryData = memoryStore.get(sessionId);
    console.log('[getSession] Memory result:', memoryData ? 'Found' : 'Not found');
    return memoryData || null;
}
async function deleteSession(sessionId) {
    await initializeRedis();
    if (kv && redisConnected) {
        try {
            await kv.del(`session:${sessionId}`);
        }
        catch (error) {
            console.error('[deleteSession] Redis error:', error.message);
        }
    }
    memoryStore.delete(sessionId);
}
async function setIntents(sessionId, intents) {
    await initializeRedis();
    // Check actual Redis connection status
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    // ALWAYS store in memory as backup
    memoryIntentStore.set(sessionId, intents);
    if (kv && isRedisReady) {
        try {
            await kv.ping();
            await kv.set(`intents:${sessionId}`, JSON.stringify(intents), 'EX', SESSION_TTL);
            redisConnected = true;
        }
        catch (error) {
            console.error('[setIntents] Redis error:', error.message);
            redisConnected = false;
        }
    }
}
async function getIntents(sessionId) {
    await initializeRedis();
    // Check actual Redis connection status
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    if (kv && isRedisReady) {
        try {
            await kv.ping();
            const data = await kv.get(`intents:${sessionId}`);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                // Also update memory cache
                memoryIntentStore.set(sessionId, parsed);
                redisConnected = true;
                return parsed;
            }
        }
        catch (error) {
            console.error('[getIntents] Redis error:', error.message);
            redisConnected = false;
        }
    }
    return memoryIntentStore.get(sessionId) || [];
}
async function deleteIntents(sessionId) {
    await initializeRedis();
    if (kv && redisConnected) {
        try {
            await kv.del(`intents:${sessionId}`);
        }
        catch (error) {
            console.error('[deleteIntents] Redis error:', error.message);
        }
    }
    memoryIntentStore.delete(sessionId);
}
async function setThemeColors(sessionId, themeColors) {
    await initializeRedis();
    // Check actual Redis connection status
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    // ALWAYS store in memory as backup
    memoryThemeStore.set(sessionId, themeColors);
    if (kv && isRedisReady) {
        try {
            await kv.ping();
            await kv.set(`theme:${sessionId}`, JSON.stringify(themeColors), 'EX', SESSION_TTL);
            redisConnected = true;
        }
        catch (error) {
            console.error('[setThemeColors] Redis error:', error.message);
            redisConnected = false;
        }
    }
}
async function getThemeColors(sessionId) {
    await initializeRedis();
    // Check actual Redis connection status
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    if (kv && isRedisReady) {
        try {
            await kv.ping();
            const data = await kv.get(`theme:${sessionId}`);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                // Also update memory cache
                memoryThemeStore.set(sessionId, parsed);
                redisConnected = true;
                return parsed;
            }
        }
        catch (error) {
            console.error('[getThemeColors] Redis error:', error.message);
            redisConnected = false;
        }
    }
    return memoryThemeStore.get(sessionId) || {};
}
async function deleteThemeColors(sessionId) {
    await initializeRedis();
    if (kv && redisConnected) {
        try {
            await kv.del(`theme:${sessionId}`);
        }
        catch (error) {
            console.error('[deleteThemeColors] Redis error:', error.message);
        }
    }
    memoryThemeStore.delete(sessionId);
}
async function clearSession(sessionId) {
    await Promise.all([
        deleteSession(sessionId),
        deleteIntents(sessionId),
        deleteThemeColors(sessionId)
    ]);
}
