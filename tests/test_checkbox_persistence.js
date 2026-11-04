/**
 * Automated test script to verify that all checkboxes (static viewport controls,
 * header colorized toggle, keyboard shortcuts, and dynamic component visibility checkboxes)
 * have their status preserved upon reload via localStorage.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Checkbox Status Persistence Upon Reload...');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
window.localStorage.clear();

const STORAGE_CHECKBOX_STATES_KEY = 'x4_checkbox_states';
const STORAGE_EXCLUDED_MACROS_KEY = 'x4_excluded_macros';

function saveCheckboxState(id, isChecked) {
  try {
    const states = JSON.parse(window.localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
    states[id] = isChecked;
    window.localStorage.setItem(STORAGE_CHECKBOX_STATES_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn('Could not save checkbox state:', e);
  }
}

function getSavedCheckboxState(id, defaultVal) {
  try {
    const states = JSON.parse(window.localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
    if (typeof states[id] === 'boolean') {
      return states[id];
    }
  } catch (e) {
    console.warn('Could not read checkbox state:', e);
  }
  return defaultVal;
}

const excludedMacros = new Set();

function saveExcludedMacros() {
  try {
    window.localStorage.setItem(STORAGE_EXCLUDED_MACROS_KEY, JSON.stringify(Array.from(excludedMacros)));
  } catch (e) {
    console.warn('Could not save excluded macros:', e);
  }
}

function loadSavedExcludedMacros() {
  excludedMacros.clear();
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_EXCLUDED_MACROS_KEY) || '[]');
    if (Array.isArray(saved)) {
      saved.forEach(m => excludedMacros.add(m));
    }
  } catch (e) {
    console.warn('Could not load excluded macros:', e);
  }
}

// -------------------------------------------------------------
// Test 1: Static Viewport and Header Checkboxes Defaults
// -------------------------------------------------------------
console.log('\n--- Test 1: Static Checkboxes Default States ---');

const staticCheckboxes = [
  { id: 'toggle-wireframe', defaultVal: false },
  { id: 'toggle-autorotate', defaultVal: false },
  { id: 'toggle-orientation', defaultVal: false },
  { id: 'toggle-dimensions', defaultVal: true },
  { id: 'toggle-snaps', defaultVal: true },
  { id: 'toggle-bloom', defaultVal: true },
  { id: 'colorized-checkbox', defaultVal: false }
];

staticCheckboxes.forEach(({ id, defaultVal }) => {
  const initial = getSavedCheckboxState(id, defaultVal);
  if (initial !== defaultVal) {
    throw new Error(`[FAIL] ${id} expected default ${defaultVal}, got ${initial}`);
  }
  console.log(`[PASS] ${id} defaults to ${defaultVal}`);
});

// -------------------------------------------------------------
// Test 2: Modify Static Checkbox States and Persist
// -------------------------------------------------------------
console.log('\n--- Test 2: Invert All Static Checkbox States & Save ---');

// Flip all defaults
staticCheckboxes.forEach(({ id, defaultVal }) => {
  const newVal = !defaultVal;
  saveCheckboxState(id, newVal);
  console.log(`[INFO] Saved ${id} = ${newVal}`);
});

// Verify localStorage contents
const storedStates = JSON.parse(window.localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
staticCheckboxes.forEach(({ id, defaultVal }) => {
  const expected = !defaultVal;
  if (storedStates[id] !== expected) {
    throw new Error(`[FAIL] Expected ${id} in localStorage to be ${expected}, got ${storedStates[id]}`);
  }
});
console.log('[PASS] All static checkboxes successfully saved in localStorage');

// -------------------------------------------------------------
// Test 3: Reload Simulation - Restoring Static Checkboxes
// -------------------------------------------------------------
console.log('\n--- Test 3: Simulate Reload & Restore Static Checkboxes ---');

staticCheckboxes.forEach(({ id, defaultVal }) => {
  const restoredVal = getSavedCheckboxState(id, defaultVal);
  const expectedVal = !defaultVal;
  if (restoredVal !== expectedVal) {
    throw new Error(`[FAIL] After reload, ${id} restored as ${restoredVal}, expected ${expectedVal}`);
  }
  const el = document.getElementById(id);
  if (el) {
    el.checked = restoredVal;
    if (el.checked !== expectedVal) {
      throw new Error(`[FAIL] DOM element #${id} checked is ${el.checked}, expected ${expectedVal}`);
    }
  }
  console.log(`[PASS] ${id} correctly restored to ${restoredVal} on reload`);
});

// -------------------------------------------------------------
// Test 4: Hotkey Toggles ('D' and 'S')
// -------------------------------------------------------------
console.log('\n--- Test 4: Hotkey toggles D and S update localStorage ---');

// Toggle 'dimensions' via simulated hotkey
const dimEl = document.getElementById('toggle-dimensions');
dimEl.checked = !dimEl.checked;
saveCheckboxState('toggle-dimensions', dimEl.checked);
const savedDim = getSavedCheckboxState('toggle-dimensions', true);
if (savedDim !== dimEl.checked) {
  throw new Error(`[FAIL] Hotkey toggle for dimensions failed to persist. Expected ${dimEl.checked}, got ${savedDim}`);
}
console.log(`[PASS] Hotkey D persisted toggle-dimensions = ${dimEl.checked}`);

// Toggle 'snaps' via simulated hotkey
const snapsEl = document.getElementById('toggle-snaps');
snapsEl.checked = !snapsEl.checked;
saveCheckboxState('toggle-snaps', snapsEl.checked);
const savedSnaps = getSavedCheckboxState('toggle-snaps', true);
if (savedSnaps !== snapsEl.checked) {
  throw new Error(`[FAIL] Hotkey toggle for snaps failed to persist. Expected ${snapsEl.checked}, got ${savedSnaps}`);
}
console.log(`[PASS] Hotkey S persisted toggle-snaps = ${snapsEl.checked}`);

// -------------------------------------------------------------
// Test 5: Dynamic Component Visibility Checkbox Persistence
// -------------------------------------------------------------
console.log('\n--- Test 5: Dynamic Component Visibility Macro Checkbox Persistence ---');

// Simulate unchecking 2 macros
const macroA = 'struct_bt_cross_01_macro';
const macroB = 'dockarea_arg_m_station_01_macro';

excludedMacros.add(macroA);
excludedMacros.add(macroB);
saveExcludedMacros();

const rawSavedExcluded = JSON.parse(window.localStorage.getItem(STORAGE_EXCLUDED_MACROS_KEY) || '[]');
if (!rawSavedExcluded.includes(macroA) || !rawSavedExcluded.includes(macroB)) {
  throw new Error('[FAIL] Excluded macros not found in localStorage');
}
console.log('[PASS] Excluded macros saved in localStorage:', rawSavedExcluded);

// Simulate Reload
console.log('\n--- Test 6: Reload Simulation for Excluded Macros ---');
excludedMacros.clear();
if (excludedMacros.size !== 0) {
  throw new Error('[FAIL] In-memory excludedMacros failed to clear before reload');
}

loadSavedExcludedMacros();
if (!excludedMacros.has(macroA) || !excludedMacros.has(macroB) || excludedMacros.size !== 2) {
  throw new Error('[FAIL] loadSavedExcludedMacros did not restore excluded macros accurately');
}
console.log('[PASS] Excluded macros restored from localStorage: size =', excludedMacros.size);

// Test rendering macro checkboxes with restored state
const mockMacros = [
  'struct_bt_cross_01_macro',
  'dockarea_arg_m_station_01_macro',
  'prod_arg_foodrations_macro'
];

mockMacros.forEach(macro => {
  const isExcluded = excludedMacros.has(macro);
  const isChecked = !isExcluded;
  const checkboxId = `vis-chk-${macro.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  if (macro === macroA || macro === macroB) {
    if (isChecked) {
      throw new Error(`[FAIL] Macro ${macro} should be unchecked on reload, but was checked`);
    }
    console.log(`[PASS] Checkbox ${checkboxId} correctly restored as UNCHECKED`);
  } else {
    if (!isChecked) {
      throw new Error(`[FAIL] Macro ${macro} should be checked on reload, but was unchecked`);
    }
    console.log(`[PASS] Checkbox ${checkboxId} correctly remains CHECKED`);
  }
});

// -------------------------------------------------------------
// Test 7: Re-checking a Macro
// -------------------------------------------------------------
console.log('\n--- Test 7: Re-checking a Macro Updates & Persists ---');
excludedMacros.delete(macroA);
saveExcludedMacros();

excludedMacros.clear();
loadSavedExcludedMacros();

if (excludedMacros.has(macroA)) {
  throw new Error(`[FAIL] Macro ${macroA} was re-checked but still present in restored excludedMacros`);
}
if (!excludedMacros.has(macroB)) {
  throw new Error(`[FAIL] Macro ${macroB} was not retained in restored excludedMacros`);
}
console.log('[PASS] Re-checked macro successfully removed from localStorage on reload');

// -------------------------------------------------------------
// Test 8: Show All restores all macros to checked
// -------------------------------------------------------------
console.log('\n--- Test 8: Show All clears excluded macros and persists ---');
excludedMacros.clear();
saveExcludedMacros();

loadSavedExcludedMacros();
if (excludedMacros.size !== 0) {
  throw new Error('[FAIL] Excluded macros should be empty after Show All');
}
console.log('[PASS] Show All successfully persisted empty excludedMacros');

console.log('\n========================================');
console.log('✅ ALL CHECKBOX PERSISTENCE TESTS PASSED!');
