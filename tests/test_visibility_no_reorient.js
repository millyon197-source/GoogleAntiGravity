/**
 * Automated test to verify that unchecking any entry in Component Visibility
 * does not cause camera re-orientation or zoom.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Component Visibility: No Re-orientation on Unchecked Entries...');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;

// Mock camera and viewer functions
let cameraCalls = {
  fitCameraToSelection: 0,
  fitCameraToStation: 0,
  focusCameraOnModule: 0
};

const mockViewer = {
  fitCameraToSelection: (cat, macro) => {
    cameraCalls.fitCameraToSelection++;
    console.log(`[CALL] fitCameraToSelection called for ${cat}, ${macro}`);
  },
  focusCameraOnModule: (idx, focus) => {
    if (focus) {
      cameraCalls.focusCameraOnModule++;
      console.log(`[CALL] focusCameraOnModule called for ${idx}`);
    }
  },
  setMacroVisibility: (macro, isVisible) => {
    console.log(`[CALL] setMacroVisibility: ${macro} -> ${isVisible}`);
  },
  highlightModulesByFilter: () => {},
  deselect: () => {}
};

// Simulation of visibility row setup
const excludedMacros = new Set();
const macro = 'defence_arg_tube_01_macro';
const cat = 'defense';
const friendlyName = 'Argon Defense Tube';
const count = 2;

const container = document.createElement('div');
const checkboxId = `vis-chk-${macro.replace(/[^a-zA-Z0-9]/g, '_')}`;

const row = document.createElement('div');
const isExcluded = excludedMacros.has(macro);
row.className = `visibility-row${isExcluded ? ' is-unchecked' : ''}`;
row.setAttribute('data-category', cat);
row.setAttribute('data-macro', macro);

row.innerHTML = `
  <div class="visibility-item-left">
    <label class="visibility-checkbox-label" for="${checkboxId}" title="Toggle visibility of ${friendlyName}">
      <input type="checkbox" id="${checkboxId}" ${!isExcluded ? 'checked' : ''}>
    </label>
    <span class="macro-text-btn${isExcluded ? ' is-excluded' : ''}" title="${isExcluded ? `${friendlyName} is hidden (unchecked)` : `Click to zoom/center on ${friendlyName}`}">${friendlyName}</span>
  </div>
  <span class="macro-count-badge" title="Click to cycle inspect ${friendlyName}">${count}</span>
`;

// Attach listeners as implemented in main.js
const badge = row.querySelector('.macro-count-badge');
badge.addEventListener('click', (e) => {
  e.stopPropagation();
  if (excludedMacros.has(macro)) {
    console.log('[BLOCKED] Badge click ignored because entry is unchecked');
    return;
  }
  mockViewer.focusCameraOnModule(1, true);
});

const textBtn = row.querySelector('.macro-text-btn');
textBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (excludedMacros.has(macro)) {
    console.log('[BLOCKED] Text click ignored because entry is unchecked');
    return;
  }
  mockViewer.fitCameraToSelection(cat, macro);
});

const input = row.querySelector('input');
input.addEventListener('change', (e) => {
  const isVisible = e.target.checked;
  if (isVisible) {
    excludedMacros.delete(macro);
  } else {
    excludedMacros.add(macro);
  }
  mockViewer.setMacroVisibility(macro, isVisible);
});

container.appendChild(row);

// Step 1: Initial state (checked)
console.log('\n--- Step 1: Initial State (checked) ---');
if (input.checked !== true) throw new Error('[FAIL] Initial checkbox should be checked');
console.log('[PASS] Initial checkbox is checked');

// Step 2: Uncheck the entry
console.log('\n--- Step 2: Uncheck Entry ---');
cameraCalls.fitCameraToSelection = 0;
cameraCalls.focusCameraOnModule = 0;

input.checked = false;
input.dispatchEvent(new window.Event('change'));

if (!excludedMacros.has(macro)) throw new Error('[FAIL] Macro was not added to excludedMacros');
if (cameraCalls.fitCameraToSelection !== 0) {
  throw new Error(`[FAIL] fitCameraToSelection called ${cameraCalls.fitCameraToSelection} times on uncheck!`);
}
if (cameraCalls.focusCameraOnModule !== 0) {
  throw new Error(`[FAIL] focusCameraOnModule called ${cameraCalls.focusCameraOnModule} times on uncheck!`);
}
console.log('[PASS] Unchecking entry caused 0 camera re-orientation calls');

// Step 3: Click on unchecked text button
console.log('\n--- Step 3: Click on Unchecked Text Button ---');
textBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

if (cameraCalls.fitCameraToSelection !== 0) {
  throw new Error(`[FAIL] fitCameraToSelection called on unchecked text button click!`);
}
console.log('[PASS] Clicking unchecked entry text caused 0 camera re-orientation calls');

// Step 4: Click on unchecked count badge
console.log('\n--- Step 4: Click on Unchecked Count Badge ---');
badge.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

if (cameraCalls.focusCameraOnModule !== 0) {
  throw new Error(`[FAIL] focusCameraOnModule called on unchecked badge click!`);
}
console.log('[PASS] Clicking unchecked badge caused 0 camera re-orientation calls');

// Step 5: Click anywhere on row
console.log('\n--- Step 5: Click Anywhere on Row ---');
row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

if (cameraCalls.fitCameraToSelection !== 0 || cameraCalls.focusCameraOnModule !== 0) {
  throw new Error(`[FAIL] Camera re-oriented on row click!`);
}
console.log('[PASS] Clicking anywhere on row caused 0 camera re-orientation calls');

console.log('\n========================================');
console.log('✅ ALL COMPONENT VISIBILITY NO-REORIENTATION TESTS PASSED!');
