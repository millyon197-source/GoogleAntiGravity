import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing active gizmo visibility within display when zoomed in on a module while zooming...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Setup mock DOM environment
const mockContainer = {
  clientWidth: 1920,
  clientHeight: 1080,
  innerHTML: '',
  appendChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.document = {
  getElementById: () => null,
  createElement: () => ({
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  }),
  querySelectorAll: () => []
};

// 2. Initialize StationViewer in a lightweight test environment
const viewer = Object.create(StationViewer.prototype);
viewer.scene = new THREE.Scene();

// Setup test camera
viewer.camera = new THREE.PerspectiveCamera(60, 1920 / 1080, 1, 30000);
viewer.camera.position.set(0, 0, 500);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);

viewer.controls = {
  target: new THREE.Vector3(0, 0, 0),
  update: () => {}
};

// Create a target module with transform gizmo attached
const testModule = new THREE.Group();
testModule.userData = { index: 0, macro: 'test_macro' };
testModule.position.set(0, 0, 0);
viewer.scene.add(testModule);

viewer.transformControls = {
  object: testModule,
  dragging: false,
  visible: true,
  enabled: true
};

console.log('\n--- Test 1: Inactive Gizmo Check ---');
viewer.transformControls.object = null;
const origCamPos = viewer.camera.position.clone();
viewer._isZooming = true;
viewer.ensureActiveGizmoVisible({ isZooming: true });
assert(viewer.camera.position.equals(origCamPos), 'When gizmo is not attached, camera position remains untouched');

console.log('\n--- Test 2: Active Gizmo Within Viewport Display ---');
viewer.transformControls.object = testModule;
testModule.position.set(0, 0, 0);
viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

viewer.ensureActiveGizmoVisible({ isZooming: true });
assert(viewer.camera.position.distanceTo(new THREE.Vector3(0, 0, 300)) < 0.001,
  'When gizmo is centered in the display, camera position remains unchanged');

console.log('\n--- Test 3: Gizmo Drifting Off Right Edge Clamped to Safe Display Margin ---');
// Position module far to the right in screen space
testModule.position.set(400, 0, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

// Check initial NDC X before constraint
let camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
let zDist = -camSpace.z;
let fovRad = THREE.MathUtils.degToRad(viewer.camera.fov);
let halfH = zDist * Math.tan(fovRad / 2);
let halfW = halfH * viewer.camera.aspect;
let initialNdcX = camSpace.x / halfW;
assert(initialNdcX > 1.0, `Initial gizmo position is off-screen to the right (NDC X: ${initialNdcX.toFixed(2)} > 1.0)`);

// Apply visibility enforcement while zooming
viewer.ensureActiveGizmoVisible({ isZooming: true });

// Check new NDC X after constraint
camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
zDist = -camSpace.z;
halfH = zDist * Math.tan(fovRad / 2);
halfW = halfH * viewer.camera.aspect;
let newNdcX = camSpace.x / halfW;

assert(Math.abs(newNdcX - 0.70) < 0.01, `Gizmo clamped to exactly safe display margin (NDC X: ${newNdcX.toFixed(2)} <= 0.70)`);
assert(newNdcX <= 0.701 && newNdcX >= -0.701, 'Gizmo is now comfortably visible inside display');

console.log('\n--- Test 4: Gizmo Drifting Off Top Edge Clamped to Safe Display Margin ---');
testModule.position.set(0, 300, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

viewer.ensureActiveGizmoVisible({ isZooming: true });

camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
zDist = -camSpace.z;
halfH = zDist * Math.tan(fovRad / 2);
let newNdcY = camSpace.y / halfH;

assert(Math.abs(newNdcY - 0.70) < 0.01, `Gizmo clamped from off-top to safe display margin (NDC Y: ${newNdcY.toFixed(2)} <= 0.70)`);

console.log('\n--- Test 5: Camera Too Close to Gizmo (Near Plane Clipping Prevention) ---');
// Place camera only 2 meters away from module
testModule.position.set(0, 0, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 2);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

viewer.ensureActiveGizmoVisible({ isZooming: true });

camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
zDist = -camSpace.z;

assert(zDist >= 15, `Camera backed up to safe viewing distance (zDist: ${zDist.toFixed(1)}m >= 15m) to avoid near clipping`);

console.log('\n--- Test 6: Camera Dollied Past Gizmo (Gizmo Behind Camera) ---');
// Place camera at z = -50 while module is at z = 0, camera facing -z
testModule.position.set(0, 0, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, -50);
viewer.camera.lookAt(0, 0, -100);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, -100);

camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
assert(camSpace.z > 0, 'Module is initially behind the camera (camSpace.z > 0)');

viewer.ensureActiveGizmoVisible({ isZooming: true });

camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
zDist = -camSpace.z;
assert(zDist >= 15, `Camera repositioned so gizmo is back in front of camera (zDist: ${zDist.toFixed(1)}m >= 15m)`);

console.log('\n--- Test 7: Manual Panning Ignored (Not Zooming) ---');
testModule.position.set(500, 0, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

viewer._isZooming = false; // User is panning, NOT zooming
const camBeforePan = viewer.camera.position.clone();
viewer.ensureActiveGizmoVisible({ isZooming: false, force: false });

assert(viewer.camera.position.equals(camBeforePan),
  'When user is panning (isZooming is false), camera position is not altered, preserving manual pan freedom');

console.log('\n--- Test 8: Multi-Step Zoom In Simulation ---');
// Simulate zooming in from distance 1000m to 50m while off-center
testModule.position.set(100, 50, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 1000);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

let allStepsVisible = true;
// Simulate 15 consecutive zoom-in steps (dolly factor 0.85 per step)
for (let step = 0; step < 15; step++) {
  // Simulate zoom moving camera in by 15% towards off-center point (300, 200, 0)
  const dollyTarget = new THREE.Vector3(300, 200, 0);
  viewer.camera.position.lerp(dollyTarget, 0.15);
  viewer.camera.updateMatrixWorld(true);

  // Apply visibility constraint during zoom
  viewer.ensureActiveGizmoVisible({ isZooming: true });

  camSpace = testModule.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
  zDist = -camSpace.z;
  halfH = zDist * Math.tan(fovRad / 2);
  halfW = halfH * viewer.camera.aspect;
  const currentNdcX = camSpace.x / halfW;
  const currentNdcY = camSpace.y / halfH;

  if (Math.abs(currentNdcX) > 0.701 || Math.abs(currentNdcY) > 0.701 || zDist < 14.9) {
    allStepsVisible = false;
    console.error(`Step ${step} failed: NDC=(${currentNdcX.toFixed(2)}, ${currentNdcY.toFixed(2)}), zDist=${zDist.toFixed(1)}`);
  }
}

assert(allStepsVisible, 'Across all 15 continuous zoom-in steps, gizmo remained strictly inside safe display margins and in front of camera');

if (allPassed) {
  console.log('\n[PASS] All active gizmo visibility during zoom tests passed successfully!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Some tests failed.');
  process.exit(1);
}
