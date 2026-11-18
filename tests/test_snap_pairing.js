import assert from 'assert';
import * as THREE from 'three';
import { pairModulesAtSnaps } from '../src/snap-pairing.js';

console.log('[*] Testing snap pairing of modules...');

// A module: a 100 m cube at `at`, with snap points in the middle of its +x / -x / +z faces
function makeModule(name, at) {
  const m = new THREE.Object3D();
  m.name = name;
  m.position.set(...at);
  m.userData.localSnaps = [new THREE.Vector3(50, 0, 0), new THREE.Vector3(-50, 0, 0), new THREE.Vector3(0, 0, 50)];
  m.updateMatrixWorld(true);
  return m;
}
const getSnaps = (m) => { m.updateMatrixWorld(true); return m.userData.localSnaps.map(p => p.clone().applyMatrix4(m.matrixWorld)); };
const getBox = (m) => new THREE.Box3(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50)).translate(m.position);

const a = makeModule('a', [0, 0, 0]);
const b = makeModule('b', [130, 0, 0]);    // its -x snap is 30 m from a's +x snap: the closest pair
const c = makeModule('c', [-400, 0, 0]);
const d = makeModule('d', [0, 0, 900]);

const { order, joins } = pairModulesAtSnaps([a, b, c, d], { getSnaps, getBox });
assert.strictEqual(order.length, 4, 'every module is joined');
assert.deepStrictEqual(new Set(order.slice(0, 2)), new Set([a, b]), 'the closest pair joins first');
assert.strictEqual(joins.length, 3, 'one join per module after the first');

// Each joined module has a snap point on a snap point of the module it joined, and no two
// joins share a snap point
const key = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
for (const j of joins) {
  const mine = getSnaps(j.mod).map(key);
  const theirs = getSnaps(j.to).map(key);
  assert(mine.some(k => theirs.includes(k)), `${j.mod.name} sits on a snap point of ${j.to.name}`);
}
// No module ends inside another
const mods = [a, b, c, d];
for (let i = 0; i < mods.length; i++) {
  for (let k = i + 1; k < mods.length; k++) {
    const inter = getBox(mods[i]).intersect(getBox(mods[k]));
    const vol = inter.isEmpty() ? 0 : (inter.max.x - inter.min.x) * (inter.max.y - inter.min.y) * (inter.max.z - inter.min.z);
    assert(vol < 1, `${mods[i].name} and ${mods[k].name} do not overlap`);
  }
}
console.log('[PASS] closest pair first, the rest join free snap points without overlapping');

// A plot: chains (two snaps per module) stay inside it, and start a new pair when they cannot grow
{
  const chain = (name, at) => {
    const m = makeModule(name, at);
    m.userData.localSnaps = [new THREE.Vector3(50, 0, 0), new THREE.Vector3(-50, 0, 0)];
    return m;
  };
  const plot = new THREE.Box3(new THREE.Vector3(-260, -260, -260), new THREE.Vector3(260, 260, 260));
  const fits = (b) => plot.containsBox(b);
  const ms = [chain('p', [0, 0, 0]), chain('q', [120, 0, 0]), chain('r', [-130, 0, 0]),
    chain('s', [0, 0, 200]), chain('t', [150, 0, 200]), chain('u', [-150, 0, -200]), chain('w', [100, 0, -200])];
  const start = new Map(ms.map(m => [m, m.position.clone()]));
  const r = pairModulesAtSnaps(ms, { getSnaps, getBox, fits });
  for (const m of ms) {
    if (start.get(m).distanceTo(m.position) > 1e-6) assert(fits(getBox(m)), `${m.name} moved inside the plot`);
  }
  for (const m of r.order) assert(fits(getBox(m)), `stationary ${m.name} is inside the plot`);
  assert(r.order.length >= 6, `most modules join (${r.order.length})`);
  // A 520 m plot holds at most five 100 m modules in a row: more than one chain formed
  const unplot = pairModulesAtSnaps(ms.map(m => chain(m.name, start.get(m).toArray())), { getSnaps, getBox });
  assert.strictEqual(unplot.order.length, 7);
  console.log(`[PASS] joins stay inside the plot (${r.order.length} of ${ms.length} joined)`);
}

// Normals: snap points join only when their hull normals face each other
{
  const mk = (name, at, local, normals) => {
    const m = makeModule(name, at);
    m.userData.localSnaps = local.map(p => new THREE.Vector3(...p));
    m.userData.normals = normals.map(n => new THREE.Vector3(...n));
    return m;
  };
  // h1's +x snap faces +x. v1's top snap (facing up) is 10 m from it but does not face it; h3's
  // +x snap is 20 m away but faces the same way; h2's -x snap is 300 m away and faces it.
  const h1 = mk('h1', [0, 0, 0], [[50, 0, 0]], [[1, 0, 0]]);
  const v1 = mk('v1', [60, -50, 0], [[0, 50, 0]], [[0, 1, 0]]);
  const h3 = mk('h3', [20, 0, 400], [[50, 0, 0]], [[1, 0, 0]]);
  const h2 = mk('h2', [400, 0, 0], [[-50, 0, 0]], [[-1, 0, 0]]);
  const v2 = mk('v2', [60, 300, 0], [[0, -50, 0]], [[0, -1, 0]]);
  const r = pairModulesAtSnaps([h1, v1, h3, h2, v2], { getSnaps, getBox, getNormals: (m) => m.userData.normals });
  const key = (p) => p.toArray().map(n => n.toFixed(3)).join(',');
  for (const j of r.joins) {
    assert(j.mod.userData.normals[0].dot(j.to.userData.normals[0]) < -0.99, `${j.mod.name} and ${j.to.name} face each other`);
    assert.strictEqual(key(getSnaps(j.mod)[0]), key(getSnaps(j.to)[0]));
  }
  assert.strictEqual(r.joins.length, 2, 'h1 joins h2 and v1 joins v2; h3 faces nothing');
  assert(!r.order.includes(h3), 'h3 stays');
  console.log('[PASS] only snap points whose normals face each other join');
}

// Pairing again: modules already stationary stay put, their taken snaps stay taken, and the
// others join their free snap points
{
  const mk = (name, at) => {
    const m = makeModule(name, at);
    m.userData.localSnaps = [new THREE.Vector3(50, 0, 0), new THREE.Vector3(-50, 0, 0)];
    m.userData.normals = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
    return m;
  };
  const getNormals = (m) => m.userData.normals;
  const a = mk('a', [0, 0, 0]);
  const b = mk('b', [100, 0, 0]);   // already joined: b's -x snap on a's +x snap
  const c = mk('c', [120, 0, 300]);
  const used = new Map([[a, new Set([0])], [b, new Set([1])]]);
  const r = pairModulesAtSnaps([a, b, c], { getSnaps, getBox, getNormals, stationary: [a, b], usedSnaps: used });
  assert.deepStrictEqual(a.position.toArray(), [0, 0, 0], 'a stays');
  assert.deepStrictEqual(b.position.toArray(), [100, 0, 0], 'b stays');
  assert.deepStrictEqual(r.order.slice(0, 2), [a, b], 'the given stationary modules come first');
  assert(r.order.includes(c), 'c joins');
  // c joined a free snap: b's +x (at 150) with its -x, so c sits at 200
  assert.deepStrictEqual(c.position.toArray().map(Math.round), [200, 0, 0]);
  console.log('[PASS] pairing again keeps the stationary modules and their taken snaps');
}

// The snap-facings table covers the snap table: unit normals for known snap names
{
  const { default: FACINGS } = await import('../src/snap-facings.json', { with: { type: 'json' } });
  const { SNAP_POINTS_DB } = await import('../packages/catalog/src/snap-points-db.js');
  let n = 0;
  for (const [macro, entry] of Object.entries(FACINGS)) {
    assert(SNAP_POINTS_DB[macro], `${macro} is in the snap table`);
    for (const [name, f] of Object.entries(entry)) {
      assert(SNAP_POINTS_DB[macro].some(s => s.name === name), `${macro} ${name} is a known snap`);
      assert(Math.abs(Math.hypot(...f) - 1) < 0.01, `${macro} ${name} facing is a unit vector`);
      n++;
    }
  }
  assert(n > 500, `facings for most snaps (${n})`);
  console.log(`[PASS] snap-facings.json: ${n} unit hull normals for known snaps`);
}

// Fewer than two modules: nothing moves
{
  const solo = makeModule('solo', [10, 0, 0]);
  const r = pairModulesAtSnaps([solo], { getSnaps, getBox });
  assert.strictEqual(r.joins.length, 0);
  assert.strictEqual(solo.position.x, 10);
  console.log('[PASS] a single module stays put');
}
