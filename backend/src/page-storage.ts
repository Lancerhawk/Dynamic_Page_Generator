// Page storage using Redis in production, in-memory Map in development
let redisClient: any = null;
let redisConnected: boolean = false;
let redisInitializing: boolean = false;
let redisInitPromise: Promise<void> | null = null;

// Initialize Redis connection (async) - same pattern as session-storage
async function initializeRedis(): Promise<void> {
  if (redisInitPromise) {
    return redisInitPromise;
  }
  
  redisInitPromise = (async () => {
    if (redisInitializing || redisClient) {
      return; // Already initializing or initialized
    }
    
    redisInitializing = true;
    
    try {
      const redisUrl = process.env.REDIS_URL;
      
      console.log('[Page Storage] 🔍 Checking Redis environment variables...');
      console.log('[Page Storage] REDIS_URL:', redisUrl ? '✅ Set' : '❌ Not set');
      
      if (redisUrl) {
        try {
          // Try to require ioredis - check if it's available
          let Redis;
          try {
            Redis = require('ioredis');
            console.log('[Page Storage] 📦 ioredis module loaded successfully');
          } catch (requireError: any) {
            console.error('[Page Storage] ❌ Failed to require ioredis:', requireError.message);
            console.error('[Page Storage] ❌ Error stack:', requireError.stack);
            console.error('[Page Storage] ❌ This usually means ioredis is not installed in node_modules');
            throw new Error(`ioredis module not found: ${requireError.message}`);
          }
          
          if (!Redis) {
            throw new Error('ioredis module loaded but is undefined');
          }
          
          console.log('[Page Storage] 📦 Using ioredis with REDIS_URL');
          
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
          
          redisClient = new Redis(redisUrl, redisOptions);
          
          redisClient.on('connect', () => {
            console.log('[Page Storage] ✅ Redis client connected');
            redisConnected = true;
          });
          
          redisClient.on('ready', () => {
            console.log('[Page Storage] ✅ Redis client ready');
            redisConnected = true;
          });
          
          redisClient.on('error', (err: Error) => {
            console.error('[Page Storage] ❌ Redis connection error:', err.message);
            redisConnected = false;
          });
          
          redisClient.on('close', () => {
            console.log('[Page Storage] ⚠️ Redis connection closed');
            redisConnected = false;
          });
          
          // Wait for connection with timeout
          await Promise.race([
            redisClient.ping(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
            )
          ]);
          
          console.log('[Page Storage] ✅ Redis PING successful');
          redisConnected = true;
        } catch (error: any) {
          console.error('[Page Storage] ❌ Failed to initialize ioredis:', error.message);
          redisClient = null;
          redisConnected = false;
        }
      } else {
        console.log('[Page Storage] ℹ️ REDIS_URL not set, using in-memory storage only');
        redisConnected = false;
      }
    } catch (error: any) {
      console.error('[Page Storage] ⚠️ Redis initialization failed:', error.message);
      console.error('[Page Storage] Error stack:', error.stack);
      redisConnected = false;
      redisClient = null;
    } finally {
      redisInitializing = false;
    }
  })();
  
  return redisInitPromise;
}

// CRITICAL: Initialize Redis immediately at module load
initializeRedis().catch(err => {
  console.error('[Page Storage] Failed to initialize Redis at module load:', err);
});

// Fallback to in-memory storage
const memoryPageStore = new Map<string, { html: string; timestamp: number }>();

const PAGE_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function storePage(intentId: string, html: string): Promise<void> {
  // Ensure Redis is initialized
  await initializeRedis();
  
  const key = `page:${intentId}`;
  const pageData = {
    html,
    timestamp: Date.now()
  };
  
  // Check actual Redis connection status (not just flag)
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  console.log('[storePage] Storing page:', key, 'redisClient exists:', !!redisClient, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
  
  // ALWAYS write to memory as backup (even if Redis is available)
  memoryPageStore.set(intentId, pageData);
  console.log('[storePage] Stored in memory as backup');
  
  // Also write to Redis if available - try even if flag says no (connection might be ready)
  if (redisClient && isRedisReady) {
    try {
      // Verify connection with ping first
      await redisClient.ping();
      const result = await redisClient.set(key, JSON.stringify(pageData), 'EX', PAGE_TTL);
      console.log('[storePage] Redis set result:', result);
      redisConnected = true; // Update flag on success
    } catch (error: any) {
      console.error('[storePage] Redis error:', error.message);
      redisConnected = false;
      console.log('[storePage] Using memory storage (already stored)');
    }
  } else {
    console.log('[storePage] Using memory storage only (no Redis connection)');
  }
}

export async function getPage(intentId: string): Promise<string | null> {
  // Ensure Redis is initialized
  await initializeRedis();
  
  const key = `page:${intentId}`;
  
  // Check actual Redis connection status (not just flag)
  const isRedisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect' || redisConnected);
  
  console.log('[getPage] Fetching page:', key, 'redisClient exists:', !!redisClient, 'redisConnected:', redisConnected, 'status:', redisClient?.status, 'isRedisReady:', isRedisReady);
  
  // Try Redis first if available - try even if flag says no (connection might be ready)
  if (redisClient && isRedisReady) {
    try {
      // Verify connection with ping first
      await redisClient.ping();
      const data = await redisClient.get(key);
      console.log('[getPage] Redis get result:', data ? 'Found data' : 'No data');
      
      if (data) {
        const pageData = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('[getPage] Parsed successfully from Redis');
        // Also update memory cache
        memoryPageStore.set(intentId, pageData);
        redisConnected = true; // Update flag on success
        return pageData.html;
      }
    } catch (error: any) {
      console.error('[getPage] Redis error:', error.message);
      redisConnected = false;
    }
  }
  
  // Fallback to memory
  const memoryData = memoryPageStore.get(intentId);
  console.log('[getPage] Memory result:', memoryData ? 'Found' : 'Not found');
  return memoryData ? memoryData.html : null;
}

export async function clearAllPages(): Promise<void> {
  await initializeRedis();
  
  if (redisClient && redisConnected) {
    try {
      // Note: We can't easily delete all pages in Redis without tracking keys
      // Pages will expire on their own with TTL
      console.log('[clearAllPages] Redis: Pages will expire with TTL');
    } catch (error: any) {
      console.error('[clearAllPages] Redis error:', error.message);
    }
  }
  
  // Always clear memory
  memoryPageStore.clear();
  console.log('[clearAllPages] Memory cleared');
}
