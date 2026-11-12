import assert from 'assert';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import {
  createUnifiedLayersCard,
  getDocksVerticalOrientation,
  setDocksVerticalOrientation,
  applyDocksVerticalOrientation,
  calculateLayeredPlacement,
  getPlotBoundingBox,
  isDocks1Present,
  addActionableElement,
  clearActionableElements
} from '../src/module-display-panel.js';
import { StationLayoutEngine } from '../packages/domain/src/services/station-layout-engine.js';
import { resolveBlueprintXmlPath, readBlueprintXml, parseConstructionPlan } from '../packages/adapter-xml/src/index.js';
import { getInitialModuleSize } from '../packages/catalog/src/index.js';

console.log('--- Testing Docks Vertical Orientation under Layout Pill ---');

// Setup mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="display-panel-container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// 1. Verify default orientation and persistence
localStorage.clear();
assert.strictEqual(getDocksVerticalOrientation(), 'top', 'Default docks vertical orientation should be top');

setDocksVerticalOrientation('center');
assert.strictEqual(getDocksVerticalOrientation(), 'center', 'Orientation should update to center');
assert.strictEqual(localStorage.getItem('x4_docks_vertical_orientation'), 'center', 'Orientation should persist in localStorage');

setDocksVerticalOrientation('bottom');
assert.strictEqual(getDocksVerticalOrientation(), 'bottom', 'Orientation should update to bottom');
assert.strictEqual(localStorage.getItem('x4_docks_vertical_orientation'), 'bottom', 'Orientation should persist in localStorage');

setDocksVerticalOrientation('top');
assert.strictEqual(getDocksVerticalOrientation(), 'top', 'Orientation should update back to top');
console.log('✓ Verified: getDocksVerticalOrientation & setDocksVerticalOrientation work and persist.');

// 2. Verify DOM rendering in createUnifiedLayersCard
const mockLayers = [
  { id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' },
  { id: 'layers:storage', decoratorId: 'layers', category: 'storage', layerNumber: 2, elementName: 'Storage-2' }
];

const card = createUnifiedLayersCard(mockLayers, 0);
assert.ok(card, 'Unified layers card should be created');

// Check the Docks-1 row
const docksRow = card.querySelector('#layer-item-layers_docks');
assert.ok(docksRow, 'Row for Docks-1 should exist');

const docksLeft = docksRow.querySelector('.unified-layer-left');
assert.ok(docksLeft, 'Left group for Docks-1 should exist');

const nameSpan = docksLeft.querySelector('.unified-layer-name');
assert.strictEqual(nameSpan.textContent, 'Docks-1', 'Sub-pill should have text Docks-1');

// Text "Orientation:" must be immediately to the right of the sub-pill "Docks-1"
const orientationText = docksLeft.querySelector('.layer-orientation-text');
assert.ok(orientationText, 'Orientation text should exist in left group');
assert.strictEqual(orientationText.textContent, 'Orientation:', 'Text should be exactly "Orientation:"');
// Check that orientationText is placed after nameSpan in DOM order
const leftChildren = Array.from(docksLeft.children);
const nameIdx = leftChildren.indexOf(nameSpan);
const orientIdx = leftChildren.indexOf(orientationText);
assert.ok(orientIdx > nameIdx, 'Orientation: text must be to the right of the sub-pill "Docks-1"');

// Dropdown labeled "Vertical" must be slid just outside the Orientation label (in docksLeft)
const vertGroup = docksLeft.querySelector('.layer-vertical-dropdown-group');
assert.ok(vertGroup, 'Vertical dropdown group should exist just outside Orientation label');
const vertIdx = leftChildren.indexOf(vertGroup);
assert.ok(vertIdx > orientIdx, 'Vertical dropdown must be immediately after Orientation label');

const docksRight = docksRow.querySelector('.unified-layer-right');
assert.ok(docksRight, 'Right group for Docks-1 should exist');

// Right group has Perimeter dropdown
const perimeterGroup = docksRight.querySelector('.layer-perimeter-dropdown-group');
assert.ok(perimeterGroup, 'Perimeter dropdown group should exist in right group');

const vertLabel = vertGroup.querySelector('.layer-vertical-label');
assert.ok(vertLabel, 'Dropdown label should exist');
assert.strictEqual(vertLabel.textContent, 'Vertical', 'Label text should be "Vertical"');

const vertSelect = vertGroup.querySelector('#docks-vertical-select');
assert.ok(vertSelect, 'Vertical dropdown select should exist');
const options = Array.from(vertSelect.options).map(o => o.value);
assert.deepStrictEqual(options, ['top', 'center', 'bottom'], 'Dropdown options must be top, center, bottom');
assert.strictEqual(vertSelect.value, 'top', 'Dropdown should reflect active orientation');

console.log('✓ Verified: Docks-1 row has "Orientation:" next to "Docks-1", "Vertical" slid just outside Orientation, and "Perimeter" dropdown on the right.');

// 3. Verify non-dock layers do NOT have Orientation or Vertical dropdown
const storageRow = card.querySelector('#layer-item-layers_storage');
assert.ok(storageRow, 'Storage-2 row should exist');
assert.strictEqual(storageRow.querySelector('.layer-orientation-text'), null, 'Storage-2 should NOT have Orientation text');
assert.strictEqual(storageRow.querySelector('.layer-vertical-dropdown-group'), null, 'Storage-2 should NOT have Vertical dropdown');
console.log('✓ Verified: Non-dock layers do not show the Orientation controls.');

// 4. Test changing dropdown updates orientation and triggers placement
let viewerRenderCalled = false;
const mockViewerInstance = {
  currentPlotConfig: {
    x: { plus: 5, minus: 5 },
    y: { plus: 5, minus: 5 },
    z: { plus: 5, minus: 5 }
  },
  modulesGroup: {
    children: [
      {
        userData: { macro: 'dock_01', initialSize: { x: 500, y: 200, z: 500 } },
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
      }
    ]
  },
  render() {
    viewerRenderCalled = true;
  }
};

// Set to 'bottom'
vertSelect.value = 'bottom';
vertSelect.dispatchEvent(new dom.window.Event('change'));
assert.strictEqual(getDocksVerticalOrientation(), 'bottom', 'Orientation should update to bottom after select change');

// 5. Test 3D positioning logic within Plot BB
// Plot config: Y is -5000 to +5000. Dock module height = 200 -> halfY = 100.
// Top: 5000 - 100 = 4900
// Center: 0
// Bottom: -5000 + 100 = -4900
const plotConfig = {
  x: { plus: 5, minus: 5 },
  y: { plus: 5, minus: 5 },
  z: { plus: 5, minus: 5 }
};

const dockModule = {
  userData: { macro: 'dock_01', initialSize: { x: 500, y: 200, z: 500 } },
  position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
};

// Ensure "Layers - Docks-1" is present in Actionable Decorators
clearActionableElements();
addActionableElement('layers', 0); // Adds Docks-1
assert.strictEqual(isDocks1Present(), true, 'isDocks1Present() should return true when Docks-1 is added');

// Test 'top'
setDocksVerticalOrientation('top');
calculateLayeredPlacement([dockModule], 'center', plotConfig, ['Docks'], {
  getModuleSize: () => ({ x: 500, y: 200, z: 500 }),
  applyToObjects: true
});
assert.strictEqual(dockModule.position.y, 4900, 'Docks in top orientation should be at maxY - halfY (4900)');

// Test 'center'
setDocksVerticalOrientation('center');
calculateLayeredPlacement([dockModule], 'center', plotConfig, ['Docks'], {
  getModuleSize: () => ({ x: 500, y: 200, z: 500 }),
  applyToObjects: true
});
assert.strictEqual(dockModule.position.y, 0, 'Docks in center orientation should be at centerY (0)');

// Test 'bottom'
setDocksVerticalOrientation('bottom');
calculateLayeredPlacement([dockModule], 'center', plotConfig, ['Docks'], {
  getModuleSize: () => ({ x: 500, y: 200, z: 500 }),
  applyToObjects: true
});
assert.strictEqual(dockModule.position.y, -4900, 'Docks in bottom orientation should be at minY + halfY (-4900)');

console.log('✓ Verified: calculateLayeredPlacement places dock modules at top (4900), center (0), and bottom (-4900).');

// Test applyDocksVerticalOrientation directly
let sceneRendered = false;
mockViewerInstance.renderScene = () => { sceneRendered = true; };

applyDocksVerticalOrientation('top', mockViewerInstance);
assert.strictEqual(mockViewerInstance.modulesGroup.children[0].position.y, 4900);
assert.strictEqual(sceneRendered, true, 'renderScene should be called after dock position change');

applyDocksVerticalOrientation('center', mockViewerInstance);
assert.strictEqual(mockViewerInstance.modulesGroup.children[0].position.y, 0);

applyDocksVerticalOrientation('bottom', mockViewerInstance);
assert.strictEqual(mockViewerInstance.modulesGroup.children[0].position.y, -4900);
console.log('✓ Verified: applyDocksVerticalOrientation directly positions dock modules and calls renderScene.');

// 6. Test Blueprint XML resolver searching user's constructionplan directory first
const resolvedDocksPath = resolveBlueprintXmlPath('Docks.xml');
assert.ok(resolvedDocksPath, 'resolveBlueprintXmlPath should find Docks.xml');
assert.ok(resolvedDocksPath.includes('Egosoft\\X4\\47624366\\constructionplan') || resolvedDocksPath.includes('Egosoft/X4/47624366/constructionplan'),
  'Should find Docks.xml in C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\constructionplan first');
console.log('✓ Verified: Blueprint XML resolver searches C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\constructionplan first.');

// 7. Test Docks.xml moves ALL docks to plot BB location
const docksXml = readBlueprintXml('Docks.xml');
assert.ok(docksXml, 'readBlueprintXml should read Docks.xml');
const docksPlan = parseConstructionPlan(docksXml);
assert.strictEqual(docksPlan.modules.length, 3, 'Docks.xml should have 3 dock modules');

const docksViewer = {
  currentPlotConfig: {
    x: { plus: 10, minus: 10 },
    y: { plus: 10, minus: 10 },
    z: { plus: 10, minus: 10 }
  },
  modulesGroup: {
    children: docksPlan.modules.map(m => {
      const initialSizeArr = getInitialModuleSize(m.macro);
      return {
        userData: {
          macro: m.macro,
          index: m.index,
          initialSize: { x: initialSizeArr[0], y: initialSizeArr[1], z: initialSizeArr[2] }
        },
        position: {
          x: m.position.x,
          y: m.position.y,
          z: -m.position.z,
          set(x, y, z) { this.x = x; this.y = y; this.z = z; }
        }
      };
    })
  },
  renderSceneCalled: false,
  renderScene() { this.renderSceneCalled = true; },
  getModuleInitialSize(m) {
    return m.userData.initialSize;
  }
};

// Test top
applyDocksVerticalOrientation('top', docksViewer);
docksViewer.modulesGroup.children.forEach((c, idx) => {
  const halfY = c.userData.initialSize.y / 2;
  const topEdge = c.position.y + halfY;
  // Top edge should touch maxY (10000)
  assert.ok(Math.abs(topEdge - 10000) < 5, `Module #${c.userData.index} top edge (${topEdge}) should reach plot BB maxY (10000)`);
});
console.log('✓ Verified: Docks.xml moves ALL 3 docks to top BB location.');

// Test center
applyDocksVerticalOrientation('center', docksViewer);
docksViewer.modulesGroup.children.forEach((c) => {
  assert.ok(Math.abs(c.position.y - 0) < 5, `Module #${c.userData.index} center (${c.position.y}) should reach plot BB centerY (0)`);
});
console.log('✓ Verified: Docks.xml moves ALL 3 docks to center BB location.');

// Test bottom
applyDocksVerticalOrientation('bottom', docksViewer);
docksViewer.modulesGroup.children.forEach((c) => {
  const halfY = c.userData.initialSize.y / 2;
  const bottomEdge = c.position.y - halfY;
  // Bottom edge should touch minY (-10000)
  assert.ok(Math.abs(bottomEdge - (-10000)) < 5, `Module #${c.userData.index} bottom edge (${bottomEdge}) should reach plot BB minY (-10000)`);
});
console.log('✓ Verified: Docks.xml moves ALL 3 docks to bottom BB location.');

// 8. Test that NO module BB overlaps the plot BB across all Layout Orientations and plot sizes
const testConfigs = [
  { name: '10km Plot', x: { plus: 10, minus: 10 }, y: { plus: 10, minus: 10 }, z: { plus: 10, minus: 10 } },
  { name: '5km Plot', x: { plus: 5, minus: 5 }, y: { plus: 5, minus: 5 }, z: { plus: 5, minus: 5 } },
  { name: 'Asymmetric 6km/4km Plot', x: { plus: 6, minus: 4 }, y: { plus: 5, minus: 3 }, z: { plus: 7, minus: 5 } }
];

for (const cfg of testConfigs) {
  const pBounds = getPlotBoundingBox(cfg);
  for (const orient of ['top', 'center', 'bottom']) {
    const vTest = {
      currentPlotConfig: cfg,
      modulesGroup: {
        children: docksPlan.modules.map(m => {
          const initialSizeArr = getInitialModuleSize(m.macro);
          const g = new THREE.Group();
          g.userData = {
            macro: m.macro,
            index: m.index,
            initialSize: new THREE.Vector3(initialSizeArr[0], initialSizeArr[1], initialSizeArr[2])
          };
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(initialSizeArr[0], initialSizeArr[1], initialSizeArr[2]),
            new THREE.MeshBasicMaterial()
          );
          g.add(mesh);
          g.position.set(m.position.x, m.position.y, -m.position.z);
          return g;
        })
      },
      renderScene() {},
      getModuleInitialSize(m) { return m.userData.initialSize; },
      getModuleWorldBoundingBox(m) {
        m.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(m);
      },
      updatePlotBoxViolations() {}
    };

    applyDocksVerticalOrientation(orient, vTest);

    // Verify every module BB is strictly inside plot BB
    vTest.modulesGroup.children.forEach(c => {
      const box = vTest.getModuleWorldBoundingBox(c);
      const eps = 0.5;
      assert.ok(box.min.x >= pBounds.minX - eps, `Module #${c.userData.index} min.x (${box.min.x}) must not overlap plot minX (${pBounds.minX}) for ${cfg.name} ${orient}`);
      assert.ok(box.max.x <= pBounds.maxX + eps, `Module #${c.userData.index} max.x (${box.max.x}) must not overlap plot maxX (${pBounds.maxX}) for ${cfg.name} ${orient}`);
      assert.ok(box.min.y >= pBounds.minY - eps, `Module #${c.userData.index} min.y (${box.min.y}) must not overlap plot minY (${pBounds.minY}) for ${cfg.name} ${orient}`);
      assert.ok(box.max.y <= pBounds.maxY + eps, `Module #${c.userData.index} max.y (${box.max.y}) must not overlap plot maxY (${pBounds.maxY}) for ${cfg.name} ${orient}`);
      assert.ok(box.min.z >= pBounds.minZ - eps, `Module #${c.userData.index} min.z (${box.min.z}) must not overlap plot minZ (${pBounds.minZ}) for ${cfg.name} ${orient}`);
      assert.ok(box.max.z <= pBounds.maxZ + eps, `Module #${c.userData.index} max.z (${box.max.z}) must not overlap plot maxZ (${pBounds.maxZ}) for ${cfg.name} ${orient}`);
    });
  }
}
console.log('✓ Verified: Zero module BB overlaps with plot BB across all orientations (top, center, bottom) and plot configurations.');

console.log('\n✅ ALL DOCKS VERTICAL ORIENTATION TESTS PASSED!');
