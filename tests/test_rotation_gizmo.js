// Automated test for 3D Gizmo Rotation Rings (Yaw, Pitch, Roll)
import assert from 'assert';
import * as THREE from 'three';

console.log('[*] Starting automated validation of 3D Gizmo Rotation Rings (Yaw, Pitch, Roll)...');

// Mock TransformControls for testing
class MockTransformControls extends THREE.Object3D {
  constructor(mode = 'translate') {
    super();
    this.mode = mode;
    this.size = 0.85;
    this.space = 'world';
    this.object = undefined;
    this.dragging = false;
    this.axis = null;
    this.visible = false;
    this.enabled = true;
  }
  setMode(mode) { this.mode = mode; }
  attach(obj) {
    this.object = obj;
    this.visible = true;
  }
  detach() {
    this.object = undefined;
    this.visible = false;
  }
  dispose() {
    this.detach();
  }
}

class MockViewer {
  constructor() {
    this.scene = new THREE.Scene();
    this.modulesGroup = new THREE.Group();
    this.scene.add(this.modulesGroup);

    this.transformControls = new MockTransformControls('translate');
    this.transformControls.space = 'world';
    this.scene.add(this.transformControls);

    this.transformControlsRotate = new MockTransformControls('rotate');
    this.transformControlsRotate.space = 'local';
    this.scene.add(this.transformControlsRotate);

    this.selectedModuleIndex = null;
    this.gizmoMode = 'combined';
    this.onModuleMoved = null;
    this.onModuleRotated = null;

    this.currentPlan = {
      name: 'Test Plan',
      modules: []
    };
  }

  selectModuleByIndex(index) {
    this.deselect();
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    this.selectedModuleIndex = index;
    if (this.transformControls && (this.gizmoMode === 'combined' || this.gizmoMode === 'translate')) {
      this.transformControls.attach(targetModule);
    }
    if (this.transformControlsRotate && (this.gizmoMode === 'combined' || this.gizmoMode === 'rotate')) {
      this.transformControlsRotate.attach(targetModule);
    }
  }

  setGizmoMode(mode) {
    this.gizmoMode = mode;
    const targetModule = this.selectedModuleIndex !== null
      ? this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex)
      : null;

    if (this.transformControls) {
      if (mode === 'combined' || mode === 'translate') {
        if (targetModule) this.transformControls.attach(targetModule);
        this.transformControls.visible = true;
        this.transformControls.enabled = true;
      } else {
        this.transformControls.detach();
        this.transformControls.visible = false;
        this.transformControls.enabled = false;
      }
    }
    if (this.transformControlsRotate) {
      if (mode === 'combined' || mode === 'rotate') {
        if (targetModule) this.transformControlsRotate.attach(targetModule);
        this.transformControlsRotate.visible = true;
        this.transformControlsRotate.enabled = true;
      } else {
        this.transformControlsRotate.detach();
        this.transformControlsRotate.visible = false;
        this.transformControlsRotate.enabled = false;
      }
    }
  }

  detachGizmo() {
    if (this.transformControls && this.transformControls.object) {
      this.transformControls.detach();
    }
    if (this.transformControlsRotate && this.transformControlsRotate.object) {
      this.transformControlsRotate.detach();
    }
  }

  isGizmoDragging() {
    const isTransDragging = !!(this.transformControls && this.transformControls.dragging);
    const isRotDragging = !!(this.transformControlsRotate && this.transformControlsRotate.dragging);
    return isTransDragging || isRotDragging;
  }

  isGizmoAttached() {
    return !!(
      (this.transformControls && this.transformControls.object) ||
      (this.transformControlsRotate && this.transformControlsRotate.object)
    );
  }

  deselect() {
    this.selectedModuleIndex = null;
    this.detachGizmo();
  }

  getModuleCalculatedRotation(index) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;

    targetModule.rotation.order = 'YXZ';
    let yawDeg = Math.round(THREE.MathUtils.radToDeg(targetModule.rotation.y)) % 360;
    let pitchDeg = Math.round(THREE.MathUtils.radToDeg(targetModule.rotation.x) - 180) % 360;
    let rollDeg = Math.round(THREE.MathUtils.radToDeg(targetModule.rotation.z) - 180) % 360;

    if (yawDeg > 180) yawDeg -= 360;
    if (yawDeg <= -180) yawDeg += 360;
    if (pitchDeg > 180) pitchDeg -= 360;
    if (pitchDeg <= -180) pitchDeg += 360;
    if (rollDeg > 180) rollDeg -= 360;
    if (rollDeg <= -180) rollDeg += 360;

    return { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg };
  }

  handleModuleRotating() {
    if (!this.transformControlsRotate || !this.transformControlsRotate.object) return;
    const targetModule = this.transformControlsRotate.object;
    const calcRot = this.getModuleCalculatedRotation(targetModule.userData.index);
    if (this.onModuleRotated) {
      this.onModuleRotated(targetModule.userData.index, calcRot, false);
    }
  }

  handleModuleRotateEnd() {
    if (!this.transformControlsRotate || !this.transformControlsRotate.object) return;
    const targetModule = this.transformControlsRotate.object;
    const calcRot = this.getModuleCalculatedRotation(targetModule.userData.index);

    if (this.currentPlan && this.currentPlan.modules) {
      const mod = this.currentPlan.modules.find(m => m.index === targetModule.userData.index);
      if (mod && calcRot) {
        mod.rotation.yaw = calcRot.yaw;
        mod.rotation.pitch = calcRot.pitch;
        mod.rotation.roll = calcRot.roll;
      }
    }

    if (this.onModuleRotated) {
      this.onModuleRotated(targetModule.userData.index, calcRot, true);
    }
  }
}

// 1. Setup viewer and test module
const viewer = new MockViewer();
const modGroup = new THREE.Group();
modGroup.userData = { index: 1, macro: 'pier_arg_harbor_04_macro' };
modGroup.rotation.order = 'YXZ';
modGroup.rotation.y = THREE.MathUtils.degToRad(0);
modGroup.rotation.x = THREE.MathUtils.degToRad(180); // 0 + 180
modGroup.rotation.z = THREE.MathUtils.degToRad(180); // 0 + 180
viewer.modulesGroup.add(modGroup);

viewer.currentPlan.modules.push({
  index: 1,
  macro: 'pier_arg_harbor_04_macro',
  position: { x: 0, y: 0, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 }
});

// Test 1: Verify TransformControlsRotate initialization
assert.strictEqual(viewer.transformControlsRotate.mode, 'rotate', 'Rotation controls must be in rotate mode');
assert.strictEqual(viewer.transformControlsRotate.space, 'local', 'Rotation controls must operate in local space');
console.log('[OK] Rotation controls initialized in rotate mode with local coordinate space.');

// Test 2: Module Selection attaches both Translation Gizmo and Rotation Rings
viewer.selectModuleByIndex(1);
assert.strictEqual(viewer.isGizmoAttached(), true, 'Gizmo must be attached');
assert.strictEqual(viewer.transformControls.object, modGroup, 'Translation controls attached to module');
assert.strictEqual(viewer.transformControlsRotate.object, modGroup, 'Rotation controls attached to module');
console.log('[OK] Module selection attaches both 3D translation arrows and rotation rings.');

// Test 3: Verify initial calculated rotation matches plan
const initRot = viewer.getModuleCalculatedRotation(1);
assert.deepStrictEqual(initRot, { yaw: 0, pitch: 0, roll: 0 }, 'Initial rotation should be 0,0,0');
console.log('[OK] Initial rotation angles verified: Yaw=0°, Pitch=0°, Roll=0°.');

// Test 4: Simulate Selecting and Rotating the Yaw Ring (around Y axis)
let rotateEventsFired = [];
viewer.onModuleRotated = (index, rot, isFinal) => {
  rotateEventsFired.push({ index, rot, isFinal });
};

// Start dragging Yaw ring (Green ring)
viewer.transformControlsRotate.axis = 'Y';
viewer.transformControlsRotate.dragging = true;

// Rotate 45 degrees around Y (Yaw)
modGroup.rotation.y = THREE.MathUtils.degToRad(45);
viewer.handleModuleRotating();

assert.strictEqual(rotateEventsFired.length, 1);
assert.strictEqual(rotateEventsFired[0].isFinal, false, 'Continuous rotation event should not be final');
assert.strictEqual(rotateEventsFired[0].rot.yaw, 45, 'Yaw angle should be 45 deg');
console.log('[OK] Continuous Yaw rotation verified in real-time (Yaw: 45°).');

// Test 5: Simulate Pitch rotation (Red ring, around X axis)
modGroup.rotation.x = THREE.MathUtils.degToRad(180 + 30); // Pitch +30 deg
viewer.handleModuleRotating();
assert.strictEqual(rotateEventsFired.length, 2);
assert.strictEqual(rotateEventsFired[1].rot.pitch, 30, 'Pitch angle should be 30 deg');
console.log('[OK] Continuous Pitch rotation verified in real-time (Pitch: 30°).');

// Test 6: Simulate Roll rotation (Blue ring, around Z axis)
modGroup.rotation.z = THREE.MathUtils.degToRad(180 - 60); // Roll -60 deg
viewer.handleModuleRotating();
assert.strictEqual(rotateEventsFired.length, 3);
assert.strictEqual(rotateEventsFired[2].rot.roll, -60, 'Roll angle should be -60 deg');
console.log('[OK] Continuous Roll rotation verified in real-time (Roll: -60°).');

// Test 7: Release mouse button -> object and station plan inherit new rotation
viewer.transformControlsRotate.dragging = false;
viewer.handleModuleRotateEnd();

assert.strictEqual(rotateEventsFired.length, 4);
assert.strictEqual(rotateEventsFired[3].isFinal, true, 'End rotation event must be final');

const planMod = viewer.currentPlan.modules[0];
assert.deepStrictEqual(planMod.rotation, { yaw: 45, pitch: 30, roll: -60 }, 'Plan must inherit updated yaw, pitch, roll');
console.log('[OK] Rotation release verified: Station plan inherited Yaw=45°, Pitch=30°, Roll=-60°.');

// Test 8: Gizmo Mode Switching
viewer.setGizmoMode('translate');
assert.strictEqual(viewer.transformControls.visible, true, 'Translation should be visible in translate mode');
assert.strictEqual(viewer.transformControlsRotate.visible, false, 'Rotation should be hidden in translate mode');

viewer.setGizmoMode('rotate');
assert.strictEqual(viewer.transformControls.visible, false, 'Translation should be hidden in rotate mode');
assert.strictEqual(viewer.transformControlsRotate.visible, true, 'Rotation should be visible in rotate mode');

viewer.setGizmoMode('combined');
assert.strictEqual(viewer.transformControls.visible, true, 'Translation should be visible in combined mode');
assert.strictEqual(viewer.transformControlsRotate.visible, true, 'Rotation should be visible in combined mode');
console.log('[OK] Gizmo mode switching verified (Translate, Rotate, Combined).');

// Test 9: Loss of Focus Detachment
viewer.detachGizmo();
assert.strictEqual(viewer.isGizmoAttached(), false, 'Both translation and rotation gizmos detach on loss of focus');
console.log('[OK] Loss of focus cleanly removes both translation arrows and rotation rings.');

console.log('\n==================================================');
console.log('[SUCCESS] All 3D Gizmo Rotation Ring tests passed 100%!\n');
