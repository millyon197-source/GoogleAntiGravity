import fs from 'fs';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const daeEntries = DAE_HASH_TABLE.flat();

const testMacros = [
  'struct_arg_cross_01_macro',
  'storage_arg_l_container_01_macro',
  'prod_gen_advancedelectronics_macro',
  'dockarea_arg_m_station_01_hightech_macro',
  'pier_arg_harbor_01_macro',
  'pier_arg_harbor_02_macro',
  'pier_arg_harbor_03_macro',
  'defence_arg_tube_01_macro',
  'hab_arg_l_01_macro'
];

for (const macro of testMacros) {
  const baseKey = macro.replace('_macro', '');
  const entry = daeEntries.find(e => e.key === baseKey || e.key === macro);
  if (!entry) continue;
  const folder = '.' + entry.folder_path;
  const jsonPath = folder + '/part_main-lod0.json';
  const binPath = folder + '/part_main-lod0.bin';
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) continue;

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  const snaps = SNAP_POINTS_DB[macro] || [];
  console.log('=== ' + macro + ' ===');
  for (const s of snaps) {
    const rawPos = s.pos;
    let minDistP1 = Infinity, minDistP2 = Infinity, minDistP3 = Infinity, minDistP4 = Infinity;
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride];
      const vy = floats[i * stride + 1];
      const vz = floats[i * stride + 2];
      
      const d1 = Math.hypot(vx - rawPos[0], vy - rawPos[1], vz - rawPos[2]);
      const d2 = Math.hypot(vx - (-rawPos[0]), vy - rawPos[1], vz - (-rawPos[2]));
      const d3 = Math.hypot(vx - rawPos[0], vy - rawPos[1], vz - (-rawPos[2]));
      const d4 = Math.hypot(vx - (-rawPos[0]), vy - rawPos[1], vz - rawPos[2]);
      
      minDistP1 = Math.min(minDistP1, d1);
      minDistP2 = Math.min(minDistP2, d2);
      minDistP3 = Math.min(minDistP3, d3);
      minDistP4 = Math.min(minDistP4, d4);
    }
    console.log(`  ${s.name} DB:[${rawPos.join(',')}] -> Dist: P1(x,y,z)=${minDistP1.toFixed(2)}m, P2(-x,y,-z)=${minDistP2.toFixed(2)}m, P3(x,y,-z)=${minDistP3.toFixed(2)}m, P4(-x,y,z)=${minDistP4.toFixed(2)}m`);
  }
}
