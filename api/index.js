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
} catch (error) {
  console.error('Failed to load server:', error);
  console.error('Error stack:', error.stack);
  throw error;
}

// Export the Express app directly - Vercel's @vercel/node handles it
module.exports = app;