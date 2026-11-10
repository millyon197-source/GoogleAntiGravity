import assert from 'node:assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };
import {
  loadModuleMesh,
  CRANE_HOLDER_KEYFRAMES,
  CRANE_ARM_KEYFRAMES,
  interpolateKeyframes
} from '@x4/adapter-three';

console.log('[*] Testing prod_arg_wheat Hierarchy, Component Offsets & Crane Animation Pipeline...');

// 1. Verify component discovery for prod_arg_wheat
const viewer = Object.create(StationViewer.prototype);
const entry = viewer.resolveModuleAssetEntry('prod_arg_wheat_macro');
assert.strictEqual(entry.baseName, 'prod_arg_wheat', 'baseName must match prod_arg_wheat');
assert.ok(entry.defaultFiles.includes('anim_main-lod0.dae'), 'must include anim_main-lod0.dae');
assert.ok(entry.defaultFiles.includes('anim_crane_holder-lod0.dae'), 'must include anim_crane_holder-lod0.dae');
assert.ok(entry.defaultFiles.includes('anim_arm-lod0.dae'), 'must include anim_arm-lod0.dae');
console.log('  ✓ [PASS] resolveModuleAssetEntry discovers anim_main, anim_crane_holder, and anim_arm');

// 2. Verify component connection offsets in component-offsets.json
const offsets = COMPONENT_OFFSETS['prod_arg_wheat'];
assert.ok(offsets, 'prod_arg_wheat offsets must exist');
assert.deepStrictEqual(offsets['anim_main'], [0, -2.0394, 15.7267], 'anim_main offset');
assert.deepStrictEqual(offsets['anim_crane_holder'], [174.896, -38.6334, -542.5852], 'anim_crane_holder local offset relative to anim_main');
assert.deepStrictEqual(offsets['anim_arm'], [-12.7555, -6.5071, -89.7079], 'anim_arm local offset relative to anim_crane_holder');
console.log('  ✓ [PASS] Authentic local connection offsets verified in component-offsets.json');

// 3. Test loadModuleMesh hierarchical parenting and rest placement
const mockHost = {
  resolveModuleAssetEntry: () => entry,
  getModuleActiveComponentFiles: () => [
    'anim_main-lod0.dae',
    'anim_crane_holder-lod0.dae',
    'anim_arm-lod0.dae',
    'detail_s_main-lod0.dae'
  ],
  loadBinaryModel: async () => null,
  loadColladaModel: async (url) => {
    const partName = url.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();
    const grp = new THREE.Group();
    grp.name = partName;
    grp.userData = { partName, sourceUrl: url };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
    mesh.name = partName + '_mesh';
    grp.add(mesh);
    return grp;
  },
  applyTexturesToMeshGroup: async () => {},
  animatedParts: []
};

const moduleRoot = await loadModuleMesh(mockHost, { macro: 'prod_arg_wheat_macro', index: 0 }, { componentOffsets: COMPONENT_OFFSETS });
assert.ok(moduleRoot, 'moduleRoot must load');

const meshGroup = moduleRoot.getObjectByName('module_mesh_group');
assert.ok(meshGroup, 'module_mesh_group must exist');

const animMain = meshGroup.getObjectByName('anim_main');
assert.ok(animMain, 'anim_main must be loaded in hierarchy');
assert.strictEqual(animMain.parent, meshGroup, 'anim_main must be child of module_mesh_group');

const craneHolder = animMain.getObjectByName('anim_crane_holder');
assert.ok(craneHolder, 'anim_crane_holder must be found');
assert.strictEqual(craneHolder.parent, animMain, 'anim_crane_holder must be parented to anim_main');

const animArm = craneHolder.getObjectByName('anim_arm');
assert.ok(animArm, 'anim_arm must be found');
assert.strictEqual(animArm.parent, craneHolder, 'anim_arm must be parented to anim_crane_holder');

console.log('  ✓ [PASS] Hierarchy verified: module_mesh_group -> anim_main -> anim_crane_holder -> anim_arm');

// 4. Verify composed world positions at rest (t = 0)
moduleRoot.updateMatrixWorld(true);

const mainWorldPos = new THREE.Vector3();
animMain.getWorldPosition(mainWorldPos);
assert.ok(Math.abs(mainWorldPos.x - 0) < 0.001, 'main world X');
assert.ok(Math.abs(mainWorldPos.y - (-2.0394)) < 0.001, 'main world Y');
assert.ok(Math.abs(mainWorldPos.z - 15.7267) < 0.001, 'main world Z');

const craneWorldPos = new THREE.Vector3();
craneHolder.getWorldPosition(craneWorldPos);
assert.ok(Math.abs(craneWorldPos.x - 174.896) < 0.001, 'crane world X must match composed X (174.896)');
assert.ok(Math.abs(craneWorldPos.y - (-40.67284)) < 0.005, 'crane world Y must match composed Y (-40.6728)');
assert.ok(Math.abs(craneWorldPos.z - (-526.8585)) < 0.005, 'crane world Z must match composed Z (-526.8585)');

const armWorldPos = new THREE.Vector3();
animArm.getWorldPosition(armWorldPos);
assert.ok(Math.abs(armWorldPos.x - 162.1405) < 0.005, 'arm world X must match composed X (162.1405)');
assert.ok(Math.abs(armWorldPos.y - (-47.18)) < 0.005, 'arm world Y must match composed Y (-47.18)');
assert.ok(Math.abs(armWorldPos.z - (-616.5664)) < 0.005, 'arm world Z must match composed Z (-616.5664)');
console.log('  ✓ [PASS] Rest world positions match generated connection compositions');

// 5. Test animation registration in animatedParts
const craneAnim = mockHost.animatedParts.find(p => p.object === craneHolder);
assert.ok(craneAnim, 'anim_crane_holder must be registered in animatedParts');
const armAnim = mockHost.animatedParts.find(p => p.object === animArm);
assert.ok(armAnim, 'anim_arm must be registered in animatedParts');

// 6. Test animation motion over cycle
// At t = 0
craneAnim.update(0);
armAnim.update(0);
moduleRoot.updateMatrixWorld(true);
assert.ok(Math.abs(craneHolder.position.x - 174.896) < 0.001, 'crane at rest t=0');
assert.ok(Math.abs(animArm.position.z - (-89.7079)) < 0.001, 'arm at rest t=0');

// At t = 6.67s (crane moves along X by +228.514, arm extends along Z by +151.383)
craneAnim.update(6.67);
armAnim.update(6.67);
moduleRoot.updateMatrixWorld(true);

const expectedCraneX = 174.896 + 228.514; // 403.41
assert.ok(Math.abs(craneHolder.position.x - expectedCraneX) < 0.05, `crane X at 6.67s (${craneHolder.position.x}) should be ~${expectedCraneX}`);
const expectedArmZ = -89.7079 + 151.383; // 61.6751
assert.ok(Math.abs(animArm.position.z - expectedArmZ) < 0.05, `arm Z at 6.67s (${animArm.position.z}) should be ~${expectedArmZ}`);

// Verify hierarchical synchronization: arm world position along X moved WITH crane holder!
const armWorldPos6s = new THREE.Vector3();
animArm.getWorldPosition(armWorldPos6s);
const expectedArmWorldX = expectedCraneX - 12.7555; // 390.6545
assert.ok(Math.abs(armWorldPos6s.x - expectedArmWorldX) < 0.05, `arm world X (${armWorldPos6s.x}) must move with crane holder (${expectedArmWorldX})`);

// At t = 13.33s (crane is stationary at 403.41 while working)
craneAnim.update(13.33);
assert.ok(Math.abs(craneHolder.position.x - expectedCraneX) < 0.05, 'crane X remains stationary during working period');

// At t = 23.33s (crane moves across to opposite side: deltaX = -311.015)
craneAnim.update(23.33);
const expectedCraneX23 = 174.896 - 311.015; // -136.119
assert.ok(Math.abs(craneHolder.position.x - expectedCraneX23) < 0.05, `crane X at 23.33s (${craneHolder.position.x}) should be ~${expectedCraneX23}`);

// At t = 66.67s (cycle completed, back to rest)
craneAnim.update(66.667);
armAnim.update(66.667);
assert.ok(Math.abs(craneHolder.position.x - 174.896) < 0.05, 'crane returns to rest at end of cycle');
assert.ok(Math.abs(animArm.position.z - (-89.7079)) < 0.05, 'arm returns to rest at end of cycle');

console.log('  ✓ [PASS] Mechanical animation loop verified: crane traverses X track, arm extends in Z hierarchically');
console.log('\n[SUCCESS] All prod_arg_wheat crane and arm positioning/animation tests passed!');
