import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';
import { generatePlanXML } from '../src/blueprint-exporter.js';

console.log('--- TEST ROUND-TRIP EXPORT OF 4 E PIERS.XML ---');

const xmlPath = 'tests/fixtures/4 E Piers.xml';
if (!fs.existsSync(xmlPath)) {
  console.log('[SKIP] 4 E Piers.xml not found on OneDrive path.');
  process.exit(0);
}

const originalXml = fs.readFileSync(xmlPath, 'utf8');
const originalPlan = parseConstructionPlan(originalXml);

// 1. Simulate StationViewer.loadStationPlan
const threeModules = originalPlan.modules.map(mod => {
  const g = new THREE.Group();
  g.position.set(mod.position.x, mod.position.y, -mod.position.z);
  g.rotation.order = 'YXZ';
  g.rotation.y = (mod.rotation.yaw || 0) * Math.PI / 180;
  g.rotation.x = ((mod.rotation.pitch || 0) + 180) * Math.PI / 180;
  g.rotation.z = ((mod.rotation.roll || 0) + 180) * Math.PI / 180;
  g.userData = {
    index: mod.index,
    macro: mod.macro,
    connection: mod.connection,
    predecessor: mod.predecessor
  };
  return g;
});

// 2. Simulate exportCurrentPlanAsBlueprint
const activeModules = threeModules.map(child => {
  child.rotation.order = 'YXZ';
  let yaw = Math.round(THREE.MathUtils.radToDeg(child.rotation.y)) % 360;
  let pitch = Math.round(THREE.MathUtils.radToDeg(child.rotation.x) - 180) % 360;
  let roll = Math.round(THREE.MathUtils.radToDeg(child.rotation.z) - 180) % 360;

  if (yaw > 180) yaw -= 360;
  if (yaw <= -180) yaw += 360;
  if (pitch > 180) pitch -= 360;
  if (pitch <= -180) pitch += 360;
  if (roll > 180) roll -= 360;
  if (roll <= -180) roll += 360;

  yaw = Object.is(yaw, -0) ? 0 : yaw;
  pitch = Object.is(pitch, -0) ? 0 : pitch;
  roll = Object.is(roll, -0) ? 0 : roll;

  return {
    index: child.userData.index,
    macro: child.userData.macro,
    connection: child.userData.connection,
    predecessor: child.userData.predecessor,
    position: {
      x: Math.round(child.position.x * 1000) / 1000,
      y: Math.round(child.position.y * 1000) / 1000,
      z: -Math.round(child.position.z * 1000) / 1000
    },
    rotation: { yaw, pitch, roll }
  };
});

// 3. Generate XML
const exportedXml = generatePlanXML('4 E Piers', { modules: activeModules });
console.log('Generated Export XML:\n', exportedXml);

// 4. Assertions on the exported XML
assert(exportedXml.includes('name="4 E Piers"'), 'Plan name is 4 E Piers');

// Pier 1
assert(exportedXml.includes('roll="45"'), 'Pier #1 exported with roll="45"');
// Cross hub
assert(exportedXml.includes('macro="struct_arg_cross_01_macro"'), 'Cross hub present');
assert(exportedXml.includes('<predecessor index="1" connection="connectionsnap001"/>'), 'Cross hub predecessor connection preserved');
// Pier 3
assert(exportedXml.includes('roll="-135"'), 'Pier #3 exported with roll="-135"');
assert(exportedXml.includes('<predecessor index="2" connection="connectionsnap004"/>'), 'Pier #3 predecessor connection preserved');
// Pier 4
assert(exportedXml.includes('roll="135"'), 'Pier #4 exported with roll="135"');
assert(exportedXml.includes('<predecessor index="2" connection="connectionsnap006"/>'), 'Pier #4 predecessor connection preserved');
// Pier 5
assert(exportedXml.includes('roll="-45"'), 'Pier #5 exported with roll="-45"');
assert(exportedXml.includes('<predecessor index="2" connection="connectionsnap005"/>'), 'Pier #5 predecessor connection preserved');

// Z position must be positive 849.023, NOT negative
assert(exportedXml.includes('z="849.023"'), 'Exported Z position is positive 849.023 (not -849)');

// 5. Re-parse and verify round-trip equivalence
const reloadedPlan = parseConstructionPlan(exportedXml);
assert.strictEqual(reloadedPlan.modules.length, 5, 'All 5 modules reloaded');

for (let i = 0; i < originalPlan.modules.length; i++) {
  const orig = originalPlan.modules[i];
  const reload = reloadedPlan.modules[i];
  assert.strictEqual(orig.macro, reload.macro, `Module #${orig.index} macro matches`);
  assert(Math.abs(orig.position.x - reload.position.x) < 0.01, `Module #${orig.index} X position matches`);
  assert(Math.abs(orig.position.y - reload.position.y) < 0.01, `Module #${orig.index} Y position matches`);
  assert(Math.abs(orig.position.z - reload.position.z) < 0.01, `Module #${orig.index} Z position matches`);
  assert(Math.abs(orig.rotation.roll - reload.rotation.roll) < 0.1, `Module #${orig.index} roll matches (${orig.rotation.roll} vs ${reload.rotation.roll})`);
}

console.log('[PASS] Full round-trip export and reload verified for 4 E Piers.xml!');
