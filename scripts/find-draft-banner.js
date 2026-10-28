const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      search(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.toLowerCase().includes('pending draft') || 
          content.toLowerCase().includes('continue where you left off') ||
          content.toLowerCase().includes('resume work') ||
          content.toLowerCase().includes('unsaved working draft')) {
        console.log('Found match in:', full);
      }
    }
  }
}

search('src');
