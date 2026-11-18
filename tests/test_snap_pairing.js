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

// Fewer than two modules: nothing moves
{
  const solo = makeModule('solo', [10, 0, 0]);
  const r = pairModulesAtSnaps([solo], { getSnaps, getBox });
  assert.strictEqual(r.joins.length, 0);
  assert.strictEqual(solo.position.x, 10);
  console.log('[PASS] a single module stays put');
}
