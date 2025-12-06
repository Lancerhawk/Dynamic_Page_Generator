import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fetchWebsiteData } from "./pub-token-fetcher";
import { calculateIntentsWithAI } from "./ai-intent-calculator";
import { extractDataByPath } from "./intent-calculator";
import { generatePageForIntent } from "./page-generator";
import { generateDetailPageForItem } from "./detail-page-generator";
import { storePage, getPage, clearAllPages } from "./page-storage";
import { 
  setSession, getSession, deleteSession,
  setIntents, getIntents, deleteIntents,
  setThemeColors, getThemeColors, deleteThemeColors,
  clearSession
} from "./session-storage";
import { extractThemeColors } from "./theme-extractor";
import { detectThemeColorsWithAI } from "./ai-theme-detector";
import { extractHeroData } from "./hero-extractor";

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  dotenv.config({ path: path.join(__dirname, "../.env") });
}

const app = express();
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`, {
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: {
      'user-agent': req.get('user-agent')?.substring(0, 50)
    }
  });
  next();
});

// Test endpoint to verify routing works
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "API routing works!",
    path: req.path,
    method: req.method
  });
});

// List all registered routes for debugging
app.get("/api/debug/routes", (req, res) => {
  const routes: any[] = [];
  app._router?.stack?.forEach((middleware: any) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods);
      routes.push({
        path: middleware.route.path,
        methods: methods
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack?.forEach((handler: any) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods);
          routes.push({
            path: handler.route.path,
            methods: methods
          });
        }
      });
    }
  });
  
  res.json({
    routes: routes,
    total: routes.length,
    message: 'Registered routes'
  });
});

const PORT = process.env.PORT || 3000;

app.post("/api/connect", async (req, res) => {
  try {
    const { pubToken } = req.body;
    
    if (!pubToken) {
      return res.status(400).json({ error: "Pub token is required" });
    }

    const siteData = await fetchWebsiteData(pubToken);
    
    const siteName = siteData.entries?.navbar?.logo_text || 
                     siteData.config?.title || 
                     "Website";
    
    const heroData = extractHeroData(siteData);
    
    let themeColors = await extractThemeColors(siteData);
    
    if (!themeColors.primary || themeColors.primary === '#3b82f6') {
      try {
        const aiColors = await detectThemeColorsWithAI(siteData);
        if (aiColors.primary !== '#3b82f6') {
          themeColors = aiColors;
        }
      } catch (error) {
        console.error("AI theme detection failed, using defaults:", error);
      }
    }
    
    const intents = await calculateIntentsWithAI(siteData);
    
    const sessionId = `session-${Date.now()}`;
    console.log('[Connect] Creating session:', sessionId);
    
    await setSession(sessionId, siteData);
    console.log('[Connect] Session saved:', sessionId);
    
    await setIntents(sessionId, intents);
    console.log('[Connect] Intents saved:', sessionId, intents.length);
    
    await setThemeColors(sessionId, themeColors);
    console.log('[Connect] Theme colors saved:', sessionId);
    
    // Verify session was saved
    const verifySession = await getSession(sessionId);
    console.log('[Connect] Session verification:', verifySession ? '✅ Saved successfully' : '❌ Failed to save');
    
    return res.json({
      sessionId,
      siteName,
      heroData,
      intents,
      themeColors,
      siteData,
      message: "Connected successfully"
    });
  } catch (error: any) {
    console.error("Connection error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/generate-page - Generate a specific page
app.post("/api/generate-page", async (req, res) => {
  try {
    const { sessionId, intentId, dataPath } = req.body;
    
    console.log('[Generate Page] Request received:', { sessionId, intentId, dataPath });
    
    if (!sessionId || !intentId || !dataPath) {
      console.log('[Generate Page] Missing fields:', { sessionId: !!sessionId, intentId: !!intentId, dataPath: !!dataPath });
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    console.log('[Generate Page] Fetching session:', sessionId);
    const siteData = await getSession(sessionId);
    console.log('[Generate Page] Session fetch result:', siteData ? 'Found' : 'Not found');
    
    if (!siteData) {
      console.error('[Generate Page] Session not found for:', sessionId);
      return res.status(404).json({ error: "Session not found", sessionId });
    }
    
    const existingPage = await getPage(intentId);
    if (existingPage) {
      return res.json({
        success: true,
        intentId,
        hash: `#${intentId}`,
        message: "Page already generated"
      });
    }
    
    let relevantData = extractDataByPath(siteData, dataPath);
    
    if (!relevantData || (typeof relevantData === 'object' && Object.keys(relevantData).length === 0)) {
      const pathParts = dataPath.split(',')[0].split(/[\.\[\]]/).filter(Boolean);
      if (pathParts.length > 0) {
        pathParts.pop();
        const parentPath = pathParts.join('.');
        if (parentPath) {
          relevantData = extractDataByPath(siteData, parentPath);
        }
      }
      
      if (!relevantData || (typeof relevantData === 'object' && Object.keys(relevantData).length === 0)) {
        relevantData = siteData;
      }
    }
    
    const siteName = siteData.entries?.navbar?.logo_text || 
                     siteData.config?.title || 
                     "Website";
    
    const storedIntents = await getIntents(sessionId);
    const intent = storedIntents.find((i: any) => i.id === intentId);
    const intentTitle = intent?.title || intentId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const intentDescription = intent?.description || '';
    
    const themeColors = await getThemeColors(sessionId);
    
    const pageHtml = await generatePageForIntent(
      intentTitle,
      intentDescription,
      {
        ...relevantData,
        _context: {
          siteName,
          intentTitle,
          intentDescription,
          fullSiteData: siteData
        }
      },
      siteName,
      themeColors,
      intentId
    );
    
    await storePage(intentId, pageHtml);
    
    return res.json({
      success: true,
      intentId,
      hash: `#${intentId}`,
      message: "Page generated successfully"
    });
  } catch (error: any) {
    console.error("Page generation error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/page-status/:intentId - Check if page is generated
app.get("/api/page-status/:intentId", async (req, res) => {
  try {
    const { intentId } = req.params;
    const pageHtml = await getPage(intentId);
    return res.json({ generated: !!pageHtml });
  } catch (error: any) {
    console.error("Error checking page status:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/regenerate-page", async (req, res) => {
  try {
    const { sessionId, intentId, dataPath } = req.body;
    
    if (!sessionId || !intentId || !dataPath) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const siteData = await getSession(sessionId);
    if (!siteData) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    let relevantData = extractDataByPath(siteData, dataPath);
    
    if (!relevantData || (typeof relevantData === 'object' && Object.keys(relevantData).length === 0)) {
      const pathParts = dataPath.split(',')[0].split(/[\.\[\]]/).filter(Boolean);
      if (pathParts.length > 0) {
        pathParts.pop();
        const parentPath = pathParts.join('.');
        if (parentPath) {
          relevantData = extractDataByPath(siteData, parentPath);
        }
      }
      
      if (!relevantData || (typeof relevantData === 'object' && Object.keys(relevantData).length === 0)) {
        relevantData = siteData;
      }
    }
    
    const siteName = siteData.entries?.navbar?.logo_text || 
                     siteData.config?.title || 
                     "Website";
    
    const storedIntents = await getIntents(sessionId);
    const intent = storedIntents.find((i: any) => i.id === intentId);
    const intentTitle = intent?.title || intentId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const intentDescription = intent?.description || '';
    
    const themeColors = await getThemeColors(sessionId);
    
    const pageHtml = await generatePageForIntent(
      intentTitle,
      intentDescription,
      {
        ...relevantData,
        _context: {
          siteName,
          intentTitle,
          intentDescription,
          fullSiteData: siteData
        }
      },
      siteName,
      themeColors,
      intentId
    );
    
    await storePage(intentId, pageHtml);
    
    return res.json({
      success: true,
      intentId,
      hash: `#${intentId}`,
      message: "Page regenerated successfully"
    });
  } catch (error: any) {
    console.error("Page regeneration error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/session/:sessionId - Check if session exists and get session data
app.get("/api/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('[Get Session] Request for:', sessionId);
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    console.log('[Get Session] Fetching from storage:', sessionId);
    const siteData = await getSession(sessionId);
    console.log('[Get Session] Result:', siteData ? 'Found' : 'Not found');
    
    if (!siteData) {
      console.error('[Get Session] Session not found:', sessionId);
      return res.status(404).json({ error: "Session not found", sessionId });
    }
    
    const intents = await getIntents(sessionId);
    const themeColors = await getThemeColors(sessionId);
    const siteName = siteData.entries?.navbar?.logo_text || 
                     siteData.config?.title || 
                     "Website";
    const heroData = extractHeroData(siteData);
    
    return res.json({
      success: true,
      sessionId,
      siteName,
      heroData,
      intents,
      themeColors,
      message: "Session is active"
    });
  } catch (error: any) {
    console.error("Session check error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/disconnect", async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    await clearSession(sessionId);
    await clearAllPages();
    
    return res.json({
      success: true,
      message: "Disconnected successfully"
    });
  } catch (error: any) {
    console.error("Disconnect error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-detail-page", async (req, res) => {
  try {
    const { sessionId, intentId, itemId, itemData } = req.body;
    
    if (!sessionId || !intentId || !itemId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const siteData = await getSession(sessionId);
    if (!siteData) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const detailPageId = `${intentId}-detail-${itemId}`;
    
    const existingPage = await getPage(detailPageId);
    if (existingPage) {
      return res.json({
        success: true,
        detailPageId,
        hash: `#${detailPageId}`,
        message: "Detail page already generated"
      });
    }
    
    const siteName = siteData.entries?.navbar?.logo_text || 
                     siteData.config?.title || 
                     "Website";
    
    const storedIntents = await getIntents(sessionId);
    const intent = storedIntents.find((i: any) => i.id === intentId);
    const intentTitle = intent?.title || intentId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const dataPath = intent?.dataPath || '';
    
    let finalItemData = itemData;
    if (!finalItemData || (typeof finalItemData === 'object' && Object.keys(finalItemData).length === 0)) {
      let relevantData = extractDataByPath(siteData, dataPath);
      
      console.log(`[Detail Page] Searching for itemId: "${itemId}" in dataPath: "${dataPath}"`);
      console.log(`[Detail Page] Relevant data type: ${Array.isArray(relevantData) ? 'array' : typeof relevantData}`);
      
      if (!relevantData || typeof relevantData !== 'object' || (typeof relevantData === 'string')) {
        console.log(`[Detail Page] dataPath points to wrong type (${typeof relevantData}), searching parent structure...`);
        
        const pathParts = dataPath.split(/[\.\[\]]/).filter(Boolean);
        if (pathParts.length > 0) {
          for (let removeCount = 1; removeCount <= 3 && pathParts.length > removeCount; removeCount++) {
            const parentPath = pathParts.slice(0, -removeCount).join('.');
            if (parentPath) {
              const parentData = extractDataByPath(siteData, parentPath);
              if (parentData && typeof parentData === 'object' && (Array.isArray(parentData) || Object.keys(parentData).length > 0)) {
                console.log(`[Detail Page] Found parent structure at: "${parentPath}"`);
                relevantData = parentData;
                break;
              }
            }
          }
        }
        
        if (!relevantData || typeof relevantData !== 'object' || (typeof relevantData === 'string')) {
          const commonPaths = [
            'entries.featured_dishes',
            'entries.dishes',
            'entries.menu',
            'entries.items',
            'entries.properties',
            'entries.projects',
            'entries.experience',
            'entries.internships',
            'pages[0].sitesections',
            'pages[0].sitesections[1]',
            'pages[0].sitesections[1].featured_dishes',
            'pages[0].sitesections[1].dishes'
          ];
          
          for (const commonPath of commonPaths) {
            const testData = extractDataByPath(siteData, commonPath);
            if (testData && typeof testData === 'object' && (Array.isArray(testData) || Object.keys(testData).length > 0)) {
              console.log(`[Detail Page] Found data at common path: "${commonPath}"`);
              relevantData = testData;
              break;
            }
          }
        }
      }
      
      if (Array.isArray(relevantData)) {
        console.log(`[Detail Page] Array length: ${relevantData.length}`);
      } else if (relevantData && typeof relevantData === 'object') {
        console.log(`[Detail Page] Object keys:`, Object.keys(relevantData).slice(0, 10));
      }
      
      function findItemInData(data: any, searchId: string, depth: number = 0): any {
        if (depth > 10) return null;
        if (!data || typeof data !== 'object') return null;
        
        const normalizedSearchId = searchId.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ').trim();
        
        if (Array.isArray(data)) {
          const numericIndex = parseInt(searchId);
          if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < data.length) {
            return data[numericIndex];
          }
          
          // Search each item in the array
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (item && typeof item === 'object') {
              // Check multiple identifier fields
              const identifiers = [
                item.id, item._id, item.slug, item.name, item.title, 
                item.property_id, item.project_id, item.skill_name,
                item.internship_name, item.experience_name, item.company_name,
                item.role, item.position, item.job_title
              ].filter(Boolean);
              
              const indexAsString = String(i);
              if (indexAsString === searchId || indexAsString === normalizedSearchId) {
                return item;
              }
              
              for (const identifier of identifiers) {
                const idStr = String(identifier);
                const normalizedIdentifier = idStr.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ').trim();
                
                // Try exact match (case insensitive)
                if (idStr.toLowerCase() === searchId.toLowerCase()) {
                  console.log(`[Detail Page] Found item by exact match: ${idStr}`);
                  return item;
                }
                
                if (normalizedIdentifier === normalizedSearchId) {
                  console.log(`[Detail Page] Found item by normalized match: ${idStr} === ${searchId}`);
                  return item;
                }
                
                // Try partial match (searchId might be part of identifier)
                if (normalizedIdentifier.includes(normalizedSearchId) || normalizedSearchId.includes(normalizedIdentifier)) {
                  console.log(`[Detail Page] Found item by partial match: ${idStr} contains ${searchId}`);
                  return item;
                }
              }
              
              const found = findItemInData(item, searchId, depth + 1);
              if (found) return found;
            }
          }
        } else {
          // Check if this object matches
          const identifiers = [
            data.id, data._id, data.slug, data.name, data.title, 
            data.property_id, data.project_id, data.skill_name,
            data.internship_name, data.experience_name, data.company_name,
            data.role, data.position, data.job_title
          ].filter(Boolean);
          
          for (const identifier of identifiers) {
            const idStr = String(identifier);
            const normalizedIdentifier = idStr.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ').trim();
            
            if (idStr.toLowerCase() === searchId.toLowerCase()) {
              return data;
            }
            if (normalizedIdentifier === normalizedSearchId) {
              return data;
            }
            if (normalizedIdentifier.includes(normalizedSearchId) || normalizedSearchId.includes(normalizedIdentifier)) {
              return data;
            }
          }
          
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && value !== null) {
              const found = findItemInData(value, searchId, depth + 1);
              if (found) return found;
            }
          }
        }
        
        return null;
      }
      
      // Try multiple search strategies
      finalItemData = findItemInData(relevantData, itemId);
      
      // If not found and relevantData is a string/primitive, search parent sections
      if (!finalItemData && (typeof relevantData === 'string' || typeof relevantData !== 'object')) {
        console.log(`[Detail Page] relevantData is ${typeof relevantData}, searching parent section...`);
        
        // Try to find dishes/items in the parent section
        const pathParts = dataPath.split(/[\.\[\]]/).filter(Boolean);
        // Try to find parent section (remove last 1-2 parts)
        for (let removeCount = 1; removeCount <= 2 && pathParts.length > removeCount; removeCount++) {
          const parentPath = pathParts.slice(0, -removeCount).join('.');
          if (parentPath) {
            const parentSection = extractDataByPath(siteData, parentPath);
            if (parentSection && typeof parentSection === 'object') {
              const possibleArrays = ['featured_dishes', 'dishes', 'items', 'menu_items', 'products', 'list'];
              for (const arrayKey of possibleArrays) {
                if (parentSection[arrayKey] && Array.isArray(parentSection[arrayKey])) {
                  console.log(`[Detail Page] Found array "${arrayKey}" in parent section`);
                  const found = findItemInData(parentSection[arrayKey], itemId);
                  if (found) {
                    finalItemData = found;
                    break;
                  }
                }
              }
              if (finalItemData) break;
              
              // Also search the section itself
              const found = findItemInData(parentSection, itemId);
              if (found) {
                finalItemData = found;
                break;
              }
            }
          }
        }
      }
      
      if (!finalItemData) {
        console.log(`[Detail Page] Not found in relevantData, searching full siteData...`);
        finalItemData = findItemInData(siteData, itemId);
      }
      
      if (!finalItemData && Array.isArray(relevantData) && relevantData.length > 0) {
        console.log(`[Detail Page] Item not found, but relevantData is array with ${relevantData.length} items. Using first item as fallback.`);
        finalItemData = relevantData[0];
      }
      
      if (!finalItemData && relevantData && typeof relevantData === 'object' && !Array.isArray(relevantData)) {
        console.log(`[Detail Page] Item not found, using relevantData object as fallback.`);
        finalItemData = relevantData;
      }
      
      if (!finalItemData) {
        console.error(`[Detail Page] Item not found. itemId: "${itemId}", dataPath: "${dataPath}"`);
        console.error(`[Detail Page] Relevant data type: ${typeof relevantData}`);
        if (relevantData && typeof relevantData === 'object') {
          console.error(`[Detail Page] Relevant data keys:`, Object.keys(relevantData).slice(0, 10));
        }
        return res.status(404).json({ 
          error: `Item not found in data. Searched for: "${itemId}" in path: "${dataPath}". Please check the item identifier.` 
        });
      }
      
      console.log(`[Detail Page] Found item! Keys:`, Object.keys(finalItemData).slice(0, 10));
    }
    
    // Extract item title from finalItemData
    const itemTitle = finalItemData.title || finalItemData.name || finalItemData.property_title || finalItemData.project_name || finalItemData.skill_name || itemId;
    
    // Get theme colors
    const themeColors = await getThemeColors(sessionId);
    
    // Generate detail page HTML
    const detailPageHtml = await generateDetailPageForItem(
      intentTitle,
      itemTitle,
      {
        ...finalItemData,
        _context: {
          siteName,
          intentTitle,
          fullSiteData: siteData // Include full siteData for additional context
        }
      },
      siteName,
      themeColors,
      intentId // Pass intentId for back link
    );
    
    // Store the detail page
    await storePage(detailPageId, detailPageHtml);
    
    return res.json({
      success: true,
      detailPageId,
      hash: `#${detailPageId}`,
      message: "Detail page generated successfully"
    });
  } catch (error: any) {
    console.error("Detail page generation error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/page/:intentId", async (req, res) => {
  try {
    const { intentId } = req.params;
    
    const pageHtml = await getPage(intentId);
    
    if (!pageHtml) {
      return res.status(404).json({ error: "Page not found" });
    }
    
    return res.json({ html: pageHtml });
  } catch (error: any) {
    console.error("Error fetching page:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Diagnostic endpoint to check Redis setup
app.get("/api/debug/kv-status", async (req, res) => {
  try {
    const envVars = {
      REDIS_URL: process.env.REDIS_URL ? '✅ Set' : '❌ Not set',
    };
    
    // Test Redis connection if available
    let redisTest = 'Not tested';
    if (process.env.REDIS_URL) {
      try {
        const Redis = require('ioredis');
        const testClient = new Redis(process.env.REDIS_URL);
        await testClient.ping();
        redisTest = '✅ Connected';
        testClient.disconnect();
      } catch (err: any) {
        redisTest = `❌ Failed: ${err.message}`;
      }
    }
    
    return res.json({
      environment: process.env.NODE_ENV || 'development',
      vercel: !!process.env.VERCEL,
      envVars: envVars,
      usingRedis: !!process.env.REDIS_URL,
      redisTest: redisTest,
      message: 'REDIS_URL is used for Vercel Redis storage'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

let frontendPath: string;
if (process.env.VERCEL) {
  frontendPath = path.join(process.cwd(), "frontend");
} else {
  frontendPath = path.join(__dirname, "../../frontend");
}

// Serve static files from frontend (but only for non-API routes)
app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  express.static(frontendPath)(req, res, next);
});

// Catch-all route for frontend (SPA routing) - must be last
// Only match non-API routes
app.get("*", (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: "API route not found", path: req.path });
  }
  
  const indexPath = path.join(frontendPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error sending index.html:", err);
      res.status(404).json({ error: "Frontend file not found" });
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

