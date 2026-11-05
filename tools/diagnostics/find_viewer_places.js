import fs from 'fs';
const v = fs.readFileSync('src/viewer.js', 'utf8');
const lines = v.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('computeModuleGroupRotation') || l.includes('addModuleToScene') || l.includes('loadPlan')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
