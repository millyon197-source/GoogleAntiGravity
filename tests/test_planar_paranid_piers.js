import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';
import { computeModuleGroupRotation } from '../src/rotation-math.js';
import { getPierDockDirection } from '../src/modules.js';

console.log('--- VERIFYING PLANAR - PARANID PIER ORIENTATIONS ---');

const xmlPath = 'tests/fixtures/Planar - Paranid.xml';
if (!fs.existsSync(xmlPath)) {
  console.log('[SKIP] Planar - Paranid.xml not found on disk at:', xmlPath);
  process.exit(0);
}

const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const pier1 = plan.modules.find(m => m.index === 1 && m.macro === 'pier_arg_harbor_03_macro');
const pier163 = plan.modules.find(m => m.index === 163 && m.macro === 'pier_arg_harbor_03_macro');

assert(pier1, 'Pier #1 must exist in Planar - Paranid.xml');
assert(pier163, 'Pier #163 must exist in Planar - Paranid.xml');

// Both piers in Planar - Paranid have roll = 60.0
assert.strictEqual(pier1.rotation.roll, 60, 'Pier #1 has roll = 60.0 in XML');
assert.strictEqual(pier163.rotation.roll, 60, 'Pier #163 has roll = 60.0 in XML');

const rot1 = computeModuleGroupRotation(pier1.rotation.yaw, pier1.rotation.pitch, pier1.rotation.roll);
const rot163 = computeModuleGroupRotation(pier163.rotation.yaw, pier163.rotation.pitch, pier163.rotation.roll);

const localDock = getPierDockDirection(pier1.macro, THREE);

const worldProng1 = localDock.clone().applyEuler(rot1);
const worldProng163 = localDock.clone().applyEuler(rot163);

console.log('Pier #1 world dock vector:', worldProng1);
console.log('Pier #163 world dock vector:', worldProng163);

// In X4, docking prongs can and do point upward into space
assert(worldProng1.y > 0.8, `Pier #1 dock prongs must point upward (+Y), got y=${worldProng1.y.toFixed(4)}`);
assert(worldProng163.y > 0.8, `Pier #163 dock prongs must point upward (+Y), got y=${worldProng163.y.toFixed(4)}`);

console.log(`[PASS] Pier #1 docking prongs point UPWARD (y = ${worldProng1.y.toFixed(4)} > 0)`);
console.log(`[PASS] Pier #163 docking prongs point UPWARD (y = ${worldProng163.y.toFixed(4)} > 0)`);
console.log('[SUCCESS] Both pier_arg_harbor_03 in Planar - Paranid.xml correctly oriented pointing upward without altering XML.');
