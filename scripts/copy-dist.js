const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../backend/dist');
const destDir = path.join(__dirname, '../api/backend-dist');

// Remove destination if it exists
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

// Create destination directory
fs.mkdirSync(destDir, { recursive: true });

// Copy all files
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(sourceDir, destDir);
console.log('Copied backend/dist to api/backend-dist');
