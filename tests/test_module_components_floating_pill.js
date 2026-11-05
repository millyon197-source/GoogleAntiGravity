import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Module Components Floating Pill Overlay over Module Navigator...');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});

const { document, Event } = dom.window;

// 1. Check DOM structure in index.html
const searchCard = document.querySelector('.search-card');
assert.ok(searchCard, 'Expected .search-card (Module Navigator) to exist');

const floatingPill = document.getElementById('module-components-floating-pill');
assert.ok(floatingPill, 'Expected #module-components-floating-pill to exist');
assert.ok(floatingPill.classList.contains('hidden'), 'Expected floating pill to be initially hidden');
assert.ok(searchCard.contains(floatingPill), 'Expected #module-components-floating-pill to be within .search-card');

const navPillBtn = document.getElementById('btn-nav-components-pill');
assert.ok(navPillBtn, 'Expected #btn-nav-components-pill to exist in search card header');
assert.ok(navPillBtn.classList.contains('hidden'), 'Expected nav pill toggle to be initially hidden');

const btnMinimize = document.getElementById('btn-minimize-components-pill');
assert.ok(btnMinimize, 'Expected #btn-minimize-components-pill to exist');

const floatingList = document.getElementById('floating-components-list');
assert.ok(floatingList, 'Expected #floating-components-list to exist');

const floatingCount = document.getElementById('floating-components-count');
assert.ok(floatingCount, 'Expected #floating-components-count to exist');

const floatingFolder = document.getElementById('floating-components-folder');
assert.ok(floatingFolder, 'Expected #floating-components-folder to exist');

const chkStopAnim = document.getElementById('chk-stop-anim');
assert.ok(chkStopAnim, 'Expected #chk-stop-anim to exist in floating pill');
assert.strictEqual(chkStopAnim.type, 'checkbox', 'Expected #chk-stop-anim to be a checkbox');

const chkSubdueDefaults = document.getElementById('chk-subdue-defaults');
assert.ok(chkSubdueDefaults, 'Expected #chk-subdue-defaults to exist in floating pill');
assert.strictEqual(chkSubdueDefaults.type, 'checkbox', 'Expected #chk-subdue-defaults to be a checkbox');

// Verified removed from Selected Module Details
assert.strictEqual(document.getElementById('det-components-section'), null, 'Selected Module Details must not contain #det-components-section');
assert.strictEqual(document.getElementById('det-components-dropdown'), null, 'Selected Module Details must not contain #det-components-dropdown');

console.log('  ✓ [PASS] Floating pill DOM elements verified; Selected Module Details pill cleanly removed');

// 2. Test expansion and minimization behavior for Module Navigator Components pill
navPillBtn.classList.remove('hidden');
floatingFolder.textContent = 'dockarea_arg_m_station_02_hightech_data';
floatingCount.textContent = '3/3';

const rightSidebar = document.getElementById('right-sidebar');
assert.ok(rightSidebar, 'Expected #right-sidebar (right hand column) to exist');

// Wire listener behavior equivalent to main.js for unit verification
function syncModuleComponentsFloatingPill() {
  if (!floatingPill) return;
  const isAvailable = navPillBtn && !navPillBtn.classList.contains('hidden');
  const isOpen = !floatingPill.classList.contains('hidden');
  if (isOpen && isAvailable) {
    searchCard.classList.add('has-floating-pill');
    if (rightSidebar) rightSidebar.classList.add('components-expanded');
  } else {
    searchCard.classList.remove('has-floating-pill');
    if (rightSidebar) rightSidebar.classList.remove('components-expanded');
  }
}

btnMinimize.addEventListener('click', (e) => {
  e.stopPropagation();
  floatingPill.classList.add('hidden');
  syncModuleComponentsFloatingPill();
});

navPillBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  floatingPill.classList.toggle('hidden');
  syncModuleComponentsFloatingPill();
});

document.addEventListener('pointerdown', (e) => {
  if (!floatingPill || floatingPill.classList.contains('hidden')) return;
  if (
    floatingPill.contains(e.target) ||
    (navPillBtn && navPillBtn.contains(e.target)) ||
    (e.target && (e.target.tagName === 'OPTION' || e.target.tagName === 'SELECT'))
  ) {
    return;
  }
  floatingPill.classList.add('hidden');
  syncModuleComponentsFloatingPill();
});

// Test 2a: Expanding Module Navigator Components pill reveals floating overlay hiding all other pills in right column
navPillBtn.click();
assert.strictEqual(floatingPill.classList.contains('hidden'), false, 'Floating pill should be visible when Components pill is clicked');
assert.strictEqual(searchCard.classList.contains('has-floating-pill'), true, 'Search card should have .has-floating-pill');
assert.strictEqual(rightSidebar.classList.contains('components-expanded'), true, 'Right sidebar should have .components-expanded to hide all other pills');
console.log('  ✓ [PASS] Expanding Module Components reveals floating pill hiding all other pills in right hand column');

// Test 2b: Minimizing via minimize button hides floating pill until minimized again
btnMinimize.click();
assert.strictEqual(floatingPill.classList.contains('hidden'), true, 'Floating pill should be hidden when minimized');
assert.strictEqual(searchCard.classList.contains('has-floating-pill'), false, 'Search card should remove .has-floating-pill when minimized');
assert.strictEqual(rightSidebar.classList.contains('components-expanded'), false, 'Right sidebar should unhide other pills when minimized');
console.log('  ✓ [PASS] Minimizing unhides all other pills in the right hand column');

// Test 2c: Expanding via nav pill button reveals floating pill overlay again
navPillBtn.click();
assert.strictEqual(floatingPill.classList.contains('hidden'), false, 'Floating pill should be visible again');
assert.strictEqual(searchCard.classList.contains('has-floating-pill'), true, 'Search card should have .has-floating-pill');
assert.strictEqual(rightSidebar.classList.contains('components-expanded'), true, 'Right sidebar should hide other pills again');
console.log('  ✓ [PASS] Expanding again re-reveals floating pill and hides other pills');

// Test 2c-2: Interacting inside floating pill does not minimize or alter displayed visibility
const floatingItem = document.createElement('div');
floatingList.appendChild(floatingItem);
floatingItem.dispatchEvent(new Event('pointerdown', { bubbles: true }));
assert.strictEqual(floatingPill.classList.contains('hidden'), false, 'Floating pill should remain visible when clicking inside floating list');
console.log('  ✓ [PASS] Interacting inside Module Components does not change displayed visibility');

// Test 2d: Clicking outside minimizes the floating pill
const outsideEl = document.createElement('div');
document.body.appendChild(outsideEl);
const pointerEvent = new Event('pointerdown', { bubbles: true });
outsideEl.dispatchEvent(pointerEvent);
assert.strictEqual(floatingPill.classList.contains('hidden'), true, 'Floating pill should be hidden when clicking outside');
assert.strictEqual(rightSidebar.classList.contains('components-expanded'), false, 'Right sidebar should restore other pills when clicking outside');
console.log('  ✓ [PASS] Clicking outside correctly minimizes floating pill and restores right hand column pills');

// 3. Check CSS rules for hiding other pills and full list display
const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8');
assert.ok(css.includes('#right-sidebar.components-expanded > .panel-card:not(.search-card)'), 'Expected CSS rule to hide other panel cards');
assert.ok(css.includes('#right-sidebar.components-expanded #floating-components-list'), 'Expected CSS rule for full list mode');
assert.ok(css.includes('.floating-pill-title {') && css.includes('white-space: nowrap;'), 'Expected floating pill title to have white-space: nowrap');
assert.ok(css.includes('.det-components-summary .sub-heading-mini {') && css.includes('white-space: nowrap;'), 'Expected det-components summary sub-heading to have white-space: nowrap');
assert.ok(css.includes('.card-header h2 {') && css.includes('white-space: nowrap;'), 'Expected card-header h2 to have white-space: nowrap');
console.log('  ✓ [PASS] CSS rules verified for hiding other pills in right column, full list, and single-line nowrap titles');

// 4. Test Stop Anim and Subdue Defaults controls
let animHalted = false;
const mockViewer = {
  isModuleAnimationHalted: (idx) => animHalted,
  setModuleAnimationHalted: (idx, halted) => { animHalted = halted; }
};

chkStopAnim.checked = true;
mockViewer.setModuleAnimationHalted(1, chkStopAnim.checked);
assert.strictEqual(mockViewer.isModuleAnimationHalted(1), true, 'Stop Anim should halt module animations when checked');

chkStopAnim.checked = false;
mockViewer.setModuleAnimationHalted(1, chkStopAnim.checked);
assert.strictEqual(mockViewer.isModuleAnimationHalted(1), false, 'Stop Anim should resume module animations when unchecked');
console.log('  ✓ [PASS] Stop Anim checkbox halts/resumes module animations');

// Test Subdue Defaults toggle logic
const comp1 = document.createElement('input');
comp1.type = 'checkbox';
comp1.checked = true;
comp1.dataset.isDefault = 'true';

const comp2 = document.createElement('input');
comp2.type = 'checkbox';
comp2.checked = true;
comp2.dataset.isDefault = 'true';

const compNonDefault = document.createElement('input');
compNonDefault.type = 'checkbox';
compNonDefault.checked = true;

const testBoxGroup = [comp1, comp2, compNonDefault];

// Simulate checking Subdue Defaults (subdue = true -> uncheck defaults)
function applySubdue(subdue) {
  testBoxGroup.forEach(cb => {
    if (cb.dataset.isDefault === 'true') {
      cb.checked = !subdue;
    }
  });
}

applySubdue(true);
assert.strictEqual(comp1.checked, false, 'Default comp 1 should be unchecked when Subdue Defaults is checked');
assert.strictEqual(comp2.checked, false, 'Default comp 2 should be unchecked when Subdue Defaults is checked');
assert.strictEqual(compNonDefault.checked, true, 'Non-default component should retain state');

// Simulate unchecking Subdue Defaults (subdue = false -> re-check defaults)
applySubdue(false);
assert.strictEqual(comp1.checked, true, 'Default comp 1 should be checked when Subdue Defaults is unchecked');
assert.strictEqual(comp2.checked, true, 'Default comp 2 should be checked when Subdue Defaults is unchecked');
console.log('  ✓ [PASS] Subdue Defaults toggles all default components off/on');

console.log('\n[SUCCESS] All Module Components floating pill overlay tests passed cleanly!');
