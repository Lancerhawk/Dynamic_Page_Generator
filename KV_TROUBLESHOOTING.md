# Vercel KV Troubleshooting Guide

## Problem: Sessions Still Not Working After Setting Up KV

### Step 1: Check Environment Variables

After creating a KV database in Vercel, you should have these environment variables:

**Required:**
- `KV_REST_API_URL` - The Redis connection URL
- `KV_REST_API_TOKEN` - The authentication token

**How to Check:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Look for variables starting with `KV_`
3. If you only see one variable (like just the URL), you need to add the token

### Step 2: Verify Environment Variables Are Set

Visit this endpoint after deployment:
```
https://your-app.vercel.app/api/debug/kv-status
```

This will show you:
- Which KV environment variables are set
- Whether the KV client initialized successfully

### Step 3: Check Server Logs

After deploying, check your Vercel function logs. You should see:

**✅ Success:**
```
🔍 Checking KV environment variables...
KV_REST_API_URL: ✅ Set
KV_REST_API_TOKEN: ✅ Set
📦 @vercel/kv package loaded
✅ Vercel KV client initialized successfully
✅ KV connection test: PING successful
```

**❌ Problem:**
```
KV_REST_API_URL: ❌ Not set
KV_REST_API_TOKEN: ❌ Not set
ℹ️ No KV URL found, using in-memory storage
```

### Step 4: If Only URL is Set

If Vercel only created `KV_REST_API_URL` but not `KV_REST_API_TOKEN`:

1. Go to Vercel Dashboard → Storage → Your KV Database
2. Click on the database
3. Look for "Environment Variables" or "Connection Details"
4. Copy the `KV_REST_API_TOKEN` value
5. Go to Project Settings → Environment Variables
6. Add `KV_REST_API_TOKEN` manually with the copied value

### Step 5: Redeploy

After adding/updating environment variables:
1. Go to Vercel Dashboard → Deployments
2. Click "..." on the latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete
5. Check logs again

### Step 6: Test Session Storage

1. Connect to your app (enter pub token)
2. Check browser console for any errors
3. Try generating a page
4. If you see "Session not found", check the server logs

### Common Issues

#### Issue: "KV_REST_API_TOKEN is not set"
**Solution:** Add it manually in Vercel Environment Variables

#### Issue: "KV connection test failed"
**Solution:** 
- Check that the KV database is active in Vercel
- Verify the URL and token are correct
- Make sure you're using the right region

#### Issue: "Using in-memory storage" in production
**Solution:**
- Environment variables might not be set for Production environment
- In Vercel Environment Variables, make sure to select "Production" when adding variables
- Redeploy after adding variables

#### Issue: Sessions work but disappear after a few minutes
**Solution:**
- This is normal - sessions have a 24-hour TTL
- If you need longer sessions, edit `SESSION_TTL` in `backend/src/session-storage.ts`

### Debug Endpoint

Use this to check your setup:
```bash
curl https://your-app.vercel.app/api/debug/kv-status
```

Expected response:
```json
{
  "environment": "production",
  "vercel": true,
  "kvEnvVars": {
    "KV_REST_API_URL": "Set",
    "KV_REST_API_TOKEN": "Set",
    "hasKvUrl": true,
    "hasKvToken": true
  }
}
```

### Still Not Working?

1. Check Vercel function logs for detailed error messages
2. Verify `@vercel/kv` package is installed (check `api/package.json`)
3. Make sure you rebuilt after adding the package: `npm run build` in backend folder
4. Check that environment variables are set for the correct environment (Production/Preview/Development)

