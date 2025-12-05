const path = require('path');

let app;
try {
  const serverPath = path.join(__dirname, '../backend/dist/server');
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