/**
 * src/app/game-assets-check.js: detects missing X4 game assets (which are not distributed with the
 * app) and shows a pop-up explaining it.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { checkGameAssets, showMissingAssetsNotice, warnIfGameAssetsMissing, GAME_ASSET_PROBE_URL } from '../src/app/game-assets-check.js';

console.log('[*] Testing the X4 game asset check...');

const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, text: async () => body });
const modelJson = JSON.stringify({ asset: 'part_main-lod0.dae', vertexCount: 15546 });

// 1. The check itself
assert.deepStrictEqual(await checkGameAssets({ fetchImpl: respond(200, modelJson) }), { available: true, reason: 'ok' });
const notFound = await checkGameAssets({ fetchImpl: respond(404, 'Not Found') });
assert.strictEqual(notFound.available, false);
assert.match(notFound.reason, /HTTP 404/);
const spaFallback = await checkGameAssets({ fetchImpl: respond(200, '<!doctype html><html><body>app</body></html>') });
assert.strictEqual(spaFallback.available, false, 'the app page served for a missing file must not count');
assert.match(spaFallback.reason, /not game data/);
const offline = await checkGameAssets({ fetchImpl: async () => { throw new Error('Failed to fetch'); } });
assert.strictEqual(offline.available, false);
assert.match(offline.reason, /Failed to fetch/);
assert.strictEqual((await checkGameAssets({ fetchImpl: respond(200, '{"hello":1}') })).available, false, 'other JSON is not a model');
assert.strictEqual((await checkGameAssets({ fetchImpl: null })).available, false);
let requested = null;
await checkGameAssets({ fetchImpl: async (url, init) => { requested = { url, init }; return respond(200, modelJson)(); } });
assert.strictEqual(requested.url, GAME_ASSET_PROBE_URL);
assert.strictEqual(requested.init.cache, 'no-store');
console.log('  ✓ available only for real game data; 404, app-page fallback, network errors and other JSON count as missing');

// The probe file must exist in a complete extraction (skipped when the assets are not installed)
const probeFile = '.' + GAME_ASSET_PROBE_URL;
if (fs.existsSync('assets1')) {
  assert.ok(fs.existsSync(probeFile), `${probeFile} is missing from assets1`);
  assert.strictEqual((await checkGameAssets({ fetchImpl: respond(200, fs.readFileSync(probeFile, 'utf8')) })).available, true);
  console.log('  ✓ the probe file exists in assets1 and passes the check');
}

// 2. The pop-up
const dom = new JSDOM('<!doctype html><html><body></body></html>');
const doc = dom.window.document;
const notice = showMissingAssetsNotice(doc, 'HTTP 404 for /assets1/x.json');
assert.ok(notice && doc.getElementById('missing-assets-modal'), 'pop-up added to the page');
assert.strictEqual(notice.getAttribute('role'), 'dialog');
assert.ok(notice.classList.contains('modal-backdrop') && notice.querySelector('.modal-card'), 'uses the app modal styles');
assert.match(notice.textContent, /X4 game assets not found/);
assert.match(notice.textContent, /Egosoft/);
assert.match(notice.textContent, /assets1/);
assert.match(notice.textContent, /HTTP 404 for \/assets1\/x\.json/);
assert.strictEqual(showMissingAssetsNotice(doc), notice, 'only one pop-up at a time');
notice.querySelector('.btn-primary').click();
assert.strictEqual(doc.getElementById('missing-assets-modal'), null, 'Continue button closes it');
showMissingAssetsNotice(doc).querySelector('.close-modal-btn').click();
assert.strictEqual(doc.getElementById('missing-assets-modal'), null, '✕ closes it');
const n3 = showMissingAssetsNotice(doc);
n3.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.strictEqual(doc.getElementById('missing-assets-modal'), null, 'Escape closes it');
const n4 = showMissingAssetsNotice(doc);
n4.querySelector('.modal-card').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
assert.ok(doc.getElementById('missing-assets-modal'), 'clicking inside the card keeps it open');
n4.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
assert.strictEqual(doc.getElementById('missing-assets-modal'), null, 'clicking the backdrop closes it');
console.log('  ✓ pop-up explains the missing assets, appears once, closes via button, ✕, Escape and backdrop');

// 3. Wiring: pop-up only when missing
const warn = console.warn; console.warn = () => {};
try {
  await warnIfGameAssetsMissing({ doc, fetchImpl: respond(200, modelJson) });
  assert.strictEqual(doc.getElementById('missing-assets-modal'), null, 'no pop-up when the assets are there');
  const r = await warnIfGameAssetsMissing({ doc, fetchImpl: respond(404, '') });
  assert.strictEqual(r.available, false);
  assert.ok(doc.getElementById('missing-assets-modal'), 'pop-up when the assets are missing');
} finally { console.warn = warn; }
console.log('  ✓ warnIfGameAssetsMissing shows the pop-up only when needed');

console.log('\n[PASS] test_game_assets_check');
