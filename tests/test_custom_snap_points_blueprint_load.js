import * as THREE from 'three';
import assert from 'assert';
import {
  getModuleSnapPoints,
  setCustomSnapPointEntry,
  removeCustomSnapPointEntry,
  hasCustomSnapPointsForMacro,
  syncCustomSnapPoints,
  SNAP_POINTS_DB,
  CUSTOM_SNAP_POINTS_TABLE
} from '../src/snap-points-db.js';
import { createProceduralModule } from '../src/modules.js';

console.log('[*] Testing custom-snap-points.json utilization during blueprint module rendering...');

let allPassed = true;

// 1. Setup mock viewer environment to test blueprint module loading and rendering
const testMacro = 'prod_arg_wheat_macro';
const baselineSnaps = [...getModuleSnapPoints(testMacro)];

console.log(`[OK] Baseline snap points for ${testMacro}: ${baselineSnaps.length} points.`);

// Mock station plan containing testMacro
const planData = {
  id: 'test_plan_custom_snaps',
  name: 'Test Plan with Custom Snaps',
  modules: [
    {
      index: 1,
      macro: testMacro,
      position: { x: 0, y: 0, z: 0 },
      rotation: { pitch: 0, yaw: 0, roll: 0 }
    },
    {
      index: 2,
      macro: 'storage_arg_l_container_01_macro',
      position: { x: 1000, y: 0, z: 0 },
      rotation: { pitch: 0, yaw: 0, roll: 0 }
    }
  ]
};

// 2. Define custom snap points for testMacro simulating entries in custom-snap-points.json
const customSnaps = [
  { name: 'ConnectionSnapCustom01', pos: [550, -180, 850] },
  { name: 'ConnectionSnapCustom02', pos: [0, 50, 1100] }
];

// Set custom snap points in table
setCustomSnapPointEntry(testMacro, customSnaps);

assert.strictEqual(hasCustomSnapPointsForMacro(testMacro), true, 'hasCustomSnapPointsForMacro must be true for testMacro');
assert.strictEqual(hasCustomSnapPointsForMacro('storage_arg_l_container_01_macro'), false, 'storage module must not have custom snaps');

// 3. Simulate module loading and rendering pipeline (matching StationViewer.buildModuleSnapPoints)
function renderModuleWithSnaps(mod) {
  const moduleGroup = createProceduralModule(mod.macro, THREE);
  moduleGroup.userData.index = mod.index;
  moduleGroup.userData.macro = mod.macro;

  // Query snap points (getModuleSnapPoints honors custom-snap-points.json)
  const snaps = getModuleSnapPoints(mod.macro);
  const isCustom = hasCustomSnapPointsForMacro(mod.macro);
  moduleGroup.userData.hasCustomSnapPoints = isCustom;
  moduleGroup.userData.snapPoints = snaps;

  const snapsGroup = new THREE.Group();
  snapsGroup.name = 'module_snaps_group';

  for (const snap of snaps) {
    const dotGeo = new THREE.SphereGeometry(1, 14, 14);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.name = `snap_dot_${snap.name}`;
    dot.userData = {
      isSnapPoint: true,
      isCustomSnapPoint: isCustom,
      snapName: snap.name,
      moduleIndex: mod.index,
      localPos: [...snap.pos]
    };
    dot.position.set(-snap.pos[0], snap.pos[1], -snap.pos[2]);
    snapsGroup.add(dot);
  }

  moduleGroup.add(snapsGroup);
  return moduleGroup;
}

// Render the blueprint modules
const renderedMod1 = renderModuleWithSnaps(planData.modules[0]);
const renderedMod2 = renderModuleWithSnaps(planData.modules[1]);

// 4. Verify rendered blueprint module #1 uses custom-snap-points.json
const snapsGroup1 = renderedMod1.getObjectByName('module_snaps_group');
assert(snapsGroup1, 'Rendered module 1 must have module_snaps_group');
assert.strictEqual(renderedMod1.userData.hasCustomSnapPoints, true, 'Module 1 must be marked as having custom snap points');
assert.strictEqual(snapsGroup1.children.length, 2, 'Module 1 snaps group must contain exactly 2 custom snap points');

const dot1 = snapsGroup1.children[0];
const dot2 = snapsGroup1.children[1];

assert.strictEqual(dot1.userData.snapName, 'ConnectionSnapCustom01', 'Dot 1 must have custom snap name');
assert.strictEqual(dot1.userData.isCustomSnapPoint, true, 'Dot 1 must be marked as custom snap point');
assert.strictEqual(dot1.position.x, -550, 'Dot 1 X coordinate must match custom position (-550)');
assert.strictEqual(dot1.position.y, -180, 'Dot 1 Y coordinate must match custom position (-180)');
assert.strictEqual(dot1.position.z, -850, 'Dot 1 Z coordinate must match custom position (-850)');

console.log('[OK] Blueprint module rendered with custom snap points from custom-snap-points.json:');
console.log(`     Snap 1: ${dot1.userData.snapName} at [${dot1.position.x}, ${dot1.position.y}, ${dot1.position.z}]`);
console.log(`     Snap 2: ${dot2.userData.snapName} at [${dot2.position.x}, ${dot2.position.y}, ${dot2.position.z}]`);

// 5. Verify uncustomized module #2 uses baseline snap points
assert.strictEqual(renderedMod2.userData.hasCustomSnapPoints, false, 'Module 2 must not have custom snap points');
const snapsGroup2 = renderedMod2.getObjectByName('module_snaps_group');
assert(snapsGroup2, 'Rendered module 2 must have module_snaps_group');
assert(snapsGroup2.children.length >= 4, 'Module 2 must use baseline snap points');
console.log(`[OK] Uncustomized blueprint module 2 rendered with baseline snap points (${snapsGroup2.children.length} points).`);

// 6. Cleanup custom snap points and verify restore
removeCustomSnapPointEntry(testMacro);
assert.strictEqual(hasCustomSnapPointsForMacro(testMacro), false, 'hasCustomSnapPointsForMacro must be false after removal');

const reloadedSnaps = getModuleSnapPoints(testMacro);
assert.strictEqual(reloadedSnaps.length, baselineSnaps.length, 'Reverted snaps length must match baseline');
assert.strictEqual(reloadedSnaps[0].name, baselineSnaps[0].name, 'Reverted first snap name must match baseline');
console.log('[OK] Removing custom snap point entry cleanly restores baseline snap points.');

console.log('\n[SUCCESS] All custom-snap-points.json blueprint rendering tests passed cleanly!');
process.exit(0);
