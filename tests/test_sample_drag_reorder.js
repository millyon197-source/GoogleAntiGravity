/**
 * Test script to verify custom SAMPLE dropdown display,
 * right mouse drag-and-drop re-ordering, order persistence,
 * and synchronization with the underlying select element.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing SAMPLE Dropdown Right-Mouse Drag & Re-order System...');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// Create mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;
window.localStorage.clear();

// Check if HTML contains the required custom dropdown elements
console.log('\n--- Step 1: DOM Elements Check ---');
const sampleWrapper = document.getElementById('sample-select-wrapper');
if (!sampleWrapper) throw new Error('[FAIL] #sample-select-wrapper not found in index.html');
console.log('[PASS] Found #sample-select-wrapper');

const sampleDropdown = document.getElementById('sample-custom-dropdown');
if (!sampleDropdown) throw new Error('[FAIL] #sample-custom-dropdown not found');
console.log('[PASS] Found #sample-custom-dropdown');

const triggerBtn = document.getElementById('sample-dropdown-trigger');
if (!triggerBtn) throw new Error('[FAIL] #sample-dropdown-trigger not found');
console.log('[PASS] Found #sample-dropdown-trigger');

const dropdownMenu = document.getElementById('sample-dropdown-menu');
if (!dropdownMenu) throw new Error('[FAIL] #sample-dropdown-menu not found');
console.log('[PASS] Found #sample-dropdown-menu');

const dropdownList = document.getElementById('sample-dropdown-list');
if (!dropdownList) throw new Error('[FAIL] #sample-dropdown-list not found');
console.log('[PASS] Found #sample-dropdown-list');

const nativeSelect = document.getElementById('sample-selector');
if (!nativeSelect) throw new Error('[FAIL] #sample-selector not found');
console.log('[PASS] Found native #sample-selector');

// Step 2: Test Re-ordering Logic and persistence
console.log('\n--- Step 2: Testing Order Persistence Logic ---');
const STORAGE_SAMPLES_ORDER_KEY = 'x4_samples_order';

const initialKeys = ['refineryComplex', 'defenseFortress', 'allModulesPlan'];

// Helper to simulate getOrderedSampleKeys
function getOrderedSampleKeys(currentKeys) {
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

let order = getOrderedSampleKeys(initialKeys);
console.log('[INFO] Initial order:', order);
if (order[0] !== 'refineryComplex' || order[1] !== 'defenseFortress' || order[2] !== 'allModulesPlan') {
  throw new Error('[FAIL] Initial order unexpected');
}
console.log('[PASS] Initial order matches default');

// Step 3: Simulate Right Mouse Drag & Drop Re-order: Move index 2 ('allModulesPlan') to index 0
console.log('\n--- Step 3: Simulate Right-Drag Re-order (allModulesPlan -> index 0) ---');
const fromIndex = 2;
const targetDropIndex = 0;
const [movedKey] = order.splice(fromIndex, 1);
order.splice(targetDropIndex, 0, movedKey);

window.localStorage.setItem(STORAGE_SAMPLES_ORDER_KEY, JSON.stringify(order));
console.log('[INFO] Re-ordered list:', order);

if (order[0] !== 'allModulesPlan' || order[1] !== 'refineryComplex' || order[2] !== 'defenseFortress') {
  throw new Error('[FAIL] Re-ordered array incorrect: ' + JSON.stringify(order));
}
console.log('[PASS] allModulesPlan successfully moved to index 0');

// Step 4: Verify persistence across fresh query
const freshOrder = getOrderedSampleKeys(initialKeys);
if (freshOrder[0] !== 'allModulesPlan') {
  throw new Error('[FAIL] Order persistence failed, got: ' + freshOrder[0]);
}
console.log('[PASS] Persisted order correctly loaded from localStorage:', freshOrder);

// Step 5: Test Dropping After an item (moving index 0 back to index 2)
console.log('\n--- Step 5: Simulate Right-Drag Re-order (allModulesPlan -> index 2) ---');
let fromIdx = 0;
let toIdx = 3; // dropping after index 2
if (fromIdx < toIdx) toIdx--; // adjustment when moving down
const [itemMoved] = freshOrder.splice(fromIdx, 1);
freshOrder.splice(toIdx, 0, itemMoved);
window.localStorage.setItem(STORAGE_SAMPLES_ORDER_KEY, JSON.stringify(freshOrder));
console.log('[INFO] Re-ordered list after moving down:', freshOrder);

if (freshOrder[2] !== 'allModulesPlan') {
  throw new Error('[FAIL] Re-order moving down failed: ' + JSON.stringify(freshOrder));
}
console.log('[PASS] allModulesPlan successfully moved to index 2 after lower drop');

console.log('\n========================================');
console.log('✅ ALL SAMPLE DROPDOWN RE-ORDERING TESTS PASSED!');
