import fs from 'fs';
import path from 'path';

/**
 * generate_dae_hash_table.js
 *
 * Scans assets1/structures for all module folders ending in _data,
 * populates the 1223-bucket MurmurHash3 table with all visual LOD0
 * component mesh files (including anim_*-lod0.dae, part_*-lod0.dae,
 * detail_*-lod0.dae, and fx_*-lod0.dae), and saves dae_hash_table.json.
 */

const HASH_TABLE_SIZE = 1223;
const STRUCTURES_DIR = path.resolve('assets1/structures');
const OUTPUT_PATH = path.resolve('dae_hash_table.json');

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
  h1 = Math.imul(h1, 0x85ebca6b) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function findDataDirs(dir) {
  let res = [];
  try {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name.endsWith('_data')) {
          res.push(full);
        } else {
          res = res.concat(findDataDirs(full));
        }
      }
    }
  } catch (_) {}
  return res;
}

export function generateDaeHashTable() {
  console.log('[*] Scanning for module directories in:', STRUCTURES_DIR);
  const dataDirs = findDataDirs(STRUCTURES_DIR).sort();
  console.log(`[+] Found ${dataDirs.length} module asset folders.`);

  const buckets = Array.from({ length: HASH_TABLE_SIZE }, () => []);

  let totalEntries = 0;
  let totalFiles = 0;
  let totalAnimFiles = 0;

  for (const dirPath of dataDirs) {
    const folderName = path.basename(dirPath);
    const key = folderName.replace(/_data$/, '');
    const relFolder = path.relative(path.resolve('.'), dirPath).replace(/\\/g, '/');
    const folder_path = relFolder.startsWith('/') ? relFolder : `/${relFolder}`;

    // Collect visual LOD0 mesh files including anim, part, detail, and fx
    const files = fs.readdirSync(dirPath).filter(file => {
      const lower = file.toLowerCase();
      if (!lower.endsWith('.dae')) return false;
      if (lower.includes('collision') || lower.includes('wreck')) return false;
      if (/-lod[123]\.dae$/.test(lower)) return false;
      return lower.includes('-lod0.dae');
    }).sort();

    if (files.length === 0) continue;

    const hash = murmur3_32(key);
    const bucketIndex = hash % HASH_TABLE_SIZE;

    buckets[bucketIndex].push({
      key,
      hash,
      folder_path,
      files
    });

    totalEntries++;
    totalFiles += files.length;
    totalAnimFiles += files.filter(f => f.startsWith('anim_')).length;
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(buckets, null, 2), 'utf8');

  console.log('====================================================');
  console.log('[COMPLETE] dae_hash_table.json Generation');
  console.log('====================================================');
  console.log(`- Total Hash Table Buckets: ${HASH_TABLE_SIZE}`);
  console.log(`- Total Key Entries Mapped: ${totalEntries}`);
  console.log(`- Total Visual LOD0 DAE Files: ${totalFiles}`);
  console.log(`- Total Anim LOD0 DAE Files Included: ${totalAnimFiles}`);
  console.log(`- Saved Output: ${OUTPUT_PATH}`);
  console.log('====================================================');
}

// Execute directly if run via CLI
if (process.argv[1] && process.argv[1].endsWith('generate_dae_hash_table.js')) {
  generateDaeHashTable();
}
