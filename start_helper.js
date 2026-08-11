const { execSync, spawn } = require('child_process');
const path = require('path');

const projectDir = 'C:\\Users\\leido\\AppData\\Roaming\\TRAE SOLO CN\\ModularData\\ai-agent\\work-mode-projects\\6a745750a04e5bc65d92b6a3';

try {
  // Check if node_modules exists
  const fs = require('fs');
  const nodeModulesPath = path.join(projectDir, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('Installing dependencies...');
    execSync('npm install', { cwd: projectDir, stdio: 'inherit' });
    console.log('Dependencies installed!');
  } else {
    console.log('Dependencies already installed.');
  }
  
  // Start server
  console.log('Starting server...');
  const server = spawn('node', ['server.js'], { cwd: projectDir, stdio: 'inherit' });
  
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
  
  // Keep the script running
  process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
  });
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
