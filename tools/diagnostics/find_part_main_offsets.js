import fs from 'fs';
import path from 'path';

function findFiles(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, filter));
    } else if (filter(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

const dirs = ['assets/structures', 'assets1/structures'];
let xmlFiles = [];
for (const d of dirs) {
  xmlFiles = xmlFiles.concat(findFiles(d, f => f.endsWith('.xml') && !f.endsWith('_macro.xml')));
}

console.log('Found component XML files:', xmlFiles.length);

const partMainOffsets = {};

for (const file of xmlFiles) {
  const baseName = path.basename(file, '.xml');
  const xml = fs.readFileSync(file, 'utf8');
  
  const connRegex = /<connection[^>]*>([\s\S]*?)<\/connection>/g;
  let match;
  while ((match = connRegex.exec(xml)) !== null) {
    const content = match[1];
    if (content.includes('name="part_main"') || content.includes("name='part_main'")) {
      // The connection offset is before <parts>
      const beforeParts = content.split('<parts>')[0];
      const offsetMatch = /<offset\s*>([\s\S]*?)<\/offset>/i.exec(beforeParts);
      if (offsetMatch) {
        const posMatch = /<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/i.exec(offsetMatch[1]);
        if (posMatch) {
          const x = parseFloat(posMatch[1]);
          const y = parseFloat(posMatch[2]);
          const z = parseFloat(posMatch[3]);
          if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01 || Math.abs(z) > 0.01) {
            partMainOffsets[baseName] = [x, y, z];
          }
        }
      }
      break;
    }
  }
}

console.log('Modules with non-zero part_main offsets:', Object.keys(partMainOffsets).length);

// This scan only covers the base-game assets. Entries for DLC modules (Split, Terran, ...) were merged
// in from the extensions folder (see merge_offsets.js, which only prints), so keep every existing entry
// and overwrite just the ones regenerated here; otherwise rerunning this would silently drop them.
const outPath = 'src/part-main-offsets.json';
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const merged = { ...existing, ...partMainOffsets };
const kept = Object.keys(existing).filter(k => !(k in partMainOffsets)).length;
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
console.log(`Wrote ${outPath} (${Object.keys(merged).length} entries; ${kept} kept from the existing file)`);
