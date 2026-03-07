const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');

fs.readdirSync(logDir)
  .filter(f => f.endsWith('.log'))
  .forEach(file => {
    const filePath = path.join(logDir, file);
    fs.truncateSync(filePath, 0);
    console.log(`Cleared: ${file}`);
  });

console.log('Done.');