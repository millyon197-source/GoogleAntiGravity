/**
 * Split DLC snap points: SNAP_POINTS_DB must match the Split component files (positions rounded to
 * 2 decimals, as for every other module) and each snap must sit on its module's part_main hull,
 * measured in the viewer frame (vertices (x - ox, y + oy, z + oz), snap dots (-x, y, z)).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../src/snap-points-db.js';
import DAE_HASH_TABLE from '../dae_hash_table.json' with { type: 'json' };

console.log('[*] Testing Split DLC snap points against the game component files and meshes...');

const entries = DAE_HASH_TABLE.flat();
const partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
const round2 = (n) => (Math.round(n * 100) / 100) || 0;

const splitMacros = Object.keys(SNAP_POINTS_DB).filter(k => k.includes('_spl_'));
assert.strictEqual(splitMacros.length, 26, 'all 26 Split modules with snap connections are in the table');

let checked = 0;
let worst = 0;
for (const macro of splitMacros) {
  const base = macro.replace(/_macro$/, '');
  const entry = entries.find(e => e.key === base);
  assert.ok(entry, `${base} is in the DAE asset index`);
  const componentFile = '.' + entry.folder_path.replace(/_data$/, '') + '.xml';
  if (!fs.existsSync(componentFile)) {
    console.log(`  - skipped ${base}: ${componentFile} missing (run npm run sync:dlc-components)`);
    continue;
  }

  // 1. Same snaps as the game component file
  const xml = fs.readFileSync(componentFile, 'utf8');
  const gameSnaps = [];
  for (const [, name, attrs, body] of xml.matchAll(/<connection name="([^"]+)"([^>]*)>([\s\S]*?)<\/connection>/g)) {
    if (!/\bsnap\b/.test((attrs.match(/tags="([^"]*)"/) || [])[1] || '')) continue;
    const p = body.match(/<position x="([-\d.Ee]+)" y="([-\d.Ee]+)" z="([-\d.Ee]+)"/);
    gameSnaps.push({ name, pos: (p ? p.slice(1).map(Number) : [0, 0, 0]).map(round2) });
  }
  assert.deepStrictEqual(getModuleSnapPoints(macro), gameSnaps, `${base} snaps match its component file`);

  // 2. On the part_main hull
  const meta = JSON.parse(fs.readFileSync(`.${entry.folder_path}/part_main-lod0.json`, 'utf8'));
  const buf = fs.readFileSync(`.${entry.folder_path}/part_main-lod0.bin`);
  const stride = meta.vertexStrideBytes / 4;
  const f = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * stride);
  const [ox, oy, oz] = partMainOffsets[base] || [0, 0, 0];
  for (const s of gameSnaps) {
    const dot = [-s.pos[0], s.pos[1], s.pos[2]];
    let nearest = Infinity;
    for (let i = 0; i < meta.vertexCount; i++) {
      nearest = Math.min(nearest, Math.hypot(f[i * stride] - ox - dot[0], f[i * stride + 1] + oy - dot[1], f[i * stride + 2] + oz - dot[2]));
    }
    assert.ok(nearest < 1, `${base} ${s.name} must sit on the hull (nearest vertex ${nearest.toFixed(2)} m)`);
    worst = Math.max(worst, nearest);
  }
  checked++;
}
assert.ok(checked > 0, 'at least one Split module was checked (component files present)');
console.log(`  ✓ ${checked} Split modules match their component files; every snap within ${worst.toFixed(2)} m of its hull`);
console.log('\n[PASS] test_split_snap_points');
