import fs from 'fs';
import path from 'path';

// Import DAE_HASH_TABLE
const hashTablePath = path.resolve(process.cwd(), 'dae_hash_table.json');
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

const xmlPath = 'tests/fixtures/Planar - Paranid.xml';
console.log('[*] Reading plan file:', xmlPath);

if (!fs.existsSync(xmlPath)) {
  console.error('[!] Plan file not found at:', xmlPath);
  process.exit(1);
}

const xmlContent = fs.readFileSync(xmlPath, 'utf8');

const entryRegex = /<entry\s+([^>]+)>/g;
const attrRegex = /(\w+)="([^"]*)"/g;

const modules = [];
let match;
while ((match = entryRegex.exec(xmlContent)) !== null) {
  const attrStr = match[1];
  const attrs = {};
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }
  if (attrs.macro) {
    modules.push({
      index: parseInt(attrs.index || (modules.length + 1), 10),
      macro: attrs.macro,
      connection: attrs.connection || ''
    });
  }
}

console.log(`[*] Parsed ${modules.length} modules from plan.`);

const factions = ['arg', 'par', 'tel', 'spl', 'ter', 'bor', 'xen', 'kha', 'pir'];
const prefixes = ['prod_', 'buildmodule_'];

let successCount = 0;
const rootDir = process.cwd();

for (const mod of modules) {
  let baseName = mod.macro.replace('_macro', '').toLowerCase();
  const origBaseName = baseName;

  let urls = lookupDaeUrls(baseName);

  if (urls.length === 0) {
    let foundGen = false;
    for (const pref of prefixes) {
      if (foundGen) break;
      if (baseName.startsWith(pref)) {
        for (const fac of factions) {
          const prefix = `${pref}${fac}_`;
          if (baseName.startsWith(prefix)) {
            const genName = baseName.replace(prefix, `${pref}gen_`);
            const genUrls = lookupDaeUrls(genName);
            if (genUrls.length > 0) {
              baseName = genName;
              urls = genUrls;
              foundGen = true;
              break;
            }
          }
        }
      }
    }
  }

  if (urls.length === 0) {
    console.error(`\n[FAIL] Module index #${mod.index} (${mod.macro}): No DAE entry found in lookupDaeUrls for baseName "${baseName}" (orig: "${origBaseName}")`);
    console.error('[STOPPING] Stopped execution on first loading failure.');
    process.exit(1);
  }

  // Check if at least one DAE file exists on disk
  let fileFound = false;
  const missingFiles = [];

  for (const url of urls) {
    const localFilePath = path.join(rootDir, url.replace(/\//g, '\\'));
    if (fs.existsSync(localFilePath)) {
      fileFound = true;
    } else {
      missingFiles.push(localFilePath);
    }
  }

  if (!fileFound) {
    console.error(`\n[FAIL] Module index #${mod.index} (${mod.macro}): DAE lookup entries found for "${baseName}", but NONE of the files exist on disk:`);
    missingFiles.forEach(f => console.error(`  - Missing: ${f}`));
    console.error('[STOPPING] Stopped execution on first loading failure.');
    process.exit(1);
  }

  successCount++;
  console.log(`[OK] Module #${mod.index} (${mod.macro}) -> ${baseName} (${urls.length} DAE files resolved)`);
}

console.log(`\n========================================`);
console.log(`[SUCCESS] All ${successCount} modules were successfully validated and their mesh assets exist!`);
