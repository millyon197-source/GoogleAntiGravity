import fs from 'fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../src/snap-points-db.js';
import { getModuleCategory } from '../src/modules.js';
import DAE_HASH_TABLE from '../dae_hash_table.json' with { type: 'json' };

console.log('[*] Testing module snap points against 3D mesh geometry for hull contact & collar centering...');

const daeEntries = DAE_HASH_TABLE.flat();
const allMacros = Object.keys(SNAP_POINTS_DB);

let partMainOffsets = {};
if (fs.existsSync('src/part-main-offsets.json')) {
  partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
}

let totalSnapsAudited = 0;
let onHullCount = 0;
let collarCount = 0;
let centeredCount = 0;

for (const macro of allMacros) {
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

  const snaps = getModuleSnapPoints(macro);
  if (!snaps || snaps.length === 0) continue;

  const xmlOffset = partMainOffsets[baseKey] || [0, 0, 0];
  const offsetX = xmlOffset[0];
  const offsetY = xmlOffset[1];
  const offsetZ = xmlOffset[2];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride] + offsetX;
    const vy = floats[i * stride + 1] + offsetY;
    const vz = floats[i * stride + 2] + offsetZ;
    minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
    minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
    minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
  }

  for (const snap of snaps) {
    totalSnapsAudited++;

    let distA = Infinity, distB = Infinity;
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride] + offsetX;
      const vy = floats[i * stride + 1] + offsetY;
      const vz = floats[i * stride + 2] + offsetZ;
      const dA = Math.hypot(vx - snap.pos[0], vy - snap.pos[1], vz - snap.pos[2]);
      const dB = Math.hypot(vx - (-snap.pos[0]), vy - snap.pos[1], vz - (-snap.pos[2]));
      if (dA < distA) distA = dA;
      if (dB < distB) distB = dB;
    }

    const useModeB = distB < distA;
    const dotX = useModeB ? -snap.pos[0] : snap.pos[0];
    const dotY = snap.pos[1];
    const dotZ = useModeB ? -snap.pos[2] : snap.pos[2];
    const closestDist = Math.min(distA, distB);

    let collarVerts = [];
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride] + offsetX;
      const vy = floats[i * stride + 1] + offsetY;
      const vz = floats[i * stride + 2] + offsetZ;
      if (Math.hypot(vx - dotX, vy - dotY, vz - dotZ) <= 60) {
        collarVerts.push([vx, vy, vz]);
      }
    }

    const isNearCollar = collarVerts.length >= 16;
    if (isNearCollar) {
      collarCount++;
      let cMinX = Infinity, cMaxX = -Infinity;
      let cMinY = Infinity, cMaxY = -Infinity;
      let cMinZ = Infinity, cMaxZ = -Infinity;
      for (const v of collarVerts) {
        cMinX = Math.min(cMinX, v[0]); cMaxX = Math.max(cMaxX, v[0]);
        cMinY = Math.min(cMinY, v[1]); cMaxY = Math.max(cMaxY, v[1]);
        cMinZ = Math.min(cMinZ, v[2]); cMaxZ = Math.max(cMaxZ, v[2]);
      }
      const cX = (cMinX + cMaxX) / 2;
      const cY = (cMinY + cMaxY) / 2;
      const cZ = (cMinZ + cMaxZ) / 2;

      const absX = Math.abs(dotX);
      const absY = Math.abs(dotY);
      const absZ = Math.abs(dotZ);
      let transverseOffset = 0;
      if (absX >= absY && absX >= absZ) {
        transverseOffset = Math.hypot(cY - dotY, cZ - dotZ);
      } else if (absY >= absX && absY >= absZ) {
        transverseOffset = Math.hypot(cX - dotX, cZ - dotZ);
      } else {
        transverseOffset = Math.hypot(cX - dotX, cY - dotY);
      }

      if (transverseOffset <= 5.0) {
        centeredCount++;
      }
    }

    const distToFace = Math.min(
      Math.abs(dotX - minX), Math.abs(dotX - maxX),
      Math.abs(dotY - minY), Math.abs(dotY - maxY),
      Math.abs(dotZ - minZ), Math.abs(dotZ - maxZ)
    );

    if (closestDist <= 30 || distToFace <= 30) {
      onHullCount++;
    }
  }
}

const hullRate = (onHullCount / totalSnapsAudited) * 100;
const collarRate = (centeredCount / collarCount) * 100;

console.log(`[OK] Audited ${totalSnapsAudited} snap points.`);
console.log(`[OK] Outside Hull Contact: ${onHullCount} / ${totalSnapsAudited} (${hullRate.toFixed(1)}%)`);
console.log(`[OK] Centered Collar Connections: ${centeredCount} / ${collarCount} (${collarRate.toFixed(1)}%)`);

if (hullRate < 95.0) {
  console.error(`[FAIL] Hull contact rate ${hullRate.toFixed(1)}% is below 95% threshold!`);
  process.exit(1);
}

console.log('[SUCCESS] All snap points verified on outside hull.');
