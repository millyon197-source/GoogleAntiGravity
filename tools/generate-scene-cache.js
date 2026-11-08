/**
 * Builds the binary scene cache: for every .dae part the viewer loads through ColladaLoader
 * (effect, detail and production part_main parts; see isSceneCacheCandidate), runs the viewer's own
 * loadColladaModel on it and saves the resulting scene next to it as <part>.x4scene. The viewer then
 * loads those instead of parsing the Collada XML, which is the slow part of opening a large plan.
 *
 * Also writes assets1/scene-cache-manifest.json listing every cached part with its .dae size and
 * modification time, so the viewer only requests cache files that exist and are current.
 *
 *   npm run generate:scene-cache            convert new or changed parts
 *   npm run generate:scene-cache -- --force convert everything again
 *   npm run generate:scene-cache -- <text>  only parts whose path contains <text>
 *
 * Run it again after replacing files in assets1; parts whose .dae changed are converted again and
 * the viewer ignores cache entries that no longer match.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
const { loadColladaModel } = await import('../packages/adapter-three/src/models/collada-model-loader.js');
const {
  serializeScene, isSceneCacheCandidate, sceneCachePathFor, SCENE_CACHE_VERSION, SCENE_CACHE_MANIFEST_PATH
} = await import('../packages/adapter-three/src/models/scene-cache.js');

const args = process.argv.slice(2);
const force = args.includes('--force');
const filter = args.find(a => !a.startsWith('--'))?.toLowerCase().replace(/\\/g, '/');
const manifestFile = '.' + SCENE_CACHE_MANIFEST_PATH;

if (!fs.existsSync('assets1')) {
  console.error('assets1/ not found: extract the game assets first.');
  process.exit(1);
}

function listDae(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) listDae(p, out);
    else if (entry.name.toLowerCase().endsWith('.dae')) out.push('/' + path.relative(root, p).replace(/\\/g, '/'));
  }
  return out;
}

let manifest = { version: SCENE_CACHE_VERSION, files: {} };
if (fs.existsSync(manifestFile)) {
  try {
    const old = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (old.version === SCENE_CACHE_VERSION) manifest = old;
  } catch { /* rebuild */ }
}
const saveManifest = () => {
  manifest.generated = new Date().toISOString();
  const sorted = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(manifestFile + '.tmp', JSON.stringify({ ...manifest, files: sorted }, null, 1));
  fs.renameSync(manifestFile + '.tmp', manifestFile);
};

const all = listDae('assets1').filter(isSceneCacheCandidate);
// Drop entries for parts that no longer exist
for (const url of Object.keys(manifest.files)) if (!all.includes(url)) delete manifest.files[url];
const targets = all.filter(url => !filter || url.toLowerCase().includes(filter));

const host = { colladaCache: new Map(), colladaLoader: new ColladaLoader() };
const log = console.log, warn = console.warn, debug = console.debug, info = console.info;
const restoreConsole = () => { console.log = log; console.warn = warn; console.debug = debug; console.info = info; };
let converted = 0, skipped = 0, failed = 0, daeBytes = 0, cacheBytes = 0;
const started = Date.now();
for (const [i, url] of targets.entries()) {
  const stat = fs.statSync('.' + url);
  const known = manifest.files[url];
  const cacheFile = '.' + sceneCachePathFor(url);
  if (!force && known && known.daeBytes === stat.size && known.daeMtime === Math.round(stat.mtimeMs) && fs.existsSync(cacheFile)) { skipped++; continue; }
  try {
    console.log = console.warn = console.debug = console.info = () => {};
    host.colladaCache.clear();
    const scene = await loadColladaModel(host, url);
    restoreConsole();
    if (!scene) throw new Error('loader returned nothing');
    const buffer = Buffer.from(serializeScene(scene));
    fs.writeFileSync(cacheFile, buffer);
    manifest.files[url] = { daeBytes: stat.size, daeMtime: Math.round(stat.mtimeMs), cacheBytes: buffer.length };
    converted++; daeBytes += stat.size; cacheBytes += buffer.length;
  } catch (err) {
    restoreConsole();
    delete manifest.files[url];
    failed++;
    warn(`  ! ${url}: ${err.message}`);
  }
  if (converted % 25 === 0 || i === targets.length - 1) {
    saveManifest();
    log(`  ${i + 1}/${targets.length} parts (${converted} converted, ${skipped} current, ${failed} failed) ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}
host.colladaCache.clear();
saveManifest();
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
log(`Scene cache: ${converted} converted (${mb(daeBytes)} of .dae -> ${mb(cacheBytes)}), ${skipped} already current, ${failed} failed; ${Object.keys(manifest.files).length} parts in ${SCENE_CACHE_MANIFEST_PATH}`);
process.exit(failed ? 1 : 0);
