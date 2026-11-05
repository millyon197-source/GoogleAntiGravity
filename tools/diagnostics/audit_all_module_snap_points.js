import fs from 'fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import { getOneDockPierMeshOffset, getModuleCategory } from '../../src/modules.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const daeEntries = DAE_HASH_TABLE.flat();
const allMacros = Object.keys(SNAP_POINTS_DB);

// Load component part_main offsets
let partMainOffsets = {};
if (fs.existsSync('src/part-main-offsets.json')) {
  partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
}

console.log(`[*] Starting comprehensive audit of all ${allMacros.length} module snap points against 3D mesh geometry...`);

let auditedModules = 0;
let totalSnapsAudited = 0;
let noMeshCount = 0;
let results = [];

const categoryStats = {};

for (const macro of allMacros) {
  const baseKey = macro.replace('_macro', '');
  const entry = daeEntries.find(e => e.key === baseKey || e.key === macro);
  if (!entry) {
    noMeshCount++;
    continue;
  }
  const folder = '.' + entry.folder_path;
  const jsonPath = folder + '/part_main-lod0.json';
  const binPath = folder + '/part_main-lod0.bin';
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) {
    noMeshCount++;
    continue;
  }

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  const snaps = getModuleSnapPoints(macro);
  if (!snaps || snaps.length === 0) continue;

  auditedModules++;
  const category = getModuleCategory(macro);
  if (!categoryStats[category]) {
    categoryStats[category] = { modules: 0, snaps: 0, onHull: 0, collars: 0, centered: 0 };
  }
  categoryStats[category].modules++;

  const isOneDockPier = macro.toLowerCase().includes('harbor_02');
  const oneDockOffset = isOneDockPier ? getOneDockPierMeshOffset(macro) : 0;
  const xmlOffset = partMainOffsets[baseKey] || [0, 0, 0];

  // Apply part_main offset:
  // If oneDockOffset is set, it overrides X for 1-dock pier
  const offsetX = isOneDockPier ? oneDockOffset : xmlOffset[0];
  const offsetY = xmlOffset[1];
  const offsetZ = xmlOffset[2];

  // Compute mesh bounds in component space
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
    categoryStats[category].snaps++;

    // Evaluate both un-inverted and inverted orientations to match mesh modeling frame
    // Mode A: (x, y, z)
    // Mode B: (-x, y, -z)
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

    // Identify collar vertices in a sphere of radius 60m around the snap point
    let collarVerts = [];
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride] + offsetX;
      const vy = floats[i * stride + 1] + offsetY;
      const vz = floats[i * stride + 2] + offsetZ;

      const dist = Math.hypot(vx - dotX, vy - dotY, vz - dotZ);
      if (dist <= 60) {
        collarVerts.push([vx, vy, vz]);
      }
    }

    // A collar connection has a circular or polygonal flange of vertices
    const isNearCollar = collarVerts.length >= 16;
    let collarCenter = null;
    let collarOffsetFromSnap = null;
    let isCentered = true;
    let isOnOutsideHull = true;

    if (isNearCollar) {
      categoryStats[category].collars++;
      let cMinX = Infinity, cMaxX = -Infinity;
      let cMinY = Infinity, cMaxY = -Infinity;
      let cMinZ = Infinity, cMaxZ = -Infinity;
      for (const v of collarVerts) {
        cMinX = Math.min(cMinX, v[0]); cMaxX = Math.max(cMaxX, v[0]);
        cMinY = Math.min(cMinY, v[1]); cMaxY = Math.max(cMaxY, v[1]);
        cMinZ = Math.min(cMinZ, v[2]); cMaxZ = Math.max(cMaxZ, v[2]);
      }
      collarCenter = [
        (cMinX + cMaxX) / 2,
        (cMinY + cMaxY) / 2,
        (cMinZ + cMaxZ) / 2
      ];

      // Measure transverse centering perpendicular to the connection axis:
      const absX = Math.abs(dotX);
      const absY = Math.abs(dotY);
      const absZ = Math.abs(dotZ);

      let transverseOffset = 0;
      if (absX >= absY && absX >= absZ) {
        // Normal along X: check centering in YZ plane
        transverseOffset = Math.hypot(collarCenter[1] - dotY, collarCenter[2] - dotZ);
      } else if (absY >= absX && absY >= absZ) {
        // Normal along Y: check centering in XZ plane
        transverseOffset = Math.hypot(collarCenter[0] - dotX, collarCenter[2] - dotZ);
      } else {
        // Normal along Z: check centering in XY plane
        transverseOffset = Math.hypot(collarCenter[0] - dotX, collarCenter[1] - dotY);
      }

      collarOffsetFromSnap = transverseOffset;

      // Collar centering check: The connection point should be centered in the transverse plane
      // True collars center within 5m
      if (transverseOffset > 5.0) {
        isCentered = false;
      } else {
        categoryStats[category].centered++;
      }
    }

    // Outside hull check:
    // 1. Distance to closest vertex should be within connector rim radius (<= 25m)
    // 2. Or snap point touches outer bounding hull faces
    const distToFace = Math.min(
      Math.abs(dotX - minX), Math.abs(dotX - maxX),
      Math.abs(dotY - minY), Math.abs(dotY - maxY),
      Math.abs(dotZ - minZ), Math.abs(dotZ - maxZ)
    );

    if (closestDist > 30 && distToFace > 30) {
      isOnOutsideHull = false;
    } else {
      categoryStats[category].onHull++;
    }

    results.push({
      macro,
      category,
      snapName: snap.name,
      posInDB: snap.pos,
      testedPos: [dotX, dotY, dotZ],
      closestHullDist: closestDist,
      isNearCollar,
      collarCenter,
      collarOffsetFromSnap,
      isCentered,
      isOnOutsideHull
    });
  }
}

console.log(`[OK] Audited ${auditedModules} modules (${totalSnapsAudited} snap points).`);
console.log(`[INFO] Modules without binary mesh files: ${noMeshCount}`);

// Analyze results
const outsideHullIssues = results.filter(r => !r.isOnOutsideHull);
const offCenterIssues = results.filter(r => r.isNearCollar && !r.isCentered);

console.log(`\n==================================================`);
console.log(`             COMPREHENSIVE AUDIT REPORT           `);
console.log(`==================================================`);
console.log(`Total Snap Points Tested:      ${totalSnapsAudited}`);
console.log(`Snap Points on Outside Hull:   ${totalSnapsAudited - outsideHullIssues.length} / ${totalSnapsAudited} (${((totalSnapsAudited - outsideHullIssues.length) / totalSnapsAudited * 100).toFixed(1)}%)`);
console.log(`Collar Connections Tested:     ${results.filter(r => r.isNearCollar).length}`);
console.log(`Centered Collar Connections:   ${results.filter(r => r.isNearCollar && r.isCentered).length} / ${results.filter(r => r.isNearCollar).length} (${(results.filter(r => r.isNearCollar && r.isCentered).length / results.filter(r => r.isNearCollar).length * 100).toFixed(1)}%)`);

console.log(`\n--- BREAKDOWN BY CATEGORY ---`);
for (const [cat, s] of Object.entries(categoryStats)) {
  const hullPct = s.snaps ? (s.onHull / s.snaps * 100).toFixed(1) : 0;
  const collarPct = s.collars ? (s.centered / s.collars * 100).toFixed(1) : 0;
  console.log(`  ${cat.toUpperCase().padEnd(16)}: ${s.modules} modules | Hull Contact: ${s.onHull}/${s.snaps} (${hullPct}%) | Collar Centered: ${s.centered}/${s.collars} (${collarPct}%)`);
}

if (outsideHullIssues.length > 0) {
  console.log(`\n[!] Remaining snap points not on outside hull (${outsideHullIssues.length}):`);
  outsideHullIssues.slice(0, 10).forEach(issue => {
    console.log(`  - ${issue.macro} [${issue.snapName}]: DB=[${issue.posInDB}], closestDist=${issue.closestHullDist.toFixed(1)}m`);
  });
}

if (offCenterIssues.length > 0) {
  console.log(`\n[!] Remaining off-center collar connections (${offCenterIssues.length}):`);
  offCenterIssues.slice(0, 10).forEach(issue => {
    console.log(`  - ${issue.macro} [${issue.snapName}]: DB=[${issue.posInDB}], collarOffset=${issue.collarOffsetFromSnap.toFixed(1)}m`);
  });
}

console.log(`\n==================================================\n`);
