import assert from 'node:assert';
import fs from 'fs';
import { getModuleSnapPoints } from '../src/snap-points-db.js';

console.log('[*] Testing Refined Metals snap points against the game data and the rendered mesh...');

const baseKey = 'prod_gen_refinedmetals';
const macro = 'prod_gen_refinedmetals_macro';

// 1. The database must match the game's component file (ConnectionSnap connections tagged "snap")
const componentXml = fs.readFileSync(`assets1/structures/production/${baseKey}.xml`, 'utf8');
const gameSnaps = [...componentXml.matchAll(/<connection name="(ConnectionSnap\d+)" tags="snap ">\s*<offset>\s*<position x="([-\d.]+)" y="([-\d.]+)" z="([-\d.]+)"/g)]
  .map(m => ({ name: m[1], pos: [Number(m[2]), Number(m[3]), Number(m[4])] }));
assert.strictEqual(gameSnaps.length, 2, 'game component defines two snap connections');

const snaps = getModuleSnapPoints(macro);
assert.deepStrictEqual(snaps, gameSnaps, 'SNAP_POINTS_DB matches the game component snap positions');
console.log('  ✓ snap positions match the game component file');

// 2. Measure in the viewer's module frame (adapter-three loadModuleMesh + viewer.buildModuleSnapPoints):
//    part_main vertices sit in a group at (-x, y, z) of the part_main offset; snap dots at (-x, y, z).
const partMainOffsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
const [ox, oy, oz] = partMainOffsets[baseKey];
const meta = JSON.parse(fs.readFileSync(`assets1/structures/production/${baseKey}_data/part_main-lod0.json`, 'utf8'));
const buf = fs.readFileSync(`assets1/structures/production/${baseKey}_data/part_main-lod0.bin`);
const stride = meta.vertexStrideBytes / 4;
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * stride);

let lowestY = Infinity;
for (let i = 0; i < meta.vertexCount; i++) lowestY = Math.min(lowestY, floats[i * stride + 1] + oy);

for (const snap of snaps) {
  const dot = [-snap.pos[0], snap.pos[1], snap.pos[2]];
  let nearest = Infinity;
  let collar = 0; // both snaps face down: count hull within 60 m sideways and up to 40 m above the snap
  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride] - ox, vy = floats[i * stride + 1] + oy, vz = floats[i * stride + 2] + oz;
    const d = Math.hypot(vx - dot[0], vy - dot[1], vz - dot[2]);
    if (d < nearest) nearest = d;
    if (Math.hypot(vx - dot[0], vz - dot[2]) < 60 && vy >= dot[1] - 5 && vy - dot[1] < 40) collar++;
  }
  console.log(`  ${snap.name}: drawn at [${dot.join(', ')}], nearest hull vertex ${nearest.toFixed(2)} m, ${collar} collar vertices`);
  assert.ok(nearest < 5, `${snap.name} must sit on the hull (nearest vertex ${nearest.toFixed(2)} m)`);
  // Game positions have ~280-300 here; the old hand-edited values had 0 and a removed override had 14
  assert.ok(collar >= 100, `${snap.name} must sit on a docking collar (${collar} collar vertices)`);
  assert.ok(Math.abs(dot[1] - lowestY) < 1, `${snap.name} must be on the bottom face (y ${dot[1]} vs lowest ${lowestY.toFixed(2)})`);
}
console.log('  ✓ both snaps sit on the bottom-face docking collars of part_main');

console.log('\n[SUCCESS] Refined Metals snap points match the game data and the rendered hull');
