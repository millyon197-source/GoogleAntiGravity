import fs from 'fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const daeEntries = DAE_HASH_TABLE.flat();
const partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));

// The production modules to detail
const testModules = [
  'prod_gen_refinedmetals_macro',
  'prod_gen_fieldcoils_macro',
  'prod_gen_energycells_macro',
  'prod_gen_quantumtubes_macro',
  'prod_gen_advancedcomposites_macro',
  'prod_arg_foodrations_macro',
  'prod_gen_antimattercells_macro',
  'prod_gen_dronecomponents_macro',
  'prod_gen_medicalsupplies_macro',
  'prod_tel_swampplants_macro'
];

console.log('=== DETAILED PRODUCTION MODULE SNAP POINT AUDIT ===\n');

for (const macro of testModules) {
  const baseKey = macro.replace('_macro', '');
  const entry = daeEntries.find(e => e.key === baseKey);
  if (!entry) continue;

  const folder = '.' + entry.folder_path;
  const jsonPath = folder + '/part_main-lod0.json';
  const binPath = folder + '/part_main-lod0.bin';
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) continue;

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  const snaps = getModuleSnapPoints(macro);
  const xmlOffset = partMainOffsets[baseKey] || [0, 0, 0];

  console.log(`Module: ${baseKey}`);
  console.log(`  XML part_main offset: [${xmlOffset.join(', ')}]`);
  console.log(`  Mesh bounds (raw): X=[${meta.boundingBox.min[0].toFixed(1)}, ${meta.boundingBox.max[0].toFixed(1)}], Y=[${meta.boundingBox.min[1].toFixed(1)}, ${meta.boundingBox.max[1].toFixed(1)}], Z=[${meta.boundingBox.min[2].toFixed(1)}, ${meta.boundingBox.max[2].toFixed(1)}]`);

  for (const s of snaps) {
    // Check distance in component space with offset
    let minD = Infinity;
    let closestV = null;

    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = -floats[i * stride] + xmlOffset[0];
      const vy = floats[i * stride + 1] + xmlOffset[1];
      const vz = floats[i * stride + 2] + xmlOffset[2];
      const d = Math.hypot(vx - s.pos[0], vy - s.pos[1], vz - s.pos[2]);
      if (d < minD) {
        minD = d;
        closestV = [vx, vy, vz];
      }
    }
    console.log(`  Snap ${s.name.padEnd(20)} DB/XML=[${s.pos.join(', ')}] -> Dist to hull: ${minD.toFixed(2)}m (closest mesh vertex: [${closestV.map(n => n.toFixed(1)).join(', ')}])`);
  }
  console.log('');
}
