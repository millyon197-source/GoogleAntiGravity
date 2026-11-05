import fs from 'fs';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const keys = [
  'prod_gen_refinedmetals_macro',
  'prod_arg_refinedmetals_macro',
  'prod_tel_refinedmetals_macro',
  'prod_par_refinedmetals_macro'
];

for (const k of keys) {
  console.log('=== ' + k + ' ===');
  console.log('DB entry:', SNAP_POINTS_DB[k]);
}

const daeEntries = DAE_HASH_TABLE.flat();
const entry = daeEntries.find(e => e.key === 'prod_gen_refinedmetals');
console.log('DAE entry:', entry);

const xmlPath = 'assets/structures/production/prod_gen_refinedmetals.xml';
if (fs.existsSync(xmlPath)) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const conns = xml.split(/<connection\s+/);
  console.log('\n=== XML connections in ' + xmlPath + ' ===');
  for (const c of conns) {
    if (c.includes('tags="snap') || c.includes("tags='snap") || c.includes('part_main')) {
      console.log('<connection ' + c.split('</connection>')[0].trim() + '\n</connection>');
    }
  }
}
