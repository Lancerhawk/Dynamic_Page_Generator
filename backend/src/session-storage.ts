// Session storage using Redis in production, in-memory Map in development
let redisClient: any = null;
let redisConnected: boolean = false;
let redisInitializing: boolean = false;
let redisInitPromise: Promise<void> | null = null;

// Initialize Redis connection (async)
async function initializeRedis(): Promise<void> {
  // If already initialized and connected, return immediately
  if (redisClient && redisConnected) {
    console.log('[initializeRedis] Redis already initialized and connected');
    return Promise.resolve();
  }
  
  // If there's an existing promise, wait for it
  if (redisInitPromise) {
    console.log('[initializeRedis] Already initializing, waiting for existing promise...');
    try {
      await redisInitPromise;
      console.log('[initializeRedis] Existing promise completed, redisClient exists:', !!redisClient);
      // If redisClient is still null after promise, something went wrong
      if (!redisClient) {
        console.error('[initializeRedis] WARNING: Promise completed but redisClient is still null! Re-initializing...');
        redisInitPromise = null; // Reset to allow retry
      } else {
        return; // Success
      }
    } catch (err: any) {
      console.error('[initializeRedis] Existing promise failed:', err.message);
      redisInitPromise = null; // Reset to allow retry
    }
  }
  
  // If redisClient exists but not connected, try to reconnect
  if (redisClient && !redisConnected) {
    console.log('[initializeRedis] redisClient exists but not connected, trying to reconnect...');
    try {
      await redisClient.ping();
      redisConnected = true;
      console.log('[initializeRedis] Reconnected successfully');
      return;
    } catch (err: any) {
      console.error('[initializeRedis] Reconnection failed:', err.message);
      redisClient = null; // Reset redisClient to allow fresh initialization
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
          // Try to require ioredis - check if it's available
          // First try global (set by api/index.js), then try require
          let Redis;
          try {
            // Try global first (set by api/index.js for Vercel)
            if (typeof global !== 'undefined' && (global as any).ioredis) {
              Redis = (global as any).ioredis;
              console.log('📦 [initializeRedis] ioredis loaded from global (Vercel bundled)');
            } else {
              // Fallback to normal require
              Redis = require('ioredis');
              console.log('📦 [initializeRedis] ioredis module loaded via require');
            }
            console.log('📦 [initializeRedis] ioredis module loaded successfully');
          } catch (requireError: any) {
            console.error('❌ [initializeRedis] Failed to require ioredis:', requireError.message);
            console.error('❌ [initializeRedis] Error stack:', requireError.stack);
            console.error('❌ [initializeRedis] This usually means ioredis is not installed in node_modules');
            throw new Error(`ioredis module not found: ${requireError.message}`);
          }
          
          if (!Redis) {
            throw new Error('ioredis module loaded but is undefined');
          }
          
          console.log('📦 [initializeRedis] Using ioredis with REDIS_URL');
          
          const redisOptions: any = {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 50, 2000);
              return delay;
            },
            reconnectOnError: (err: Error) => {
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
          
          redisClient.on('error', (err: Error) => {
            console.error('❌ [initializeRedis] Redis connection error:', err.message);
            console.error('❌ [initializeRedis] Redis error stack:', err.stack);
            redisConnected = false;
          });
          
          redisClient.on('close', () => {
            console.log('⚠️ [initializeRedis] Redis connection closed event');
            redisConnected = false;
          });
          
          // Wait for connection with timeout
          console.log('[initializeRedis] Waiting for Redis PING (timeout: 5s)...');
          try {
            await Promise.race([
              redisClient.ping(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
              )
            ]);
            console.log('✅ [initializeRedis] Redis PING successful');
            redisConnected = true;
          } catch (pingError: any) {
            console.error('❌ [initializeRedis] Redis PING failed:', pingError.message);
            throw pingError;
          }
        } catch (error: any) {
          console.error('❌ [initializeRedis] Failed to initialize ioredis:', error.message);
          console.error('❌ [initializeRedis] Error stack:', error.stack);
          redisClient = null;
          redisConnected = false;
          throw error; // Re-throw so caller knows it failed
        }
      } else {
        console.log('ℹ️ [initializeRedis] REDIS_URL not set, using in-memory storage only');
        redisConnected = false;
      }
    } catch (error: any) {
      console.error('⚠️ [initializeRedis] Redis initialization failed:', error.message);
      console.error('⚠️ [initializeRedis] Error stack:', error.stack);
      redisConnected = false;
      redisClient = null;
      throw error; // Re-throw so caller knows it failed
    } finally {
      redisInitializing = false;
      // Reset promise on failure so it can retry
      if (!redisClient) {
        console.log('[initializeRedis] Resetting promise (will allow retry on next call)');
        redisInitPromise = null;
      }
    }
  })();
  
  return redisInitPromise;
}

// CRITICAL: Initialize Redis immediately at module load
initializeRedis().catch(err => {
  console.error('❌ [Module Load] Failed to initialize Redis at module load:', err.message);
  console.error('❌ [Module Load] Error stack:', err.stack);
  console.error('❌ [Module Load] This is non-fatal - Redis will retry on first use');
  // Don't throw - allow the module to load even if Redis fails
  redisClient = null;
  redisConnected = false;
  redisInitPromise = null; // Reset so it can retry later
});

// Fallback to in-memory storage
const memoryStore = new Map<string, any>();
const memoryIntentStore = new Map<string, any[]>();
const memoryThemeStore = new Map<string, any>();

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function setSession(sessionId: string, siteData: any): Promise<void> {
  // Ensure Redis is initialized - WAIT for it to complete
  try {
    await initializeRedis();
  } catch (err: any) {
    console.error('[setSession] Redis initialization error:', err.message);
  }
  
  const key = `session:${sessionId}`;
  
  // Check actual Redis connection status (not just flag)
  const hasRedis = !!redisClient;
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  console.log('[setSession] Storing session:', key);
  console.log('[setSession] Redis state - redisClient exists:', hasRedis, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
  console.log('[setSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
  
  // ALWAYS write to memory as backup (even if Redis is available)
  memoryStore.set(sessionId, siteData);
  console.log('[setSession] Stored in memory as backup');
  
  // Also write to Redis if redisClient exists (try even if status is unknown)
  if (redisClient) {
    try {
      // Try ping to verify connection
      await redisClient.ping();
      console.log('[setSession] Redis PING successful, trying to set data');
      const result = await redisClient.set(key, JSON.stringify(siteData), 'EX', SESSION_TTL);
      console.log('[setSession] Redis set result:', result);
      redisConnected = true; // Update flag on success
    } catch (error: any) {
      console.error('[setSession] Redis error:', error.message);
      console.error('[setSession] Redis error stack:', error.stack);
      redisConnected = false;
      console.log('[setSession] Using memory storage (already stored)');
    }
  } else {
    console.log('[setSession] Redis client not available (redisClient is null)');
  }
}

export async function getSession(sessionId: string): Promise<any | null> {
  // Ensure Redis is initialized - WAIT for it to complete with timeout
  try {
    console.log('[getSession] Waiting for Redis initialization...');
    await Promise.race([
      initializeRedis(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis initialization timeout (10s)')), 10000)
      )
    ]);
    console.log('[getSession] Redis initialization completed, redisClient exists:', !!redisClient);
  } catch (err: any) {
    console.error('[getSession] Redis initialization error:', err.message);
    console.error('[getSession] Redis initialization error stack:', err.stack);
    // Continue anyway - might still work if kv was set before timeout
  }
  
  const key = `session:${sessionId}`;
  
  // Check actual Redis connection status (not just flag)
  // If redisClient exists, try to use it even if status is unknown
  const hasRedis = !!redisClient;
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  console.log('[getSession] Fetching:', key);
  console.log('[getSession] Redis state - redisClient exists:', hasRedis, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
  console.log('[getSession] REDIS_URL env:', process.env.REDIS_URL ? 'Set (' + process.env.REDIS_URL.substring(0, 20) + '...)' : 'NOT SET');
  
  // Try Redis if redisClient exists (even if status is unknown - might be connecting)
  if (redisClient) {
    try {
      // Try ping to verify connection
      await redisClient.ping();
      console.log('[getSession] Redis PING successful, trying to get data');
      const data = await redisClient.get(key);
      console.log('[getSession] Redis get result:', data ? 'Found data' : 'No data');
      
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('[getSession] Parsed successfully from Redis');
        // Also update memory cache
        memoryStore.set(sessionId, parsed);
        redisConnected = true; // Update flag on success
        return parsed;
      }
    } catch (error: any) {
      console.error('[getSession] Redis error:', error.message);
      console.error('[getSession] Redis error stack:', error.stack);
      redisConnected = false;
    }
  } else {
    console.log('[getSession] Redis client not available (redisClient is null)');
    console.log('[getSession] This means Redis initialization either failed or is still in progress');
    console.log('[getSession] Check logs above for initialization errors');
  }
  
  // Fallback to memory
  const memoryData = memoryStore.get(sessionId);
  console.log('[getSession] Memory result:', memoryData ? 'Found' : 'Not found');
  return memoryData || null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await initializeRedis();
  
  if (redisClient && redisConnected) {
    try {
      await redisClient.del(`session:${sessionId}`);
    } catch (error: any) {
      console.error('[deleteSession] Redis error:', error.message);
    }
  }
  memoryStore.delete(sessionId);
}

export async function setIntents(sessionId: string, intents: any[]): Promise<void> {
  await initializeRedis();
  
  // Check actual Redis connection status
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  // ALWAYS store in memory as backup
  memoryIntentStore.set(sessionId, intents);
  
  if (redisClient && isRedisReady) {
    try {
      await redisClient.ping();
      await redisClient.set(`intents:${sessionId}`, JSON.stringify(intents), 'EX', SESSION_TTL);
      redisConnected = true;
    } catch (error: any) {
      console.error('[setIntents] Redis error:', error.message);
      redisConnected = false;
    }
  }
}

export async function getIntents(sessionId: string): Promise<any[]> {
  await initializeRedis();
  
  // Check actual Redis connection status
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  if (redisClient && isRedisReady) {
    try {
      await redisClient.ping();
      const data = await redisClient.get(`intents:${sessionId}`);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        // Also update memory cache
        memoryIntentStore.set(sessionId, parsed);
        redisConnected = true;
        return parsed;
      }
    } catch (error: any) {
      console.error('[getIntents] Redis error:', error.message);
      redisConnected = false;
    }
  }
  
  return memoryIntentStore.get(sessionId) || [];
}

export async function deleteIntents(sessionId: string): Promise<void> {
  await initializeRedis();
  
  if (redisClient && redisConnected) {
    try {
      await redisClient.del(`intents:${sessionId}`);
    } catch (error: any) {
      console.error('[deleteIntents] Redis error:', error.message);
    }
  }
  memoryIntentStore.delete(sessionId);
}

export async function setThemeColors(sessionId: string, themeColors: any): Promise<void> {
  await initializeRedis();
  
  // Check actual Redis connection status
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  // ALWAYS store in memory as backup
  memoryThemeStore.set(sessionId, themeColors);
  
  if (redisClient && isRedisReady) {
    try {
      await redisClient.ping();
      await redisClient.set(`theme:${sessionId}`, JSON.stringify(themeColors), 'EX', SESSION_TTL);
      redisConnected = true;
    } catch (error: any) {
      console.error('[setThemeColors] Redis error:', error.message);
      redisConnected = false;
    }
  }
}

export async function getThemeColors(sessionId: string): Promise<any> {
  await initializeRedis();
  
  // Check actual Redis connection status
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  if (redisClient && isRedisReady) {
    try {
      await redisClient.ping();
      const data = await redisClient.get(`theme:${sessionId}`);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        // Also update memory cache
        memoryThemeStore.set(sessionId, parsed);
        redisConnected = true;
        return parsed;
      }
    } catch (error: any) {
      console.error('[getThemeColors] Redis error:', error.message);
      redisConnected = false;
    }
  }
  
  return memoryThemeStore.get(sessionId) || {};
}

export async function deleteThemeColors(sessionId: string): Promise<void> {
  await initializeRedis();
  
  if (redisClient && redisConnected) {
    try {
      await redisClient.del(`theme:${sessionId}`);
    } catch (error: any) {
      console.error('[deleteThemeColors] Redis error:', error.message);
    }
  }
  memoryThemeStore.delete(sessionId);
}

export async function clearSession(sessionId: string): Promise<void> {
  await Promise.all([
    deleteSession(sessionId),
    deleteIntents(sessionId),
    deleteThemeColors(sessionId)
  ]);
}
