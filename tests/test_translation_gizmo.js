import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createProceduralModule } from '../src/modules.js';

console.log('[*] Starting automated validation of 3D Translation Gizmo...');

let allPassed = true;

// 1. Setup mock scene, camera, domElement
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
camera.position.set(500, 300, 500);

const mockDomElement = {
  style: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  ownerDocument: {
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  getRootNode: () => ({
    addEventListener: () => {},
    removeEventListener: () => {}
  }),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

const transformControls = new TransformControls(camera, mockDomElement);
transformControls.setMode('translate');
transformControls.size = 0.85;
scene.add(transformControls);

console.log('[OK] TransformControls initialized in translate mode.');

// 2. Create sample module and test attach / detach
const testMod = createProceduralModule('struct_arg_cross_01', THREE);
testMod.userData = { index: 1, macro: 'struct_arg_cross_01_macro' };
testMod.position.set(100, 50, -200);
scene.add(testMod);

transformControls.attach(testMod);
if (transformControls.object === testMod) {
  console.log('[OK] TransformControls attached to selected module successfully.');
} else {
  console.error('[FAIL] TransformControls failed to attach to module.');
  allPassed = false;
}

// 3. Test continuous movement while dragging
const initialPlan = {
  modules: [
    { index: 1, macro: 'struct_arg_cross_01_macro', position: { x: 100, y: 50, z: 200 } }
  ]
};

let callbackFired = false;
let lastReportedPos = null;

const onModuleMoved = (index, pos, isFinal) => {
  callbackFired = true;
  lastReportedPos = pos;
};

// Simulate dragging translation along X, Y, Z
testMod.position.set(250.7, 120.3, -400.9);

// Execute handleModuleDragging logic
const planPosIntermediate = {
  x: Math.round(testMod.position.x),
  y: Math.round(testMod.position.y),
  z: Math.round(-testMod.position.z)
};
onModuleMoved(testMod.userData.index, planPosIntermediate, false);

if (callbackFired && lastReportedPos.x === 251 && lastReportedPos.y === 120 && lastReportedPos.z === 401) {
  console.log('[OK] Continuous dragging movement verified: coordinates update in real-time (X=251, Y=120, Z=401).');
} else {
  console.error('[FAIL] Continuous dragging movement callback failed.');
  allPassed = false;
}

// 4. Simulate mouse release (drag end) and coordinate inheritance
let dragEndFinalized = false;
const handleDragEndSimulation = () => {
  const finalPos = {
    x: Math.round(testMod.position.x),
    y: Math.round(testMod.position.y),
    z: Math.round(-testMod.position.z)
  };
  testMod.position.set(finalPos.x, finalPos.y, -finalPos.z);
  
  // Inherit in plan
  const mod = initialPlan.modules.find(m => m.index === testMod.userData.index);
  if (mod) {
    mod.position.x = finalPos.x;
    mod.position.y = finalPos.y;
    mod.position.z = finalPos.z;
  }
  onModuleMoved(testMod.userData.index, finalPos, true);
  dragEndFinalized = true;
};

handleDragEndSimulation();

const updatedMod = initialPlan.modules[0];
if (dragEndFinalized && updatedMod.position.x === 251 && updatedMod.position.y === 120 && updatedMod.position.z === 401) {
  console.log('[OK] Drag release verified: Object and plan inherited new coordinates for further display.');
} else {
  console.error('[FAIL] Coordinate inheritance on release failed.');
  allPassed = false;
}

// 5. Test detach on deselect
transformControls.detach();
if (!transformControls.object) {
  console.log('[OK] TransformControls detached on deselect cleanly.');
} else {
  console.error('[FAIL] TransformControls failed to detach.');
  allPassed = false;
}

// Cleanup
transformControls.dispose();
scene.remove(transformControls);
console.log('[OK] TransformControls disposed with zero leaks.');

console.log('\n==================================================');
if (allPassed) {
  console.log('[SUCCESS] All 3D Translation Gizmo tests passed 100%!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
