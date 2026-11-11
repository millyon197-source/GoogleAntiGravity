import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_DISPLAY_VALUES,
  DEFAULT_ORDER_OF_LAYOUT,
  loadDisplayPanelConfig,
  isBlueprintModeActive,
  setBlueprintModeActive,
  examineFiveCheckboxes,
  applyModuleDisplayBehavior
} from '../src/module-display-panel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Testing Blueprint Checkbox Outside Layout ---');

// 1. Verify index.html contains the Blueprint checkbox on the Layout pill to the right of "Layout" text
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

assert.ok(htmlContent.includes('id="toggle-blueprint"'), 'index.html should have #toggle-blueprint checkbox');
assert.ok(htmlContent.includes('<span class="toggle-label">Blueprint</span>'), 'index.html should label the checkbox as "Blueprint"');
assert.ok(htmlContent.includes('id="btn-toggle-display-panel"'), 'index.html should have Layout pill');

// Ensure Blueprint checkbox appears inside the Layout pill, just to the right of the "Layout" text
const layoutPillMatch = htmlContent.match(/<div id="btn-toggle-display-panel"[^>]*>([\s\S]*?)<\/div>/);
assert.ok(layoutPillMatch, 'Layout pill should be present');
const layoutPillHtml = layoutPillMatch[1];
assert.ok(layoutPillHtml.includes('Layout</span>'), 'Layout pill should contain "Layout" text');
assert.ok(layoutPillHtml.includes('id="toggle-blueprint"'), 'toggle-blueprint should be inside the Layout pill');
assert.ok(layoutPillHtml.indexOf('Layout</span>') < layoutPillHtml.indexOf('id="toggle-blueprint"'),
  'toggle-blueprint should be placed just to the right of the "Layout" text on the Layout pill');
console.log('✓ Verified: Blueprint checkbox is on the Layout pill just to the right of "Layout" text.');

// Verify "Rotate" checkbox is removed from main viewer screen
assert.strictEqual(htmlContent.includes('id="toggle-autorotate"'), false, 'Rotate checkbox should be removed from main viewer screen');
console.log('✓ Verified: Rotate checkbox removed from main viewer screen.');

// 2. Verify Decorator Palette under Layout no longer contains Order of Layout
assert.strictEqual(DEFAULT_DISPLAY_VALUES.some(v => v.id === 'order-of-layout'), false,
  'Order of Layout should be removed from Decorator Palette (DEFAULT_DISPLAY_VALUES)');
assert.strictEqual(DEFAULT_DISPLAY_VALUES.length, 5, 'Decorator Palette should have 5 items');
console.log('✓ Verified: Order of Layout removed from Decorator Palette.');

// 3. Verify Default state of Blueprint is active (true)
setBlueprintModeActive(true);
assert.strictEqual(isBlueprintModeActive(), true, 'Blueprint mode should default to true');
console.log('✓ Verified: Blueprint mode is active by default.');

// 4. Verify mock viewer placement behaviors: In Blueprint mode, procedural placement is skipped
let viewerPlacementCalled = false;
let lastPlacementMode = null;
const mockViewer = {
  applyDisplayPlacementBehavior(valueId, behaviorKey, behaviorValue) {
    viewerPlacementCalled = true;
    lastPlacementMode = { valueId, behaviorKey, behaviorValue };
  },
  applyLayoutBehavior(key, name) {
    lastPlacementMode = { key, name };
  },
  fitCameraToStation() {},
  renderScene() {}
};

// With Blueprint active, applying spacing-offset should be skipped
applyModuleDisplayBehavior('spacing-offset', 'Pad (+50m)', 'pad-50', mockViewer);
assert.strictEqual(viewerPlacementCalled, false, 'applyModuleDisplayBehavior must skip spacing-offset when Blueprint is active');
console.log('✓ Verified: Procedural placement is skipped while Blueprint is active.');

// 5. Uncheck Blueprint mode: procedural placement executes
setBlueprintModeActive(false, mockViewer);
assert.strictEqual(isBlueprintModeActive(), false, 'isBlueprintModeActive() should be false when set to false');
applyModuleDisplayBehavior('spacing-offset', 'Pad (+50m)', 'pad-50', mockViewer);
assert.strictEqual(viewerPlacementCalled, true, 'applyModuleDisplayBehavior must execute when Blueprint is disabled');
console.log('✓ Verified: Disabling Blueprint enables procedural layout placement.');

// 6. Selecting a procedural Layout Mode unchecks Blueprint
setBlueprintModeActive(true, mockViewer);
assert.strictEqual(isBlueprintModeActive(), true);
examineFiveCheckboxes('layout-mode', 0, true); // Category Clusters
assert.strictEqual(isBlueprintModeActive(), false, 'Selecting a procedural Layout Mode should uncheck Blueprint');
console.log('✓ Verified: Selecting a procedural Layout Mode unchecks Blueprint.');

// 7. Re-checking Blueprint restores Blueprint mode
setBlueprintModeActive(true, mockViewer);
assert.strictEqual(isBlueprintModeActive(), true, 'Re-checking Blueprint should restore Blueprint mode');
console.log('✓ Verified: Re-checking Blueprint restores Blueprint mode.');

console.log('\n✅ ALL BLUEPRINT OUTSIDE LAYOUT TESTS PASSED!');
