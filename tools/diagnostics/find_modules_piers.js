import fs from 'fs';
const m = fs.readFileSync('src/modules.js', 'utf8');
const lines = m.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('harbor') || l.includes('pier') || l.includes('dock')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
