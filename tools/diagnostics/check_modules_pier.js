import fs from 'fs';
const m = fs.readFileSync('src/modules.js', 'utf8');
const lines = m.split('\n');
lines.forEach((l, idx) => {
  if (l.toLowerCase().includes('pier')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
