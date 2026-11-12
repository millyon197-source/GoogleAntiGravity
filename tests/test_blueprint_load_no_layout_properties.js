import assert from 'assert';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import {
  isBlueprintModeActive,
  setBlueprintModeActive,
  setActiveBlueprint,
  getActiveBlueprint,
  setAllPillsToDefault,
  saveActionableElements,
  clearActionableElements,
  setDocksVerticalOrientation,
  getDocksVerticalOrientation,
  isDocks1Present
} from '../src/module-display-panel.js';
import { StationViewer } from '../src/viewer.js';
import { resolveBlueprintXmlPath, readBlueprintXml, parseConstructionPlan } from '../packages/adapter-xml/src/index.js';

console.log('--- Testing Blueprint Load Without Layout Properties ---');

// Setup mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="display-panel-container"><input type="checkbox" id="toggle-blueprint" checked /></div></body></html>');
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

// 1. Verify setActiveBlueprint activates Blueprint mode and resets pills to default
setBlueprintModeActive(false);
assert.strictEqual(isBlueprintModeActive(), false, 'Blueprint mode initially set to false');

setActiveBlueprint('test_station_id', 'Test Station');
assert.strictEqual(isBlueprintModeActive(), true, 'setActiveBlueprint must activate Blueprint mode');
console.log('✓ Verified: setActiveBlueprint activates Blueprint mode.');

// 2. Load Docks.xml blueprint
const docksXmlPath = resolveBlueprintXmlPath('Docks');
assert.ok(docksXmlPath, 'Docks.xml blueprint should resolve');
const docksXml = readBlueprintXml(docksXmlPath);
const docksPlan = parseConstructionPlan(docksXml);
assert.ok(docksPlan.modules.length > 0, 'Docks blueprint should have modules');

// Find a dock module in Docks.xml and verify its authored blueprint coordinates
const originalDock = docksPlan.modules.find(m => m.macro.includes('dock'));
assert.ok(originalDock, 'Should find a dock module in Docks.xml');
console.log(`Authored blueprint position for ${originalDock.macro}: (${originalDock.position.x}, ${originalDock.position.y}, ${originalDock.position.z})`);

// 3. Configure mock StationViewer
const viewer = Object.create(StationViewer.prototype);
viewer.scene = new THREE.Scene();
viewer.modulesGroup = new THREE.Group();
viewer.scene.add(viewer.modulesGroup);
viewer.hiddenMacros = new Set();
viewer.clear = function() {
  while (this.modulesGroup.children.length > 0) {
    this.modulesGroup.remove(this.modulesGroup.children[0]);
  }
};
viewer.clearFilterHighlights = () => {};
viewer.fitCameraToStation = () => {};
viewer.restoreFullPlanGrid = () => {};
viewer.precompileShaders = async () => {};
viewer.buildModuleSnapPoints = () => {};
viewer.getModuleInitialSize = () => new THREE.Vector3(100, 100, 100);
viewer.camera = new THREE.PerspectiveCamera(60, 1, 1, 1000);
viewer.currentPlotConfig = { x: { plus: 5, minus: 5 }, y: { plus: 5, minus: 5 }, z: { plus: 5, minus: 5 } };

// Mock loadModuleMesh to create simple mesh group
viewer.loadModuleMesh = async function(mod) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
  g.add(mesh);
  return g;
};

// Set actionable decorators: add Layers - Docks-1 with orientation 'center'
clearActionableElements();
saveActionableElements([{
  id: 'layers:docks',
  decoratorId: 'layers',
  category: 'docks',
  layerNumber: 1,
  elementName: 'Docks-1'
}]);
assert.strictEqual(isDocks1Present(), true, 'Docks-1 should be present in actionable elements');
setDocksVerticalOrientation('center');

// Set prior layout args and alignment behavior on viewer
viewer.lastLayoutArgs = { key: 'clusters', name: 'Category Clusters' };
viewer.activeAlignmentBehavior = { key: 'anchor-center', name: 'Center' };

// 4. Call loadStationPlanContents
await viewer.loadStationPlanContents(docksPlan);

// Verify that blueprint mode is active
assert.strictEqual(isBlueprintModeActive(), true, 'Blueprint mode must be active after loading blueprint');

// Verify that lingering procedural layout args were cleared
assert.strictEqual(viewer.lastLayoutArgs, null, 'lastLayoutArgs must be null upon blueprint load');
assert.strictEqual(viewer.activeAlignmentBehavior, null, 'activeAlignmentBehavior must be null upon blueprint load');

// 5. Verify modules were NOT repositioned by vertical orientation (or any layout property)
const loadedDockGroup = viewer.modulesGroup.children.find(c => c.userData.macro === originalDock.macro);
assert.ok(loadedDockGroup, 'Loaded dock group must exist in modulesGroup');

// The dock Y position must match authored blueprint Y position exactly (e.g. 6000), NOT center (0) or top/bottom
assert.strictEqual(
  loadedDockGroup.position.y,
  originalDock.position.y,
  `Dock Y position (${loadedDockGroup.position.y}) must match blueprint authored Y (${originalDock.position.y}), NOT orientation center (0)`
);

assert.strictEqual(
  loadedDockGroup.position.x,
  originalDock.position.x,
  `Dock X position (${loadedDockGroup.position.x}) must match blueprint authored X (${originalDock.position.x})`
);

assert.strictEqual(
  loadedDockGroup.position.z,
  -originalDock.position.z,
  `Dock Z position (${loadedDockGroup.position.z}) must match blueprint authored -Z (${-originalDock.position.z})`
);
console.log('✓ Verified: Dock modules retain exact blueprint positions upon load without vertical orientation movement.');

// 6. Verify modules outside plot BB were NOT clamped upon blueprint load
// Note: originalDock.position.y is 6000, while plot Y max is 5000 (y.plus = 5km).
// If clamping had run, position.y would be <= 4950.
assert.ok(
  loadedDockGroup.position.y > 5000,
  `Module outside plot Y (${loadedDockGroup.position.y}) must not be clamped upon blueprint load`
);
console.log('✓ Verified: Modules outside plot boundary are not clamped upon blueprint load.');

// 7. Verify all modules in the blueprint match their authored positions
docksPlan.modules.forEach(mod => {
  const modGroup = viewer.modulesGroup.children.find(c => c.userData.index === mod.index);
  assert.ok(modGroup, `Module #${mod.index} must be present`);
  assert.strictEqual(modGroup.position.x, mod.position.x, `Module #${mod.index} X position must match`);
  assert.strictEqual(modGroup.position.y, mod.position.y, `Module #${mod.index} Y position must match`);
  assert.strictEqual(modGroup.position.z, -mod.position.z, `Module #${mod.index} Z position must match`);
});
console.log('✓ Verified: All blueprint modules are placed strictly at authored blueprint coordinates.');

console.log('\n✅ ALL BLUEPRINT LOAD NO LAYOUT PROPERTIES TESTS PASSED!');
