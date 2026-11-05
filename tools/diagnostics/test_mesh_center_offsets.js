import path from 'path';
import fs from 'fs';

const hashTablePath = path.resolve(process.cwd(), 'dae_hash_table.json');
const DAE_HASH_TABLE = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

console.log('[*] Inspecting DAE Mesh Local Offsets across macro categories...');

const sampleMacros = [
  'pier_arg_harbor_03',
  'pier_tel_harbor_01',
  'prod_gen_water',
  'buildmodule_arg_equip_l',
  'storage_arg_l_container_01',
  'defence_arg_disc_01',
  'hab_arg_l_01'
];

sampleMacros.forEach(macroKey => {
  let found = false;
  DAE_HASH_TABLE.forEach(bucket => {
    bucket.forEach(item => {
      if (item.key === macroKey) {
        found = true;
        console.log(`\nMacro: ${macroKey}`);
        console.log(`  Folder: ${item.folder_path}`);
        console.log(`  Files (${item.files.length}):`, item.files);
      }
    });
  });
  if (!found) {
    console.log(`\nMacro ${macroKey} not found in hash table`);
  }
});
