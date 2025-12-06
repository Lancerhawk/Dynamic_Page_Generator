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
        console.log('[initializeRedis] Already initializing, waiting for existing promise...');
        return redisInitPromise;
    }
    if (kv && redisConnected) {
        console.log('[initializeRedis] Redis already initialized and connected');
        return Promise.resolve();
    }
    console.log('[initializeRedis] Starting Redis initialization...');
    redisInitPromise = (async () => {
        if (redisInitializing) {
            console.log('[initializeRedis] Already initializing, skipping...');
            return;
        }
        if (kv) {
            console.log('[initializeRedis] Redis client already exists');
            return;
        }
        redisInitializing = true;
        console.log('[initializeRedis] Set redisInitializing = true');
        try {
            const redisUrl = process.env.REDIS_URL;
            console.log('🔍 [initializeRedis] Checking Redis environment variables...');
            console.log('🔍 [initializeRedis] REDIS_URL:', redisUrl ? '✅ Set (' + redisUrl.substring(0, 20) + '...)' : '❌ Not set');
            console.log('🔍 [initializeRedis] NODE_ENV:', process.env.NODE_ENV);
            console.log('🔍 [initializeRedis] VERCEL:', !!process.env.VERCEL);
            if (redisUrl) {
                try {
                    // Try to require ioredis - check if it's available
                    let Redis;
                    try {
                        Redis = require('ioredis');
                        console.log('📦 [initializeRedis] ioredis module loaded successfully');
                    }
                    catch (requireError) {
                        console.error('❌ [initializeRedis] Failed to require ioredis:', requireError.message);
                        console.error('❌ [initializeRedis] Error stack:', requireError.stack);
                        console.error('❌ [initializeRedis] This usually means ioredis is not installed in node_modules');
                        throw new Error(`ioredis module not found: ${requireError.message}`);
                    }
                    if (!Redis) {
                        throw new Error('ioredis module loaded but is undefined');
                    }
                    console.log('📦 [initializeRedis] Using ioredis with REDIS_URL');
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
                    console.log('[initializeRedis] Creating Redis client...');
                    kv = new Redis(redisUrl, redisOptions);
                    console.log('[initializeRedis] Redis client created, status:', kv.status);
                    kv.on('connect', () => {
                        console.log('✅ [initializeRedis] Redis client connected event');
                        redisConnected = true;
                    });
                    kv.on('ready', () => {
                        console.log('✅ [initializeRedis] Redis client ready event');
                        redisConnected = true;
                    });
                    kv.on('error', (err) => {
                        console.error('❌ [initializeRedis] Redis connection error:', err.message);
                        console.error('❌ [initializeRedis] Redis error stack:', err.stack);
                        redisConnected = false;
                    });
                    kv.on('close', () => {
                        console.log('⚠️ [initializeRedis] Redis connection closed event');
                        redisConnected = false;
                    });
                    // Wait for connection with timeout
                    console.log('[initializeRedis] Waiting for Redis PING (timeout: 5s)...');
                    try {
                        await Promise.race([
                            kv.ping(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
                        ]);
                        console.log('✅ [initializeRedis] Redis PING successful');
                        redisConnected = true;
                    }
                    catch (pingError) {
                        console.error('❌ [initializeRedis] Redis PING failed:', pingError.message);
                        throw pingError;
                    }
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
    // Ensure Redis is initialized - WAIT for it to complete
    try {
        await initializeRedis();
    }
    catch (err) {
        console.error('[setSession] Redis initialization error:', err.message);
    }
    const key = `session:${sessionId}`;
    // Check actual Redis connection status (not just flag)
    const hasKv = !!kv;
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    console.log('[setSession] Storing session:', key);
    console.log('[setSession] Redis state - kv exists:', hasKv, 'redisConnected:', redisConnected, 'status:', kv?.status, 'isRedisReady:', isRedisReady);
    console.log('[setSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
    // ALWAYS write to memory as backup (even if Redis is available)
    memoryStore.set(sessionId, siteData);
    console.log('[setSession] Stored in memory as backup');
    // Also write to Redis if kv exists (try even if status is unknown)
    if (kv) {
        try {
            // Try ping to verify connection
            await kv.ping();
            console.log('[setSession] Redis PING successful, trying to set data');
            const result = await kv.set(key, JSON.stringify(siteData), 'EX', SESSION_TTL);
            console.log('[setSession] Redis set result:', result);
            redisConnected = true; // Update flag on success
        }
        catch (error) {
            console.error('[setSession] Redis error:', error.message);
            console.error('[setSession] Redis error stack:', error.stack);
            redisConnected = false;
            console.log('[setSession] Using memory storage (already stored)');
        }
    }
    else {
        console.log('[setSession] Redis client not available (kv is null)');
    }
}
async function getSession(sessionId) {
    // Ensure Redis is initialized - WAIT for it to complete
    try {
        await initializeRedis();
    }
    catch (err) {
        console.error('[getSession] Redis initialization error:', err.message);
    }
    const key = `session:${sessionId}`;
    // Check actual Redis connection status (not just flag)
    // If kv exists, try to use it even if status is unknown
    const hasKv = !!kv;
    const isRedisReady = kv && (kv.status === 'ready' || kv.status === 'connect' || redisConnected);
    console.log('[getSession] Fetching:', key);
    console.log('[getSession] Redis state - kv exists:', hasKv, 'redisConnected:', redisConnected, 'status:', kv?.status, 'isRedisReady:', isRedisReady);
    console.log('[getSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
    // Try Redis if kv exists (even if status is unknown - might be connecting)
    if (kv) {
        try {
            // Try ping to verify connection
            await kv.ping();
            console.log('[getSession] Redis PING successful, trying to get data');
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
            console.error('[getSession] Redis error stack:', error.stack);
            redisConnected = false;
        }
    }
    else {
        console.log('[getSession] Redis client not available (kv is null)');
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
