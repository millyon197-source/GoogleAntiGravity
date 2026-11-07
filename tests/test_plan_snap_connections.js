/**
 * In plans that record how modules connect (entry connection="..." + <predecessor connection="..."/>),
 * the two snap points must meet and face each other when placed the way the app places them:
 * plan position (x, y, z) -> app (x, y, -z), rotation via computeModuleGroupRotation, snap dots at
 * (-x, y, z). Checked on the real plans exported from X4 (which validates that maths against the
 * game) and on the built-in samples.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
const { parseConstructionPlan } = await import('../src/parser.js');
const { computeModuleGroupRotation } = await import('../packages/adapter-three/src/math/rotation-math.js');
const { getModuleSnapPoints, createDaeAssetIndex } = await import('../packages/catalog/src/index.js');
const { readComponentSnaps } = await import('../tools/snap-game-data.js');
const { SAMPLES } = await import('../src/samples.js');
const DAE_HASH_TABLE = JSON.parse(fs.readFileSync('dae_hash_table.json', 'utf8'));

console.log('[*] Testing that connected snaps meet in exported plans and samples...');

const assetIndex = createDaeAssetIndex(DAE_HASH_TABLE);
const facingCache = new Map();
function snapFacing(macro, name) {
  if (!facingCache.has(macro)) {
    const { folderPath } = assetIndex.resolveModuleAssetEntry(macro);
    facingCache.set(macro, folderPath ? readComponentSnaps('.' + folderPath.replace(/_data$/, '') + '.xml') : null);
  }
  return facingCache.get(macro)?.get(name)?.facing || null;
}
function worldSnap(mod, connection) {
  const snap = getModuleSnapPoints(mod.macro).find(s => s.name.toLowerCase() === connection.toLowerCase());
  if (!snap) return null;
  const m = new THREE.Matrix4().makeRotationFromEuler(computeModuleGroupRotation(mod.rotation.yaw, mod.rotation.pitch, mod.rotation.roll));
  const pos = new THREE.Vector3(-snap.pos[0], snap.pos[1], snap.pos[2]).applyMatrix4(m)
    .add(new THREE.Vector3(mod.position.x, mod.position.y, -mod.position.z));
  const f = snapFacing(mod.macro, snap.name);
  const facing = f ? new THREE.Vector3(-f[0], f[1], f[2]).applyMatrix4(m).normalize() : null;
  return { pos, facing };
}
function checkPlan(name, xml, { tolerance }) {
  const plan = parseConstructionPlan(xml);
  const byIndex = new Map(plan.modules.map(m => [m.index, m]));
  let checked = 0, skipped = 0, worstGap = 0;
  const failures = [];
  for (const mod of plan.modules) {
    if (!mod.predecessor || !mod.connection) continue;
    const parent = byIndex.get(mod.predecessor.index);
    const a = parent && worldSnap(parent, mod.predecessor.connection);
    const b = worldSnap(mod, mod.connection);
    if (!a || !b) { skipped++; continue; }
    checked++;
    const gap = a.pos.distanceTo(b.pos);
    worstGap = Math.max(worstGap, gap);
    const opposed = !a.facing || !b.facing || a.facing.dot(b.facing) < -0.99;
    if (gap > tolerance || !opposed) {
      failures.push(`${parent.index}:${parent.macro}.${mod.predecessor.connection} -> ${mod.index}:${mod.macro}.${mod.connection} gap ${gap.toFixed(1)} m${opposed ? '' : ', not facing each other'}`);
    }
  }
  return { name, modules: plan.modules.length, checked, skipped, worstGap, failures };
}

// 1. Real plans exported from the game: the placement maths must make nearly all their recorded
//    connections meet. Not all of them do (about 6% of X4's exported connections are off, spread
//    over many module types, e.g. hab_ter_l_01 -> hab_ter_m_01), so this checks the overall rate.
let exportedChecked = 0, exportedMet = 0;
for (const f of fs.readdirSync('tests/fixtures').filter(f => f.endsWith('.xml'))) {
  const r = checkPlan(f, fs.readFileSync(`tests/fixtures/${f}`, 'utf8'), { tolerance: 0.1 });
  exportedChecked += r.checked;
  exportedMet += r.checked - r.failures.length;
}
const rate = exportedMet / exportedChecked;
assert.ok(exportedChecked > 1000, 'enough real connections were checked');
assert.ok(rate >= 0.9, `only ${(rate * 100).toFixed(1)}% of exported connections meet: the placement maths no longer matches X4`);
console.log(`  ✓ exported plans: ${exportedMet} of ${exportedChecked} connections meet within 0.1 m (${(rate * 100).toFixed(1)}%), so the maths matches X4`);

// 2. Built-in samples that record connections
for (const [key, xml] of Object.entries(SAMPLES)) {
  const r = checkPlan(key, xml, { tolerance: 0.1 });
  if (r.checked === 0) continue;
  assert.deepStrictEqual(r.failures, [], `${key}: connections that do not meet:\n  ${r.failures.join('\n  ')}`);
  assert.strictEqual(r.skipped, 0, `${key}: every connection uses known snap points`);
  console.log(`  ✓ sample ${key}: all ${r.checked} connections meet and face each other`);
}
const fortress = checkPlan('defenseFortress', SAMPLES.defenseFortress, { tolerance: 0.1 });
assert.strictEqual(fortress.checked, fortress.modules - 1, 'every defenseFortress module after the first is connected to a predecessor');

console.log('\n[PASS] test_plan_snap_connections');
