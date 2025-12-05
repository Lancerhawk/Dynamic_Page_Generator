# Complete Vercel Deployment Guide

## 🎯 Overview

Deploy both **frontend** and **backend** to Vercel in one deployment. No payment method required!

---

## 📋 Prerequisites

1. **GitHub Account** (free)
2. **Vercel Account** (free, sign up with GitHub)
3. **Anthropic API Key** (for Claude AI)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Your Code to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Ready for Vercel deployment"
   ```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Create a new repository (e.g., `dynamic-page-generator`)
   - **Don't** initialize with README (you already have code)

3. **Push Your Code**:
   ```bash
   git remote add origin https://github.com/yourusername/your-repo-name.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel**:
   - Visit https://vercel.com
   - Click **"Sign Up"** or **"Login"**
   - Choose **"Continue with GitHub"**

2. **Import Project**:
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Select your repository
   - Click **"Import"**

3. **Configure Project**:
   
   **Root Directory**: Leave as `.` (root)
   
   **Framework Preset**: Select **"Other"** or **"No Framework"**
   
   **Build Command**: 
   ```bash
   cd backend && npm install && npm run build
   ```
   
   **Output Directory**: Leave **empty** (Vercel handles routing)
   
   **Install Command**: 
   ```bash
   npm install
   ```
   
   **Important**: Make sure the build command runs BEFORE deployment. The `backend/dist` folder must exist for the serverless function to work.

4. **Add Environment Variables**:
   Click **"Environment Variables"** and add:
   
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: `your_anthropic_api_key_here`
   - **Environment**: Production, Preview, Development (select all)
   
   Click **"Add"** for each variable.

5. **Deploy**:
   - Click **"Deploy"** button
   - Wait 2-3 minutes for build to complete
   - You'll get a URL like `https://your-app.vercel.app`

**That's it!** Your app is now live! 🎉

---

#### Option B: Via Vercel CLI (Alternative)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy** (in project root):
   ```bash
   vercel
   ```
   
   **When prompted:**
   - Set up and deploy? **Yes**
   - Which scope? (select your account)
   - Link to existing project? **No**
   - Project name? (press Enter for default)
   - Directory? **./** (press Enter)
   - Override settings? **No**

4. **Add Environment Variables**:
   ```bash
   vercel env add ANTHROPIC_API_KEY
   ```
   Enter your API key when prompted.
   Select all environments (Production, Preview, Development).

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

---

## ✅ Verify Deployment

1. **Visit Your URL**:
   - Go to `https://your-app.vercel.app`
   - You should see your connect screen

2. **Test the App**:
   - Enter a pub token (e.g., `pub-1ez9p-e308d0f0c4fc4a81b1364d12882d609d`)
   - Click "Connect"
   - Try generating a page

3. **Check Logs** (if issues):
   - Go to Vercel Dashboard → Your Project → "Deployments"
   - Click on latest deployment → "Functions" tab
   - Check for any errors

---

## 🔧 How It Works

### File Structure:
```
your-project/
├── api/
│   └── index.js          # Vercel serverless function entry point
├── backend/
│   └── src/
│       └── server.ts     # Express app (exports for Vercel)
├── frontend/
│   └── index.html        # Frontend static files
└── vercel.json           # Vercel configuration
```

### Routing:
- **`/api/*`** → Goes to Express backend (serverless function)
- **`/*`** → Goes to Express backend, which serves frontend static files (index.html for SPA routing)

### Frontend API Calls:
- **Local dev**: Uses `http://localhost:3000`
- **Production**: Uses relative URLs (same domain, no CORS issues)

---

## 🐛 Troubleshooting

### Issue: "Cannot find module" or build fails

**Fix**: 
1. Make sure `backend/package.json` exists
2. Check build logs in Vercel dashboard
3. Verify TypeScript compiles locally: `cd backend && npm run build`

---

### Issue: "ANTHROPIC_API_KEY is not set"

**Fix**: 
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `ANTHROPIC_API_KEY` with your key
3. Redeploy: Go to Deployments → Click "..." → "Redeploy"

---

### Issue: Frontend can't reach API

**Fix**: 
1. Check browser console for errors
2. Verify `API_BASE_URL` is set correctly (should be empty string in production)
3. Check Vercel function logs for API errors

---

### Issue: "Module not found" errors

**Fix**: 
1. Make sure all dependencies are in `backend/package.json`
2. Check that `backend/node_modules` is in `.gitignore` (should be)
3. Vercel will install dependencies automatically

---

### Issue: Cold starts are slow (first request takes 2-3 seconds)

**Fix**: 
- This is normal for serverless functions
- First request after inactivity is slower
- Subsequent requests are fast
- Consider upgrading to Vercel Pro for better performance (optional)

---

## 📊 Vercel Free Tier Limits

- ✅ **100GB bandwidth/month** (plenty for most apps)
- ✅ **Unlimited deployments**
- ✅ **Free SSL/HTTPS** (automatic)
- ✅ **Global CDN**
- ✅ **Serverless functions**: 100GB-hours execution time/month
- ⚠️ **Cold starts**: First request after inactivity may be slow (1-2 seconds)

---

## 🔄 Updating Your App

### After Making Changes:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

2. **Vercel Auto-Deploys**:
   - Vercel automatically detects GitHub pushes
   - Creates a new deployment
   - Your changes go live in 1-2 minutes

3. **Manual Redeploy** (if needed):
   - Go to Vercel Dashboard → Deployments
   - Click "..." on any deployment → "Redeploy"

---

## 🎯 Environment Variables

### Required:
- `ANTHROPIC_API_KEY` - Your Claude AI API key

### Optional:
- `NODE_ENV` - Set to `production` (auto-set by Vercel)
- `PORT` - Not needed (Vercel handles this)

---

## 📝 Project Configuration Files

### `vercel.json`:
Routes API calls to serverless function and serves frontend.

### `api/index.js`:
Entry point that exports your Express app for Vercel.

### `backend/src/server.ts`:
Your Express app that exports for both local dev and Vercel.

---

## 🎉 Success Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Build command configured: `cd backend && npm install && npm run build`
- [ ] Environment variable `ANTHROPIC_API_KEY` added
- [ ] Deployment successful
- [ ] App accessible at `https://your-app.vercel.app`
- [ ] Tested: Can connect with pub token
- [ ] Tested: Can generate pages

---

## 💡 Pro Tips

1. **Preview Deployments**: Every PR gets a preview URL automatically
2. **Custom Domain**: Add your domain in Vercel dashboard → Settings → Domains
3. **Analytics**: Free analytics available in Vercel dashboard
4. **Rollback**: Easy rollback to previous deployments in dashboard
5. **Environment Variables**: Can set different values for Production/Preview/Development

---

## 📞 Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Discord**: https://vercel.com/discord
- **Check Logs**: Vercel Dashboard → Your Project → Deployments → Functions

---

## 🚀 Next Steps

1. **Test your deployment** thoroughly
2. **Share your URL** with others
3. **Monitor usage** in Vercel dashboard
4. **Set up custom domain** (optional)
5. **Enable analytics** (optional, free)

**Congratulations! Your app is now live on Vercel! 🎉**
