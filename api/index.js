const path = require('path');

// CRITICAL: Require and USE ioredis so Vercel's bundler includes it
// Vercel's @vercel/node only bundles dependencies that are actually used
// We also make it globally available so backend/dist code can access it
let ioredisModule;
try {
  ioredisModule = require('ioredis');
  
  // Make it available globally so backend/dist code can access it
  // This is needed because Vercel bundles dependencies, and backend/dist requires it
  if (typeof global !== 'undefined') {
    global.ioredis = ioredisModule;
  }
  
  // Actually USE it (not just require) so Vercel's bundler includes it
  // Create a dummy instance to prevent tree-shaking
  if (ioredisModule && typeof ioredisModule === 'function') {
    // Just reference the constructor to ensure bundler includes it
    const _Redis = ioredisModule;
    // This ensures the module is actually used, not just required
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Init] ioredis constructor available:', typeof _Redis);
    }
  }
  
  console.log('[API Init] ✅ ioredis required, used, and made available globally');
  console.log('[API Init] ioredis type:', typeof ioredisModule);
} catch (err) {
  console.error('[API Init] ❌ ioredis NOT available:', err.message);
  console.error('[API Init] Error stack:', err.stack);
  console.error('[API Init] This will cause Redis connection to fail!');
  console.error('[API Init] Make sure ioredis is in api/package.json dependencies');
  throw err; // Throw here so deployment fails if ioredis is missing
}

let app;
try {
  const serverPath = path.join(__dirname, '../backend/dist/server');
  console.log('[API Init] Loading server from:', serverPath);
  app = require(serverPath);
  console.log('[API Init] Server loaded successfully');
  
  // Verify app is an Express app
  if (!app || typeof app !== 'function') {
    throw new Error('Server export is not a function. Got: ' + typeof app);
  }
  
  // Log that app is ready
  console.log('[API Init] Express app ready, type:', typeof app);
} catch (error) {
  console.error('[API Init] Failed to load server:', error);
  console.error('[API Init] Error stack:', error.stack);
  throw error;
}

// Export as a handler function for Vercel
// Vercel's @vercel/node can handle Express apps directly, but we'll wrap it to be safe
module.exports = async (req, res) => {
  try {
    // Log incoming request for debugging
    console.log(`[Vercel Handler] ${req.method} ${req.url}`, {
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl || 'none'
    });
    
    // Ensure app is loaded
    if (!app) {
      console.error('Express app not loaded!');
      return res.status(500).json({ error: 'Server not initialized' });
    }
    
    // Call the Express app
    return app(req, res);
  } catch (error) {
    console.error('[Vercel Handler] Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};