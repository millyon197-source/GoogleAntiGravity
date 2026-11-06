/**
 * Verifies StationViewer delegates gizmo logic to TransformGizmoCoordinator:
 * the coordinator is created on demand (also for viewers built without init()), it shares
 * the viewer's gizmoWorldOffset vector, and a relocation is applied to the TransformControls
 * in the same update (no one-frame lag) when the coordinator was created up front as in the app.
 */
import assert from 'node:assert';
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
const THREE = await import('three');
const { TransformControls } = await import('three/addons/controls/TransformControls.js');
const { TransformGizmoCoordinator } = await import('@x4/adapter-three');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing gizmo coordinator delegation...');

const dom = { style: {}, addEventListener() {}, removeEventListener() {} };
function makeViewer({ precreateCoordinator }) {
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera(60, 1.5, 1, 1e6);
  v.camera.position.set(0, 0, 200);
  v.camera.lookAt(0, 0, 0);
  v.camera.updateMatrixWorld(true);
  v.gizmoWorldOffset = new THREE.Vector3();
  const tc = new TransformControls(v.camera, dom);
  v.scene.add(tc.getHelper());
  v.setupTransformControlsOverride(tc);
  v.transformControls = tc;
  v.transformControlsRotate = null;
  const mod = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), new THREE.MeshBasicMaterial());
  mod.position.set(500, 0, 0); // well outside the viewport
  v.scene.add(mod);
  mod.updateMatrixWorld(true);
  tc.attach(mod);
  if (precreateCoordinator) {
    // As StationViewer.init() does in the app
    v.gizmoCoordinator = new TransformGizmoCoordinator({ camera: v.camera, transformControls: tc, transformControlsRotate: null });
  }
  return { v, tc, mod };
}

// 1. Created on demand and kept in sync
{
  const { v, tc } = makeViewer({ precreateCoordinator: false });
  assert.strictEqual(v.gizmoCoordinator, undefined);
  assert.strictEqual(v.isGizmoAttached(), true);
  const c = v.gizmoCoordinator;
  assert.ok(c instanceof TransformGizmoCoordinator, 'coordinator created on first use');
  assert.strictEqual(c.transformControls, tc);
  assert.strictEqual(c.gizmoWorldOffset, v.gizmoWorldOffset, 'offset vector is shared with the viewer');
  const otherCam = new THREE.PerspectiveCamera();
  v.camera = otherCam;
  v.isGizmoDragging();
  assert.strictEqual(c.camera, otherCam, 'camera re-synced on each use');
  assert.strictEqual(v.getAppropriateGizmoSize(50), c.getAppropriateGizmoSize(50));
  console.log('  ✓ coordinator created on demand, shares offset, re-syncs camera/controls');
}

// 2. App path (coordinator created up front): relocation applies in the same update
for (const precreateCoordinator of [true, false]) {
  const { v, tc, mod } = makeViewer({ precreateCoordinator });
  v.ensureActiveGizmoVisible({ force: true });
  assert.ok(v.gizmoWorldOffset.lengthSq() > 0.0001, 'gizmo relocated into the viewport');
  const expected = mod.position.clone().add(v.gizmoWorldOffset);
  assert.ok(tc.worldPosition.distanceTo(expected) < 1e-3,
    `controls show the relocated position in the same update (precreated=${precreateCoordinator})`);
  assert.strictEqual(v.gizmoCoordinator.gizmoWorldOffset, v.gizmoWorldOffset, 'pre-existing coordinator adopts the viewer offset vector');
  // Resetting the viewer offset (e.g. on deselect) is seen by the coordinator too
  v.gizmoWorldOffset.set(0, 0, 0);
  assert.strictEqual(v.gizmoCoordinator.gizmoWorldOffset.lengthSq(), 0);
}
console.log('  ✓ relocation applied without a one-frame lag, with and without a pre-created coordinator');

// 3. Dragging guard and the viewer-level drag flag
{
  const { v, tc } = makeViewer({ precreateCoordinator: true });
  v._isGizmoDragging = true;
  assert.strictEqual(v.isGizmoDragging(), true, 'viewer drag flag still honoured');
  v._isGizmoDragging = false;
  tc.dragging = true;
  assert.strictEqual(v.isGizmoDragging(), true);
  v.ensureActiveGizmoVisible({ force: true });
  assert.strictEqual(v.gizmoWorldOffset.lengthSq(), 0, 'no relocation while dragging');
  console.log('  ✓ dragging blocks relocation; viewer drag flag honoured');
}

console.log('\n[PASS] test_gizmo_coordinator_delegation');
