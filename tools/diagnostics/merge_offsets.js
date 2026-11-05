import fs from 'fs';

const extDir = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/extensions';
const baseDir = 'assets';

function scanDir(dir) {
  const map = {};
  function walk(curr) {
    try {
      for (const f of fs.readdirSync(curr, { withFileTypes: true })) {
        const full = curr + '/' + f.name;
        if (f.isDirectory()) {
          walk(full);
        } else if (f.name.endsWith('.xml') && !f.name.includes('macro')) {
          const content = fs.readFileSync(full, 'utf8');
          const conns = [...content.matchAll(/<connection\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/connection>/g)];
          for (const [_, name, body] of conns) {
            if (body.includes('name="part_main"') && !body.includes('name="part_main_wreck"')) {
              const pos = body.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
              const baseName = f.name.replace('.xml', '').toLowerCase();
              if (pos) {
                const p = [parseFloat(pos[1]), parseFloat(pos[2]), parseFloat(pos[3])];
                if (Math.abs(p[0]) > 1e-4 || Math.abs(p[1]) > 1e-4 || Math.abs(p[2]) > 1e-4) {
                  map[baseName] = p;
                }
              }
            }
          }
        }
      }
    } catch(e) {}
  }
  walk(dir);
  return map;
}

const currentOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
console.log('Current offsets count:', Object.keys(currentOffsets).length);

const extOffsets = scanDir(extDir);
console.log('Extension offsets count:', Object.keys(extOffsets).length);

let addedCount = 0;
const merged = { ...currentOffsets };
for (const [k, v] of Object.entries(extOffsets)) {
  if (!merged[k]) {
    merged[k] = v;
    addedCount++;
    console.log(`Adding ${k}:`, v);
  }
}

console.log(`Added ${addedCount} new offsets. Total: ${Object.keys(merged).length}`);
