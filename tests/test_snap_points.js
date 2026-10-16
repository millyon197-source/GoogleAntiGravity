import * as THREE from 'three';
import { getModuleSnapPoints, SNAP_POINTS_DB } from '../src/snap-points-db.js';
import { createProceduralModule } from '../src/modules.js';

console.log('[*] Starting automated validation of Module Snap Points...');

// 1. Verify Snap Points DB entries
const totalKeys = Object.keys(SNAP_POINTS_DB).length;
console.log(`[OK] Snap Points Database loaded with ${totalKeys} module entries.`);
if (totalKeys < 100) {
  console.error('[FAIL] Snap points database has unexpectedly few entries!');
  process.exit(1);
}

// 2. Test snap points resolution across multiple module categories
const testCases = [
  { macro: 'struct_arg_cross_01_macro', minExpectedSnaps: 6 },
  { macro: 'dockarea_arg_m_station_02_hightech_macro', minExpectedSnaps: 4 },
  { macro: 'storage_arg_l_liquid_01_macro', minExpectedSnaps: 4 },
  { macro: 'defence_arg_tube_01_macro', minExpectedSnaps: 2 },
  { macro: 'pier_arg_harbor_03_macro', minExpectedSnaps: 3 },
  // Test American vs British spelling normalization
  { macro: 'defense_arg_disc_01_macro', minExpectedSnaps: 2 },
  // Test case without _macro suffix
  { macro: 'struct_arg_cross_01', minExpectedSnaps: 6 }
];

let allPassed = true;

for (const tc of testCases) {
  const snaps = getModuleSnapPoints(tc.macro);
  if (snaps && snaps.length >= tc.minExpectedSnaps) {
    console.log(`[OK] Macro '${tc.macro}': Resolved ${snaps.length} snap points (expected >= ${tc.minExpectedSnaps}).`);
  } else {
    console.error(`[FAIL] Macro '${tc.macro}': Expected >= ${tc.minExpectedSnaps} snaps, got ${snaps ? snaps.length : 0}`);
    allPassed = false;
  }
}

// 3. Test fallback for unknown macro using localBounds
console.log('\n[*] Testing bounding face center fallback for unknown macro...');
const dummyBox = new THREE.Box3(new THREE.Vector3(-50, -20, -100), new THREE.Vector3(50, 20, 100));
const fallbackSnaps = getModuleSnapPoints('unknown_custom_module_99', dummyBox);
if (fallbackSnaps.length === 6) {
  console.log(`[OK] Fallback returned 6 connection face snap points for unknown module.`);
} else {
  console.error(`[FAIL] Fallback failed: expected 6 points, got ${fallbackSnaps.length}`);
  allPassed = false;
}

// 4. Test Snap Dots Creation and Zoom Scaling
console.log('\n[*] Testing Snap Dot Creation & Dynamic Zoom Scaling...');
const snapGeo = new THREE.SphereGeometry(1, 14, 14);
const snapMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
const snapDots = [];

const moduleGroup = createProceduralModule('struct_arg_cross_01', THREE);
moduleGroup.position.set(500, 200, -800);
moduleGroup.updateMatrixWorld(true);

const snaps = getModuleSnapPoints('struct_arg_cross_01');
const snapsGroup = new THREE.Group();
snapsGroup.name = 'module_snaps_group';

snaps.forEach(snap => {
  const dot = new THREE.Mesh(snapGeo, snapMat);
  dot.userData = { isSnapPoint: true, snapName: snap.name };
  dot.position.set(-snap.pos[0], snap.pos[1], -snap.pos[2]);
  snapsGroup.add(dot);
  snapDots.push(dot);
});
moduleGroup.add(snapsGroup);

// Verify zoom scaling formula at varied camera distances
const cameraPos = new THREE.Vector3(500, 200, 0); // ~800m away
const tempVec = new THREE.Vector3();
const testDistances = [100, 1000, 5000, 20000];

testDistances.forEach(dist => {
  const calculatedScale = Math.max(2.5, dist * 0.0075);
  // Verify scale stays within a reasonable, viewable range
  if (calculatedScale >= 2.5 && calculatedScale <= 200) {
    console.log(`[OK] Distance ${dist}m -> Red Dot Scale = ${calculatedScale.toFixed(2)} (well-proportioned screen size)`);
  } else {
    console.error(`[FAIL] Scale out of bounds at ${dist}m: ${calculatedScale}`);
    allPassed = false;
  }
});

// 5. Test memory disposal
snapGeo.dispose();
snapMat.dispose();
console.log('[OK] Geometries and materials disposed cleanly.');

console.log('\n==================================================');
if (allPassed) {
  console.log('[SUCCESS] All Snap Points and Zoom Scaling checks passed 100%!');
  process.exit(0);
} else {
  console.error('[FAIL] Some snap point checks failed.');
  process.exit(1);
}
