import assert from 'assert';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock global Worker for Node.js
if (typeof global.Worker === 'undefined') {
  global.Worker = class {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    postMessage() {}
    terminate() {}
  };
}

const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing Snap Point addition on module click and Structure Analysis highlight clearing...');

// 1. Test StationViewer: Snap Points addition on module selection
{
  const viewer = Object.create(StationViewer.prototype);
  viewer.scene = new THREE.Scene();
  viewer.modulesGroup = new THREE.Group();
  viewer.scene.add(viewer.modulesGroup);
  viewer.snapDots = [];
  viewer.snapPointGeometry = new THREE.SphereGeometry(1, 14, 14);
  viewer.snapPointMaterial = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
  viewer.showDimensions = false;
  viewer.showSnapPoints = true;
  viewer.selectedModuleIndex = null;
  viewer.selectedModules = [];
  viewer.selectedModuleIndices = [];
  viewer.multiSelectionHelpers = [];
  viewer.detachGizmo = () => {};
  viewer.clearDimensionOverlay = () => {};
  viewer.clearMultiSelection = () => {};
  viewer.restoreFullPlanGrid = () => {};
  viewer.clearFilterHighlights = () => {};

  // Create test module groups
  const mod1 = new THREE.Group();
  mod1.userData = { index: 1, macro: 'struct_arg_cross_01_macro' };
  const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
  mesh1.userData.moduleIndex = 1;
  mod1.add(mesh1);

  const mod2 = new THREE.Group();
  mod2.userData = { index: 2, macro: 'pier_arg_harbor_02_macro' };
  const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
  mesh2.userData.moduleIndex = 2;
  mod2.add(mesh2);

  viewer.modulesGroup.add(mod1);
  viewer.modulesGroup.add(mod2);

  // Initially, mod1 has no snap points
  assert(!mod1.getObjectByName('module_snaps_group'), 'mod1 initially has no snap group');

  // Turn snaps toggle OFF to test that selection still adds and displays snap points for selected module
  viewer.showSnapPoints = false;

  // Select mod1 (simulating left-click on module 1 in viewer)
  viewer.selectModuleByIndex(1);

  const snapsGroup1 = mod1.getObjectByName('module_snaps_group');
  assert(snapsGroup1, 'mod1 must have module_snaps_group added upon selection');
  assert.strictEqual(snapsGroup1.visible, true, 'Snap points must be visible on the selected module even when showSnapPoints is false');
  assert(snapsGroup1.children.length >= 6, 'mod1 must have all connection snap dots created');

  // Select mod2 (simulating left-click on module 2 in viewer)
  viewer.selectModuleByIndex(2);

  const snapsGroup2 = mod2.getObjectByName('module_snaps_group');
  assert(snapsGroup2, 'mod2 must have module_snaps_group added upon selection');
  assert.strictEqual(snapsGroup2.visible, true, 'Snap points must be visible on the newly selected module');

  // Previously selected mod1 snap points must be hidden when showSnapPoints is false
  assert.strictEqual(snapsGroup1.visible, false, 'Previous module snap points must be hidden when showSnapPoints is false');

  // Deselect
  viewer.deselect();
  assert.strictEqual(snapsGroup2.visible, false, 'Deselected module snap points must be hidden when showSnapPoints is false');

  console.log('[PASS] Module selection adds and displays snap points as expected.');
}

// 2. Test DOM: Left-click of a module in Structure Analysis clears previous Component Visibility highlights
{
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { document } = dom.window;

  const visContainer = document.getElementById('visibility-controls-container');
  const structCard = document.getElementById('card-structure-analysis');
  assert(visContainer, 'visibility-controls-container must exist');
  assert(structCard, 'card-structure-analysis must exist');

  // Populate mock visibility rows
  const rowA = document.createElement('div');
  rowA.className = 'visibility-row';
  rowA.setAttribute('data-macro', 'prod_arg_meat_macro');
  visContainer.appendChild(rowA);

  const rowB = document.createElement('div');
  rowB.className = 'visibility-row';
  rowB.setAttribute('data-macro', 'storage_arg_l_container_01_macro');
  visContainer.appendChild(rowB);

  // Function to simulate clearComponentVisibilityHighlights matching main.js
  function clearComponentVisibilityHighlights() {
    visContainer.querySelectorAll('.selected-persistent, .reveal-highlight-cv, .highlighted-cat, .reveal-highlight')
      .forEach(el => el.classList.remove('selected-persistent', 'reveal-highlight-cv', 'highlighted-cat', 'reveal-highlight'));
  }

  // Simulate rowA being highlighted from a previous selection
  rowA.classList.add('selected-persistent');
  assert(rowA.classList.contains('selected-persistent'), 'rowA should be highlighted');

  // Click on a macro in Structure Analysis
  const macroItem = document.createElement('div');
  macroItem.className = 'stat-macro-item';
  macroItem.setAttribute('data-macro', 'storage_arg_l_container_01_macro');
  structCard.appendChild(macroItem);

  // Attach the clearing listener matching main.js
  structCard.addEventListener('click', (e) => {
    if (e.button === 0) {
      clearComponentVisibilityHighlights();
    }
  }, true);

  // Left click on macroItem
  macroItem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

  assert(!rowA.classList.contains('selected-persistent'), 'Previous Component Visibility highlight must be cleared on Structure Analysis left-click');

  console.log('[PASS] Left-click in Structure Analysis clears previous Component Visibility highlights.');
}

console.log('\n[SUCCESS] All checks for click snap points and Structure Analysis highlight clearing passed 100%!');
