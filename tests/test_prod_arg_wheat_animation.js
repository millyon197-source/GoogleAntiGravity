import assert from 'node:assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };
import PART_PARENTS from '../src/component-part-parents.json' with { type: 'json' };
import { loadModuleMesh, loadModuleAniClips } from '@x4/adapter-three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The game's own animation file, read from disk the way the viewer fetches it
const fetchLocal = async (url) => {
  const file = path.join(root, url.replace(/^\//, ''));
  if (!fs.existsSync(file)) return { ok: false };
  const buf = fs.readFileSync(file);
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

console.log('[*] Testing prod_arg_wheat Hierarchy, Component Offsets & Crane Animation Pipeline...');

// 1. Verify component discovery for prod_arg_wheat
const viewer = Object.create(StationViewer.prototype);
const entry = viewer.resolveModuleAssetEntry('prod_arg_wheat_macro');
assert.strictEqual(entry.baseName, 'prod_arg_wheat', 'baseName must match prod_arg_wheat');
assert.ok(entry.defaultFiles.includes('anim_main-lod0.dae'), 'must include anim_main-lod0.dae');
assert.ok(entry.defaultFiles.includes('anim_crane_holder-lod0.dae'), 'must include anim_crane_holder-lod0.dae');
assert.ok(entry.defaultFiles.includes('anim_arm-lod0.dae'), 'must include anim_arm-lod0.dae');
console.log('  ✓ [PASS] resolveModuleAssetEntry discovers anim_main, anim_crane_holder, and anim_arm');

// 2. Offsets are in component space (generated from the XML); the hierarchy comes from component-part-parents.json
const offsets = COMPONENT_OFFSETS['prod_arg_wheat'];
assert.ok(offsets, 'prod_arg_wheat offsets must exist');
const near = (got, want, msg) => assert.ok(Array.isArray(got) && want.every((w, i) => Math.abs(got[i] - w) < 0.001), `${msg}: ${JSON.stringify(got)}`);
near(offsets['anim_main'], [0, -2.039436, 15.72672], 'anim_main offset');
near(offsets['anim_crane_holder'], [174.896, -40.67284, -526.8585], 'anim_crane_holder offset');
near(offsets['anim_arm'], [162.1404, -47.17998, -616.5664], 'anim_arm offset');
assert.deepStrictEqual(PART_PARENTS['prod_arg_wheat'], { anim_arm: 'anim_crane_holder', anim_crane_holder: 'anim_main' }, 'crane chain from the XML');
console.log('  ✓ [PASS] Component-space offsets and the XML crane chain verified');

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
  shouldAnimateModule: () => true,
  loadModuleAnimations: (folder) => loadModuleAniClips(folder, fetchLocal),
  animatedParts: []
};

const moduleRoot = await loadModuleMesh(mockHost, { macro: 'prod_arg_wheat_macro', index: 0 }, { componentOffsets: COMPONENT_OFFSETS, partParents: PART_PARENTS });
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

// 5. Animation comes from the game's PROD_ARG_WHEAT_DATA.ANI (mode_active, 66.67 s), nothing hand-made
const haveAni = fs.existsSync(path.join(root, 'assets1/structures/production/PROD_ARG_WHEAT_DATA.ANI'));
if (haveAni) {
  const craneAnim = mockHost.animatedParts.find(p => p.object === craneHolder);
  const armAnim = mockHost.animatedParts.find(p => p.object === animArm);
  assert.ok(craneAnim && craneAnim.source === 'ani', 'anim_crane_holder animated from the .ANI');
  assert.ok(armAnim && armAnim.source === 'ani', 'anim_arm animated from the .ANI');

  craneAnim.update(0);
  armAnim.update(0);
  const craneRest = craneHolder.position.clone();
  const armRest = animArm.position.clone();
  moduleRoot.updateMatrixWorld(true);
  const armWorld0 = animArm.getWorldPosition(new THREE.Vector3());

  // At 6.67 s the crane has run +228.5 m along its rail (x) and the arm reached +151.4 m (z)
  craneAnim.update(6.67);
  armAnim.update(6.67);
  moduleRoot.updateMatrixWorld(true);
  assert.ok(Math.abs(craneHolder.position.x - craneRest.x - 228.514) < 0.5, `crane x at 6.67 s: +${(craneHolder.position.x - craneRest.x).toFixed(2)}`);
  assert.ok(Math.abs(animArm.position.z - armRest.z - 151.383) < 0.5, `arm z at 6.67 s: +${(animArm.position.z - armRest.z).toFixed(2)}`);
  // The arm hangs off the crane holder, so it rides along the rail with it
  const armWorld6 = animArm.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(armWorld6.x - armWorld0.x - 228.514) < 0.5, 'arm carried along x by the crane holder');

  // End of the cycle: back at rest
  craneAnim.update(66.667);
  armAnim.update(66.667);
  assert.ok(craneHolder.position.distanceTo(craneRest) < 0.05, 'crane back at rest at the end of the cycle');
  assert.ok(animArm.position.distanceTo(armRest) < 0.05, 'arm back at rest at the end of the cycle');
  console.log('  ✓ [PASS] Crane runs its rail and the arm rides with it, from the game animation');
} else {
  console.log('  - game animation file not present; animation checks skipped');
}
console.log('\n[SUCCESS] All prod_arg_wheat crane and arm positioning/animation tests passed!');
