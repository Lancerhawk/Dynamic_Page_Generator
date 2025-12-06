const path = require('path');

// Check if ioredis is available before loading server
console.log('[API Init] Checking dependencies...');
try {
  const ioredis = require('ioredis');
  console.log('[API Init] ✅ ioredis is available');
} catch (err) {
  console.error('[API Init] ❌ ioredis NOT available:', err.message);
  console.error('[API Init] This will cause Redis connection to fail!');
  console.error('[API Init] Make sure ioredis is in api/package.json dependencies');
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