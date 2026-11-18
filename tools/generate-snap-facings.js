/**
 * Builds the snap-point hull normals (src/snap-facings.json) from the game's component XML.
 *
 * Each snap connection in a component file carries a quaternion; its facing (the rotated +Z axis,
 * see readComponentSnaps) is the hull normal at that snap. The table maps every module in
 * SNAP_POINTS_DB to { snapName: [x, y, z] } in X4 component space, rounded to 3 decimals. The
 * viewer mirrors X like it does for positions (-x, y, z) and turns it with the module.
 *
 *   node tools/generate-snap-facings.js            report only
 *   node tools/generate-snap-facings.js --write    write src/snap-facings.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SNAP_POINTS_DB } from '../packages/catalog/src/snap-points-db.js';
import { indexGameFiles, findComponentFile, readComponentSnaps } from './snap-game-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const WRITE = process.argv.includes('--write');
const OUT = path.join(root, 'src/snap-facings.json');

const files = indexGameFiles('assets1');
if (files.components.size === 0) {
  console.error('[FAIL] No game component files under assets1/');
  process.exit(1);
}
const r3 = (n) => Math.round(n * 1000) / 1000 || 0;
const table = {};
let modules = 0, snaps = 0, vertical = 0;
const missing = [];
for (const macro of Object.keys(SNAP_POINTS_DB).sort()) {
  const { componentFile } = findComponentFile(files, macro);
  const game = componentFile ? readComponentSnaps(componentFile) : null;
  if (!game) { missing.push(macro); continue; }
  const entry = {};
  for (const s of SNAP_POINTS_DB[macro]) {
    const g = game.get(s.name);
    if (!g) continue;
    entry[s.name] = g.facing.map(r3);
    snaps++;
    if (Math.abs(g.facing[1]) > 0.7) vertical++;
  }
  if (Object.keys(entry).length) { table[macro] = entry; modules++; }
}
console.log(`[OK] ${modules} modules, ${snaps} snap facings (${vertical} vertical, ${snaps - vertical} horizontal)`);
if (missing.length) console.log(`[INFO] ${missing.length} modules without a game component file`);
if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify(table, null, 1) + '\n');
  console.log(`[OK] Wrote ${path.relative(root, OUT)}`);
}
