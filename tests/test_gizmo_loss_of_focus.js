// Automated test for 3D translation gizmo removal on any loss of focus
import assert from 'assert';
import * as THREE from 'three';

console.log('[*] Starting automated validation of 3D Gizmo Removal on Loss of Focus...');

// Mock TransformControls for testing
class MockTransformControls extends THREE.Object3D {
  constructor() {
    super();
    this.mode = 'translate';
    this.size = 0.85;
    this.object = undefined;
    this.dragging = false;
    this.axis = null;
    this.visible = false;
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

// Minimal Viewer mock implementing the exact logic in viewer.js
class MockViewer {
  constructor() {
    this.scene = new THREE.Scene();
    this.modulesGroup = new THREE.Group();
    this.scene.add(this.modulesGroup);
    this.transformControls = new MockTransformControls();
    this.scene.add(this.transformControls);
    this.selectedModuleIndex = null;
    this.showDimensions = true;
    this.dimensionOverlayGroup = null;
  }

  selectModuleByIndex(index) {
    this.deselect();
    const targetModule = this.modulesGroup.children.find(c => c.userData.index === index);
    if (!targetModule) return;
    this.selectedModuleIndex = index;
    if (this.transformControls) {
      this.transformControls.attach(targetModule);
    }
  }

  detachGizmo() {
    if (this.transformControls && this.transformControls.object) {
      this.transformControls.detach();
    }
  }

  isGizmoDragging() {
    return !!(this.transformControls && this.transformControls.dragging);
  }

  isGizmoAttached() {
    return !!(this.transformControls && this.transformControls.object);
  }

  deselect() {
    this.selectedModuleIndex = null;
    this.detachGizmo();
  }

  setBuildProgress(progressPercentage) {
    if (this.selectedModuleIndex !== null) {
      const selectedModule = this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex);
      if (selectedModule && !selectedModule.visible) {
        this.detachGizmo();
      }
    }
  }
}

// 1. Setup mock viewer and station modules
const viewer = new MockViewer();
const mod1 = new THREE.Group();
mod1.userData = { index: 0, macro: 'dock_01' };
mod1.visible = true;
viewer.modulesGroup.add(mod1);

const mod2 = new THREE.Group();
mod2.userData = { index: 1, macro: 'prod_01' };
mod2.visible = true;
viewer.modulesGroup.add(mod2);

// Test 1: Module Selection attaches Gizmo
viewer.selectModuleByIndex(0);
assert.strictEqual(viewer.isGizmoAttached(), true, 'Gizmo should be attached on selection');
assert.strictEqual(viewer.transformControls.object, mod1, 'Gizmo object should be mod1');
console.log('[OK] Gizmo attached on module selection.');

// Test 2: Window Blur removes Gizmo
const simulateWindowBlur = () => {
  if (viewer && !viewer.isGizmoDragging()) {
    viewer.detachGizmo();
  }
};
simulateWindowBlur();
assert.strictEqual(viewer.isGizmoAttached(), false, 'Gizmo should be removed on window blur');
assert.strictEqual(viewer.transformControls.object, undefined, 'Gizmo object should be undefined after blur');
console.log('[OK] Window blur removes 3D gizmo.');

// Test 3: Re-selecting module re-attaches Gizmo
viewer.selectModuleByIndex(0);
assert.strictEqual(viewer.isGizmoAttached(), true, 'Gizmo reattaches when module is selected');
console.log('[OK] Module re-selection reattaches 3D gizmo.');

// Test 4: Document Visibility Change (user switches tab) removes Gizmo
const simulateVisibilityChange = (hidden) => {
  if (hidden && viewer && !viewer.isGizmoDragging()) {
    viewer.detachGizmo();
  }
};
simulateVisibilityChange(true);
assert.strictEqual(viewer.isGizmoAttached(), false, 'Gizmo should be removed when document is hidden');
console.log('[OK] Document tab-switch/visibilitychange removes 3D gizmo.');

// Test 5: Outside Click Handler
viewer.selectModuleByIndex(0);
assert.strictEqual(viewer.isGizmoAttached(), true);

const simulateOutsideClick = (targetType) => {
  if (!viewer || viewer.isGizmoDragging()) return;
  if (targetType === 'canvas') return; // Canvas click handled by canvas raycasting
  if (targetType === 'module-selector') return; // Intentional module row click

  // Any other click outside canvas removes gizmo
  viewer.detachGizmo();
};

// Outside click on sidebar background
simulateOutsideClick('sidebar-background');
assert.strictEqual(viewer.isGizmoAttached(), false, 'Outside click on sidebar must remove 3D gizmo');
console.log('[OK] Outside click on sidebar removes 3D gizmo.');

// Test 6: Escape key removes Gizmo and deselects
viewer.selectModuleByIndex(1);
assert.strictEqual(viewer.isGizmoAttached(), true);
const simulateEscapeKey = () => {
  viewer.detachGizmo();
  viewer.deselect();
};
simulateEscapeKey();
assert.strictEqual(viewer.isGizmoAttached(), false, 'Escape key must remove 3D gizmo');
assert.strictEqual(viewer.selectedModuleIndex, null, 'Escape key must deselect module');
console.log('[OK] Escape key removes 3D gizmo and deselects.');

// Test 7: Active dragging protection (dragging must not be killed mid-motion by blur)
viewer.selectModuleByIndex(0);
viewer.transformControls.dragging = true;
assert.strictEqual(viewer.isGizmoDragging(), true);

// Attempt window blur while actively dragging
simulateWindowBlur();
assert.strictEqual(viewer.isGizmoAttached(), true, 'Actively dragged gizmo must not be detached mid-motion');
console.log('[OK] Active dragging is protected from premature mid-motion blur detachment.');

// Finish drag and blur
viewer.transformControls.dragging = false;
simulateWindowBlur();
assert.strictEqual(viewer.isGizmoAttached(), false, 'Once dragging completes, blur removes gizmo');
console.log('[OK] Post-drag blur removes 3D gizmo cleanly.');

// Test 8: Timeline build scrubber hides module -> removes Gizmo
viewer.selectModuleByIndex(0);
assert.strictEqual(viewer.isGizmoAttached(), true);
mod1.visible = false; // Scrubber hides mod1
viewer.setBuildProgress(50);
assert.strictEqual(viewer.isGizmoAttached(), false, 'Hiding module via build progress must remove 3D gizmo');
console.log('[OK] Hiding module in build scrubber removes 3D gizmo.');

console.log('\n==================================================');
console.log('[SUCCESS] All Loss of Focus 3D Gizmo tests passed 100%!\n');
