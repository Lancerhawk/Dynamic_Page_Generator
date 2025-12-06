// Session storage using Redis in production, in-memory Map in development
let kv: any = null;
let redisConnected: boolean = false;

// Try to initialize Redis if available
try {
  // Check for REDIS_URL (Vercel Redis) or KV_REST_API_URL (Vercel KV)
  const redisUrl = process.env.REDIS_URL;
  const kvUrl = process.env.KV_REST_API_URL || process.env.KV_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_TOKEN;
  
  // Log what we found
  console.log('🔍 Checking Redis/KV environment variables...');
  console.log('REDIS_URL:', redisUrl ? '✅ Set' : '❌ Not set');
  console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
  console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');
  
  // Priority 1: Use REDIS_URL with ioredis (Vercel Redis)
  if (redisUrl) {
    try {
      const Redis = require('ioredis');
      console.log('📦 Using ioredis with REDIS_URL');
      console.log('📦 Redis URL format:', redisUrl.substring(0, 20) + '...' + redisUrl.substring(redisUrl.length - 10));
      
      // Parse Redis URL to extract connection options
      // Format: redis://default:password@host:port
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
        // Enable ready check
        enableReadyCheck: true,
        // Connection timeout
        connectTimeout: 10000,
        // Lazy connect - don't connect immediately
        lazyConnect: false
      };
      
      kv = new Redis(redisUrl, redisOptions);
      
      // Handle connection events
      kv.on('connect', () => {
        console.log('✅ Redis client connected');
        redisConnected = true;
      });
      
      kv.on('ready', () => {
        console.log('✅ Redis client ready');
        redisConnected = true;
      });
      
      kv.on('error', (err: Error) => {
        console.error('❌ Redis connection error:', err.message);
        console.error('❌ Redis error stack:', err.stack);
        redisConnected = false;
      });
      
      kv.on('close', () => {
        console.log('⚠️ Redis connection closed');
        redisConnected = false;
      });
      
      // Test connection (async, don't block initialization)
      kv.ping().then((result: string) => {
        console.log('✅ Redis PING successful:', result);
        redisConnected = true;
      }).catch((err: any) => {
        console.error('❌ Redis PING failed:', err.message);
        console.error('❌ Redis PING error stack:', err.stack);
        redisConnected = false;
      });
      
    } catch (error: any) {
      console.error('❌ Failed to initialize ioredis:', error.message);
      console.error('❌ ioredis error stack:', error.stack);
    }
  }
  // Priority 2: Use Vercel KV (@vercel/kv)
  else if (kvUrl) {
    try {
      const vercelKv = require('@vercel/kv');
      console.log('📦 Using @vercel/kv');
      
      if (vercelKv.createClient) {
        kv = vercelKv.createClient({
          url: kvUrl,
          token: kvToken || undefined
        });
      } else if (vercelKv.kv) {
        kv = vercelKv.kv;
      } else {
        kv = vercelKv.default || vercelKv;
      }
      
      if (kv) {
        console.log('✅ Vercel KV client initialized');
      }
    } catch (error: any) {
      console.log('⚠️ Failed to initialize @vercel/kv:', error.message);
    }
  }
  
  if (!kv) {
    console.log('ℹ️ No Redis/KV connection available, using in-memory storage');
    redisConnected = false;
  } else {
    // For ioredis, check status
    if (kv.status === 'ready' || kv.status === 'connect') {
      redisConnected = true;
      console.log('✅ Redis status check: ready/connected');
    } else {
      console.log('⚠️ Redis status:', kv.status, '- will check on first use');
      // Will be set by event handlers
    }
  }
} catch (error: any) {
  console.log('⚠️ Redis/KV initialization failed, using in-memory storage');
  console.log('Error:', error.message);
}

// Fallback to in-memory storage
const memoryStore = new Map<string, any>();
const memoryIntentStore = new Map<string, any[]>();
const memoryThemeStore = new Map<string, any>();

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function setSession(sessionId: string, siteData: any): Promise<void> {
  const key = `session:${sessionId}`;
  
  // Check Redis connection status
  let usingRedis = false;
  if (kv) {
    // For ioredis, check status
    if (kv.status === 'ready' || kv.status === 'connect') {
      redisConnected = true;
      usingRedis = true;
    } else if (redisConnected) {
      usingRedis = true;
    } else {
      // Try to verify connection
      try {
        await kv.ping();
        redisConnected = true;
        usingRedis = true;
      } catch {
        redisConnected = false;
        usingRedis = false;
      }
    }
  }
  
  console.log('[setSession] Storing session:', key, 'Using:', usingRedis ? 'Redis/KV' : 'Memory', 'kv exists:', !!kv, 'redisConnected:', redisConnected, 'status:', kv?.status);
  
  if (usingRedis) {
    try {
      // ioredis uses 'EX' as third parameter, @vercel/kv uses { ex: ttl }
      if (kv.set && typeof kv.set === 'function') {
        // Try ioredis style first (EX parameter)
        try {
          const result = await kv.set(key, JSON.stringify(siteData), 'EX', SESSION_TTL);
          console.log('[setSession] Redis set result (ioredis):', result);
        } catch (err: any) {
          console.log('[setSession] ioredis style failed, trying @vercel/kv style:', err.message);
          // Fallback to @vercel/kv style
          const result = await kv.set(key, JSON.stringify(siteData), { ex: SESSION_TTL });
          console.log('[setSession] Redis set result (@vercel/kv):', result);
        }
      } else {
        throw new Error('KV client does not have set method');
      }
    } catch (error: any) {
      console.error('[setSession] KV error:', error.message, error.stack);
      // Fallback to memory on error
      console.log('[setSession] Falling back to memory storage');
      memoryStore.set(sessionId, siteData);
    }
  } else {
    console.log('[setSession] Using memory storage (no Redis/KV)');
    memoryStore.set(sessionId, siteData);
  }
}

export async function getSession(sessionId: string): Promise<any | null> {
  const key = `session:${sessionId}`;
  
  // Check Redis connection status
  let usingRedis = false;
  if (kv) {
    // For ioredis, check status
    if (kv.status === 'ready' || kv.status === 'connect') {
      redisConnected = true;
      usingRedis = true;
    } else if (redisConnected) {
      usingRedis = true;
    } else {
      // Try to verify connection
      try {
        await kv.ping();
        redisConnected = true;
        usingRedis = true;
      } catch {
        redisConnected = false;
        usingRedis = false;
      }
    }
  }
  
  console.log('[getSession] Fetching:', key, 'Using:', usingRedis ? 'Redis/KV' : 'Memory', 'kv exists:', !!kv, 'redisConnected:', redisConnected, 'status:', kv?.status);
  
  if (usingRedis) {
    try {
      const data = await kv.get(key);
      console.log('[getSession] Redis get result:', data ? 'Found data' : 'No data', typeof data);
      
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('[getSession] Parsed successfully, keys:', Object.keys(parsed).slice(0, 5));
        return parsed;
      }
      console.log('[getSession] No data in Redis, checking memory fallback');
      return memoryStore.get(sessionId) || null;
    } catch (error: any) {
      console.error('[getSession] KV error:', error.message, error.stack);
      // Fallback to memory on error
      console.log('[getSession] Falling back to memory storage');
      return memoryStore.get(sessionId) || null;
    }
  } else {
    const memoryData = memoryStore.get(sessionId);
    console.log('[getSession] Memory result:', memoryData ? 'Found' : 'Not found');
    return memoryData || null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (kv) {
    await kv.del(`session:${sessionId}`);
  } else {
    memoryStore.delete(sessionId);
  }
}

export async function setIntents(sessionId: string, intents: any[]): Promise<void> {
  if (kv) {
    try {
      try {
        await kv.set(`intents:${sessionId}`, JSON.stringify(intents), 'EX', SESSION_TTL);
      } catch {
        await kv.set(`intents:${sessionId}`, JSON.stringify(intents), { ex: SESSION_TTL });
      }
    } catch (error: any) {
      console.error('KV setIntents error:', error.message);
      memoryIntentStore.set(sessionId, intents);
    }
  } else {
    memoryIntentStore.set(sessionId, intents);
  }
}

export async function getIntents(sessionId: string): Promise<any[]> {
  if (kv) {
    const data = await kv.get(`intents:${sessionId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
  } else {
    return memoryIntentStore.get(sessionId) || [];
  }
}

export async function deleteIntents(sessionId: string): Promise<void> {
  if (kv) {
    await kv.del(`intents:${sessionId}`);
  } else {
    memoryIntentStore.delete(sessionId);
  }
}

export async function setThemeColors(sessionId: string, themeColors: any): Promise<void> {
  if (kv) {
    try {
      try {
        await kv.set(`theme:${sessionId}`, JSON.stringify(themeColors), 'EX', SESSION_TTL);
      } catch {
        await kv.set(`theme:${sessionId}`, JSON.stringify(themeColors), { ex: SESSION_TTL });
      }
    } catch (error: any) {
      console.error('KV setThemeColors error:', error.message);
      memoryThemeStore.set(sessionId, themeColors);
    }
  } else {
    memoryThemeStore.set(sessionId, themeColors);
  }
}

export async function getThemeColors(sessionId: string): Promise<any> {
  if (kv) {
    const data = await kv.get(`theme:${sessionId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};
  } else {
    return memoryThemeStore.get(sessionId) || {};
  }
}

export async function deleteThemeColors(sessionId: string): Promise<void> {
  if (kv) {
    await kv.del(`theme:${sessionId}`);
  } else {
    memoryThemeStore.delete(sessionId);
  }
}

export async function clearSession(sessionId: string): Promise<void> {
  await Promise.all([
    deleteSession(sessionId),
    deleteIntents(sessionId),
    deleteThemeColors(sessionId)
  ]);
}

