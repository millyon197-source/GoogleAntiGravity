import fs from 'fs';
import * as THREE from 'three';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';

const races = ['arg', 'par', 'tel', 'spl', 'ter'];

for (const r of races) {
  const macro = `pier_${r}_harbor_02`;
  const jsonPath = `assets1/structures/dock/${macro}_data/part_main-lod0.json`;
  const binPath = `assets1/structures/dock/${macro}_data/part_main-lod0.bin`;
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) continue;

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride];
    minX = Math.min(minX, vx);
    maxX = Math.max(maxX, vx);
  }

  const snaps = SNAP_POINTS_DB[macro] || SNAP_POINTS_DB[macro + '_macro'];
  const snap004 = snaps.find(s => s.name.toLowerCase() === 'connectionsnap004' || s.name.toLowerCase() === 'con_snap_01');

  console.log(`\n=== ${macro} ===`);
  console.log(`  Raw X range: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
  console.log(`  Station snap:`, snap004);
}
