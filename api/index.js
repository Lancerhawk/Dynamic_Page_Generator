const path = require('path');

let ioredisModule;
try {
  ioredisModule = require('ioredis');
  
  if (typeof global !== 'undefined') {
    global.ioredis = ioredisModule;
  }
  
  if (ioredisModule && typeof ioredisModule === 'function') {
    const _Redis = ioredisModule;
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
  throw err; 
}

let app;
try {
  const serverPath = path.join(__dirname, '../backend/dist/server');
  console.log('[API Init] Loading server from:', serverPath);
  app = require(serverPath);
  console.log('[API Init] Server loaded successfully');
  
  if (!app || typeof app !== 'function') {
    throw new Error('Server export is not a function. Got: ' + typeof app);
  }
  
  console.log('[API Init] Express app ready, type:', typeof app);
} catch (error) {
  console.error('[API Init] Failed to load server:', error);
  console.error('[API Init] Error stack:', error.stack);
  throw error;
}

module.exports = async (req, res) => {
  try {
    console.log(`[Vercel Handler] ${req.method} ${req.url}`, {
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl || 'none'
    });
    
    if (!app) {
      console.error('Express app not loaded!');
      return res.status(500).json({ error: 'Server not initialized' });
    }
    
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