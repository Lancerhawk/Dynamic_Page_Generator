// Session storage using Vercel KV (Redis) in production, in-memory Map in development
let kv: any = null;

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
} catch (error) {
  console.log('Vercel KV not available, using in-memory storage');
}

// Fallback to in-memory storage
const memoryStore = new Map<string, any>();
const memoryIntentStore = new Map<string, any[]>();
const memoryThemeStore = new Map<string, any>();

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function setSession(sessionId: string, siteData: any): Promise<void> {
  if (kv) {
    await kv.set(`session:${sessionId}`, JSON.stringify(siteData), { ex: SESSION_TTL });
  } else {
    memoryStore.set(sessionId, siteData);
  }
}

export async function getSession(sessionId: string): Promise<any | null> {
  if (kv) {
    const data = await kv.get(`session:${sessionId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } else {
    return memoryStore.get(sessionId) || null;
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
    await kv.set(`intents:${sessionId}`, JSON.stringify(intents), { ex: SESSION_TTL });
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
    await kv.set(`theme:${sessionId}`, JSON.stringify(themeColors), { ex: SESSION_TTL });
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

