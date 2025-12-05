const path = require('path');
const fs = require('fs');

let app;
try {
  // Try to load from api/backend-dist first (for Vercel), then fall back to ../backend/dist
  let serverPath;
  const apiDistPath = path.join(__dirname, 'backend-dist/server');
  const backendDistPath = path.join(__dirname, '../backend/dist/server');
  
  if (fs.existsSync(apiDistPath + '.js')) {
    serverPath = apiDistPath;
    console.log('Loading server from api/backend-dist (Vercel build)');
  } else if (fs.existsSync(backendDistPath + '.js')) {
    serverPath = backendDistPath;
    console.log('Loading server from ../backend/dist (local dev)');
  } else {
    throw new Error(`Server file not found. Checked: ${apiDistPath}.js and ${backendDistPath}.js`);
  }
  
  console.log('Loading server from:', serverPath);
  console.log('Current directory:', process.cwd());
  console.log('__dirname:', __dirname);
  app = require(serverPath);
  console.log('Server loaded successfully');
} catch (error) {
  console.error('Failed to load server:', error);
  console.error('Error stack:', error.stack);
  throw error;
}

module.exports = async (req, res) => {
  try {
    if (!app) {
      throw new Error('Express app not loaded');
    }
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};