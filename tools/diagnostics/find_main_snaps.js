import fs from 'fs';
const v = fs.readFileSync('src/main.js', 'utf8');
const lines = v.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('snap') || l.includes('Snap')) {
    console.log(`Line ${idx+1}: ${l.slice(0, 100)}`);
  }
});
