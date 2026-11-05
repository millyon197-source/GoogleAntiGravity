import path from 'path';
import fs from 'fs';
import * as THREE from 'three';
import { createProceduralModule } from '../../src/modules.js';
import { MACRO_TO_NAME_DB } from '../../src/modules-cost-db.js';
import { SAMPLES } from '../../src/samples.js';

const DAE_HASH_TABLE = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'dae_hash_table.json'), 'utf8'));

function murmur3_32(key, seed = 0) {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  let c1 = 0xcc9e2d51;
  let c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (((h1 * 5) + 0xe6546b64)) & 0xffffffff;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);
      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function lookupDaeUrls(key) {
  const hashVal = murmur3_32(key);
  const bucketIndex = hashVal % 1223;
  const bucket = DAE_HASH_TABLE[bucketIndex] || [];
  const entry = bucket.find(item => item.key === key);
  if (!entry) return [];
  return entry.files.map(file => `${entry.folder_path}/${file}`);
}

function getMacroDaeUrls(macro) {
  let baseName = macro.replace('_macro', '').toLowerCase();
  if (baseName.startsWith('buildmodule_gen_equip_') || baseName.startsWith('buildmodule_gen_ships_')) {
    baseName = baseName.replace('buildmodule_gen_', 'buildmodule_arg_');
  }

  let urls = lookupDaeUrls(baseName);
  if (urls.length === 0) {
    const prefixes = ['prod_', 'buildmodule_', 'landmarks_'];
    let foundGen = false;
    for (const pref of prefixes) {
      if (foundGen) break;
      if (baseName.startsWith(pref)) {
        const factions = ['arg', 'par', 'tel', 'spl', 'ter', 'bor', 'xen', 'kha', 'pir'];
        for (const fac of factions) {
          const prefix = `${pref}${fac}_`;
          if (baseName.startsWith(prefix)) {
            const candidateNames = [
              baseName.replace(prefix, `${pref}gen_`),
              baseName.replace(prefix, `${pref}arg_`)
            ];
            for (const candName of candidateNames) {
              const candUrls = lookupDaeUrls(candName);
              if (candUrls.length > 0) {
                baseName = candName;
                urls = candUrls;
                foundGen = true;
                break;
              }
            }
          }
        }
      }
    }
  }
  return urls;
}

const xml = SAMPLES.allModulesPlan;
const entryRegex = /<entry\s+index="(\d+)"\s+macro="([^"]+)">/g;
let match;
const modules = [];
while ((match = entryRegex.exec(xml)) !== null) {
  modules.push({
    index: parseInt(match[1], 10),
    macro: match[2],
    name: MACRO_TO_NAME_DB[match[2]] || match[2]
  });
}

console.log(`Total modules in All Modules Showcase: ${modules.length}`);

let withDaeJson = 0;
let withProcedural = 0;
const results = [];

for (const mod of modules) {
  const urls = getMacroDaeUrls(mod.macro);
  let box = null;
  if (urls.length > 0) {
    let combinedBox = new THREE.Box3();
    let hasBox = false;
    for (const u of urls) {
      const relPath = u.startsWith('/') ? u.slice(1) : u;
      const jsonPath = relPath.replace(/\.dae$/i, '.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (data.boundingBox && data.boundingBox.min && data.boundingBox.max) {
            combinedBox.expandByPoint(new THREE.Vector3(...data.boundingBox.min));
            combinedBox.expandByPoint(new THREE.Vector3(...data.boundingBox.max));
            hasBox = true;
          }
        } catch (e) {}
      }
    }
    if (hasBox) {
      box = combinedBox;
      withDaeJson++;
    }
  }

  if (!box) {
    const proc = createProceduralModule(mod.macro, THREE);
    box = new THREE.Box3().setFromObject(proc);
    withProcedural++;
  }

  const size = box.getSize(new THREE.Vector3());
  results.push({
    index: mod.index,
    macro: mod.macro,
    name: mod.name,
    min: [Number(box.min.x.toFixed(2)), Number(box.min.y.toFixed(2)), Number(box.min.z.toFixed(2))],
    max: [Number(box.max.x.toFixed(2)), Number(box.max.y.toFixed(2)), Number(box.max.z.toFixed(2))],
    size: [Number(size.x.toFixed(2)), Number(size.y.toFixed(2)), Number(size.z.toFixed(2))]
  });
}

console.log(`Processed ${results.length} modules.`);
console.log(`With DAE JSON sidecars: ${withDaeJson}`);
console.log(`With Procedural fallback: ${withProcedural}`);
console.log('Sample result #1:', results[0]);
console.log('Sample result #247:', results[results.length - 1]);
