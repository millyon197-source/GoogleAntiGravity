import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

console.log('--- Step 1: Copying missing DAE/ANI from nested assets/assets ---');
const nestedLandmarks = 'assets/assets/structures/landmarks';
if (fs.existsSync(nestedLandmarks)) {
  let copiedDae = 0;
  function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);
      if (item.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (['.dae', '.ani'].includes(ext)) {
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            copiedDae++;
          }
        }
      }
    }
  }
  copyRecursive(nestedLandmarks, 'assets1/structures/landmarks');
  console.log(`Copied ${copiedDae} missing DAE/ANI landmark files.`);
}

console.log('--- Step 2: Copying component XML files to assets1/structures ---');
let copiedXml = 0;
function copyXmlFiles(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyXmlFiles(srcPath, destPath);
    } else if (item.name.endsWith('.xml') && !item.name.endsWith('.sig')) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        copiedXml++;
      }
    }
  }
}
copyXmlFiles('assets/structures', 'assets1/structures');
console.log(`Copied ${copiedXml} component XML files.`);

console.log('--- Step 3: Copying libraries to assets1/libraries ---');
if (fs.existsSync('assets/libraries')) {
  if (!fs.existsSync('assets1/libraries')) fs.mkdirSync('assets1/libraries', { recursive: true });
  for (const item of fs.readdirSync('assets/libraries')) {
    const srcPath = path.join('assets/libraries', item);
    const destPath = path.join('assets1/libraries', item);
    if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('--- Step 4: Decompressing station .gz textures into .dds in assets1/textures ---');
const stationFolders = [
  'generic',
  'argon',
  'paranid',
  'teladi',
  'terran',
  'split',
  'natural',
  'paint',
  'ad_signs',
  'fx'
];

let decompressedCount = 0;
let skippedCount = 0;

for (const folder of stationFolders) {
  const dir = path.join('assets1/textures', folder);
  if (!fs.existsSync(dir)) continue;

  function decompressInDir(d) {
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) {
        decompressInDir(full);
      } else if (item.name.endsWith('.gz') && !item.name.endsWith('.sig') && !item.name.includes('-small')) {
        const ddsName = item.name.replace(/\.gz$/i, '.dds');
        const ddsPath = path.join(d, ddsName);
        if (!fs.existsSync(ddsPath)) {
          try {
            const gzBuf = fs.readFileSync(full);
            const decomp = zlib.gunzipSync(gzBuf);
            fs.writeFileSync(ddsPath, decomp);
            decompressedCount++;
          } catch (err) {
            console.error(`Failed decompressing ${full}: ${err.message}`);
          }
        } else {
          skippedCount++;
        }
      }
    }
  }

  decompressInDir(dir);
}

console.log(`Decompressed ${decompressedCount} station .dds texture files (${skippedCount} already existed).`);
console.log('Done!');
