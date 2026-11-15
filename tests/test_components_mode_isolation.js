/**
 * Module Component mode shows only its module: every other module is hidden while it is open and
 * restored as it was when it closes. Left-clicks in the viewport leave the selection and its BB
 * displays alone while the mode is open.
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}
const THREE = await import('three');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing Module Component mode hides other modules and keeps BB displays on left-click...');

function makeViewer() {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  for (let i = 1; i <= 4; i++) {
    const g = new THREE.Group();
    g.userData = { index: i, macro: `mod_${i}_macro` };
    v.modulesGroup.add(g);
  }
  v.modulesGroup.children[3].visible = false; // module 4 hidden by the user before the mode
  v.componentsToggledModuleIndex = null;
  v.animatedParts = [];
  v.animatedTextures = [];
  v.hiddenMacros = new Set();
  v.renderScene = () => {};
  v.updatePlotBoxViolations = () => {};
  v.getModuleActiveComponentFiles = () => ['part_main-lod0.dae'];
  v.setModuleComponentFiles = async () => true; // mesh reloads are not under test
  return v;
}
const visible = (v) => v.modulesGroup.children.map(m => m.visible);

// 1. Entering, switching and leaving the mode
{
  const v = makeViewer();
  await v.setModuleComponentsToggled(2, true);
  assert.deepStrictEqual(visible(v), [false, true, false, false], 'only the mode\'s module shows');

  await v.setModuleComponentsToggled(3, true);
  assert.deepStrictEqual(visible(v), [false, false, true, false], 'switching modules shows only the new one');

  await v.setModuleComponentsToggled(4, true);
  assert.deepStrictEqual(visible(v), [false, false, false, true], 'a module hidden before the mode still shows while the mode is on it');

  await v.setModuleComponentsToggled(null, false);
  assert.deepStrictEqual(visible(v), [true, true, true, false], 'leaving the mode restores every module as it was');
  assert.strictEqual(v.componentsIsolation, null);
  console.log('  ✓ other modules hidden in the mode, restored as they were on leaving');
}

// 2. Visibility recomputed during the mode (Component Visibility, build progress) is what gets restored
{
  const v = makeViewer();
  v.currentBuildProgressPercentage = 100;
  await v.setModuleComponentsToggled(1, true);
  v.hiddenMacros.add('mod_3_macro');
  v.setBuildProgress(100);
  assert.deepStrictEqual(visible(v), [true, false, false, false], 'still only the mode\'s module while in the mode');
  await v.setModuleComponentsToggled(null, false);
  assert.deepStrictEqual(visible(v), [true, true, false, true], 'the visibility worked out during the mode is restored');
  console.log('  ✓ visibility changes made during the mode apply once it closes');
}

// 3. Clearing the plan drops what the mode remembered
{
  const v = makeViewer();
  await v.setModuleComponentsToggled(2, true);
  assert.ok(v.componentsIsolation, 'the mode remembers the hidden modules');
  v.deselect = () => {};
  v.clearFilterHighlights = () => {};
  try { v.clear(); } catch (_) { /* later parts of clear() need a full viewer; the reset comes first */ }
  assert.strictEqual(v.componentsIsolation, null, 'clear() forgets the hidden modules');
  console.log('  ✓ clearing the plan forgets the hidden modules');
}

// 4. Left-clicks keep the selection and its BB displays in the mode
{
  const makeClickViewer = (inMode) => {
    const v = makeViewer();
    v.componentsToggledModuleIndex = inMode ? 2 : null;
    v.selectedModuleIndex = 2;
    v.selectionHelper = { tag: 'bb' };
    v.cameraTransitionAnimId = null;
    v.isGizmoAttached = () => false;
    v.renderer = { domElement: { focus() {} } };
    v.transformControls = null;
    v.transformControlsRotate = null;
    v.findPlotCornerNearPointer = () => null;
    v.deselectCalls = 0;
    v.selectCalls = 0;
    v.deselect = function () { this.deselectCalls++; this.selectionHelper = null; };
    v.selectModuleByIndex = function () { this.selectCalls++; };
    v.onModuleSelected = () => {};
    return v;
  };
  const click = { button: 0, clientX: 10, clientY: 10, preventDefault() {} };

  for (const hit of [null, { moduleIdx: 2 }]) {
    const v = makeClickViewer(true);
    v.raycastModuleAtPointer = () => hit;
    v.onPointerDown(click);
    assert.strictEqual(v.deselectCalls, 0, `in the mode a left-click ${hit ? 'on the module' : 'on empty space'} does not deselect`);
    assert.strictEqual(v.selectCalls, 0, 'nor re-select (which rebuilds the BB displays)');
    assert.deepStrictEqual(v.selectionHelper, { tag: 'bb' }, 'the BB display stays');
  }

  const outside = makeClickViewer(false);
  outside.raycastModuleAtPointer = () => null;
  outside.onPointerDown(click);
  assert.strictEqual(outside.deselectCalls, 1, 'outside the mode a left-click on empty space still deselects');
  console.log('  ✓ left-clicks leave the selection and BB displays alone in the mode');
}

console.log('\n[SUCCESS] Module Component mode isolates its module and keeps its BB displays');
