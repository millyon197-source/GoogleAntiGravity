import fs from 'fs';
const v = fs.readFileSync('src/viewer.js', 'utf8');
const lines = v.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('findNearestSnapPoint') || l.includes('snapTo') || l.includes('snapModule') || l.includes('snapPoints') || l.includes('snap_')) {
    if (idx < 500 || idx > 2000 && idx < 3500) {
      console.log(`Line ${idx+1}: ${l.trim()}`);
    }
  }
});
