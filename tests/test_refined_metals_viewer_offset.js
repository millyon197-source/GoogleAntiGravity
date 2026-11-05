import fs from 'fs';
import { getModuleSnapPoints } from '../src/snap-points-db.js';

console.log('[*] Testing Refined Metals snap points centering at lowest Y mesh parts...');

const partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const baseKey = 'prod_gen_refinedmetals';
const macro = 'prod_gen_refinedmetals_macro';
const partOffset = partMainOffsets[baseKey]; // [-63.88318, -140.9294, 27.99579]

const snaps = getModuleSnapPoints(macro, null, true);

let allCentered = true;

for (const snap of snaps) {
  const dotPos = snap.pos; // Direct viewer position for Refined Metals

  let minDist = Infinity;
  let closestMeshV = null;
  const nearbyVerts = [];

  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride] + partOffset[0];
    const vy = floats[i * stride + 1] + partOffset[1];
    const vz = floats[i * stride + 2] + partOffset[2];

    const d = Math.hypot(vx - dotPos[0], vy - dotPos[1], vz - dotPos[2]);
    if (d < minDist) {
      minDist = d;
      closestMeshV = [vx, vy, vz];
    }
    if (d <= 75.0) {
      nearbyVerts.push([vx, vy, vz]);
    }
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const v of nearbyVerts) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
  }

  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;

  const dx = Math.abs(dotPos[0] - midX);
  const dy = Math.abs(dotPos[1] - minY);
  const dz = Math.abs(dotPos[2] - midZ);

  console.log(`[OK] Snap ${snap.name}: [${dotPos.join(', ')}]`);
  console.log(`     Closest mesh vertex: [${closestMeshV.map(n => n.toFixed(2)).join(', ')}] (dist: ${minDist.toFixed(2)}m)`);
  console.log(`     Offset from part midpoint: dx=${dx.toFixed(2)}m, dy=${dy.toFixed(2)}m, dz=${dz.toFixed(2)}m`);

  // Verify that snap is at the lowest Y of the mesh (-400m)
  if (Math.abs(dotPos[1] - (-400.0)) > 1.0) {
    console.error(`[FAIL] Snap Y ${dotPos[1]} does not match lowest Y (-400m)!`);
    allCentered = false;
  }

  // Verify that snap is centered on that part of the mesh in X and Z (< 10m)
  if (dx > 10.0 || dz > 10.0) {
    console.error(`[FAIL] Snap is not centered on mesh part: dx=${dx.toFixed(2)}, dz=${dz.toFixed(2)}`);
    allCentered = false;
  }
}

if (allCentered) {
  console.log('[SUCCESS] Refined Metals snap points are centered at lowest Y on both mesh mounting parts!');
  process.exit(0);
} else {
  console.error('[FAIL] Centering check failed.');
  process.exit(1);
}
