import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Module Animations Gated by "Toggle Module Components"...');

// 1. Create StationViewer instance
const viewer = Object.create(StationViewer.prototype);
viewer.modulesGroup = new THREE.Group();
viewer.scene = new THREE.Scene();
viewer.scene.add(viewer.modulesGroup);
viewer.animatedParts = [];
viewer.animatedTextures = [];
viewer.haltedModuleAnimations = new Set();
viewer.moduleComponentSelections = new Map();
viewer.componentsToggledModuleIndex = null; // Explicitly initialized to null (outside Toggle Module Components)

// Mock asset entry resolution
viewer.resolveModuleAssetEntry = (macro) => {
  if (macro === 'prod_arg_wheat_macro') {
    return {
      baseName: 'prod_arg_wheat',
      folderPath: '/assets1/structures/production/prod_arg_wheat_data',
      defaultFiles: ['anim_crane_holder-lod0.dae', 'anim_arm-lod0.dae', 'part_main-lod0.dae']
    };
  }
  return {
    baseName: macro.replace('_macro', ''),
    folderPath: `/assets1/structures/production/${macro.replace('_macro', '')}_data`,
    defaultFiles: ['part_main-lod0.dae']
  };
};

viewer.getModuleActiveComponentFiles = StationViewer.prototype.getModuleActiveComponentFiles;
viewer.shouldAnimateModule = StationViewer.prototype.shouldAnimateModule;
viewer.setModuleComponentsToggled = StationViewer.prototype.setModuleComponentsToggled;
viewer.isModuleComponentsToggled = StationViewer.prototype.isModuleComponentsToggled;
viewer.setModuleComponentFiles = StationViewer.prototype.setModuleComponentFiles;
viewer.limitModuleLights = () => {};

// Mock loadModuleMesh that checks shouldAnimateModule
viewer.loadModuleMesh = async (mod) => {
  const root = new THREE.Group();
  const meshGroup = new THREE.Group();
  meshGroup.name = 'module_mesh_group';
  root.add(meshGroup);

  const canAnimate = viewer.shouldAnimateModule(mod?.index);
  if (canAnimate && mod.macro === 'prod_arg_wheat_macro') {
    const craneMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    craneMesh.name = 'anim_crane_holder';
    meshGroup.add(craneMesh);
    viewer.animatedParts.push({
      object: craneMesh,
      moduleIndex: mod.index,
      update: (time) => { craneMesh.position.x = Math.sin(time); }
    });

    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    armMesh.name = 'anim_arm';
    meshGroup.add(armMesh);
    viewer.animatedParts.push({
      object: armMesh,
      moduleIndex: mod.index,
      update: (time) => { armMesh.position.z = Math.cos(time); }
    });

    const tex = new THREE.Texture();
    viewer.animatedTextures.push({
      texture: tex,
      speedX: 0.1,
      speedY: 0.0,
      moduleIndex: mod.index
    });
  } else {
    const staticMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    staticMesh.name = 'part_main';
    meshGroup.add(staticMesh);
  }

  return root;
};

// 2. Simulate Loading Station Plan (outside "Toggle Module Components")
console.log('  [1] Verifying station plan loading creates NO module animations...');
assert.strictEqual(viewer.componentsToggledModuleIndex, null, 'componentsToggledModuleIndex must be null initially');

const modWheat = new THREE.Group();
modWheat.userData = { index: 1, macro: 'prod_arg_wheat_macro' };
const initialMeshGroup = (await viewer.loadModuleMesh({ index: 1, macro: 'prod_arg_wheat_macro' })).getObjectByName('module_mesh_group');
modWheat.add(initialMeshGroup);
viewer.modulesGroup.add(modWheat);

assert.strictEqual(viewer.shouldAnimateModule(1), false, 'shouldAnimateModule(1) must be false outside of Toggle Module Components');
assert.strictEqual(viewer.animatedParts.length, 0, 'No animated parts must be created during plan load');
assert.strictEqual(viewer.animatedTextures.length, 0, 'No animated textures must be created during plan load');
console.log('  ✓ [PASS] Zero animations created for modules during normal render/plan load');

// 3. User clicks "Toggle Module Components" on Module 1
console.log('  [2] Verifying "Toggle Module Components" creates animations for the toggled module...');
await viewer.setModuleComponentsToggled(1, true);

assert.strictEqual(viewer.isModuleComponentsToggled(1), true, 'Module 1 must be flagged as components toggled');
assert.strictEqual(viewer.shouldAnimateModule(1), true, 'shouldAnimateModule(1) must be true when components toggled');
assert.strictEqual(viewer.animatedParts.length, 2, 'Module 1 must now have its 2 animated parts created');
assert.strictEqual(viewer.animatedTextures.length, 1, 'Module 1 must now have its animated texture created');
console.log('  ✓ [PASS] Animations successfully created upon "Toggle Module Components"');

// 4. Update Loop Execution
console.log('  [3] Verifying update loop executes for toggled module and skips untoggled modules...');
viewer.updateAnimatedParts = StationViewer.prototype.updateAnimatedParts;
const crane = viewer.animatedParts.find(p => p.object.name === 'anim_crane_holder');
assert.ok(crane, 'Crane anim part must exist');

viewer.updateAnimatedParts(1.5, 0.016);
assert.strictEqual(crane.object.position.x, Math.sin(1.5), 'Toggled module animations must actively execute');

// 5. User Closes / Minimizes "Toggle Module Components"
console.log('  [4] Verifying closing "Toggle Module Components" cleans up animations...');
await viewer.setModuleComponentsToggled(1, false);

assert.strictEqual(viewer.isModuleComponentsToggled(1), false, 'Module 1 must no longer be components toggled');
assert.strictEqual(viewer.shouldAnimateModule(1), false, 'shouldAnimateModule(1) must return false');
assert.strictEqual(viewer.animatedParts.length, 0, 'All animated parts must be removed on untoggle');
assert.strictEqual(viewer.animatedTextures.length, 0, 'All animated textures must be removed on untoggle');
console.log('  ✓ [PASS] Closing "Toggle Module Components" completely cleans up module animations');

// 6. Switching "Toggle Module Components" to another module
console.log('  [5] Verifying toggling components on Module 2 clears Module 1 animations...');
const modWheat2 = new THREE.Group();
modWheat2.userData = { index: 2, macro: 'prod_arg_wheat_macro' };
const initialMeshGroup2 = (await viewer.loadModuleMesh({ index: 2, macro: 'prod_arg_wheat_macro' })).getObjectByName('module_mesh_group');
modWheat2.add(initialMeshGroup2);
viewer.modulesGroup.add(modWheat2);

await viewer.setModuleComponentsToggled(1, true);
assert.strictEqual(viewer.animatedParts.length, 2);
assert.strictEqual(viewer.componentsToggledModuleIndex, 1);

// Switch directly to module 2
await viewer.setModuleComponentsToggled(2, true);
assert.strictEqual(viewer.componentsToggledModuleIndex, 2);
assert.strictEqual(viewer.isModuleComponentsToggled(1), false);
assert.strictEqual(viewer.isModuleComponentsToggled(2), true);
assert.ok(viewer.animatedParts.every(p => p.moduleIndex === 2), 'Only Module 2 animations should exist');
assert.strictEqual(viewer.animatedParts.length, 2);
console.log('  ✓ [PASS] Switching toggled module properly hands off animation ownership');

console.log('\n[SUCCESS] All "Toggle Module Components" animation gating tests passed cleanly!');
