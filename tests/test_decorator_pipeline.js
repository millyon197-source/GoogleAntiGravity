import assert from 'assert';
import {
  DEFAULT_DISPLAY_VALUES,
  LAYER_CATEGORIES,
  loadDisplayPanelConfig,
  loadActionableElements,
  saveActionableElements,
  getActiveActionableElements,
  getActiveDecoratorIds,
  isDecoratorInPipeline,
  addActionableElement,
  removeActionableElement,
  moveActionableElement,
  reorderActionableElement,
  reorderLayerPosition,
  clearActionableElements,
  detectElementConflicts,
  addDecoratorWithSelectedElement,
  addCustomDisplayValue,
  getActiveDropdownDecoratorId,
  setActiveDropdownDecoratorId,
  examineFiveCheckboxes,
  getLayerPlacementCategoryOrder,
  refreshLayerNumbers,
  addCheckboxToValue,
  renameCheckbox,
  parseLayerCheckbox,
  ACTIONABLE_ELEMENTS_STORAGE_KEY,
  isOrderOfLayoutBlueprint,
  reloadBlueprintName,
  setActiveBlueprint,
  getActiveBlueprint,
  createActionableElementCard,
  createUnifiedLayersCard,
  applyModuleDisplayBehavior
} from '../src/module-display-panel.js';

console.log('--- Testing Draggable Decorator Pipeline with Conflict Resolution ---');

// Mock localStorage for test environment
const mockStorage = {};
globalThis.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// 1. Actionable panel starts empty at first
clearActionableElements();
assert.strictEqual(getActiveActionableElements().length, 0, 'Active actionable elements should start empty');
console.log('✓ Actionable panel starts empty at first');

// 2. Select element: only it is added to the Actionable Panel
// Add "Pad (+50m)" from Spacing & Offset (index 2)
const elemPad50 = addActionableElement('spacing-offset', 2);
assert.ok(elemPad50);
assert.strictEqual(elemPad50.decoratorName, 'Spacing & Offset');
assert.strictEqual(elemPad50.elementName, 'Pad (+50m)');

const currentElements1 = getActiveActionableElements();
assert.strictEqual(currentElements1.length, 1, 'Only the single selected element should be added to Actionable Panel');
assert.strictEqual(currentElements1[0].elementName, 'Pad (+50m)');
assert.strictEqual(currentElements1[0].decoratorName, 'Spacing & Offset');
console.log('✓ Only selected element "Pad (+50m)" added to Actionable Panel (carrying heading "Spacing & Offset")');

// 3. Add second element: "Planar Row" from Layout Mode (index 1)
const elemPlanar = addActionableElement('layout-mode', 1);
assert.ok(elemPlanar);
assert.strictEqual(elemPlanar.elementName, 'Planar Row');
const currentElements2 = getActiveActionableElements();
assert.strictEqual(currentElements2.length, 2);
assert.strictEqual(currentElements2[1].elementName, 'Planar Row');
console.log('✓ Added second element "Planar Row" (carrying heading "Layout Mode")');

// 4. Conflict Resolution: Add "Grid Matrix" from Layout Mode (index 2)
// Since Layout Mode can only have one active mode, it detects conflict with "Planar Row" and replaces it!
const conflictCheck1 = detectElementConflicts({
  id: 'layout-mode:layout-grid',
  decoratorId: 'layout-mode',
  decoratorName: 'Layout Mode',
  elementId: 'layout-grid',
  elementName: 'Grid Matrix'
}, getActiveActionableElements());
assert.strictEqual(conflictCheck1.hasConflict, true, 'Should detect conflict with existing Layout Mode');
assert.strictEqual(conflictCheck1.conflicts[0].elementName, 'Planar Row');
console.log(`✓ Conflict correctly detected: ${conflictCheck1.reason}`);

const elemGrid = addActionableElement('layout-mode', 2);
const currentElements3 = getActiveActionableElements();
assert.strictEqual(currentElements3.length, 2, 'Actionable list should replace conflicting Layout Mode');
assert.ok(currentElements3.some(e => e.elementName === 'Grid Matrix'), 'Grid Matrix should be in actionable list');
assert.ok(!currentElements3.some(e => e.elementName === 'Planar Row'), 'Planar Row should have been removed due to conflict');
console.log('✓ Conflict resolved: "Grid Matrix" replaced "Planar Row" in actionable list');

// 5. Cross-Decorator Conflict Resolution:
// Adding "Blueprint" (Order of Layout) conflicts with procedural Layout Modes
const conflictCheck2 = detectElementConflicts({
  id: 'order-of-layout:layout-blueprint',
  decoratorId: 'order-of-layout',
  decoratorName: 'Order of Layout',
  elementId: 'layout-blueprint',
  elementName: 'Blueprint'
}, getActiveActionableElements());
assert.strictEqual(conflictCheck2.hasConflict, true, 'Blueprint should detect conflict with procedural Layout Mode');
assert.strictEqual(conflictCheck2.conflicts[0].elementName, 'Grid Matrix');
console.log(`✓ Cross-decorator conflict correctly detected: ${conflictCheck2.reason}`);

const elemBlueprint = addActionableElement('order-of-layout', 0);
const currentElements4 = getActiveActionableElements();
assert.ok(currentElements4.some(e => e.elementName === 'Blueprint'));
assert.ok(!currentElements4.some(e => e.elementName === 'Grid Matrix'), 'Grid Matrix replaced by Blueprint mode');
console.log('✓ Conflict resolved: "Blueprint" replaced procedural Layout Mode');

// 6. Layer Palette additions: Order of addition establishes order of evaluation
// Add "Docks" (first addition clicked -> Layer 1)
const elemDocks1 = addActionableElement('layers', 0);
assert.ok(elemDocks1);
assert.strictEqual(elemDocks1.layerNumber, 1);
assert.strictEqual(elemDocks1.category, 'docks');

// Add "Storage" (second addition clicked -> Layer 2)
const elemStorage2 = addActionableElement('layers', 1);
assert.ok(elemStorage2);
assert.strictEqual(elemStorage2.layerNumber, 2);
assert.strictEqual(elemStorage2.category, 'storage');

// Add "Production" (third addition clicked -> Layer 3)
const elemProd3 = addActionableElement('layers', 2);
assert.ok(elemProd3);
assert.strictEqual(elemProd3.layerNumber, 3);
assert.strictEqual(elemProd3.category, 'production');

assert.ok(getActiveActionableElements().some(e => e.elementName === 'Docks-1'));
assert.ok(getActiveActionableElements().some(e => e.elementName === 'Storage-2'));
assert.ok(getActiveActionableElements().some(e => e.elementName === 'Production-3'));
console.log('✓ Sequential Layers additions added in the order clicked (Layer 1, Layer 2, Layer 3)');

// Verify that the order of addition establishes the order of evaluation:
const initialEvalOrder = getLayerPlacementCategoryOrder();
assert.strictEqual(initialEvalOrder[0], 'docks');
assert.strictEqual(initialEvalOrder[1], 'storage');
assert.strictEqual(initialEvalOrder[2], 'production');
console.log('✓ Initial order of addition established order of evaluation: docks -> storage -> production');

// 7. Hand placement re-ordering within the Layers actionable list
// Reorder: Move Production (elemProd3) to the very top (index 1 in active list)
const activeItemsBefore = getActiveActionableElements();
const prodIdx = activeItemsBefore.findIndex(e => e.id === elemProd3.id);
assert.ok(prodIdx !== -1);
const targetPlacementIdx = activeItemsBefore.findIndex(e => e.id === elemDocks1.id);
reorderActionableElement(elemProd3.id, targetPlacementIdx);

// After placement re-ordering, layer numbers and evaluation order update dynamically:
const reorderedEvalOrder = getLayerPlacementCategoryOrder();
assert.strictEqual(reorderedEvalOrder[0], 'production', 'Production placed first in evaluation');
assert.strictEqual(reorderedEvalOrder[1], 'docks', 'Docks shifted to second in evaluation');
assert.strictEqual(reorderedEvalOrder[2], 'storage', 'Storage shifted to third in evaluation');

const updatedElements = getActiveActionableElements();
const updatedProd = updatedElements.find(e => e.id === elemProd3.id);
const updatedDocks = updatedElements.find(e => e.id === elemDocks1.id);
const updatedStorage = updatedElements.find(e => e.id === elemStorage2.id);
assert.strictEqual(updatedProd.layerNumber, 1);
assert.strictEqual(updatedProd.elementName, 'Production-1');
assert.strictEqual(updatedDocks.layerNumber, 2);
assert.strictEqual(updatedDocks.elementName, 'Docks-2');
assert.strictEqual(updatedStorage.layerNumber, 3);
assert.strictEqual(updatedStorage.elementName, 'Storage-3');
console.log('✓ Hand placement re-ordering successfully re-indexed layer numbers and established new evaluation order');

// Test direct reorderLayerPosition (drag and release within unified Layers card)
// Drag Storage-3 and release it at position 0 (top):
reorderLayerPosition(updatedStorage.id, 0);
const storageTopEval = getLayerPlacementCategoryOrder();
assert.strictEqual(storageTopEval[0], 'storage', 'Storage dragged and released at top');
assert.strictEqual(storageTopEval[1], 'production', 'Production shifted to second');
assert.strictEqual(storageTopEval[2], 'docks', 'Docks shifted to third');

const storageTopElems = getActiveActionableElements();
assert.strictEqual(storageTopElems.find(e => e.id === updatedStorage.id).elementName, 'Storage-1');
assert.strictEqual(storageTopElems.find(e => e.id === updatedProd.id).elementName, 'Production-2');
assert.strictEqual(storageTopElems.find(e => e.id === updatedDocks.id).elementName, 'Docks-3');
console.log('✓ Dragging and releasing any layer position successfully reordered the Layers within the unified heading');

// 8. Remove actionable element and ensure remaining layers re-index
removeActionableElement(updatedStorage.id);
assert.ok(!getActiveActionableElements().some(e => e.id === updatedStorage.id));
const afterRemovalOrder = getLayerPlacementCategoryOrder();
assert.strictEqual(afterRemovalOrder[0], 'production');
assert.strictEqual(afterRemovalOrder[1], 'docks');
console.log('✓ Successfully removed actionable element and refreshed layer sequence');

// 9. Clear actionable panel
clearActionableElements();
assert.strictEqual(getActiveActionableElements().length, 0);
console.log('✓ Cleared actionable panel back to empty state');

// 10. Test dropdown state helpers
setActiveDropdownDecoratorId('spacing-offset');
assert.strictEqual(getActiveDropdownDecoratorId(), 'spacing-offset');
setActiveDropdownDecoratorId(null);
assert.strictEqual(getActiveDropdownDecoratorId(), null);
console.log('✓ Dropdown state helpers verified');

// 11. Strictly "Only the five" and "No duplicate names" validation
console.log('\n--- Testing Layers: Strictly Only the Five & No Duplicate Names ---');
assert.strictEqual(LAYER_CATEGORIES.length, 5, 'Must be strictly only the five canonical categories');
assert.deepStrictEqual(LAYER_CATEGORIES, ['Docks', 'Storage', 'Production', 'Habitats', 'Defense']);

// Verify initial state has zero duplicate names in displayValues
clearActionableElements();
const layersCfgInitial = loadDisplayPanelConfig().find(v => v.id === 'layers');
assert.ok(layersCfgInitial, 'Layers row must exist');
assert.strictEqual(layersCfgInitial.checkboxes.length, 5, 'Must have strictly 5 checkboxes');
const namesInitial = layersCfgInitial.checkboxes.map(cb => cb.name);
const uniqueNamesInitial = new Set(namesInitial);
assert.strictEqual(uniqueNamesInitial.size, 5, 'Initial checkboxes must have zero duplicate names');

// Add Habitats (index 3) first:
const elemHabitats = addActionableElement('layers', 3);
assert.ok(elemHabitats);
assert.strictEqual(elemHabitats.layerNumber, 1);
assert.strictEqual(elemHabitats.elementName, 'Habitats-1');

// Verify displayValues has zero duplicates after Habitats added
const layersCfgAfterHab = loadDisplayPanelConfig().find(v => v.id === 'layers');
assert.strictEqual(layersCfgAfterHab.checkboxes.length, 5);
const namesAfterHab = layersCfgAfterHab.checkboxes.map(cb => cb.name);
const uniqueNamesAfterHab = new Set(namesAfterHab);
assert.strictEqual(uniqueNamesAfterHab.size, 5, 'Checkboxes after adding Habitats must have zero duplicate names');
assert.strictEqual(layersCfgAfterHab.checkboxes[0].name, 'Habitats-1', 'Active layer Habitats should be slot 1');

// Verify all 5 categories are present once and only once across checkboxes:
const catsAfterHab = layersCfgAfterHab.checkboxes.map(cb => parseLayerCheckbox(cb).category);
assert.strictEqual(new Set(catsAfterHab).size, 5, 'Every category must be present exactly once');
for (const cat of LAYER_CATEGORIES) {
  assert.ok(catsAfterHab.includes(cat), `Category "${cat}" must be present`);
}

// Add Defense (which is now in remaining categories):
const defenseIdx = layersCfgAfterHab.checkboxes.findIndex(cb => parseLayerCheckbox(cb).category === 'Defense');
const elemDefense = addActionableElement('layers', defenseIdx);
assert.ok(elemDefense);
assert.strictEqual(elemDefense.layerNumber, 2);
assert.strictEqual(elemDefense.elementName, 'Defense-2');

// Verify displayValues has zero duplicate names after second addition:
const layersCfgAfterDef = loadDisplayPanelConfig().find(v => v.id === 'layers');
const namesAfterDef = layersCfgAfterDef.checkboxes.map(cb => cb.name);
assert.strictEqual(new Set(namesAfterDef).size, 5, 'Must have zero duplicate names with two active layers');
assert.strictEqual(layersCfgAfterDef.checkboxes[0].name, 'Habitats-1');
assert.strictEqual(layersCfgAfterDef.checkboxes[1].name, 'Defense-2');

// Attempting to add an already active category (Habitats again) must NOT duplicate:
const dupeConflictCheck = detectElementConflicts({
  id: 'layers:habitats',
  decoratorId: 'layers',
  decoratorName: 'Layers',
  elementId: 'layer-habitats',
  elementName: 'Habitats-3',
  category: 'habitats'
}, getActiveActionableElements());
assert.strictEqual(dupeConflictCheck.hasConflict, true, 'Must detect conflict when adding existing category');

// Adding Habitats replaces/moves without creating duplicates:
addActionableElement('layers', 0); // Habitats is at index 0
const activeLayersAfterDupe = getActiveActionableElements().filter(e => e.decoratorId === 'layers');
assert.strictEqual(activeLayersAfterDupe.length, 2, 'Total active layers must not duplicate');
const activeCatSet = new Set(activeLayersAfterDupe.map(l => l.category));
assert.strictEqual(activeCatSet.size, 2, 'No duplicate categories in active layers');

// Test addCheckboxToValue rejects adding extra checkboxes to Layers:
const addCbResult = addCheckboxToValue('layers', 'ExtraLayer');
assert.strictEqual(addCbResult, false, 'Cannot add beyond the five canonical categories');

// Test renameCheckbox rejects invalid category or duplicate category name in Layers:
const invalidRename = renameCheckbox('layers', 0, 'InvalidCategory');
assert.strictEqual(invalidRename, false, 'Cannot rename to non-canonical category');
const dupeRename = renameCheckbox('layers', 0, 'Habitats'); // Habitats is in slot 1
assert.strictEqual(dupeRename, false, 'Cannot rename to duplicate category');

// Test loadDisplayPanelConfig sanitization on corrupt storage:
mockStorage['x4_module_display_panel_config'] = JSON.stringify([
  {
    id: 'layers',
    name: 'Layers',
    checkboxes: [
      { id: 'l1', name: 'Storage-1', checked: true },
      { id: 'l2', name: 'Storage-2', checked: false }, // DUPLICATE!
      { id: 'l3', name: 'Custom-3', checked: false }  // Non-canonical!
    ]
  }
]);
const sanitizedLoaded = loadDisplayPanelConfig().find(v => v.id === 'layers');
assert.strictEqual(sanitizedLoaded.checkboxes.length, 5, 'Must sanitize to strictly 5 checkboxes');
const sanitizedCats = sanitizedLoaded.checkboxes.map(cb => parseLayerCheckbox(cb).category);
assert.strictEqual(new Set(sanitizedCats).size, 5, 'Sanitized categories must have zero duplicates');
assert.deepStrictEqual(new Set(sanitizedCats), new Set(LAYER_CATEGORIES), 'Must contain all 5 canonical categories');

clearActionableElements();
console.log('✓ Layers Elements strictly maintained only the five canonical categories with zero duplicate names');

// 12. Alignment Anchor: Strictly Only One Selection (Mutually Exclusive)
console.log('\n--- Testing Alignment Anchor: Strictly Only One Selection (Mutually Exclusive) ---');
clearActionableElements();
assert.strictEqual(getActiveActionableElements().length, 0);

// Add "Origin (0,0,0)" (index 0) from Alignment Anchor:
const elemOrigin = addActionableElement('alignment-anchor', 0);
assert.ok(elemOrigin);
assert.strictEqual(elemOrigin.decoratorId, 'alignment-anchor');
assert.strictEqual(elemOrigin.elementName, 'Origin (0,0,0)');
assert.strictEqual(getActiveActionableElements().length, 1);

// Conflict check: adding "Ground Floor" (index 1) from Alignment Anchor detects conflict:
const alignConflictCheck = detectElementConflicts({
  id: 'alignment-anchor:align-ground',
  decoratorId: 'alignment-anchor',
  decoratorName: 'Alignment Anchor',
  elementId: 'align-ground',
  elementName: 'Ground Floor'
}, getActiveActionableElements());
assert.strictEqual(alignConflictCheck.hasConflict, true, 'Must detect conflict with existing Alignment Anchor element');
assert.strictEqual(alignConflictCheck.conflicts[0].elementName, 'Origin (0,0,0)');
console.log(`✓ Alignment Anchor conflict correctly detected: ${alignConflictCheck.reason}`);

// Add "Ground Floor" (index 1): auto-resolves conflict by replacing "Origin (0,0,0)"
const elemGround = addActionableElement('alignment-anchor', 1);
assert.ok(elemGround);
assert.strictEqual(elemGround.elementName, 'Ground Floor');

const activeAlignElements = getActiveActionableElements().filter(e => e.decoratorId === 'alignment-anchor');
assert.strictEqual(activeAlignElements.length, 1, 'Only one Alignment Anchor selection allowed at a time');
assert.strictEqual(activeAlignElements[0].elementName, 'Ground Floor');
assert.ok(!getActiveActionableElements().some(e => e.elementName === 'Origin (0,0,0)'), 'Origin (0,0,0) replaced by Ground Floor');
console.log('✓ Alignment Anchor auto-resolved conflict: "Ground Floor" replaced "Origin (0,0,0)"');

// Add "Bounding Center" (index 2): auto-resolves by replacing "Ground Floor"
const elemCenter = addActionableElement('alignment-anchor', 2);
assert.ok(elemCenter);
const activeAlignAfterCenter = getActiveActionableElements().filter(e => e.decoratorId === 'alignment-anchor');
assert.strictEqual(activeAlignAfterCenter.length, 1, 'Strictly only one Alignment Anchor selection allowed');
assert.strictEqual(activeAlignAfterCenter[0].elementName, 'Bounding Center');
assert.ok(!getActiveActionableElements().some(e => e.elementName === 'Ground Floor'));
console.log('✓ Alignment Anchor auto-resolved conflict: "Bounding Center" replaced "Ground Floor"');

// Verify examineFiveCheckboxes enforces single active selection in alignment-anchor
const examOrigin = examineFiveCheckboxes('alignment-anchor', 0, true);
assert.strictEqual(examOrigin.checkedEntries.length, 1, 'Strictly 1 checked entry in Alignment Anchor');
assert.strictEqual(examOrigin.checkedEntries[0].id, 'align-origin');

const examGround = examineFiveCheckboxes('alignment-anchor', 1, true);
assert.strictEqual(examGround.checkedEntries.length, 1, 'Strictly 1 checked entry in Alignment Anchor');
assert.strictEqual(examGround.checkedEntries[0].id, 'align-ground');

clearActionableElements();
console.log('✓ Alignment Anchor strictly allows only one selection. All elements are mutually exclusive.');

// 12. Testing Order of Layout Blueprint: Reload blueprint name, skip other decorators, and yellow styling
console.log('\n--- Testing Order of Layout: Blueprint Name Reload, Skipping Decorators & Yellow Styling ---');

// Mock DOM environment for rendering cards and testing badges/classes
const mockElements = new Map();
globalThis.document = {
  getElementById(id) {
    return mockElements.get(id) || null;
  },
  createElement(tag) {
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      title: '',
      textContent: '',
      children: [],
      get className() {
        return Array.from(classes).join(' ');
      },
      set className(val) {
        classes.clear();
        (val || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
      },
      classList: {
        add(...cs) { cs.forEach(c => classes.add(c)); },
        remove(...cs) { cs.forEach(c => classes.delete(c)); },
        contains(c) { return classes.has(c); }
      },
      appendChild(child) {
        this.children.push(child);
        if (child.id) mockElements.set(child.id, child);
      },
      addEventListener() {},
      removeEventListener() {},
      contains() { return false; },
      getBoundingClientRect() { return { top: 0, height: 40 }; }
    };
    return el;
  }
};

// Set up mock DOM elements for plan-name and sample-dropdown-current-label
const mockPlanName = document.createElement('span');
mockPlanName.id = 'plan-name';
mockElements.set('plan-name', mockPlanName);

const mockSampleLabel = document.createElement('span');
mockSampleLabel.id = 'sample-dropdown-current-label';
mockElements.set('sample-dropdown-current-label', mockSampleLabel);

// Set active blueprint
setActiveBlueprint('argon_station_mega', 'Argon Station Megaplex Alpha');
assert.strictEqual(getActiveBlueprint().name, 'Argon Station Megaplex Alpha');

// Add Blueprint as Order of Layout actionable element (index 0)
clearActionableElements();
const elemBp = addActionableElement('order-of-layout', 0);
assert.ok(elemBp);
assert.strictEqual(elemBp.elementName, 'Blueprint');
assert.strictEqual(isOrderOfLayoutBlueprint(), true, 'isOrderOfLayoutBlueprint should be true when Blueprint is active in Order of Layout');

// Verify reloadBlueprintName updates DOM and actionable element
const reloaded = reloadBlueprintName();
assert.strictEqual(reloaded, 'Argon Station Megaplex Alpha');
assert.strictEqual(mockPlanName.textContent, 'Argon Station Megaplex Alpha', 'plan-name should be reloaded with blueprint name');
assert.strictEqual(mockSampleLabel.textContent, 'Argon Station Megaplex Alpha', 'sample-dropdown-current-label should be reloaded with blueprint name');
console.log('✓ reloadBlueprintName successfully refreshed plan name and dropdown label');

// Add other actionable decorators (Spacing & Offset, Layers)
const elemSpacing = addActionableElement('spacing-offset', 2); // Pad (+50m)
const elemDocks = addActionableElement('layers', 0); // Docks-1

assert.strictEqual(getActiveActionableElements().length, 3);
console.log('✓ Added Spacing & Offset and Layers alongside Blueprint in Actionable Panel');

// Test createActionableElementCard rendering:
// 1. Blueprint card should have is-blueprint-active and blueprint-reloaded-name
const bpCard = createActionableElementCard(elemBp, 0, 3);
assert.strictEqual(bpCard.classList.contains('is-blueprint-active'), true, 'Blueprint card should have is-blueprint-active class');
assert.strictEqual(bpCard.classList.contains('is-skipped-by-blueprint'), false, 'Blueprint card should NOT be marked skipped');

// Check blueprint name badge
function findDescendantByClass(el, className) {
  if (el.classList && el.classList.contains(className)) return el;
  if (!el.children) return null;
  for (const child of el.children) {
    const found = findDescendantByClass(child, className);
    if (found) return found;
  }
  return null;
}

const bpNameBadge = findDescendantByClass(bpCard, 'blueprint-reloaded-name');
assert.ok(bpNameBadge, 'Blueprint card must contain .blueprint-reloaded-name badge');
assert.strictEqual(bpNameBadge.textContent, 'Argon Station Megaplex Alpha');
console.log('✓ Blueprint actionable card displays reloaded name badge (.blueprint-reloaded-name)');

// 2. Spacing card should have is-skipped-by-blueprint and badge-skipped-yellow
const spacingCard = createActionableElementCard(elemSpacing, 1, 3);
assert.strictEqual(spacingCard.classList.contains('is-skipped-by-blueprint'), true, 'Spacing card must have is-skipped-by-blueprint class');
const spacingSkipBadge = findDescendantByClass(spacingCard, 'badge-skipped-yellow');
assert.ok(spacingSkipBadge, 'Spacing card must contain .badge-skipped-yellow badge');
assert.strictEqual(spacingSkipBadge.textContent, 'Skipped by Blueprint');
console.log('✓ Spacing actionable card is marked skipped in yellow (.is-skipped-by-blueprint & .badge-skipped-yellow)');

// 3. Unified Layers card should have is-skipped-by-blueprint and badge-skipped-yellow
const layersCard = createUnifiedLayersCard([elemDocks], 2);
assert.strictEqual(layersCard.classList.contains('is-skipped-by-blueprint'), true, 'Layers card must have is-skipped-by-blueprint class');
const layersSkipBadge = findDescendantByClass(layersCard, 'badge-skipped-yellow');
assert.ok(layersSkipBadge, 'Layers card must contain .badge-skipped-yellow badge');
assert.strictEqual(layersSkipBadge.textContent, 'Skipped by Blueprint');
console.log('✓ Unified Layers card is marked skipped in yellow (.is-skipped-by-blueprint & .badge-skipped-yellow)');

// Test skipping in applyModuleDisplayBehavior
let viewerPlacementCalled = false;
const mockViewer = {
  applyDisplayPlacementBehavior(valueId, behaviorKey, behaviorValue) {
    viewerPlacementCalled = true;
  }
};

// Applying spacing behavior when Order of Layout is Blueprint should be skipped
applyModuleDisplayBehavior('spacing-offset', 'Pad (+50m)', 'pad-50', mockViewer);
assert.strictEqual(viewerPlacementCalled, false, 'applyModuleDisplayBehavior must skip spacing-offset when Order of Layout is Blueprint');
console.log('✓ applyModuleDisplayBehavior correctly skipped procedural placement for spacing-offset');

// Switch Order of Layout away from Blueprint (index 1: "Layers Order")
const elemNonBpOrder = addActionableElement('order-of-layout', 1);
assert.strictEqual(elemNonBpOrder.elementName, 'Layers Order');
assert.strictEqual(isOrderOfLayoutBlueprint(), false, 'isOrderOfLayoutBlueprint should be false when switched away from Blueprint');

// After switching away from Blueprint, decorators should no longer be marked skipped:
const spacingCardNormal = createActionableElementCard(elemSpacing, 1, 3);
assert.strictEqual(spacingCardNormal.classList.contains('is-skipped-by-blueprint'), false, 'Spacing card should no longer be marked skipped');
assert.strictEqual(findDescendantByClass(spacingCardNormal, 'badge-skipped-yellow'), null, 'Yellow skip badge should not be present');

const layersCardNormal = createUnifiedLayersCard([elemDocks], 2);
assert.strictEqual(layersCardNormal.classList.contains('is-skipped-by-blueprint'), false, 'Layers card should no longer be marked skipped');
assert.strictEqual(findDescendantByClass(layersCardNormal, 'badge-skipped-yellow'), null, 'Yellow skip badge should not be present');

// Applying spacing behavior when Order of Layout is NOT Blueprint should execute
viewerPlacementCalled = false;
applyModuleDisplayBehavior('spacing-offset', 'Pad (+50m)', 'pad-50', mockViewer);
assert.strictEqual(viewerPlacementCalled, true, 'applyModuleDisplayBehavior must execute when Order of Layout is not Blueprint');
console.log('✓ Switching away from Blueprint restored normal cyan styling and active decorator execution');

clearActionableElements();

console.log('✅ All Actionable Elements, Layers Order of Addition, Hand Placement & Blueprint Skip tests passed cleanly!');
