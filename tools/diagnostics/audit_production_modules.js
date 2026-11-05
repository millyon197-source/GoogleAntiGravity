import fs from 'fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import { getModuleCategory } from '../../src/modules.js';
import DAE_HASH_TABLE from '../../dae_hash_table.json' with { type: 'json' };

const daeEntries = DAE_HASH_TABLE.flat();
const partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));

const prodMacros = Object.keys(SNAP_POINTS_DB).filter(m => getModuleCategory(m) === 'production');

console.log(`Auditing all ${prodMacros.length} production modules...`);

const results = [];

for (const macro of prodMacros) {
  const baseKey = macro.replace('_macro', '');
  const entry = daeEntries.find(e => e.key === baseKey || e.key === macro);
  if (!entry) {
    results.push({ macro, status: 'NO_DAE_ENTRY' });
    continue;
  }

  const folder = '.' + entry.folder_path;
  const jsonPath = folder + '/part_main-lod0.json';
  const binPath = folder + '/part_main-lod0.bin';
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) {
    results.push({ macro, status: 'NO_MESH_FILES' });
    continue;
  }

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  const snaps = getModuleSnapPoints(macro);
  if (!snaps || snaps.length === 0) {
    results.push({ macro, status: 'NO_SNAPS' });
    continue;
  }

  const xmlOffset = partMainOffsets[baseKey] || [0, 0, 0];

  const snapResults = [];

  for (const snap of snaps) {
    // Test 4 coordinate mappings with xmlOffset:
    // M1: ( vx + ox,  vy + oy,  vz + oz)  -- direct XYZ
    // M2: (-vx + ox,  vy + oy,  vz + oz)  -- X reflection (like Refined Metals)
    // M3: ( vx + ox,  vy + oy, -vz + oz)  -- Z reflection
    // M4: (-vx + ox,  vy + oy, -vz + oz)  -- 180° Y rotation (-X, -Z)
    
    let minD1 = Infinity, minD2 = Infinity, minD3 = Infinity, minD4 = Infinity;
    let closest1 = null, closest2 = null, closest3 = null, closest4 = null;

    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride];
      const vy = floats[i * stride + 1];
      const vz = floats[i * stride + 2];

      const p1 = [ vx + xmlOffset[0], vy + xmlOffset[1],  vz + xmlOffset[2]];
      const p2 = [-vx + xmlOffset[0], vy + xmlOffset[1],  vz + xmlOffset[2]];
      const p3 = [ vx + xmlOffset[0], vy + xmlOffset[1], -vz + xmlOffset[2]];
      const p4 = [-vx + xmlOffset[0], vy + xmlOffset[1], -vz + xmlOffset[2]];

      const d1 = Math.hypot(p1[0] - snap.pos[0], p1[1] - snap.pos[1], p1[2] - snap.pos[2]);
      const d2 = Math.hypot(p2[0] - snap.pos[0], p2[1] - snap.pos[1], p2[2] - snap.pos[2]);
      const d3 = Math.hypot(p3[0] - snap.pos[0], p3[1] - snap.pos[1], p3[2] - snap.pos[2]);
      const d4 = Math.hypot(p4[0] - snap.pos[0], p4[1] - snap.pos[1], p4[2] - snap.pos[2]);

      if (d1 < minD1) { minD1 = d1; closest1 = p1; }
      if (d2 < minD2) { minD2 = d2; closest2 = p2; }
      if (d3 < minD3) { minD3 = d3; closest3 = p3; }
      if (d4 < minD4) { minD4 = d4; closest4 = p4; }
    }

    const minAll = Math.min(minD1, minD2, minD3, minD4);
    let bestMode = 'M1(XYZ)';
    let bestClosest = closest1;
    if (minAll === minD2) { bestMode = 'M2(-X)'; bestClosest = closest2; }
    else if (minAll === minD3) { bestMode = 'M3(-Z)'; bestClosest = closest3; }
    else if (minAll === minD4) { bestMode = 'M4(-X,-Z)'; bestClosest = closest4; }

    snapResults.push({
      snapName: snap.name,
      pos: snap.pos,
      minD1: minD1.toFixed(2),
      minD2: minD2.toFixed(2),
      minD3: minD3.toFixed(2),
      minD4: minD4.toFixed(2),
      bestMode,
      minDist: minAll.toFixed(2),
      closestPoint: bestClosest.map(n => Math.round(n * 10) / 10)
    });
  }

  results.push({
    macro,
    baseKey,
    xmlOffset,
    snaps: snapResults
  });
}

// Filter modules where any snap point has minDist > 20m
const problematic = results.filter(r => r.snaps && r.snaps.some(s => parseFloat(s.minDist) > 20));

console.log(`\nAudited ${results.length} production modules.`);
console.log(`Modules with all snap points touching hull (<= 20m): ${results.length - problematic.length}`);
console.log(`Modules with snap points > 20m: ${problematic.length}`);

for (const p of problematic) {
  console.log(`\n=== ${p.macro} ===`);
  console.log('xmlOffset:', p.xmlOffset);
  for (const s of p.snaps) {
    console.log(`  ${s.snapName} pos=[${s.pos}] -> Best: ${s.bestMode} dist=${s.minDist}m closest=[${s.closestPoint}] (D1_XYZ=${s.minD1}m, D2_-X=${s.minD2}m, D3_-Z=${s.minD3}m, D4_-X-Z=${s.minD4}m)`);
  }
}
