import fs from 'fs';

const hashTablePath = './dae_hash_table.json';
const table = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

let totalEntries = 0;
let affectedCount = 0;
const affectedEntries = [];

table.forEach(bucket => {
  bucket.forEach(entry => {
    totalEntries++;
    const files = entry.files || [];
    const hasLod0 = files.some(f => f.toLowerCase() === 'part_main-lod0.dae');
    const hasLod1 = files.some(f => f.toLowerCase() === 'part_main-lod1.dae');

    if (hasLod0 && hasLod1) {
      affectedCount++;
      affectedEntries.push({
        key: entry.key,
        folder_path: entry.folder_path,
        filesCount: files.length
      });
    }
  });
});

console.log('====================================================');
console.log('[AUDIT REPORT] dae_hash_table.json LOD Optimization');
console.log('====================================================');
console.log(`- Total Key Entries Scanned: ${totalEntries}`);
console.log(`- Affected Entries (containing BOTH lod0 AND lod1): ${affectedCount}`);
console.log('\nList of Affected Key Entries:');

affectedEntries.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.key}] (${item.folder_path}) - total files: ${item.filesCount}`);
});

console.log('\n====================================================');
console.log(`Count of affected entries: ${affectedCount}`);
console.log('====================================================');
