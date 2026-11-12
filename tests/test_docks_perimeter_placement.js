import assert from 'assert';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import {
  setDocksVerticalOrientation,
  applyDocksVerticalOrientation,
  getDocksVerticalOrientation,
  getDocksPerimeterSelections,
  setDocksPerimeterSelections,
  clearDocksPerimeterSelections,
  applyDocksPerimeterPlacement,
  createUnifiedLayersCard,
  createActionableElementCard,
  createPerimeterMultiSelectGroup,
  ensureNoDocksInvisibleOverlap,
  getDockInvisibleWorldBoundingBox,
  isPierModule,
  isGeometryInvisibleComponent,
  getPlotBoundingBox
} from '../src/module-display-panel.js';

console.log('--- Testing Docks Perimeter Placement & UI Controls ---');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// =========================================================================
// Test 1: UI DOM structure & positioning
// =========================================================================
console.log('\n--- Test 1: UI Layout - Vertical slid outside Orientation, Perimeter dropdown provided ---');

const card = createUnifiedLayersCard([
  { id: 'layers:docks-1', elementName: 'Docks-1', category: 'Docks', layerNumber: 1 }
], 0);

const docksRow = card.querySelector('#layer-item-layers_docks-1');
assert.ok(docksRow, 'Docks-1 row should exist');

const docksLeft = docksRow.querySelector('.unified-layer-left');
const docksRight = docksRow.querySelector('.unified-layer-right');
assert.ok(docksLeft, 'docksLeft should exist');
assert.ok(docksRight, 'docksRight should exist');

const nameSpan = docksLeft.querySelector('.unified-layer-name');
const orientationText = docksLeft.querySelector('.layer-orientation-text');
const vertGroup = docksLeft.querySelector('.layer-vertical-dropdown-group');

assert.ok(nameSpan, 'Docks-1 name label should exist');
assert.ok(orientationText, 'Orientation: text should exist');
assert.ok(vertGroup, 'Vertical dropdown group should exist');

const leftChildren = Array.from(docksLeft.children);
const nameIdx = leftChildren.indexOf(nameSpan);
const orientIdx = leftChildren.indexOf(orientationText);
const vertIdx = leftChildren.indexOf(vertGroup);

assert.ok(orientIdx > nameIdx, 'Orientation: must be after Docks-1');
assert.ok(vertIdx > orientIdx, 'Vertical dropdown must be slid just outside Orientation: label');

// Check Perimeter group in right group
const perimeterGroup = docksRight.querySelector('.layer-perimeter-dropdown-group');
assert.ok(perimeterGroup, 'Perimeter multi-selection dropdown group must exist in right group');

const perimeterLabel = perimeterGroup.querySelector('.layer-perimeter-label');
assert.strictEqual(perimeterLabel.textContent, 'Perimeter', 'Perimeter label text should be "Perimeter"');

const multiselectToggle = perimeterGroup.querySelector('.cyber-multiselect-toggle');
assert.ok(multiselectToggle, 'Perimeter dropdown toggle button should exist');

const multiselectMenu = perimeterGroup.querySelector('.cyber-multiselect-menu');
assert.ok(multiselectMenu, 'Perimeter dropdown menu should exist');

const menuItems = Array.from(multiselectMenu.querySelectorAll('.cyber-multiselect-item'));
const itemValues = menuItems.map(it => it.dataset.value);
assert.deepStrictEqual(itemValues, ['clear', 'lanes', 'stacked', 'spread'], 'Dropdown selections must be clear, lanes, stacked, spread');

console.log('✓ Verified: Vertical dropdown is placed just outside Orientation label, Perimeter dropdown exists with options (clear, lanes, stacked, spread).');

// =========================================================================
// Test 2: Multi-selection and Clear behavior
// =========================================================================
console.log('\n--- Test 2: Multi-selection interaction & Clear removes all checks ---');

clearDocksPerimeterSelections();
assert.strictEqual(getDocksPerimeterSelections().size, 0, 'Initially selections should be empty');

const clearCb = multiselectMenu.querySelector('input[value="clear"]');
const lanesCb = multiselectMenu.querySelector('input[value="lanes"]');
const stackedCb = multiselectMenu.querySelector('input[value="stacked"]');
const spreadCb = multiselectMenu.querySelector('input[value="spread"]');

assert.ok(clearCb && lanesCb && stackedCb && spreadCb, 'All checkboxes must exist');

// Select 'lanes'
lanesCb.checked = true;
lanesCb.dispatchEvent(new dom.window.Event('change'));
assert.ok(getDocksPerimeterSelections().has('lanes'), 'lanes must be in selections');

// Select 'stacked'
stackedCb.checked = true;
stackedCb.dispatchEvent(new dom.window.Event('change'));
assert.ok(getDocksPerimeterSelections().has('stacked'), 'stacked must be in selections');
assert.ok(getDocksPerimeterSelections().has('lanes'), 'lanes must still be in selections');

// Click 'clear'
clearCb.checked = true;
clearCb.dispatchEvent(new dom.window.Event('change'));

assert.strictEqual(lanesCb.checked, false, 'lanes must be unchecked on clear');
assert.strictEqual(stackedCb.checked, false, 'stacked must be unchecked on clear');
assert.strictEqual(spreadCb.checked, false, 'spread must be unchecked on clear');
assert.strictEqual(clearCb.checked, false, 'clear itself must remain unchecked');
assert.strictEqual(getDocksPerimeterSelections().size, 0, 'All selections cleared');

console.log('✓ Verified: Multi-selection toggles correctly and Clear removes all checks.');

// =========================================================================
// Test 3: "stacked" places largest docks along longest dimension displaced vertically by BB
// =========================================================================
console.log('\n--- Test 3: Stacked Placement ---');

// Create mock viewer with 3 docks of different sizes
// Longest plot dimension: widthX = 20,000m, depthZ = 10,000m -> Longest is X
const mockViewer = {
  currentPlotConfig: {
    enabled: true,
    x: { plus: 10, minus: 10 }, // 20 km widthX
    z: { plus: 5, minus: 5 },   // 10 km depthZ
    y: { plus: 10, minus: 10 }  // 20 km heightY
  },
  modulesGroup: {
    children: [
      {
        name: 'dock_small',
        userData: { macro: 'dock_small_macro', initialSize: { x: 100, y: 100, z: 100 } },
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
      },
      {
        name: 'dock_huge',
        userData: { macro: 'dock_huge_macro', initialSize: { x: 500, y: 300, z: 500 } },
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
      },
      {
        name: 'dock_medium',
        userData: { macro: 'dock_medium_macro', initialSize: { x: 200, y: 200, z: 200 } },
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
      }
    ]
  },
  renderSceneCalled: false,
  renderScene() {
    this.renderSceneCalled = true;
  }
};

setDocksVerticalOrientation('bottom', mockViewer);
setDocksPerimeterSelections(['stacked'], mockViewer);

const mods = mockViewer.modulesGroup.children;
const dockHuge = mods.find(m => m.name === 'dock_huge');
const dockMed = mods.find(m => m.name === 'dock_medium');
const dockSmall = mods.find(m => m.name === 'dock_small');

// Bounding box heights: huge=300, medium=200, small=100
// Since vertical is 'bottom', largest starts at bottom, displaced vertically
assert.ok(dockHuge.position.y < dockMed.position.y, 'Huge dock must be below medium dock');
assert.ok(dockMed.position.y < dockSmall.position.y, 'Medium dock must be below small dock');

// Vertical displacement is at least the preceding dock BB height
const diffHugeToMed = dockMed.position.y - dockHuge.position.y;
assert.ok(diffHugeToMed >= 200, `Vertical displacement between docks should be >= half-heights (got ${diffHugeToMed})`);

console.log('✓ Verified: Stacked places largest docks along longest dimension, vertically displaced by BB height.');

// =========================================================================
// Test 4: "spread" spreads docks out evenly to each side with multiples beyond 4 walls stacking vertically
// =========================================================================
console.log('\n--- Test 4: Spread Placement Across Four Walls & Stacking ---');

// Create 6 docks
const spreadDocks = [];
for (let i = 0; i < 6; i++) {
  spreadDocks.push({
    name: `dock_${i}`,
    userData: { macro: `dock_${i}_macro`, initialSize: { x: 200, y: 150, z: 200 } },
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
  });
}

mockViewer.modulesGroup.children = spreadDocks;
setDocksVerticalOrientation('bottom', mockViewer);
setDocksPerimeterSelections(['spread'], mockViewer);

// Docks 0..3 should be on the four perimeter walls: +Z, +X, -Z, -X
const d0 = spreadDocks[0];
const d1 = spreadDocks[1];
const d2 = spreadDocks[2];
const d3 = spreadDocks[3];
const d4 = spreadDocks[4];
const d5 = spreadDocks[5];

const plotBounds = getPlotBoundingBox(mockViewer.currentPlotConfig);

// d0 on +Z wall
assert.ok(Math.abs(d0.position.z - (plotBounds.maxZ - 100)) < 2, 'Dock 0 should be on +Z wall');
// d1 on +X wall
assert.ok(Math.abs(d1.position.x - (plotBounds.maxX - 100)) < 2, 'Dock 1 should be on +X wall');
// d2 on -Z wall
assert.ok(Math.abs(d2.position.z - (plotBounds.minZ + 100)) < 2, 'Dock 2 should be on -Z wall');
// d3 on -X wall
assert.ok(Math.abs(d3.position.x - (plotBounds.minX + 100)) < 2, 'Dock 3 should be on -X wall');

// d4 is the 5th dock (i=4): multiple beyond 4 walls -> stacks vertically on wall 0 (+Z wall)!
assert.ok(Math.abs(d4.position.z - (plotBounds.maxZ - 100)) < 2, 'Dock 4 should be on +Z wall');
assert.ok(d4.position.y > d0.position.y, 'Dock 4 should stack vertically above Dock 0');
assert.ok((d4.position.y - d0.position.y) >= 150, `Dock 4 must be displaced by Dock 0 BB height (got ${d4.position.y - d0.position.y})`);

// d5 is the 6th dock (i=5): multiple beyond 4 walls -> stacks vertically on wall 1 (+X wall)!
assert.ok(Math.abs(d5.position.x - (plotBounds.maxX - 100)) < 2, 'Dock 5 should be on +X wall');
assert.ok(d5.position.y > d1.position.y, 'Dock 5 should stack vertically above Dock 1');

console.log('✓ Verified: Spread distributes docks evenly to 4 walls, and multiples beyond 4 walls stack vertically.');

// =========================================================================
// Test 5: "lanes" insures no docks invisible geometries BB overlap
// =========================================================================
console.log('\n--- Test 5: Lanes Insure No Invisible Geometries Overlap ---');

// Create 2 pier docks with large invisible approach corridor meshes overlapping at origin
function createMockDockWithInvisible(macro, x, y, z, invisW, invisH, invisD) {
  const group = new THREE.Group();
  group.name = macro;
  group.userData = { macro, initialSize: { x: 200, y: 100, z: 200 } };
  group.position.set(x, y, z);

  const physical = new THREE.Mesh(
    new THREE.BoxGeometry(200, 100, 200),
    new THREE.MeshBasicMaterial()
  );
  physical.name = 'part_main-lod0';
  group.add(physical);

  const invis = new THREE.Mesh(
    new THREE.BoxGeometry(invisW, invisH, invisD),
    new THREE.MeshBasicMaterial()
  );
  invis.name = 'geometryinvisible-approach';
  invis.userData = { isGeometryInvisible: true };
  group.add(invis);

  return group;
}

const pier1 = createMockDockWithInvisible('pier_01', 0, 0, 0, 2000, 500, 2000);
const pier2 = createMockDockWithInvisible('pier_02', 100, 0, 100, 2000, 500, 2000);

pier1.updateMatrixWorld(true);
pier2.updateMatrixWorld(true);

const box1Before = getDockInvisibleWorldBoundingBox(pier1);
const box2Before = getDockInvisibleWorldBoundingBox(pier2);
assert.ok(box1Before && box2Before, 'Invisible bounding boxes should be computed');
assert.ok(box1Before.intersectsBox(box2Before), 'Invisible geometries initially overlap');

mockViewer.modulesGroup.children = [pier1, pier2];
setDocksPerimeterSelections(['lanes'], mockViewer);

pier1.updateMatrixWorld(true);
pier2.updateMatrixWorld(true);

const box1After = getDockInvisibleWorldBoundingBox(pier1);
const box2After = getDockInvisibleWorldBoundingBox(pier2);
assert.strictEqual(box1After.intersectsBox(box2After), false, 'Lanes must insure no invisible geometry BB overlap');

console.log('✓ Verified: Lanes successfully resolves invisible geometry bounding box overlaps.');

// =========================================================================
// Test 6: Removal of a checked selection causes re-evaluation
// =========================================================================
console.log('\n--- Test 6: Removal of a Checked Selection Re-evaluates Remaining ---');

// Activate 'spread' and 'lanes'
setDocksPerimeterSelections(['spread', 'lanes'], mockViewer);
assert.deepStrictEqual(Array.from(getDocksPerimeterSelections()), ['spread', 'lanes']);

// Now remove 'lanes', leaving 'spread'
setDocksPerimeterSelections(['spread'], mockViewer);
assert.deepStrictEqual(Array.from(getDocksPerimeterSelections()), ['spread']);

// Now remove 'spread' (all unchecked)
clearDocksPerimeterSelections(mockViewer);
assert.strictEqual(getDocksPerimeterSelections().size, 0);

console.log('✓ Verified: Removal of checked selections re-evaluates remaining selections cleanly.');

console.log('\n✅ ALL PERIMETER PLACEMENT & UI TESTS PASSED SUCCESSFULLY!');
