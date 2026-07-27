import fs from 'fs';

const hashTablePath = './dae_hash_table.json';
const DAE_HASH_TABLE = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

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

const testGenMacros = [
  'buildmodule_gen_equip_l_macro',
  'buildmodule_gen_equip_xl_macro',
  'buildmodule_gen_ships_l_macro',
  'buildmodule_gen_ships_xl_macro'
];

console.log('[*] Testing buildmodule_gen_ -> _arg_ key lookup replacements:');

let allPassed = true;

for (const macro of testGenMacros) {
  let baseName = macro.replace('_macro', '').toLowerCase();

  // Apply explicit gen to arg key replacement
  if (baseName.startsWith('buildmodule_gen_equip_') || baseName.startsWith('buildmodule_gen_ships_')) {
    baseName = baseName.replace('buildmodule_gen_', 'buildmodule_arg_');
  }

  const urls = lookupDaeUrls(baseName);

  if (urls.length === 0) {
    console.error(`[FAIL] ${macro} -> ${baseName} failed to resolve URLs!`);
    allPassed = false;
  } else {
    console.log(`[OK] ${macro} successfully replaced with '${baseName}' -> (${urls.length} DAE files resolved)`);
  }
}

console.log(`\n========================================`);
if (allPassed) {
  console.log('[SUCCESS] All buildmodule_gen_ equip/ships macros successfully mapped to _arg_ lookups!');
} else {
  console.error('[FAIL] Key replacement test failed.');
  process.exit(1);
}
