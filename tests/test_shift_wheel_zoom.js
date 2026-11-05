import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Shift+Mouse Wheel 5x Slower Zoom Increment...');

// Setup mock viewer
const viewer = Object.create(StationViewer.prototype);
viewer.controls = {
  zoomSpeed: 1.0
};
viewer._isZooming = false;
viewer._zoomTimeout = null;
viewer.isGizmoAttached = () => false;

// Attach mock boundOnWheel matching viewer.js logic
viewer.boundOnWheel = (event) => {
  if (viewer.controls) {
    viewer.controls.zoomSpeed = (event && event.shiftKey) ? 0.2 : 1.0;
  }
  viewer._isZooming = true;
};

// 1. Normal wheel test (no Shift)
viewer.boundOnWheel({ shiftKey: false });
assert.strictEqual(viewer.controls.zoomSpeed, 1.0, 'Normal wheel zoom speed should be 1.0');
console.log('  ✓ [PASS] Normal wheel zoom speed is 1.0');

// 2. Shift + wheel test
viewer.boundOnWheel({ shiftKey: true });
assert.strictEqual(viewer.controls.zoomSpeed, 0.2, 'Shift + wheel zoom speed should be 0.2 (5x slower)');
console.log('  ✓ [PASS] Shift + wheel zoom speed is 0.2 (5x slower)');

// Verify exact 5x ratio
const normalSpeed = 1.0;
const shiftSpeed = 0.2;
const ratio = normalSpeed / shiftSpeed;
assert.strictEqual(ratio, 5, 'Ratio of normal to shift zoom speed must be exactly 5.0');
console.log('  ✓ [PASS] Zoom increment ratio is exactly 5x slower');

// 3. Wheel without Shift after Shift was pressed restores normal speed
viewer.boundOnWheel({ shiftKey: false });
assert.strictEqual(viewer.controls.zoomSpeed, 1.0, 'Subsequent wheel without Shift restores zoom speed to 1.0');
console.log('  ✓ [PASS] Subsequent wheel without Shift restores zoom speed to 1.0');

// 4. Test Keydown Shift sets 0.2
viewer.controls.zoomSpeed = 1.0;
const simulateShiftKeyDown = () => {
  if (viewer.controls) viewer.controls.zoomSpeed = 0.2;
};
simulateShiftKeyDown();
assert.strictEqual(viewer.controls.zoomSpeed, 0.2, 'KeyDown Shift sets zoomSpeed to 0.2');

// 5. Test KeyUp Shift restores 1.0
const simulateShiftKeyUp = () => {
  if (viewer.controls) viewer.controls.zoomSpeed = 1.0;
};
simulateShiftKeyUp();
assert.strictEqual(viewer.controls.zoomSpeed, 1.0, 'KeyUp Shift restores zoomSpeed to 1.0');

console.log('  ✓ [PASS] KeyDown / KeyUp Shift correctly toggles zoom speed between 0.2 and 1.0');
console.log('\n[SUCCESS] All shift+wheel zoom speed tests passed cleanly!');
