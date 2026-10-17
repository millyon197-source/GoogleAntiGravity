import * as THREE from 'three';
import {
  ThreeRenderEngine,
  CameraController,
  TransformGizmoCoordinator,
  DimensionOverlayManager,
  PlotBoundsManager,
  SelectionManager
} from '@x4/adapter-three';
import { IRenderEnginePort } from '@x4/application';

console.log('[*] Testing Hexagonal Three.js Adapter (@x4/adapter-three)...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Port Interface Compliance
console.log('\n--- Test Group 1: Port Implementation Compliance ---');
const engine = new ThreeRenderEngine();
assert(engine instanceof IRenderEnginePort, 'ThreeRenderEngine implements IRenderEnginePort');

let eventReceived = null;
engine.on('testEvent', (data) => {
  eventReceived = data;
});
engine.emit('testEvent', { status: 'success' });
assert(eventReceived && eventReceived.status === 'success', 'ThreeRenderEngine event pub/sub works');

// 2. TransformGizmoCoordinator
console.log('\n--- Test Group 2: TransformGizmoCoordinator ---');
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 10000);
camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);

const coordinator = new TransformGizmoCoordinator({ camera });

const closeSize = coordinator.getAppropriateGizmoSize(50);
const midSize = coordinator.getAppropriateGizmoSize(500);
const farSize = coordinator.getAppropriateGizmoSize(5000);

assert(closeSize < midSize, 'Gizmo size is more compact when close-up');
assert(midSize === 0.85, 'Default mid-range gizmo size is 0.85');
assert(farSize > midSize, 'Gizmo size expands when far away');

// Mock module mesh
const mockModule = new THREE.Group();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
mockModule.add(mesh);
mockModule.position.set(0, 0, 0);
mockModule.updateMatrixWorld(true);

const zoomedLoc = coordinator.getModuleZoomedLocation(mockModule);
assert(zoomedLoc instanceof THREE.Vector3, 'getModuleZoomedLocation returns Vector3 point');

// Test ensureActiveGizmoVisible when outside viewport
const mockTarget = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50));
mockTarget.position.set(5000, 5000, 0); // far outside viewport
mockTarget.updateMatrixWorld(true);

const mockTC = { object: mockTarget, size: 0.85, dragging: false };
coordinator.transformControls = mockTC;

coordinator.ensureActiveGizmoVisible({ force: true });
assert(coordinator.gizmoWorldOffset.lengthSq() > 0, 'Computes non-zero offset when gizmo is outside display');

coordinator.detach();
assert(coordinator.gizmoWorldOffset.lengthSq() === 0, 'detach() resets gizmoWorldOffset to zero');

// 3. CameraController
console.log('\n--- Test Group 3: CameraController ---');
const scene = new THREE.Scene();
const modulesGroup = new THREE.Group();
scene.add(modulesGroup);

const controls = {
  target: new THREE.Vector3(0, 0, 0),
  maxDistance: 2000,
  update() {}
};

const camController = new CameraController({ camera, controls, scene, modulesGroup });

camController.setViewAngle('top');
assert(camera.position.y > controls.target.y, 'setViewAngle("top") places camera above target');

camController.setViewAngle('front');
assert(camera.position.z > controls.target.z, 'setViewAngle("front") places camera in front of target');

camController.setViewAngle('left');
assert(camera.position.x < controls.target.x, 'setViewAngle("left") places camera to the left of target');

// 4. DimensionOverlayManager
console.log('\n--- Test Group 4: DimensionOverlayManager ---');
const dimMgr = new DimensionOverlayManager({ scene });
assert(dimMgr.overlayGroup instanceof THREE.Group, 'DimensionOverlayManager creates overlay group');
assert(scene.children.includes(dimMgr.overlayGroup), 'Overlay group is added to scene');

dimMgr.clear();
assert(dimMgr.overlayGroup.children.length === 0, 'clear() removes all overlay children');

// 5. PlotBoundsManager
console.log('\n--- Test Group 5: PlotBoundsManager ---');
const plotMgr = new PlotBoundsManager({ scene });
assert(plotMgr.stationPlotGroup instanceof THREE.Group, 'PlotBoundsManager creates station plot group');
assert(plotMgr.plotCornersGroup instanceof THREE.Group, 'PlotBoundsManager creates corner handles group');

plotMgr.setPlotCornersVisible(true);
assert(plotMgr.plotCornersGroup.visible === true, 'setPlotCornersVisible updates visibility');

plotMgr.toggleGrid(false);
assert(plotMgr.stationPlotGroup.visible === false, 'toggleGrid updates visibility');

// 6. SelectionManager
console.log('\n--- Test Group 6: SelectionManager ---');
const selectMgr = new SelectionManager({ camera, scene, modulesGroup });
assert(Array.isArray(selectMgr.multiSelectedModules), 'multiSelectedModules initialized as array');

selectMgr.clearMultiSelection();
assert(selectMgr.multiSelectedModules.length === 0, 'clearMultiSelection clears array');

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n[PASS] All Adapter Three tests completed successfully!');
}
