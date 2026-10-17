import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing active gizmo repositioning to zoomed location and sizing appropriately when outside viewport...');

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
// Add a mesh child to testModule for raycasting
const geom = new THREE.BoxGeometry(100, 100, 100);
const mat = new THREE.MeshBasicMaterial();
const mesh = new THREE.Mesh(geom, mat);
testModule.add(mesh);
viewer.scene.add(testModule);
testModule.updateMatrixWorld(true);

viewer.transformControls = {
  object: testModule,
  dragging: false,
  visible: true,
  enabled: true,
  size: 0.85
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
testModule.updateMatrixWorld(true);
viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

const origModPos = testModule.position.clone();
viewer.ensureActiveGizmoVisible({ isZooming: true });
assert(viewer.camera.position.distanceTo(new THREE.Vector3(0, 0, 300)) < 0.001,
  'When gizmo is inside display, camera position remains untouched at zoomed location');
assert(testModule.position.distanceTo(origModPos) < 0.001,
  'When gizmo is inside display, gizmo position remains at module center');

console.log('\n--- Test 3: Gizmo Outside Viewport (Off Right Edge) Moves Gizmo to Zoomed Location ---');
// Module center is placed far to the right outside viewport
testModule.position.set(600, 0, 0);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 300);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);
viewer.controls.target.set(0, 0, 0);

// Camera remains at (0, 0, 300)
const camPosBefore = viewer.camera.position.clone();
viewer.ensureActiveGizmoVisible({ isZooming: true });

assert(viewer.camera.position.equals(camPosBefore),
  'Camera position is NEVER forcibly shifted away from the user zoom position');

assert(testModule.position.distanceTo(new THREE.Vector3(600, 0, 0)) < 0.001,
  'Target module position remains completely UNTOUCHED when gizmo relocates to viewport (no module jump)');

// Gizmo visual handles/pickers moved to the zoomed location on the module
const activeGizmoPos = testModule.position.clone().add(viewer.gizmoWorldOffset);
const camSpace = activeGizmoPos.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
const zDist = -camSpace.z;
const fovRad = THREE.MathUtils.degToRad(viewer.camera.fov);
const halfH = zDist * Math.tan(fovRad / 2);
const halfW = halfH * viewer.camera.aspect;
const ndcX = camSpace.x / halfW;
const ndcY = camSpace.y / halfH;

assert(Math.abs(ndcX) <= 0.85 && Math.abs(ndcY) <= 0.85,
  `Gizmo was moved to zoomed location inside the viewport display (NDC X: ${ndcX.toFixed(2)}, Y: ${ndcY.toFixed(2)})`);

console.log('\n--- Test 4: Gizmo Behind Camera Moves to Visible Zoomed Location ---');
testModule.position.set(0, 0, 50);
testModule.updateMatrixWorld(true);

viewer.camera.position.set(0, 0, 0);
viewer.camera.lookAt(0, 0, -100);
viewer.camera.updateMatrixWorld(true);

viewer.ensureActiveGizmoVisible({ isZooming: true });

assert(testModule.position.distanceTo(new THREE.Vector3(0, 0, 50)) < 0.001,
  'Target module position remains untouched when behind camera');

const activeGizmoBehind = testModule.position.clone().add(viewer.gizmoWorldOffset);
const camSpaceBehind = activeGizmoBehind.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
assert(-camSpaceBehind.z >= 15, `Gizmo moved in front of camera at safe viewing distance (${(-camSpaceBehind.z).toFixed(1)}m >= 15m)`);

console.log('\n--- Test 5: Gizmo Sized Appropriately for Close-up and Distant Zoom ---');
// Close-up zoomed in (< 150m)
const sizeClose = viewer.getAppropriateGizmoSize(50);
assert(sizeClose < 0.85 && sizeClose >= 0.68, `Close-up zoom appropriately scales down gizmo (${sizeClose.toFixed(2)} < 0.85)`);

// Far zoomed out (> 2000m)
const sizeFar = viewer.getAppropriateGizmoSize(4000);
assert(sizeFar > 0.85, `Far zoom appropriately scales up gizmo (${sizeFar.toFixed(2)} > 0.85)`);

// Standard distance (~500m)
const sizeStd = viewer.getAppropriateGizmoSize(500);
assert(Math.abs(sizeStd - 0.85) < 0.001, `Standard distance retains standard 0.85 size (${sizeStd.toFixed(2)})`);

console.log('\n--- Test 6: transformControls.size is Updated Appropriately During Zoom ---');
testModule.position.set(0, 0, 0);
testModule.updateMatrixWorld(true);
viewer.camera.position.set(0, 0, 50); // distance 50
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);

viewer.ensureActiveGizmoVisible({ isZooming: true });
assert(viewer.transformControls.size < 0.85,
  `transformControls.size dynamically adapted to zoomed distance: ${viewer.transformControls.size.toFixed(2)}`);

console.log('\n--- Test 7: Manual Panning Ignored (Not Zooming) ---');
testModule.position.set(600, 0, 0);
testModule.updateMatrixWorld(true);
const modPosBeforePan = testModule.position.clone();

viewer._isZooming = false; // User is panning, NOT zooming
viewer.ensureActiveGizmoVisible({ isZooming: false, force: false });

assert(testModule.position.equals(modPosBeforePan),
  'When user is panning (isZooming is false), gizmo position is not moved, preserving manual pan freedom');

console.log('\n--- Test 8: Dragging Relocated Gizmo Translates Module by Drag Delta Without Initial Jump ---');

const mockDom = { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
const realTc = new TransformControls(viewer.camera, mockDom);
realTc.setMode('translate');
realTc.space = 'world';
viewer.scene.add(realTc);
viewer.setupTransformControlsOverride(realTc);
viewer.transformControls = realTc;

testModule.position.set(500, 0, 0);
testModule.updateMatrixWorld(true);
realTc.attach(testModule);

viewer.camera.position.set(0, 0, 200);
viewer.camera.lookAt(0, 0, 0);
viewer.camera.updateMatrixWorld(true);

viewer.ensureActiveGizmoVisible({ force: true });

assert(testModule.position.x === 500, 'Module remains strictly at (500, 0, 0) during zoom');
assert(viewer.gizmoWorldOffset.lengthSq() > 0.0001, 'Gizmo offset was activated to place handles in viewport');
assert(realTc.worldPosition.distanceTo(testModule.position.clone().add(viewer.gizmoWorldOffset)) < 0.001,
  'TransformControls worldPosition reflects the relocated viewport location');

// Start drag on X axis
realTc.axis = 'X';
realTc.pointerDown({ x: 0, y: 0, button: 0 });
if (viewer.gizmoWorldOffset.lengthSq() > 0.0001) {
  realTc.worldPositionStart.add(viewer.gizmoWorldOffset);
  realTc.pointStart.sub(viewer.gizmoWorldOffset);
}

// Drag pointer by dx = 0.1
realTc.pointerMove({ x: 0.1, y: 0, button: -1 });
const deltaX = testModule.position.x - 500;
assert(deltaX > 0, `Dragging relocated gizmo translated the module by delta: ${deltaX.toFixed(2)}`);
assert(Math.abs(testModule.position.x - 500 - deltaX) < 0.0001, 'Module moved relative to original position without teleporting to gizmo');

if (allPassed) {
  console.log('\n[PASS] All active gizmo visibility, repositioning, and sizing tests passed successfully!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Some tests failed.');
  process.exit(1);
}
