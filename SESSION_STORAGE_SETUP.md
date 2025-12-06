# Session Storage Setup for Production

## Problem
In serverless environments (like Vercel), sessions stored in memory are lost between function invocations. This causes "Session not found" errors when users try to generate pages.

## Solution
The application now uses **Vercel KV** (Redis) for persistent session storage in production, with automatic fallback to in-memory storage for local development.

## Setup Instructions

### 1. Install Vercel KV Package
The package is already added to `package.json`. Run:
```bash
npm install
```

### 2. Create Vercel KV Database
1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database**
4. Select **KV** (Redis)
5. Give it a name (e.g., "session-storage")
6. Select a region close to your users
7. Click **Create**

### 3. Link KV to Your Project
After creating the KV database:
1. Vercel will automatically add environment variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
2. These are automatically available in your serverless functions

### 4. Verify Setup
The application will automatically detect if KV is available:
- If `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set → Uses Vercel KV
- If not set → Falls back to in-memory storage (for local dev)

## How It Works

### Session Storage
- Sessions are stored with a 24-hour TTL (time-to-live)
- Keys are prefixed: `session:{sessionId}`, `intents:{sessionId}`, `theme:{sessionId}`
- All operations are async and handle errors gracefully

### Page Storage
- Generated pages are also stored in KV with 24-hour TTL
- Keys are prefixed: `page:{intentId}`
- Pages persist across function invocations

### Local Development
- Works without KV (uses in-memory storage)
- Perfect for development and testing
- No additional setup required

## Troubleshooting

### "Session not found" still occurs
1. Check that KV database is created in Vercel
2. Verify environment variables are set in Vercel dashboard
3. Check Vercel function logs for KV connection errors
4. Ensure `@vercel/kv` package is installed

### Sessions expire too quickly
- Default TTL is 24 hours
- Can be adjusted in `backend/src/session-storage.ts` (SESSION_TTL constant)

### Local development issues
- In-memory storage is used automatically
- No KV setup needed for local development
- Sessions will be lost on server restart (expected behavior)

## Benefits
✅ Sessions persist across serverless function invocations
✅ Works seamlessly in production
✅ No code changes needed - automatic detection
✅ Graceful fallback for local development
✅ 24-hour automatic expiration prevents storage bloat

