const path = require('path');

let app;
try {
  const serverPath = path.join(__dirname, '../backend/dist/server');
  console.log('Loading server from:', serverPath);
  app = require(serverPath);
  console.log('Server loaded successfully');
  
  // Verify app is an Express app
  if (!app || typeof app !== 'function') {
    throw new Error('Server export is not a function. Got: ' + typeof app);
  }
  
  // Log that app is ready
  console.log('Express app ready, type:', typeof app);
} catch (error) {
  console.error('Failed to load server:', error);
  console.error('Error stack:', error.stack);
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