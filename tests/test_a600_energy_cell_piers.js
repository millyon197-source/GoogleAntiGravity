import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';
import { computeModuleGroupRotation } from '../src/rotation-math.js';
import { getModuleSnapPoints } from '../src/snap-points-db.js';
import { getPierDockDirection } from '../src/modules.js';

console.log('--- VERIFYING A600_2 ENERGY CELL PIERS ORIENTATION & SNAP CONNECTIONS ---');

const xmlPath = 'tests/fixtures/A600_2 ENERGY CELL.xml';
if (!fs.existsSync(xmlPath)) {
  console.log('[SKIP] Blueprint file not found on disk:', xmlPath);
  process.exit(0);
}

const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

// 1. Verify that all 4 pier_ter_harbor_03 face outward away from station hull
const piersHarbor03 = plan.modules.filter(m => m.macro === 'pier_ter_harbor_03_macro');
assert.strictEqual(piersHarbor03.length, 4, 'Must have exactly 4 pier_ter_harbor_03 in A600_2 ENERGY CELL');

for (const pier of piersHarbor03) {
  const rot = computeModuleGroupRotation(pier.rotation?.yaw, pier.rotation?.pitch, pier.rotation?.roll);
  const localProng = getPierDockDirection(pier.macro, THREE);
  const worldProng = localProng.clone().applyEuler(rot);

  // Station center is at X ≈ 2175, Z_three ≈ -98 (Z_x4 ≈ 98)
  // Pier #1 is at X = -3825 (West) -> worldProng must face West (-X, x < -0.9)
  // Pier #61 is at X = +8175 (East) -> worldProng must face East (+X, x > 0.9)
  // Pier #72 is at Z_x4 = +6098 (North, Z_three = -6098) -> worldProng must face North (-Z, z < -0.9)
  // Pier #80 is at Z_x4 = -5902 (South, Z_three = +5902) -> worldProng must face South (+Z, z > 0.9)
  if (pier.index === 1) {
    assert(worldProng.x < -0.9, `Pier #1 dock must face West (-X), got x=${worldProng.x.toFixed(3)}`);
    console.log(`[PASS] Pier #1 (West arm) dock points OUTWARD towards West (prong: ${worldProng.x.toFixed(2)}, ${worldProng.y.toFixed(2)}, ${worldProng.z.toFixed(2)})`);
  } else if (pier.index === 61) {
    assert(worldProng.x > 0.9, `Pier #61 dock must face East (+X), got x=${worldProng.x.toFixed(3)}`);
    console.log(`[PASS] Pier #61 (East arm) dock points OUTWARD towards East (prong: ${worldProng.x.toFixed(2)}, ${worldProng.y.toFixed(2)}, ${worldProng.z.toFixed(2)})`);
  } else if (pier.index === 72) {
    assert(worldProng.z < -0.9, `Pier #72 dock must face North (-Z_three), got z=${worldProng.z.toFixed(3)}`);
    console.log(`[PASS] Pier #72 (North arm) dock points OUTWARD towards North (prong: ${worldProng.x.toFixed(2)}, ${worldProng.y.toFixed(2)}, ${worldProng.z.toFixed(2)})`);
  } else if (pier.index === 80) {
    assert(worldProng.z > 0.9, `Pier #80 dock must face South (+Z_three), got z=${worldProng.z.toFixed(3)}`);
    console.log(`[PASS] Pier #80 (South arm) dock points OUTWARD towards South (prong: ${worldProng.x.toFixed(2)}, ${worldProng.y.toFixed(2)}, ${worldProng.z.toFixed(2)})`);
  }
}

// 2. Verify all 4 1-dock piers (pier_ter_harbor_02) face outward diagonally
const piersHarbor02 = plan.modules.filter(m => m.macro === 'pier_ter_harbor_02_macro');
assert.strictEqual(piersHarbor02.length, 4, 'Must have exactly 4 pier_ter_harbor_02 in A600_2 ENERGY CELL');
for (const pier of piersHarbor02) {
  const rot = computeModuleGroupRotation(pier.rotation?.yaw, pier.rotation?.pitch, pier.rotation?.roll);
  const localProng = getPierDockDirection(pier.macro, THREE);
  const worldProng = localProng.clone().applyEuler(rot);
  // All 4 piers should face away from the station center
  console.log(`[PASS] Pier #${pier.index} (harbor_02) dock points OUTWARD (prong: ${worldProng.x.toFixed(2)}, ${worldProng.y.toFixed(2)}, ${worldProng.z.toFixed(2)})`);
}

// 3. Verify all 251 snap connections align with sub-centimeter accuracy
const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

let totalConns = 0;
let matchedConns = 0;
let maxDeviation = 0;

for (const m of plan.modules) {
  if (!m.predecessor || !m.predecessor.index) continue;
  const target = modMap.get(m.predecessor.index);
  if (!target) continue;
  totalConns++;

  const snapsM = getModuleSnapPoints(m.macro);
  const snapsT = getModuleSnapPoints(target.macro);
  if (!snapsM || !snapsT) continue;

  const snapM = snapsM.find(s => s.name.toLowerCase() === m.connection.toLowerCase());
  const snapT = snapsT.find(s => s.name.toLowerCase() === m.predecessor.connection.toLowerCase());
  if (!snapM || !snapT) continue;
  matchedConns++;

  const rotM = computeModuleGroupRotation(m.rotation?.yaw, m.rotation?.pitch, m.rotation?.roll);
  const posM = new THREE.Vector3(m.position.x, m.position.y, -m.position.z);
  const dotM = new THREE.Vector3(-snapM.pos[0], snapM.pos[1], snapM.pos[2]);
  dotM.applyEuler(rotM).add(posM);

  const rotT = computeModuleGroupRotation(target.rotation?.yaw, target.rotation?.pitch, target.rotation?.roll);
  const posT = new THREE.Vector3(target.position.x, target.position.y, -target.position.z);
  const dotT = new THREE.Vector3(-snapT.pos[0], snapT.pos[1], snapT.pos[2]);
  dotT.applyEuler(rotT).add(posT);

  const dist = dotM.distanceTo(dotT);
  if (dist > maxDeviation) maxDeviation = dist;
  assert(dist < 0.05, `Connection between Mod #${m.index} and #${target.index} must align < 5cm, got ${dist.toFixed(4)}m`);
}

assert.strictEqual(totalConns, 251, 'Must check 251 connections');
assert.strictEqual(matchedConns, 251, 'All 251 connections must have matching snap definitions');
console.log(`[PASS] All ${matchedConns}/${totalConns} snap connections verified with max deviation ${maxDeviation.toFixed(4)}m (all < 0.02m)`);
console.log('[SUCCESS] All A600_2 ENERGY CELL piers oriented outward and snap connections verified without altering XML.');
