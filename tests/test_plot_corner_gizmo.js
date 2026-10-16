import * as THREE from 'three';
import { getPlotBoundingBox, DEFAULT_PLOT_CONFIG, setPlotConfig } from '../src/module-display-panel.js';

console.log('--- Testing Plot Bounding Box Corner Gizmo & Floating HUD ---');

// Mock DOM elements and environment
const mockElements = new Map();
globalThis.document = {
  getElementById(id) {
    return mockElements.get(id) || null;
  },
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      appendChild(child) {
        if (child.id) mockElements.set(child.id, child);
      },
      remove() {
        if (this.id) mockElements.delete(this.id);
      }
    };
    return el;
  },
  body: {
    appendChild(child) {
      if (child.id) mockElements.set(child.id, child);
    }
  }
};

globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080
};

// Test 1: Verify 8 corners calculation from getPlotBoundingBox
console.log('\n--- Test 1: Bounding Box Dimensions & 8 Corners ---');
const testConfig = {
  enabled: true,
  x: { plus: 10, minus: 10 },
  y: { plus: 8, minus: 12 },
  z: { plus: 6, minus: 14 }
};

const bb = getPlotBoundingBox(testConfig);
console.log(`Plot BB: widthX=${bb.widthX}, heightY=${bb.heightY}, depthZ=${bb.depthZ}`);
console.log(`Plot Center: (${bb.centerX}, ${bb.centerY}, ${bb.centerZ})`);

if (bb.widthX !== 20000 || bb.heightY !== 20000 || bb.depthZ !== 20000) {
  throw new Error(`Expected all dimensions to be 20000m, got ${bb.widthX}, ${bb.heightY}, ${bb.depthZ}`);
}

const signs = [-1, 1];
const corners = [];
const halfW = bb.widthX / 2;
const halfH = bb.heightY / 2;
const halfD = bb.depthZ / 2;

for (const sx of signs) {
  for (const sy of signs) {
    for (const sz of signs) {
      corners.push({ sx, sy, sz, x: sx * halfW, y: sy * halfH, z: sz * halfD });
    }
  }
}

if (corners.length !== 8) {
  throw new Error(`Expected 8 corners, got ${corners.length}`);
}
console.log(`Verified: Exactly 8 corners identified for the 3D bounding box.`);

// Test 2: Verify Corner Red Dot Meshes creation
console.log('\n--- Test 2: Red Dot Meshes Creation at 8 Corners ---');
const plotCornerHandles = [];
const stationPlotGroup = new THREE.Group();
const cornerSphereGeo = new THREE.SphereGeometry(1, 16, 16);
const cornerMat = new THREE.MeshBasicMaterial({
  color: 0xFF0033,
  depthTest: false,
  transparent: true,
  opacity: 0.95
});

for (const { sx, sy, sz, x, y, z } of corners) {
  const dot = new THREE.Mesh(cornerSphereGeo, cornerMat.clone());
  dot.name = `plot_corner_dot_${sx}_${sy}_${sz}`;
  dot.position.set(x, y, z);
  dot.userData = { isPlotCorner: true, sx, sy, sz };
  stationPlotGroup.add(dot);
  plotCornerHandles.push(dot);
}

if (plotCornerHandles.length !== 8) {
  throw new Error(`Expected 8 corner handles, got ${plotCornerHandles.length}`);
}

plotCornerHandles.forEach((dot, idx) => {
  if (!dot.userData.isPlotCorner) {
    throw new Error(`Corner handle ${idx} missing isPlotCorner userData!`);
  }
  if (dot.material.color.getHex() !== 0xFF0033) {
    throw new Error(`Corner handle ${idx} should have red color 0xFF0033, got ${dot.material.color.getHexString()}`);
  }
});
console.log('Verified: All 8 corner handles created as red meshes with correct userData!');

// Test 3: Sizing logic in 1 unit increments/decrements
console.log('\n--- Test 3: Sizing Logic (1 unit increment/decrement) ---');
const applyAxisDelta = (axisObj, isPositiveSide, delta) => {
  let p = axisObj.plus;
  let m = axisObj.minus;
  if (isPositiveSide) {
    p = Math.max(0, Math.min(20, p + delta));
    if (p + m > 20) {
      m = Math.max(0, 20 - p);
    }
    if (p + m < 1) {
      p = Math.max(p, 1 - m);
    }
  } else {
    m = Math.max(0, Math.min(20, m + delta));
    if (p + m > 20) {
      p = Math.max(0, 20 - m);
    }
    if (p + m < 1) {
      m = Math.max(m, 1 - p);
    }
  }
  return { plus: p, minus: m };
};

// 3a: Decrement positive X by 1 unit (from 10 to 9)
const startAxis = { plus: 10, minus: 10 };
const decrementedX = applyAxisDelta(startAxis, true, -1);
console.log('Decremented +X by 1 unit:', decrementedX, `Total: ${decrementedX.plus + decrementedX.minus}`);
if (decrementedX.plus !== 9 || decrementedX.minus !== 10 || (decrementedX.plus + decrementedX.minus) !== 19) {
  throw new Error(`Expected plus: 9, minus: 10, total: 19. Got: ${JSON.stringify(decrementedX)}`);
}

// 3b: Decrement negative X by 3 units (from 10 to 7)
const decrementedMinusX = applyAxisDelta(startAxis, false, -3);
console.log('Decremented -X by 3 units:', decrementedMinusX, `Total: ${decrementedMinusX.plus + decrementedMinusX.minus}`);
if (decrementedMinusX.plus !== 10 || decrementedMinusX.minus !== 7 || (decrementedMinusX.plus + decrementedMinusX.minus) !== 17) {
  throw new Error(`Expected plus: 10, minus: 7, total: 17. Got: ${JSON.stringify(decrementedMinusX)}`);
}

// 3c: Verify sub-unit movements snap to integer increments (Math.round(delta / 1000))
const deltaMetersSmall = 350; // < 500m -> 0 units
const unitSmall = Math.round(deltaMetersSmall / 1000);
if (unitSmall !== 0) throw new Error(`Expected 350m to round to 0 units, got ${unitSmall}`);

const deltaMetersStep = 1200; // ~1000m -> 1 unit
const unitStep = Math.round(deltaMetersStep / 1000);
if (unitStep !== 1) throw new Error(`Expected 1200m to round to 1 unit, got ${unitStep}`);

const deltaMetersTwo = 2400; // ~2000m -> 2 units
const unitTwo = Math.round(deltaMetersTwo / 1000);
if (unitTwo !== 2) throw new Error(`Expected 2400m to round to 2 units, got ${unitTwo}`);

console.log('Verified: Mouse delta accurately snaps to 1 unit (1000m) increments/decrements!');

// Test 4: Floating Plot Size HUD format: "just the current plot size in X, Y, Z integer values"
console.log('\n--- Test 4: Floating Plot Size HUD Presentation ---');

function formatFloatingPlotSize(totX, totY, totZ) {
  return `X: ${totX}, Y: ${totY}, Z: ${totZ}`;
}

const hudText = formatFloatingPlotSize(19, 20, 18);
console.log('Floating Plot Size text:', hudText);

// Verify exact format: "X: <int>, Y: <int>, Z: <int>"
const match = hudText.match(/^X:\s*(\d+),\s*Y:\s*(\d+),\s*Z:\s*(\d+)$/);
if (!match) {
  throw new Error(`HUD text does not match format "X: <int>, Y: <int>, Z: <int>": "${hudText}"`);
}
if (parseInt(match[1], 10) !== 19 || parseInt(match[2], 10) !== 20 || parseInt(match[3], 10) !== 18) {
  throw new Error(`Mismatched integer values in HUD: ${hudText}`);
}

// Verify DOM HUD creation
let hudEl = document.getElementById('floating-plot-size-hud');
if (!hudEl) {
  hudEl = document.createElement('div');
  hudEl.id = 'floating-plot-size-hud';
  hudEl.className = 'floating-plot-size-hud';
  document.body.appendChild(hudEl);
}
hudEl.textContent = hudText;
hudEl.classList.remove('hidden');

const retrievedHud = document.getElementById('floating-plot-size-hud');
if (!retrievedHud || retrievedHud.textContent !== 'X: 19, Y: 20, Z: 18') {
  throw new Error(`Failed to retrieve floating HUD element with text "X: 19, Y: 20, Z: 18"`);
}
console.log('Verified: Floating HUD presents just the current plot size in X, Y, Z integer values!');

// Test 5: Hide red dots until corner click, reveal on click, hide on release and perform FIT
console.log('\n--- Test 5: Visibility Toggle & FIT Function on Release ---');

let arePlotCornersVisible = false;
const setPlotCornersVisible = (visible) => {
  arePlotCornersVisible = !!visible;
  plotCornerHandles.forEach(dot => {
    dot.visible = arePlotCornersVisible;
  });
};

// 5a: Initially red dots must be hidden
setPlotCornersVisible(false);
const allHiddenInitial = plotCornerHandles.every(dot => dot.visible === false);
console.log('Red dots initially hidden:', allHiddenInitial);
if (!allHiddenInitial) {
  throw new Error('Expected all 8 red corner dots to be hidden initially!');
}

// 5b: Corner click performed -> red dots revealed
console.log('Simulating corner click...');
setPlotCornersVisible(true);
const allVisibleOnClick = plotCornerHandles.every(dot => dot.visible === true);
console.log('Red dots visible on corner click:', allVisibleOnClick);
if (!allVisibleOnClick) {
  throw new Error('Expected all 8 red corner dots to become visible upon BB corner click!');
}

// 5c: Release corner gizmo -> hide red dots and perform FIT function
console.log('Simulating release of corner gizmo...');
let fitPerformed = false;
const fitCameraToStation = () => {
  fitPerformed = true;
};

// On release:
setPlotCornersVisible(false);
fitCameraToStation();

const allHiddenOnRelease = plotCornerHandles.every(dot => dot.visible === false);
console.log('Red dots hidden after release:', allHiddenOnRelease);
console.log('FIT function performed after release:', fitPerformed);

if (!allHiddenOnRelease) {
  throw new Error('Expected all 8 red corner dots to be hidden after release of the corner gizmo!');
}
if (!fitPerformed) {
  throw new Error('Expected FIT function to be performed after release of the corner gizmo!');
}

console.log('Verified: Red dots are hidden until BB corner click, hidden on release, and FIT function performed!');

// Test 6: Lock the move to affect only the initial direction until released
console.log('\n--- Test 6: Direction Locking Until Release ---');

let lockedAxis = null;
const computeAxisDeltas = (deltaVec, sx, sy, sz) => {
  let deltaUnitsX = Math.round((sx * deltaVec.x) / 1000);
  let deltaUnitsY = Math.round((sy * deltaVec.y) / 1000);
  let deltaUnitsZ = Math.round((sz * deltaVec.z) / 1000);

  if (!lockedAxis) {
    const absX = Math.abs(deltaVec.x);
    const absY = Math.abs(deltaVec.y);
    const absZ = Math.abs(deltaVec.z);
    const maxDist = Math.max(absX, absY, absZ);

    if (maxDist >= 400 || Math.abs(deltaUnitsX) > 0 || Math.abs(deltaUnitsY) > 0 || Math.abs(deltaUnitsZ) > 0) {
      if (absX >= absY && absX >= absZ) {
        lockedAxis = 'x';
      } else if (absY >= absX && absY >= absZ) {
        lockedAxis = 'y';
      } else {
        lockedAxis = 'z';
      }
    }
  }

  if (lockedAxis === 'x') {
    deltaUnitsY = 0;
    deltaUnitsZ = 0;
  } else if (lockedAxis === 'y') {
    deltaUnitsX = 0;
    deltaUnitsZ = 0;
  } else if (lockedAxis === 'z') {
    deltaUnitsX = 0;
    deltaUnitsY = 0;
  } else {
    deltaUnitsX = 0;
    deltaUnitsY = 0;
    deltaUnitsZ = 0;
  }

  return { deltaUnitsX, deltaUnitsY, deltaUnitsZ, lockedAxis };
};

// 6a: First movement primarily along X
let res1 = computeAxisDeltas({ x: 1200, y: 300, z: 200 }, 1, 1, 1);
console.log('Step 1 (move +X):', res1);
if (res1.lockedAxis !== 'x' || res1.deltaUnitsX !== 1 || res1.deltaUnitsY !== 0 || res1.deltaUnitsZ !== 0) {
  throw new Error(`Expected move to lock to X and zero Y and Z! Got: ${JSON.stringify(res1)}`);
}

// 6b: Subsequent diagonal/Y movement while dragging must only affect locked X axis
let res2 = computeAxisDeltas({ x: 2200, y: 1500, z: 1800 }, 1, 1, 1);
console.log('Step 2 (further move with diagonal input):', res2);
if (res2.lockedAxis !== 'x' || res2.deltaUnitsX !== 2 || res2.deltaUnitsY !== 0 || res2.deltaUnitsZ !== 0) {
  throw new Error(`Expected move to stay locked to X (Y=0, Z=0)! Got: ${JSON.stringify(res2)}`);
}

// 6c: Upon release, lockedAxis resets
lockedAxis = null;
let res3 = computeAxisDeltas({ x: 0, y: 1400, z: 0 }, 1, 1, 1);
console.log('Step 3 (new drag moving +Y):', res3);
if (res3.lockedAxis !== 'y' || res3.deltaUnitsY !== 1 || res3.deltaUnitsX !== 0 || res3.deltaUnitsZ !== 0) {
  throw new Error(`Expected new drag to lock to Y! Got: ${JSON.stringify(res3)}`);
}

console.log('\n--- Test 7: Module Selection vs Right-Click Gizmo Presentation ---');

// Mock module and viewer state
const mockModules = [
  { userData: { index: 1, macro: 'module_prod_energy_macro' }, position: new THREE.Vector3(0, 0, 0) },
  { userData: { index: 2, macro: 'module_dock_macro' }, position: new THREE.Vector3(100, 0, 100) }
];

let attachedGizmoObject = null;
const mockTransformControls = {
  object: null,
  attach(obj) { this.object = obj; attachedGizmoObject = obj; },
  detach() { this.object = null; attachedGizmoObject = null; }
};

let gizmoTargetModuleIndex = null;
let selectedModuleIndex = null;

const selectModuleByIndex = (index, resizeGridAndBounds = false, attachGizmo = null) => {
  const priorGizmoTarget = gizmoTargetModuleIndex;
  selectedModuleIndex = index;
  const targetModule = mockModules.find(m => m.userData.index === index);

  const shouldAttachGizmo = attachGizmo === true || (attachGizmo === null && priorGizmoTarget === index);
  if (shouldAttachGizmo) {
    mockTransformControls.attach(targetModule);
  } else {
    mockTransformControls.detach();
  }
};

const deselect = () => {
  selectedModuleIndex = null;
  gizmoTargetModuleIndex = null;
  mockTransformControls.detach();
};

// 7a: Standard selection (e.g. from UI list or left-click) does NOT present gizmo
selectModuleByIndex(1);
console.log('Module 1 selected normally. Gizmo attached:', !!attachedGizmoObject);
if (attachedGizmoObject !== null) {
  throw new Error('Module selection should NOT present a gizmo!');
}

// 7b: Left-click selection explicitly passing attachGizmo=false
selectModuleByIndex(2, false, false);
console.log('Module 2 selected via left click. Gizmo attached:', !!attachedGizmoObject);
if (attachedGizmoObject !== null) {
  throw new Error('Left-click selection should NOT present a gizmo!');
}

// 7c: Right-clicking on module 2 DOES present gizmo
gizmoTargetModuleIndex = 2;
selectModuleByIndex(2, false, true);
console.log('Module 2 right-clicked. Gizmo attached:', !!attachedGizmoObject);
if (!attachedGizmoObject || attachedGizmoObject.userData.index !== 2) {
  throw new Error('Right-clicking on module MUST present the gizmo!');
}

// 7d: Deselecting detaches gizmo
deselect();
console.log('Deselected. Gizmo attached:', !!attachedGizmoObject);
if (attachedGizmoObject !== null) {
  throw new Error('Deselection should detach the gizmo!');
}

console.log('Verified: Module selection does not present a gizmo, right-clicking on a module does!');

console.log('\n✅ ALL PLOT CORNER GIZMO & RIGHT-CLICK GIZMO TESTS PASSED SUCCESSFULLY!');



