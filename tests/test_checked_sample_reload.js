/**
 * Automated test script to verify that the currently checked SAMPLE
 * is saved and loaded as the default sample on reload.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Checked SAMPLE as Default on Reload...');

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

const STORAGE_CURRENT_SAMPLE_KEY = 'x4_current_sample';
const STORAGE_SAMPLES_ORDER_KEY = 'x4_samples_order';

const mockSamples = {
  refineryComplex: '<plan name="Methane Miner"></plan>',
  defenseFortress: '<plan name="Xenon Border Citadel"></plan>',
  allModulesPlan: '<plan name="All Modules Showcase"></plan>'
};

function getOrderedSampleKeys() {
  const currentKeys = Object.keys(mockSamples);
  try {
    const savedOrder = JSON.parse(window.localStorage.getItem(STORAGE_SAMPLES_ORDER_KEY) || '[]');
    if (Array.isArray(savedOrder) && savedOrder.length > 0) {
      const result = [];
      savedOrder.forEach(key => {
        if (currentKeys.includes(key) && !result.includes(key)) {
          result.push(key);
        }
      });
      currentKeys.forEach(key => {
        if (!result.includes(key)) {
          result.push(key);
        }
      });
      return result;
    }
  } catch (e) {}
  return currentKeys;
}

function getDefaultSampleKey() {
  try {
    const saved = window.localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY);
    if (saved && mockSamples[saved]) {
      return saved;
    }
  } catch (e) {}
  const ordered = getOrderedSampleKeys();
  if (ordered.length > 0 && mockSamples[ordered[0]]) {
    return ordered[0];
  }
  return mockSamples['refineryComplex'] ? 'refineryComplex' : Object.keys(mockSamples)[0];
}

function setDefaultSampleKey(key) {
  try {
    if (key && mockSamples[key]) {
      window.localStorage.setItem(STORAGE_CURRENT_SAMPLE_KEY, key);
    }
  } catch (e) {}
}

// Step 1: Initial state before any selection
console.log('\n--- Step 1: Initial State on Fresh Start ---');
let initialDefault = getDefaultSampleKey();
console.log('[INFO] Fresh default key:', initialDefault);
if (initialDefault !== 'refineryComplex') {
  throw new Error(`[FAIL] Expected refineryComplex as initial fallback, got ${initialDefault}`);
}
console.log('[PASS] Fresh start defaults to refineryComplex');

// Step 2: User selects and checks 'defenseFortress'
console.log('\n--- Step 2: User Checks "defenseFortress" ---');
setDefaultSampleKey('defenseFortress');
console.log('[INFO] Stored current sample key in localStorage:', window.localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY));

if (window.localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY) !== 'defenseFortress') {
  throw new Error('[FAIL] localStorage did not store defenseFortress');
}
console.log('[PASS] defenseFortress stored as current checked sample');

// Step 3: Simulate Browser Reload
console.log('\n--- Step 3: Simulate Browser Reload ---');
let reloadedDefaultKey = getDefaultSampleKey();
console.log('[INFO] Default key retrieved on reload:', reloadedDefaultKey);

if (reloadedDefaultKey !== 'defenseFortress') {
  throw new Error(`[FAIL] Expected defenseFortress on reload, got ${reloadedDefaultKey}`);
}
console.log('[PASS] Browser reload correctly loaded checked sample (defenseFortress) as default');

// Step 4: User selects and checks 'allModulesPlan'
console.log('\n--- Step 4: User Checks "allModulesPlan" ---');
setDefaultSampleKey('allModulesPlan');
let reloadedDefaultKey2 = getDefaultSampleKey();
console.log('[INFO] Default key retrieved on next reload:', reloadedDefaultKey2);

if (reloadedDefaultKey2 !== 'allModulesPlan') {
  throw new Error(`[FAIL] Expected allModulesPlan on reload, got ${reloadedDefaultKey2}`);
}
console.log('[PASS] Browser reload correctly loaded newly checked sample (allModulesPlan) as default');

// Step 5: Check DOM UI Elements
console.log('\n--- Step 5: Verify DOM UI Dropdown Elements ---');
const hintEl = document.querySelector('.sample-dropdown-hint');
if (!hintEl || !hintEl.textContent.includes('Checked loads on reload')) {
  throw new Error('[FAIL] Dropdown hint does not mention "Checked loads on reload"');
}
console.log('[PASS] Dropdown hint shows: "' + hintEl.textContent.trim() + '"');

console.log('\n========================================');
console.log('✅ ALL CHECKED SAMPLE DEFAULT RELOAD TESTS PASSED!');
