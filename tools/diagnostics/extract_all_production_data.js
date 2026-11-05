import fs from 'fs';
import path from 'path';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import { getModuleCategory } from '../../src/modules.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const daeEntries = DAE_HASH_TABLE.flat();

// Find all component XMLs in assets/structures/production
const prodXmlDir = 'assets/structures/production';
const xmlFiles = fs.readdirSync(prodXmlDir).filter(f => f.endsWith('.xml') && !f.endsWith('_macro.xml') && !f.endsWith('.sig'));

console.log(`Found ${xmlFiles.length} production component XML files in ${prodXmlDir}.`);

const prodModulesData = [];

for (const xmlFile of xmlFiles) {
  const baseKey = path.basename(xmlFile, '.xml');
  const macroKey = baseKey + '_macro';

  const xmlContent = fs.readFileSync(path.join(prodXmlDir, xmlFile), 'utf8');

  // Extract part_main offset and size
  let partMainOffset = [0, 0, 0];
  let partMainSize = null;
  let partMainCenter = null;

  const conns = xmlContent.split(/<connection\s+/);
  for (const c of conns) {
    if (c.includes('name="part_main"') || c.includes("name='part_main'")) {
      const beforeParts = c.split('<parts>')[0];
      const offsetMatch = /<offset\s*>([\s\S]*?)<\/offset>/i.exec(beforeParts);
      if (offsetMatch) {
        const posMatch = /<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/i.exec(offsetMatch[1]);
        if (posMatch) {
          partMainOffset = [parseFloat(posMatch[1]), parseFloat(posMatch[2]), parseFloat(posMatch[3])];
        }
      }
      const sizeMatch = c.match(/<size>[\s\S]*?<max\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"[\s\S]*?<center\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
      if (sizeMatch) {
        partMainSize = [parseFloat(sizeMatch[1]), parseFloat(sizeMatch[2]), parseFloat(sizeMatch[3])];
        partMainCenter = [parseFloat(sizeMatch[4]), parseFloat(sizeMatch[5]), parseFloat(sizeMatch[6])];
      }
      break;
    }
  }

  // Extract XML snap connections
  const xmlSnaps = [];
  for (const c of conns) {
    if (c.includes('tags="snap') || c.includes("tags='snap")) {
      const nameMatch = c.match(/name="([^"]+)"/);
      const posMatch = c.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
      const quatMatch = c.match(/<quaternion\s+qx="([^"]+)"\s+qy="([^"]+)"\s+qz="([^"]+)"\s+qw="([^"]+)"/);
      const snapName = nameMatch ? nameMatch[1] : 'unnamed';
      const pos = posMatch ? [parseFloat(posMatch[1]), parseFloat(posMatch[2]), parseFloat(posMatch[3])] : [0, 0, 0];
      const quat = quatMatch ? [parseFloat(quatMatch[1]), parseFloat(quatMatch[2]), parseFloat(quatMatch[3]), parseFloat(quatMatch[4])] : null;
      xmlSnaps.push({ name: snapName, pos, quat });
    }
  }

  // Find DAE entry and mesh JSON
  const entry = daeEntries.find(e => e.key === baseKey || e.key === macroKey);
  let meshBBox = null;
  let hasBin = false;
  if (entry) {
    const jsonPath = '.' + entry.folder_path + '/part_main-lod0.json';
    const binPath = '.' + entry.folder_path + '/part_main-lod0.bin';
    if (fs.existsSync(jsonPath) && fs.existsSync(binPath)) {
      hasBin = true;
      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      meshBBox = meta.boundingBox;
    }
  }

  const dbSnaps = SNAP_POINTS_DB[macroKey] || SNAP_POINTS_DB[baseKey] || null;

  prodModulesData.push({
    baseKey,
    macroKey,
    hasBin,
    partMainOffset,
    partMainSize,
    partMainCenter,
    meshBBox,
    xmlSnaps,
    dbSnaps
  });
}

console.log(`Processed ${prodModulesData.length} production modules.`);
fs.writeFileSync('tools/diagnostics/production_modules_analysis.json', JSON.stringify(prodModulesData, null, 2), 'utf8');
console.log('Saved to tools/diagnostics/production_modules_analysis.json');
