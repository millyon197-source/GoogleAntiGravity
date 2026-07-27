import fs from 'fs';

const hashTablePath = './dae_hash_table.json';
const table = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

let totalEntries = 0;
let modifiedEntriesCount = 0;
let lod1RemovedCount = 0;

table.forEach(bucket => {
  bucket.forEach(entry => {
    totalEntries++;
    const files = entry.files || [];
    const hasLod0 = files.some(f => f.toLowerCase() === 'part_main-lod0.dae');
    const hasLod1 = files.some(f => f.toLowerCase() === 'part_main-lod1.dae');

    if (hasLod0 && hasLod1) {
      modifiedEntriesCount++;
      const initialLen = entry.files.length;
      // Remove any part_main-lod1.dae from the files array
      entry.files = entry.files.filter(f => f.toLowerCase() !== 'part_main-lod1.dae');
      lod1RemovedCount += (initialLen - entry.files.length);
    }
  });
});

// Save updated dae_hash_table.json
fs.writeFileSync(hashTablePath, JSON.stringify(table, null, 2), 'utf8');

console.log('====================================================');
console.log('[UPDATE COMPLETE] dae_hash_table.json LOD Optimization');
console.log('====================================================');
console.log(`- Total Key Entries Processed: ${totalEntries}`);
console.log(`- Total Key Entries Modified: ${modifiedEntriesCount}`);
console.log(`- Total part_main-lod1.dae Filename Instances Removed: ${lod1RemovedCount}`);
console.log('====================================================');
