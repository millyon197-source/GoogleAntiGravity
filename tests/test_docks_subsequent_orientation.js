import assert from 'assert';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import {
  setBlueprintModeActive,
  isBlueprintModeActive,
  setDocksVerticalOrientation,
  applyDocksVerticalOrientation,
  getDocksVerticalOrientation,
  createUnifiedLayersCard,
  initModuleDisplayPanel,
  getPlotBoundingBox,
  isDocksVerticalAppliedToCurrentPlan
} from '../src/module-display-panel.js';
import { StationViewer } from '../src/viewer.js';
import { parseConstructionPlan, readBlueprintXml, resolveBlueprintXmlPath } from '../packages/adapter-xml/src/index.js';

console.log('--- Testing Subsequent Drop-Down Selection of Vertical Orientation ---');

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

const docksXmlPath = resolveBlueprintXmlPath('Docks');
assert.ok(docksXmlPath, 'Docks.xml should resolve');
const docksXml = readBlueprintXml(docksXmlPath);
const docksPlan = parseConstructionPlan(docksXml);

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
viewer.renderScene = () => {};

viewer.loadModuleMesh = async function(mod) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
  g.add(mesh);
  return g;
};

initModuleDisplayPanel(viewer);

console.log('--- Step 1: Loading blueprint ---');
await viewer.loadStationPlanContents(docksPlan);

const dockMesh = viewer.modulesGroup.children.find(m => m.userData.macro.includes('dock'));
assert.ok(dockMesh, 'Dock mesh must exist in modulesGroup');
console.log('Blueprint loaded. Authored dock Y:', dockMesh.position.y);
assert.strictEqual(dockMesh.position.y, 6000, 'Upon loading blueprint, dock Y must remain at authored 6000');
assert.strictEqual(isBlueprintModeActive(), true, 'Blueprint mode must be active upon load');
assert.strictEqual(isDocksVerticalAppliedToCurrentPlan(), false, 'Orientation must not be applied upon load');

console.log('--- Step 2: Creating UI card and checking dropdown ---');
const card = createUnifiedLayersCard([
  { id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' }
], 0);

const vertSelect = card.querySelector('#docks-vertical-select');
assert.ok(vertSelect, 'Vertical select must exist in card');
console.log('Initial vertSelect value:', vertSelect.value);

const pBounds = getPlotBoundingBox(viewer.currentPlotConfig);
const expectedTopY = pBounds.maxY - 50; // maxY (10000) - halfY (50) = 9950
const expectedBottomY = pBounds.minY + 50; // minY (-10000) + halfY (50) = -9950
const expectedCenterY = (pBounds.maxY + pBounds.minY) / 2; // 0

console.log('--- Step 3: Subsequent dropdown selection of "center" ---');
vertSelect.value = 'center';
vertSelect.dispatchEvent(new dom.window.Event('change'));

console.log('After selecting center, dock Y:', dockMesh.position.y);
assert.strictEqual(dockMesh.position.y, expectedCenterY, `Dock Y must be moved to center (${expectedCenterY})`);
assert.strictEqual(isDocksVerticalAppliedToCurrentPlan(), true, 'Orientation must be marked as applied');

console.log('--- Step 4: Subsequent dropdown selection of "top" ---');
vertSelect.value = 'top';
vertSelect.dispatchEvent(new dom.window.Event('change'));

console.log('After selecting top, dock Y:', dockMesh.position.y);
assert.strictEqual(dockMesh.position.y, expectedTopY, `Dock Y must be moved to top (${expectedTopY})`);

console.log('--- Step 5: Subsequent dropdown selection of "bottom" ---');
vertSelect.value = 'bottom';
vertSelect.dispatchEvent(new dom.window.Event('change'));

console.log('After selecting bottom, dock Y:', dockMesh.position.y);
assert.strictEqual(dockMesh.position.y, expectedBottomY, `Dock Y must be moved to bottom (${expectedBottomY})`);

console.log('--- Step 6: Reloading blueprint resets vertical applied flag and retains blueprint authored coords ---');
const reloadedPlan = parseConstructionPlan(docksXml);
await viewer.loadStationPlanContents(reloadedPlan);
const reloadedDock = viewer.modulesGroup.children.find(m => m.userData.macro.includes('dock'));
assert.strictEqual(reloadedDock.position.y, 6000, 'On reload, dock Y must reset to authored 6000');
assert.strictEqual(isDocksVerticalAppliedToCurrentPlan(), false, 'Orientation must reset to not applied on reload');

console.log('--- Step 7: Clicking on dropdown when set to "top" immediately applies top ---');
const reloadedCard = createUnifiedLayersCard([
  { id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' }
], 0);
const reloadedVertSelect = reloadedCard.querySelector('#docks-vertical-select');
reloadedVertSelect.value = 'top';
reloadedVertSelect.dispatchEvent(new dom.window.Event('click'));

console.log('After clicking dropdown (set to top), dock Y:', reloadedDock.position.y);
assert.strictEqual(reloadedDock.position.y, expectedTopY, `Dock Y must be moved to top (${expectedTopY}) on click`);
assert.strictEqual(isDocksVerticalAppliedToCurrentPlan(), true, 'Orientation must be applied after click');

console.log('\n✅ All subsequent dropdown selections honored successfully!');
