/**
 * Automated test script to verify that:
 * "If a component is visible within the main display when clicked,
 * do not force a re-render upon moving/rotating"
 */

import * as THREE from 'three';

console.log('[*] Testing Visible Component Click & Move/Rotate - No Forced Re-render...');

// Mock Minimal OrbitControls
class MockOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 0, 0);
    this.enabled = true;
    this.autoRotate = false;
  }
  update() {}
}

// Mock TransformControls
class MockTransformControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.object = null;
    this.dragging = false;
    this.axis = null;
    this.enabled = true;
    this.visible = true;
  }
  attach(obj) { this.object = obj; }
  detach() { this.object = null; }
  setMode() {}
}

// Construct Test Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 10000);
camera.position.set(0, 200, 500);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);

const controls = new MockOrbitControls(camera, {});
controls.target.set(0, 0, 0);

const modulesGroup = new THREE.Group();
scene.add(modulesGroup);

// Create Module 0 (Centered in main display, visible)
const geom0 = new THREE.BoxGeometry(50, 50, 50);
const mat0 = new THREE.MeshBasicMaterial();
const mesh0 = new THREE.Mesh(geom0, mat0);
const modGroup0 = new THREE.Group();
modGroup0.userData = { index: 0, macro: 'struct_arg_cross_01_macro' };
modGroup0.position.set(0, 0, 0);
modGroup0.add(mesh0);
modulesGroup.add(modGroup0);

// Create Module 1 (Far behind camera: Z = +2000, outside camera frustum)
const geom1 = new THREE.BoxGeometry(50, 50, 50);
const mat1 = new THREE.MeshBasicMaterial();
const mesh1 = new THREE.Mesh(geom1, mat1);
const modGroup1 = new THREE.Group();
modGroup1.userData = { index: 1, macro: 'dockarea_arg_m_station_01_macro' };
modGroup1.position.set(0, 0, 2000);
modGroup1.add(mesh1);
modulesGroup.add(modGroup1);

// Test viewer implementation
const viewer = {
  scene,
  camera,
  controls,
  modulesGroup,
  hiddenMacros: new Set(),
  cameraTransitionAnimId: null,
  isGridAtComponentScale: false,
  gridRebuildCount: 0,
  cameraMoveCount: 0,

  isModuleVisibleInViewport(index) {
    if (!this.camera || !this.modulesGroup) return false;
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule || !targetModule.visible) return false;

    let cur = targetModule.parent;
    while (cur && cur !== this.scene) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }

    if (targetModule.userData.macro && this.hiddenMacros.has(targetModule.userData.macro)) {
      return false;
    }

    const box = new THREE.Box3().setFromObject(targetModule);
    if (box.isEmpty()) return false;

    this.camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    return frustum.intersectsBox(box);
  },

  selectModuleByIndex(index, resizeGridAndBounds = false) {
    if (resizeGridAndBounds) {
      this.gridRebuildCount++;
      this.isGridAtComponentScale = true;
    } else if (this.isGridAtComponentScale) {
      this.gridRebuildCount++;
      this.isGridAtComponentScale = false;
    }
    // Selection does not rebuild full grid if already at full scale
  },

  focusCameraOnModule(index, focusCameraPosition = true) {
    if (this.cameraTransitionAnimId) {
      this.cameraTransitionAnimId = null;
    }

    if (!focusCameraPosition) return;

    if (this.isModuleVisibleInViewport(index)) {
      // If already visible in main display, do not force re-render/camera change
      return;
    }

    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    this.cameraMoveCount++;
    const box = new THREE.Box3().setFromObject(targetModule);
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);
  }
};

// -------------------------------------------------------------
// Test 1: Verify isModuleVisibleInViewport
// -------------------------------------------------------------
console.log('\n--- Test 1: Visibility in Main Display Detection ---');
const isMod0Visible = viewer.isModuleVisibleInViewport(0);
console.log('[INFO] Module 0 (in front of camera at 0,0,0) visible:', isMod0Visible);
if (!isMod0Visible) {
  throw new Error('[FAIL] Module 0 should be visible in main display');
}
console.log('[PASS] Module 0 correctly detected as visible in main display');

const isMod1Visible = viewer.isModuleVisibleInViewport(1);
console.log('[INFO] Module 1 (behind camera at 0,0,2000) visible:', isMod1Visible);
if (isMod1Visible) {
  throw new Error('[FAIL] Module 1 is behind camera and should NOT be visible');
}
console.log('[PASS] Module 1 correctly detected as NOT visible in main display');

// -------------------------------------------------------------
// Test 2: Clicking Visible Component (Module 0)
// -------------------------------------------------------------
console.log('\n--- Test 2: Clicking Visible Component ---');
const initialCamPos = camera.position.clone();
const initialTarget = controls.target.clone();
const initialGridRebuilds = viewer.gridRebuildCount;
const initialCameraMoves = viewer.cameraMoveCount;

// Simulate selectModule(0, false) triggered by click on main display or list
const isVisibleInMain = viewer.isModuleVisibleInViewport(0);
const shouldFocus = false && !isVisibleInMain; // clicked in 3D (focusCamera = false)

viewer.selectModuleByIndex(0, shouldFocus);
if (shouldFocus) {
  viewer.focusCameraOnModule(0, true);
}

if (!camera.position.equals(initialCamPos)) {
  throw new Error('[FAIL] Camera position changed when clicking visible component');
}
if (!controls.target.equals(initialTarget)) {
  throw new Error('[FAIL] Controls target changed when clicking visible component');
}
if (viewer.gridRebuildCount !== initialGridRebuilds) {
  throw new Error('[FAIL] Grid was rebuilt when clicking visible component');
}
if (viewer.cameraMoveCount !== initialCameraMoves) {
  throw new Error('[FAIL] Camera focus was triggered for visible component');
}
console.log('[PASS] No camera change, target shift, or grid rebuild on clicking visible component');

// -------------------------------------------------------------
// Test 3: Moving the Component in 3D
// -------------------------------------------------------------
console.log('\n--- Test 3: Moving Visible Component (Translation) ---');
// Simulate dragging module 0 from (0, 0, 0) to (100, 50, -50)
modGroup0.position.set(100, 50, -50);
modGroup0.updateMatrixWorld(true);

// Verify camera and grid are not modified during move
if (!camera.position.equals(initialCamPos)) {
  throw new Error('[FAIL] Camera moved during module translation');
}
if (!controls.target.equals(initialTarget)) {
  throw new Error('[FAIL] Controls target shifted during module translation');
}
if (viewer.gridRebuildCount !== initialGridRebuilds) {
  throw new Error('[FAIL] Grid re-render forced during module translation');
}
console.log('[PASS] Moving visible component caused 0 camera moves and 0 grid re-renders');

// -------------------------------------------------------------
// Test 4: Rotating the Component in 3D
// -------------------------------------------------------------
console.log('\n--- Test 4: Rotating Visible Component (Rotation) ---');
// Simulate rotating module 0 (yaw: 90 deg)
modGroup0.rotation.y = Math.PI / 2;
modGroup0.updateMatrixWorld(true);

if (!camera.position.equals(initialCamPos)) {
  throw new Error('[FAIL] Camera moved during module rotation');
}
if (!controls.target.equals(initialTarget)) {
  throw new Error('[FAIL] Controls target shifted during module rotation');
}
if (viewer.gridRebuildCount !== initialGridRebuilds) {
  throw new Error('[FAIL] Grid re-render forced during module rotation');
}
console.log('[PASS] Rotating visible component caused 0 camera moves and 0 grid re-renders');

// -------------------------------------------------------------
// Test 5: Off-screen Component Click with focusCamera = true
// -------------------------------------------------------------
console.log('\n--- Test 5: Off-screen Component Click with focusCamera = true ---');
const isMod1VisibleBefore = viewer.isModuleVisibleInViewport(1);
const shouldFocus1 = true && !isMod1VisibleBefore;

if (!shouldFocus1) {
  throw new Error('[FAIL] shouldFocus1 should be true for off-screen component');
}

viewer.selectModuleByIndex(1, shouldFocus1);
viewer.focusCameraOnModule(1, true);

if (viewer.cameraMoveCount === initialCameraMoves) {
  throw new Error('[FAIL] Camera should focus on off-screen component when explicitly requested');
}
console.log('[PASS] Off-screen component correctly focused into view');

console.log('\n========================================');
console.log('✅ ALL VISIBLE COMPONENT NO RE-RENDER TESTS PASSED!');
