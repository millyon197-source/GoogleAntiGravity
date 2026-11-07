/**
 * StationViewer.setGameAssetsAvailability: when the X4 game assets are missing, model loads
 * return null without trying to fetch anything (placeholders are drawn instead).
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing model loading gated on the game asset check...');

// A viewer without the constructor (as other tests do); count how often model loading starts
function makeViewer() {
  const viewer = Object.create(StationViewer.prototype);
  viewer.started = 0;
  // First step of adapter-three's loadModuleMesh; returning no folder makes it finish with null
  viewer.resolveModuleAssetEntry = () => { viewer.started++; return { baseName: 'x', folderPath: null, defaultFiles: [] }; };
  viewer.getModuleActiveComponentFiles = () => [];
  return viewer;
}
const mod = { index: 1, macro: 'struct_arg_cross_01_macro' };

// No check set: loads as before
const plain = makeViewer();
assert.strictEqual(await plain.loadModuleMesh(mod), null);
assert.strictEqual(plain.started, 1, 'without a check, model loading runs');
assert.strictEqual(plain.gameAssetsMissing, undefined);

// Assets missing: no load attempt at all
const missing = makeViewer();
missing.setGameAssetsAvailability(Promise.resolve(false));
assert.strictEqual(await missing.loadModuleMesh(mod), null);
assert.strictEqual(await missing.loadModuleMesh({ index: 2, macro: 'hab_arg_l_01_macro' }), null);
assert.strictEqual(missing.started, 0, 'no model loading when the assets are missing');
assert.strictEqual(missing.gameAssetsMissing, true);
console.log('  ✓ missing assets: loads return null without starting');

// Assets present: loads run
const present = makeViewer();
present.setGameAssetsAvailability(Promise.resolve(true));
await present.loadModuleMesh(mod);
assert.strictEqual(present.started, 1);
assert.strictEqual(present.gameAssetsMissing, false);
console.log('  ✓ assets present: loads run');

// Check still running: loads wait for it
const pending = makeViewer();
let resolveCheck;
pending.setGameAssetsAvailability(new Promise((r) => { resolveCheck = r; }));
const load = pending.loadModuleMesh(mod);
await new Promise((r) => setTimeout(r, 20));
assert.strictEqual(pending.started, 0, 'waits while the check is running');
resolveCheck(false);
assert.strictEqual(await load, null);
assert.strictEqual(pending.started, 0, 'and skips once it reports missing assets');
console.log('  ✓ loads wait for a running check');

// A failed check does not block models
const failed = makeViewer();
failed.setGameAssetsAvailability(Promise.reject(new Error('boom')));
await failed.loadModuleMesh(mod);
assert.strictEqual(failed.started, 1, 'a failed check counts as available');
assert.notStrictEqual(failed.gameAssetsMissing, true);
console.log('  ✓ a failed check falls back to normal loading');

console.log('\n[PASS] test_viewer_asset_gating');
