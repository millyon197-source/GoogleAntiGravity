import fs from 'fs';
const v = fs.readFileSync('src/viewer.js', 'utf8');
const lines = v.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('loadModuleMesh') || l.includes('dae_hash_table') || l.includes('part_main') || l.includes('oneDockOffset') || l.includes('harbor_02')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
