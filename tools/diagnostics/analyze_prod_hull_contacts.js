import fs from 'fs';

const data = JSON.parse(fs.readFileSync('tools/diagnostics/production_modules_analysis.json', 'utf8'));

console.log('=== PRODUCTION MODULES HULL CONTACT & SNAP POINTS ANALYSIS ===\n');

for (const mod of data) {
  if (!mod.hasBin) {
    console.log(`[SKIP] ${mod.baseKey}: No binary mesh available.`);
    continue;
  }

  // Compare XML snaps vs DB snaps
  const xmlSnapCount = mod.xmlSnaps.length;
  const dbSnapCount = mod.dbSnaps ? mod.dbSnaps.length : 0;

  const bbox = mod.meshBBox;
  const offset = mod.partMainOffset;

  // Compute mesh bounds with offset applied
  const compBounds = {
    minX: bbox.min[0] + offset[0],
    maxX: bbox.max[0] + offset[0],
    minY: bbox.min[1] + offset[1],
    maxY: bbox.max[1] + offset[1],
    minZ: bbox.min[2] + offset[2],
    maxZ: bbox.max[2] + offset[2]
  };

  // Also reflected X bounds
  const compBoundsReflX = {
    minX: -bbox.max[0] + offset[0],
    maxX: -bbox.min[0] + offset[0],
    minY: compBounds.minY,
    maxY: compBounds.maxY,
    minZ: compBounds.minZ,
    maxZ: compBounds.maxZ
  };

  let hasIssue = false;
  const snapReports = [];

  for (const snap of mod.xmlSnaps) {
    const p = snap.pos;
    // Check distance to bounds faces
    const distFaceY = Math.min(Math.abs(p[1] - compBounds.minY), Math.abs(p[1] - compBounds.maxY));
    const distFaceX = Math.min(Math.abs(p[0] - compBoundsReflX.minX), Math.abs(p[0] - compBoundsReflX.maxX));
    const distFaceZ = Math.min(Math.abs(p[2] - compBounds.minZ), Math.abs(p[2] - compBounds.maxZ));

    const minFaceDist = Math.min(distFaceX, distFaceY, distFaceZ);

    let status = 'ON_HULL';
    if (minFaceDist > 25) {
      status = 'NO_HULL_CONTACT';
      hasIssue = true;
    }

    snapReports.push({
      name: snap.name,
      xmlPos: p,
      dbPos: mod.dbSnaps ? (mod.dbSnaps.find(s => s.name === snap.name)?.pos || 'MISSING') : 'NO_DB',
      minFaceDist: minFaceDist.toFixed(1),
      status
    });
  }

  if (hasIssue || xmlSnapCount !== dbSnapCount) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Module: ${mod.baseKey} (${mod.macroKey})`);
    console.log(`  part_main offset in XML: [${offset.join(', ')}]`);
    console.log(`  Mesh bounds (raw): X=[${bbox.min[0]}, ${bbox.max[0]}], Y=[${bbox.min[1]}, ${bbox.max[1]}], Z=[${bbox.min[2]}, ${bbox.max[2]}]`);
    console.log(`  Mesh bounds (offset + reflX): X=[${compBoundsReflX.minX.toFixed(1)}, ${compBoundsReflX.maxX.toFixed(1)}], Y=[${compBounds.minY.toFixed(1)}, ${compBounds.maxY.toFixed(1)}], Z=[${compBounds.minZ.toFixed(1)}, ${compBounds.maxZ.toFixed(1)}]`);
    for (const r of snapReports) {
      console.log(`  Snap ${r.name.padEnd(20)} XML=[${r.xmlPos}] DB=[${r.dbPos}] -> status: ${r.status} (dist to face: ${r.minFaceDist}m)`);
    }
  }
}
