import fs from 'fs';
import * as THREE from 'three';
import { createProceduralModule } from './src/modules.js';
import { MACRO_TO_NAME_DB } from './src/modules-cost-db.js';
import { SAMPLES } from './src/samples.js';

const DAE_HASH_TABLE = JSON.parse(fs.readFileSync('./dae_hash_table.json', 'utf8'));

// Pure JS MurmurHash3_x86_32 implementation
function murmur3_32(key, seed = 0) {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) & 0xffffffff;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
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

// 1. Parse modules from allModulesPlan
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

console.log(`Total module entries in showcase: ${modules.length}`);
const uniqueMacros = new Set(modules.map(m => m.macro));
console.log(`Unique macros: ${uniqueMacros.size}`);

// 2. Compute bounding boxes
const moduleDataList = [];
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
    }
  }

  if (!box) {
    const proc = createProceduralModule(mod.macro, THREE);
    box = new THREE.Box3().setFromObject(proc);
  }

  const size = box.getSize(new THREE.Vector3());
  moduleDataList.push({
    index: mod.index,
    key: mod.macro,
    name: mod.name,
    boundingBox: {
      size: [Number(size.x.toFixed(2)), Number(size.y.toFixed(2)), Number(size.z.toFixed(2))]
    }
  });
}

// 3. Build Double Hash Table of size 503
const TABLE_SIZE = 503;
const H2_PRIME = 499;

const hashTable = new Array(TABLE_SIZE).fill(null);
let totalCollisions = 0;
let maxProbes = 0;

for (const mod of moduleDataList) {
  const hashVal = murmur3_32(mod.key);
  const h1 = hashVal % TABLE_SIZE;
  const h2 = H2_PRIME - (hashVal % H2_PRIME);

  let placed = false;
  let probes = 0;
  for (let i = 0; i < TABLE_SIZE; i++) {
    const idx = (h1 + i * h2) % TABLE_SIZE;
    if (hashTable[idx] === null) {
      hashTable[idx] = {
        key: mod.key,
        name: mod.name,
        index: mod.index,
        hash: hashVal,
        boundingBox: mod.boundingBox
      };
      placed = true;
      probes = i;
      break;
    } else if (hashTable[idx].key === mod.key) {
      // In case of duplicate macro key, update or handle
      console.log(`Duplicate macro found: ${mod.key}`);
      placed = true;
      break;
    }
  }

  if (!placed) {
    throw new Error(`Failed to place ${mod.key} in hash table!`);
  }

  totalCollisions += probes;
  if (probes > maxProbes) maxProbes = probes;
}

// Verify all can be retrieved
for (const mod of moduleDataList) {
  const hashVal = murmur3_32(mod.key);
  const h1 = hashVal % TABLE_SIZE;
  const h2 = H2_PRIME - (hashVal % H2_PRIME);

  let found = null;
  for (let i = 0; i < TABLE_SIZE; i++) {
    const idx = (h1 + i * h2) % TABLE_SIZE;
    const entry = hashTable[idx];
    if (entry === null) break;
    if (entry.key === mod.key) {
      found = entry;
      break;
    }
  }

  if (!found) {
    throw new Error(`Verification failed for ${mod.key}!`);
  }
}

const filledSlots = hashTable.filter(x => x !== null).length;
console.log(`Hash table size: ${TABLE_SIZE}`);
console.log(`Filled slots: ${filledSlots} / ${TABLE_SIZE} (${(filledSlots / TABLE_SIZE * 100).toFixed(1)}% load factor)`);
console.log(`Empty slots: ${TABLE_SIZE - filledSlots}`);
console.log(`Total collision probes during insert: ${totalCollisions}`);
console.log(`Max probes for a single entry: ${maxProbes}`);
console.log('All 247 items verified successfully via double hashing lookup!');

// Also test bucket chaining representation just in case
const bucketTable = Array.from({ length: TABLE_SIZE }, () => []);
for (const mod of moduleDataList) {
  const hashVal = murmur3_32(mod.key);
  const idx = hashVal % TABLE_SIZE;
  bucketTable[idx].push({
    key: mod.key,
    name: mod.name,
    index: mod.index,
    hash: hashVal,
    boundingBox: mod.boundingBox
  });
}

// Write the primary double hash table to JSON file
fs.writeFileSync('module_bounds_hashtable_503.json', JSON.stringify(hashTable, null, 2), 'utf8');
console.log('Saved module_bounds_hashtable_503.json successfully.');

// Write bucket chained representation as well for flexibility
fs.writeFileSync('module_bounds_buckets_503.json', JSON.stringify(bucketTable, null, 2), 'utf8');
console.log('Saved module_bounds_buckets_503.json successfully.');
