import fs from 'fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import { getModuleCategory } from '../../src/modules.js';
import { createDaeAssetIndex } from '../../packages/catalog/src/index.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

// Usage: node tools/diagnostics/audit_all_module_snap_points.js [--part-main-only]
//   --part-main-only  measure against part_main alone (the audit's behaviour before all hull parts were loaded)
const PART_MAIN_ONLY = process.argv.includes('--part-main-only');

const assetIndex = createDaeAssetIndex(DAE_HASH_TABLE);
const allMacros = Object.keys(SNAP_POINTS_DB);
const componentOffsets = JSON.parse(fs.readFileSync('src/component-offsets.json', 'utf8'));

// Parts that are not solid hull: effects, animated pieces, lights, decals, signs, shadow casters and
// invisible helpers (trigger zones, bounding boxes, character dummies, collision meshes).
const NON_HULL_PART = /^(fx|anim)|decal|light|billboard|^ads|sign|shadow|trigger|bounding|dummy|collision/;

/**
 * Hull vertices of a module in the viewer's module frame, placed the way adapter-three's
 * loadModuleMesh places them: each default part at its component-offsets.json position/rotation,
 * all inside a group at (-x, y, z) of the part_main offset. Uses the pre-converted <part>-lod0.bin
 * geometry; parts without it are listed in `skipped`. Returns null when part_main is unavailable.
 */
function loadHullVertices(macro) {
  const { baseName, folderPath, defaultFiles } = assetIndex.resolveModuleAssetEntry(macro);
  if (!folderPath) return null;
  const [ox, oy, oz] = partMainOffsets[baseName] || [0, 0, 0];
  const files = PART_MAIN_ONLY ? ['part_main-lod0.dae'] : defaultFiles;
  const chunks = [];
  const used = [];
  const skipped = [];
  for (const file of files) {
    const partBase = file.replace(/-lod\d+\.dae$/i, '').toLowerCase();
    if (partBase !== 'part_main' && NON_HULL_PART.test(partBase)) continue;
    const jsonPath = `.${folderPath}/${file.replace(/\.dae$/i, '.json')}`;
    const binPath = jsonPath.replace(/\.json$/, '.bin');
    if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) { skipped.push(partBase); continue; }
    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const buf = fs.readFileSync(binPath);
    const stride = meta.vertexStrideBytes / 4;
    const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * stride);

    // Same lookup as loadModuleMesh (including its hab_arg_l_01 fallback)
    let off = componentOffsets[baseName]?.[partBase];
    if (!off && folderPath.toLowerCase().includes('hab_arg_l_01')) off = componentOffsets.hab_arg_l_01?.[partBase];
    const pos = Array.isArray(off) ? off.slice(0, 3) : off?.position || [0, 0, 0];
    const quat = Array.isArray(off) ? (off.length >= 7 ? off.slice(3, 7) : [0, 0, 0, 1]) : off?.quaternion || [0, 0, 0, 1];
    const [qx, qy, qz, qw] = quat;

    const out = new Float64Array(meta.vertexCount * 3);
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride], vy = floats[i * stride + 1], vz = floats[i * stride + 2];
      // rotate by the quaternion: v + 2w(q x v) + 2 q x (q x v)
      const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
      out[i * 3] = vx + qw * tx + (qy * tz - qz * ty) + pos[0] - ox;
      out[i * 3 + 1] = vy + qw * ty + (qz * tx - qx * tz) + pos[1] + oy;
      out[i * 3 + 2] = vz + qw * tz + (qx * ty - qy * tx) + pos[2] + oz;
    }
    chunks.push({ out, structural: partBase === 'part_main' });
    used.push(partBase);
  }
  if (!used.includes('part_main')) return null;
  const total = chunks.reduce((n, c) => n + c.out.length, 0);
  const pts = new Float64Array(total);
  // 1 for part_main vertices (used for the collar sample), 0 for every other hull part
  const structural = new Uint8Array(total / 3);
  let at = 0;
  for (const c of chunks) {
    pts.set(c.out, at);
    if (c.structural) structural.fill(1, at / 3, (at + c.out.length) / 3);
    at += c.out.length;
  }
  return { pts, structural, folderPath, used, skipped };
}

let hullPartsUsed = 0;
let hullPartsWithoutGeometry = 0;

/**
 * Reads snap connections from the module's game component file (<folder>/<name>.xml next to
 * <name>_data). A connection faces along its local +Z rotated by its offset quaternion (identity
 * when the quaternion is omitted). Tags are a space-separated list: "snap" marks a module docking
 * snap; "room_snap" marks where a room (e.g. room_gen_venturerroom_01) attaches inside another
 * structure, which has no docking collar.
 * Returns Map<connectionName, { facing: [x, y, z], isRoomSnap: boolean }> in X4 component space,
 * or null if the file is missing.
 */
function readComponentSnapFacings(folderPath) {
  const file = '.' + folderPath.replace(/_data$/, '') + '.xml';
  if (!fs.existsSync(file)) return null;
  const xml = fs.readFileSync(file, 'utf8');
  const snaps = new Map();
  for (const [, name, attrs, body] of xml.matchAll(/<connection name="([^"]+)"([^>]*)>([\s\S]*?)<\/connection>/g)) {
    const tags = ((attrs.match(/tags="([^"]*)"/) || [])[1] || '').split(/\s+/);
    const isSnap = tags.includes('snap');
    const isRoomSnap = tags.includes('room_snap') && !isSnap;
    if (!isSnap && !isRoomSnap) continue;
    const q = body.match(/<quaternion qx="([-\d.Ee]+)" qy="([-\d.Ee]+)" qz="([-\d.Ee]+)" qw="([-\d.Ee]+)"/);
    const [x, y, z, w] = q ? q.slice(1).map(Number) : [0, 0, 0, 1];
    snaps.set(name, { facing: [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)], isRoomSnap });
  }
  return snaps;
}

let roomSnaps = 0;

let facingFromGame = 0;
let facingFallback = 0;

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
  const hull = loadHullVertices(macro);
  if (!hull) {
    noMeshCount++;
    continue;
  }
  const { pts, structural } = hull;
  const vertexCount = pts.length / 3;

  const snaps = getModuleSnapPoints(macro);
  if (!snaps || snaps.length === 0) continue;
  const snapFacings = readComponentSnapFacings(hull.folderPath);
  hullPartsUsed += hull.used.length;
  hullPartsWithoutGeometry += hull.skipped.length;

  auditedModules++;
  const category = getModuleCategory(macro);
  if (!categoryStats[category]) {
    categoryStats[category] = { modules: 0, snaps: 0, onHull: 0, collars: 0, centered: 0 };
  }
  categoryStats[category].modules++;

  // Hull vertices are already in the viewer's module frame (see loadHullVertices); snap dots are
  // placed at (-x, y, z) of their DB position, as viewer.buildModuleSnapPoints does.

  // Compute mesh bounds in the module frame
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const vx = pts[i * 3];
    const vy = pts[i * 3 + 1];
    const vz = pts[i * 3 + 2];
    minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
    minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
    minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
  }

  for (const snap of snaps) {
    totalSnapsAudited++;
    categoryStats[category].snaps++;

    // Snap dot exactly where the viewer draws it
    const dotX = -snap.pos[0];
    const dotY = snap.pos[1];
    const dotZ = snap.pos[2];
    let closestDist = Infinity;
    for (let i = 0; i < vertexCount; i++) {
      const d = Math.hypot(pts[i * 3] - dotX, pts[i * 3 + 1] - dotY, pts[i * 3 + 2] - dotZ);
      if (d < closestDist) closestDist = d;
    }

    // Identify collar vertices in a sphere of radius 60m around the snap point. Only part_main
    // counts: adding the other hull parts (detail_* add-ons, part_main_techcubes, ...) skews the
    // sample's centre and flagged 14 well-placed collars. The hull check above uses every part.
    let collarVerts = [];
    for (let i = 0; i < vertexCount; i++) {
      if (!structural[i]) continue;
      const vx = pts[i * 3];
      const vy = pts[i * 3 + 1];
      const vz = pts[i * 3 + 2];

      const dist = Math.hypot(vx - dotX, vy - dotY, vz - dotZ);
      if (dist <= 60) {
        collarVerts.push([vx, vy, vz]);
      }
    }

    // A collar connection has a circular or polygonal flange of vertices.
    // Room attachment points ("room_snap") are not docking collars, so they skip the collar check.
    const gameSnap = snapFacings?.get(snap.name);
    const isRoomSnap = !!gameSnap?.isRoomSnap;
    if (isRoomSnap) roomSnaps++;
    const isNearCollar = !isRoomSnap && collarVerts.length >= 16;
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

      // Connection axis: the snap's real facing from the game component file, mapped into the
      // viewer frame like positions are (-x, y, z). Without component data (e.g. Terran modules
      // whose XML is not extracted), fall back to the snap position's dominant coordinate.
      const gameFacing = gameSnap?.facing;
      let axis;
      if (gameFacing) {
        axis = [-gameFacing[0], gameFacing[1], gameFacing[2]];
        facingFromGame++;
      } else {
        const abs = [Math.abs(dotX), Math.abs(dotY), Math.abs(dotZ)];
        const dominant = abs.indexOf(Math.max(...abs));
        axis = [0, 0, 0];
        axis[dominant] = 1;
        facingFallback++;
      }

      // Transverse centering: distance from the collar centre to the line through the snap along its axis
      const rel = [collarCenter[0] - dotX, collarCenter[1] - dotY, collarCenter[2] - dotZ];
      const along = rel[0] * axis[0] + rel[1] * axis[1] + rel[2] * axis[2];
      const transverseOffset = Math.hypot(rel[0] - along * axis[0], rel[1] - along * axis[1], rel[2] - along * axis[2]);

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
      isOnOutsideHull,
      isRoomSnap
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
console.log(`Collar Axis From Game Data:    ${facingFromGame} / ${facingFromGame + facingFallback} (rest: dominant-coordinate fallback, no component XML)`);
console.log(`Room Attachment Snaps:         ${roomSnaps} (tagged room_snap; attach rooms inside structures, no collar check)`);
console.log(PART_MAIN_ONLY
  ? 'Hull Geometry:                 part_main only (--part-main-only)'
  : `Hull Geometry:                 ${hullPartsUsed} hull parts measured; ${hullPartsWithoutGeometry} skipped (no converted .bin geometry)`);

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
