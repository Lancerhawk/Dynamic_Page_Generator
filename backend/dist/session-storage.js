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
let redisClient = null;
let redisConnected = false;
let redisInitializing = false;
let redisInitPromise = null;
async function initializeRedis() {
    if (redisClient && redisConnected) {
        console.log('[initializeRedis] Redis already initialized and connected');
        return Promise.resolve();
    }
    if (redisInitPromise) {
        console.log('[initializeRedis] Already initializing, waiting for existing promise...');
        try {
            await redisInitPromise;
            console.log('[initializeRedis] Existing promise completed, redisClient exists:', !!redisClient);
            if (!redisClient) {
                console.error('[initializeRedis] WARNING: Promise completed but redisClient is still null! Re-initializing...');
                redisInitPromise = null;
            }
            else {
                return;
            }
        }
        catch (err) {
            console.error('[initializeRedis] Existing promise failed:', err.message);
            redisInitPromise = null;
        }
    }
    if (redisClient && !redisConnected) {
        console.log('[initializeRedis] redisClient exists but not connected, trying to reconnect...');
        try {
            await redisClient.ping();
            redisConnected = true;
            console.log('[initializeRedis] Reconnected successfully');
            return;
        }
        catch (err) {
            console.error('[initializeRedis] Reconnection failed:', err.message);
            redisClient = null;
        }
    }
    console.log('[initializeRedis] Starting NEW Redis initialization...');
    redisInitPromise = (async () => {
        if (redisInitializing) {
            console.log('[initializeRedis] Already initializing, skipping...');
            return;
        }
        if (redisClient) {
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
                    let Redis;
                    try {
                        if (typeof global !== 'undefined' && global.ioredis) {
                            Redis = global.ioredis;
                            console.log('📦 [initializeRedis] ioredis loaded from global (Vercel bundled)');
                        }
                        else {
                            Redis = require('ioredis');
                            console.log('📦 [initializeRedis] ioredis module loaded via require');
                        }
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
                    redisClient = new Redis(redisUrl, redisOptions);
                    console.log('[initializeRedis] Redis client created, status:', redisClient.status);
                    redisClient.on('connect', () => {
                        console.log('✅ [initializeRedis] Redis client connected event');
                        redisConnected = true;
                    });
                    redisClient.on('ready', () => {
                        console.log('✅ [initializeRedis] Redis client ready event');
                        redisConnected = true;
                    });
                    redisClient.on('error', (err) => {
                        console.error('❌ [initializeRedis] Redis connection error:', err.message);
                        console.error('❌ [initializeRedis] Redis error stack:', err.stack);
                        redisConnected = false;
                    });
                    redisClient.on('close', () => {
                        console.log('⚠️ [initializeRedis] Redis connection closed event');
                        redisConnected = false;
                    });
                    console.log('[initializeRedis] Waiting for Redis PING (timeout: 5s)...');
                    try {
                        await Promise.race([
                            redisClient.ping(),
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
                    console.error('❌ [initializeRedis] Failed to initialize ioredis:', error.message);
                    console.error('❌ [initializeRedis] Error stack:', error.stack);
                    redisClient = null;
                    redisConnected = false;
                    throw error;
                }
            }
            else {
                console.log('ℹ️ [initializeRedis] REDIS_URL not set, using in-memory storage only');
                redisConnected = false;
            }
        }
        catch (error) {
            console.error('⚠️ [initializeRedis] Redis initialization failed:', error.message);
            console.error('⚠️ [initializeRedis] Error stack:', error.stack);
            redisConnected = false;
            redisClient = null;
            throw error;
        }
        finally {
            redisInitializing = false;
            if (!redisClient) {
                console.log('[initializeRedis] Resetting promise (will allow retry on next call)');
                redisInitPromise = null;
            }
        }
    })();
    return redisInitPromise;
}
initializeRedis().catch(err => {
    console.error('❌ [Module Load] Failed to initialize Redis at module load:', err.message);
    console.error('❌ [Module Load] Error stack:', err.stack);
    console.error('❌ [Module Load] This is non-fatal - Redis will retry on first use');
    redisClient = null;
    redisConnected = false;
    redisInitPromise = null;
});
const memoryStore = new Map();
const memoryIntentStore = new Map();
const memoryThemeStore = new Map();
const SESSION_TTL = 60 * 60 * 24;
async function setSession(sessionId, siteData) {
    try {
        await initializeRedis();
    }
    catch (err) {
        console.error('[setSession] Redis initialization error:', err.message);
    }
    const key = `session:${sessionId}`;
    const hasRedis = !!redisClient;
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    console.log('[setSession] Storing session:', key);
    console.log('[setSession] Redis state - redisClient exists:', hasRedis, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
    console.log('[setSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
    memoryStore.set(sessionId, siteData);
    console.log('[setSession] Stored in memory as backup');
    if (redisClient) {
        try {
            await redisClient.ping();
            console.log('[setSession] Redis PING successful, trying to set data');
            const result = await redisClient.set(key, JSON.stringify(siteData), 'EX', SESSION_TTL);
            console.log('[setSession] Redis set result:', result);
            redisConnected = true;
        }
        catch (error) {
            console.error('[setSession] Redis error:', error.message);
            console.error('[setSession] Redis error stack:', error.stack);
            redisConnected = false;
            console.log('[setSession] Using memory storage (already stored)');
        }
    }
    else {
        console.log('[setSession] Redis client not available (redisClient is null)');
    }
}
async function getSession(sessionId) {
    try {
        console.log('[getSession] Waiting for Redis initialization...');
        await Promise.race([
            initializeRedis(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis initialization timeout (10s)')), 10000))
        ]);
        console.log('[getSession] Redis initialization completed, redisClient exists:', !!redisClient);
    }
    catch (err) {
        console.error('[getSession] Redis initialization error:', err.message);
        console.error('[getSession] Redis initialization error stack:', err.stack);
    }
    const key = `session:${sessionId}`;
    const hasRedis = !!redisClient;
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    console.log('[getSession] Fetching:', key);
    console.log('[getSession] Redis state - redisClient exists:', hasRedis, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
    console.log('[getSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
    if (redisClient) {
        try {
            await redisClient.ping();
            console.log('[getSession] Redis PING successful, trying to get data');
            const data = await redisClient.get(key);
            console.log('[getSession] Redis get result:', data ? 'Found data' : 'No data');
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                console.log('[getSession] Parsed successfully from Redis');
                memoryStore.set(sessionId, parsed);
                redisConnected = true;
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
        console.log('[getSession] Redis client not available (redisClient is null)');
        console.log('[getSession] This means Redis initialization either failed or is still in progress');
        console.log('[getSession] Check logs above for initialization errors');
    }
    const memoryData = memoryStore.get(sessionId);
    console.log('[getSession] Memory result:', memoryData ? 'Found' : 'Not found');
    return memoryData || null;
}
async function deleteSession(sessionId) {
    await initializeRedis();
    if (redisClient && redisConnected) {
        try {
            await redisClient.del(`session:${sessionId}`);
        }
        catch (error) {
            console.error('[deleteSession] Redis error:', error.message);
        }
    }
    memoryStore.delete(sessionId);
}
async function setIntents(sessionId, intents) {
    await initializeRedis();
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    memoryIntentStore.set(sessionId, intents);
    if (redisClient && isRedisReady) {
        try {
            await redisClient.ping();
            await redisClient.set(`intents:${sessionId}`, JSON.stringify(intents), 'EX', SESSION_TTL);
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
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    if (redisClient && isRedisReady) {
        try {
            await redisClient.ping();
            const data = await redisClient.get(`intents:${sessionId}`);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
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
    if (redisClient && redisConnected) {
        try {
            await redisClient.del(`intents:${sessionId}`);
        }
        catch (error) {
            console.error('[deleteIntents] Redis error:', error.message);
        }
    }
    memoryIntentStore.delete(sessionId);
}
async function setThemeColors(sessionId, themeColors) {
    await initializeRedis();
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    memoryThemeStore.set(sessionId, themeColors);
    if (redisClient && isRedisReady) {
        try {
            await redisClient.ping();
            await redisClient.set(`theme:${sessionId}`, JSON.stringify(themeColors), 'EX', SESSION_TTL);
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
    const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
    if (redisClient && isRedisReady) {
        try {
            await redisClient.ping();
            const data = await redisClient.get(`theme:${sessionId}`);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
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
    if (redisClient && redisConnected) {
        try {
            await redisClient.del(`theme:${sessionId}`);
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
