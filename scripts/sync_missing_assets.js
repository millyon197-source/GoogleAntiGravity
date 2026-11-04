import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve('assets/structures');
const dstRoot = path.resolve('assets1/structures');

console.log('Scanning source:', srcRoot);

let totalScanned = 0;
let copiedDae = 0;
let copiedAni = 0;
let skipped = 0;

function syncDir(currentSrc, currentDst) {
  if (!fs.existsSync(currentSrc)) return;

  const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
  for (const entry of entries) {
    totalScanned++;
    const srcPath = path.join(currentSrc, entry.name);
    const dstPath = path.join(currentDst, entry.name);

    if (entry.isDirectory()) {
      syncDir(srcPath, dstPath);
    } else {
      const lower = entry.name.toLowerCase();
      // Match all .dae files and .ani files
      if (lower.endsWith('.dae') || lower.endsWith('.ani')) {
        if (!fs.existsSync(dstPath)) {
          fs.mkdirSync(currentDst, { recursive: true });
          fs.copyFileSync(srcPath, dstPath);
          if (lower.endsWith('.dae')) copiedDae++;
          if (lower.endsWith('.ani')) copiedAni++;
        } else {
          skipped++;
        }
      }
    }
  }
}

const startTime = Date.now();
syncDir(srcRoot, dstRoot);
const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('=== SYNC COMPLETED in ' + duration + 's ===');
console.log('Total entries scanned: ' + totalScanned);
console.log('Copied .dae files: ' + copiedDae);
console.log('Copied .ani files: ' + copiedAni);
console.log('Already existing (skipped): ' + skipped);
