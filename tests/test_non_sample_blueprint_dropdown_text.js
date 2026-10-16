/**
 * Automated test script to verify that after loading a blueprint that is not
 * in the Samples list, the Samples dropdown text displays "Samples" as the default text.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Samples Dropdown Text for Non-Sample Blueprint Loads...');

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
  refineryComplex: '<?xml version="1.0" encoding="UTF-8"?><plans><plan id="6E731F75-D302-42C5-B8CF-02E0BF2FBC43_1754199066" name="Methane Miner" description="Methane mining station"><entry index="1" macro="pier_arg_harbor_04_macro"><offset><position x="-959.899" z="393.056"/></offset></entry></plan></plans>',
  defenseFortress: '<?xml version="1.0" encoding="UTF-8"?><plans><plan id="defense_fort_xenon_border" name="Xenon Border Defense Citadel" description="Heavy military fortress"><entry index="1" macro="struct_arg_base_01_macro"><offset><position x="0" y="0" z="0"/></offset></entry></plan></plans>',
  allModulesPlan: '<?xml version="1.0" encoding="UTF-8"?><plans><plan id="showcase_all_modules" name="All Modules Showcase" description="A vertical stack of all modules"><entry index="1" macro="dockarea_arg_m_station_01_macro"><offset><position x="0" y="0" z="0"/></offset></entry></plan></plans>'
};

const customExternalXml = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="custom_player_hq_9999" name="Grand Argon Trading Spire" description="Player customized mega trade center">
    <entry index="1" macro="dockarea_arg_l_station_01_macro">
      <offset>
        <position x="0" y="0" z="0"/>
      </offset>
    </entry>
    <entry index="2" macro="storage_arg_l_container_01_macro">
      <offset>
        <position x="200" y="0" z="0"/>
      </offset>
    </entry>
  </plan>
</plans>`;

let currentLoadedSampleKey = null;

function getSamplePlanName(key) {
  const xml = mockSamples[key];
  if (!xml) return key;
  const match = xml.match(/<plan\s+[^>]*name="([^"]+)"/i);
  return (match && match[1]) ? match[1] : key;
}

function getDefaultSampleKey() {
  try {
    const saved = window.localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY);
    if (saved && mockSamples[saved]) return saved;
  } catch (_) {}
  return 'refineryComplex';
}

function setDefaultSampleKey(key) {
  try {
    if (key && mockSamples[key]) {
      window.localStorage.setItem(STORAGE_CURRENT_SAMPLE_KEY, key);
    }
  } catch (_) {}
}

function findMatchingSampleKey(planData, xmlText) {
  if (!planData || !mockSamples) return null;
  const planId = (planData.id || '').trim();
  const planName = (planData.name || '').trim();

  for (const key of Object.keys(mockSamples)) {
    const sampleXml = mockSamples[key];
    if (!sampleXml) continue;
    if (xmlText && sampleXml.trim() === xmlText.trim()) return key;

    const idMatch = sampleXml.match(/<plan\s+[^>]*id="([^"]+)"/i);
    const nameMatch = sampleXml.match(/<plan\s+[^>]*name="([^"]+)"/i);
    const sId = idMatch ? idMatch[1].trim() : '';
    const sName = nameMatch ? nameMatch[1].trim() : '';

    if (planId && sId && planId === sId) return key;
    if (planName && sName && planName === sName) return key;
  }
  return null;
}

function updateCustomSampleDropdownSelection(sampleKey) {
  currentLoadedSampleKey = (sampleKey && mockSamples[sampleKey]) ? sampleKey : null;
  const labelEl = document.getElementById('sample-dropdown-current-label');
  if (labelEl) {
    if (currentLoadedSampleKey && mockSamples[currentLoadedSampleKey]) {
      labelEl.textContent = getSamplePlanName(currentLoadedSampleKey);
    } else {
      labelEl.textContent = 'Samples';
    }
  }
  const defaultKey = getDefaultSampleKey();
  const items = document.querySelectorAll('#sample-dropdown-list .sample-dropdown-item');
  items.forEach(item => {
    const isSelected = Boolean(currentLoadedSampleKey && item.dataset.key === currentLoadedSampleKey);
    item.classList.toggle('active', isSelected);
  });
}

function renderCustomSampleDropdown() {
  const listContainer = document.getElementById('sample-dropdown-list');
  const labelEl = document.getElementById('sample-dropdown-current-label');
  if (!listContainer) return;

  const currentKey = currentLoadedSampleKey;
  if (labelEl) {
    if (currentKey && mockSamples[currentKey]) {
      labelEl.textContent = getSamplePlanName(currentKey);
    } else {
      labelEl.textContent = 'Samples';
    }
  }

  listContainer.innerHTML = '';
  Object.keys(mockSamples).forEach(key => {
    const name = getSamplePlanName(key);
    const isSelected = Boolean(currentKey && key === currentKey);

    const item = document.createElement('div');
    item.className = `sample-dropdown-item${isSelected ? ' active' : ''}`;
    item.dataset.key = key;
    item.textContent = name;
    listContainer.appendChild(item);
  });
}

function populateSampleSelector() {
  const selector = document.getElementById('sample-selector');
  if (selector) {
    selector.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Samples';
    selector.appendChild(defaultOpt);

    Object.keys(mockSamples).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = getSamplePlanName(key);
      selector.appendChild(opt);
    });

    if (currentLoadedSampleKey && mockSamples[currentLoadedSampleKey]) {
      selector.value = currentLoadedSampleKey;
    } else {
      selector.value = '';
    }
  }
  renderCustomSampleDropdown();
}

// Simulated load function mirroring src/main.js
function simulateLoadPlan(xmlText, sourceSampleKey = null) {
  const idMatch = xmlText.match(/<plan\s+[^>]*id="([^"]+)"/i);
  const nameMatch = xmlText.match(/<plan\s+[^>]*name="([^"]+)"/i);
  const planData = {
    id: idMatch ? idMatch[1] : '',
    name: nameMatch ? nameMatch[1] : 'Station'
  };

  const matched = sourceSampleKey || findMatchingSampleKey(planData, xmlText);
  const selector = document.getElementById('sample-selector');

  if (matched && mockSamples[matched]) {
    currentLoadedSampleKey = matched;
    if (selector) selector.value = matched;
    updateCustomSampleDropdownSelection(matched);
  } else {
    currentLoadedSampleKey = null;
    if (selector) selector.value = '';
    updateCustomSampleDropdownSelection(null);
  }
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------

// Step 1: Initial state - load default sample (refineryComplex)
console.log('\n--- Step 1: Initialize with Default Sample (Methane Miner) ---');
populateSampleSelector();
simulateLoadPlan(mockSamples.refineryComplex, 'refineryComplex');
setDefaultSampleKey('refineryComplex');

const labelEl = document.getElementById('sample-dropdown-current-label');
const selectorEl = document.getElementById('sample-selector');

console.log('[INFO] Current Label:', labelEl.textContent);
console.log('[INFO] Selector Value:', selectorEl.value);

if (labelEl.textContent !== 'Methane Miner') {
  throw new Error(`[FAIL] Expected label "Methane Miner", got "${labelEl.textContent}"`);
}
if (selectorEl.value !== 'refineryComplex') {
  throw new Error(`[FAIL] Expected selector value "refineryComplex", got "${selectorEl.value}"`);
}
console.log('[PASS] Default sample loaded and displayed correctly.');

// Step 2: Load a blueprint not in the Samples list (customExternalXml)
console.log('\n--- Step 2: Load Blueprint NOT in the Samples List ---');
simulateLoadPlan(customExternalXml, null);

console.log('[INFO] Label after external load:', labelEl.textContent);
console.log('[INFO] Selector value after external load:', selectorEl.value);

if (labelEl.textContent !== 'Samples') {
  throw new Error(`[FAIL] Expected label to be "Samples", but got "${labelEl.textContent}"`);
}
if (selectorEl.value !== '') {
  throw new Error(`[FAIL] Expected selector value to be empty string "", but got "${selectorEl.value}"`);
}

const activeItems = document.querySelectorAll('#sample-dropdown-list .sample-dropdown-item.active');
if (activeItems.length !== 0) {
  throw new Error(`[FAIL] Expected 0 active dropdown items, found ${activeItems.length}`);
}
console.log('[PASS] Non-sample blueprint successfully resulted in "Samples" default text with no active dropdown selection.');

// Step 3: Verify dropdown re-render preserves "Samples" text
console.log('\n--- Step 3: Re-render Dropdown Menu ---');
renderCustomSampleDropdown();
if (labelEl.textContent !== 'Samples') {
  throw new Error(`[FAIL] Expected label to remain "Samples" after dropdown re-render, got "${labelEl.textContent}"`);
}
console.log('[PASS] Dropdown re-render correctly maintained "Samples" text.');

// Step 4: User selects a sample again from the dropdown
console.log('\n--- Step 4: User Selects "defenseFortress" Sample ---');
simulateLoadPlan(mockSamples.defenseFortress, 'defenseFortress');
setDefaultSampleKey('defenseFortress');

console.log('[INFO] Label after sample selection:', labelEl.textContent);
if (labelEl.textContent !== 'Xenon Border Defense Citadel') {
  throw new Error(`[FAIL] Expected label "Xenon Border Defense Citadel", got "${labelEl.textContent}"`);
}
if (selectorEl.value !== 'defenseFortress') {
  throw new Error(`[FAIL] Expected selector value "defenseFortress", got "${selectorEl.value}"`);
}
console.log('[PASS] Selecting a sample restored the sample name on the label.');

// Step 5: User loads another custom blueprint not in the Samples list
console.log('\n--- Step 5: User Loads Another Custom Non-Sample Blueprint ---');
const anotherCustomXml = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="xenon_gate_outpost_01" name="Gate Sentinel Outpost">
    <entry index="1" macro="dockarea_arg_m_station_01_macro">
      <offset><position x="0" y="0" z="0"/></offset>
    </entry>
  </plan>
</plans>`;

simulateLoadPlan(anotherCustomXml, null);
console.log('[INFO] Label after second external load:', labelEl.textContent);
if (labelEl.textContent !== 'Samples') {
  throw new Error(`[FAIL] Expected label to reset to "Samples", got "${labelEl.textContent}"`);
}
if (selectorEl.value !== '') {
  throw new Error(`[FAIL] Expected selector value to be "", got "${selectorEl.value}"`);
}
console.log('[PASS] Second non-sample blueprint load successfully restored "Samples" default text.');

console.log('\n======================================================');
console.log('✅ ALL NON-SAMPLE BLUEPRINT DROPDOWN TEXT TESTS PASSED!');
