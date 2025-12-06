// Page storage using Redis in production, in-memory Map in development
let kv: any = null;

// Try to initialize Redis (reuse same connection logic as session-storage)
try {
  const redisUrl = process.env.REDIS_URL;
  const kvUrl = process.env.KV_REST_API_URL || process.env.KV_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_TOKEN;
  
  if (redisUrl) {
    const Redis = require('ioredis');
    kv = new Redis(redisUrl);
  } else if (kvUrl) {
    const vercelKv = require('@vercel/kv');
    if (vercelKv.createClient) {
      kv = vercelKv.createClient({ url: kvUrl, token: kvToken || undefined });
    } else if (vercelKv.kv) {
      kv = vercelKv.kv;
    } else {
      kv = vercelKv.default || vercelKv;
    }
  }
} catch (error: any) {
  // Silent fail - will use memory storage
}

// Fallback to in-memory storage
const memoryPageStore = new Map<string, { html: string; timestamp: number }>();

const PAGE_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function storePage(intentId: string, html: string): Promise<void> {
  const pageData = {
    html,
    timestamp: Date.now()
  };
  
  if (kv) {
    try {
      try {
        await kv.set(`page:${intentId}`, JSON.stringify(pageData), 'EX', PAGE_TTL);
      } catch {
        await kv.set(`page:${intentId}`, JSON.stringify(pageData), { ex: PAGE_TTL });
      }
    } catch (error: any) {
      console.error('KV storePage error:', error.message);
      memoryPageStore.set(intentId, pageData);
    }
  } else {
    memoryPageStore.set(intentId, pageData);
  }
}

export async function getPage(intentId: string): Promise<string | null> {
  let pageData: { html: string; timestamp: number } | null = null;
  
  if (kv) {
    const data = await kv.get(`page:${intentId}`);
    pageData = data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } else {
    pageData = memoryPageStore.get(intentId) || null;
  }
  
  return pageData ? pageData.html : null;
}

export async function clearAllPages(): Promise<void> {
  if (kv) {
    // For KV, we need to get all page keys and delete them
    // This is a simplified version - in production you might want to track keys
    // For now, pages will expire on their own with TTL
    console.log('Note: Individual page cleanup in KV requires key tracking');
  } else {
    memoryPageStore.clear();
  }
}
