/**
 * Scene cache (packages/adapter-three/src/models/scene-cache.js): a scene rebuilt from the cache must
 * be identical to the one loadColladaModel builds from the .dae, both as loaded and after the real
 * texturing code (applyTexturesToMeshGroup) has run on it. When generated cache files exist on disk
 * (npm run generate:scene-cache), they are checked the same way and against the manifest.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}
const THREE = await import('three');
const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
const { loadColladaModel } = await import('../packages/adapter-three/src/models/collada-model-loader.js');
const { applyTexturesToMeshGroup } = await import('../packages/adapter-three/src/materials/mesh-group-materials.js');
const {
  serializeScene, deserializeScene, isSceneCacheCandidate, sceneCachePathFor, loadCachedScene, SCENE_CACHE_VERSION, SCENE_CACHE_MANIFEST_PATH
} = await import('../packages/adapter-three/src/models/scene-cache.js');

console.log('[*] Testing the scene cache...');
const quiet = (fn) => async (...a) => { const l = console.log, w = console.warn; console.log = () => {}; console.warn = () => {}; try { return await fn(...a); } finally { console.log = l; console.warn = w; } };

// 1. Which parts qualify
for (const [url, expected] of [
  ['/assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.dae', true],
  ['/assets1/structures/habitat/hab_arg_l_01_data/detail_m_main-lod0.dae', true],
  ['/assets1/structures/dock/x_data/fx_glow-lod0.dae', true],
  ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/part_main-lod0.dae', false],
  ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae', false],
  ['/assets1/structures/habitat/hab_arg_l_01_data/anim_poslights-lod0.dae', false],
  ['/assets1/structures/x_data/billboard_ads-lod0.dae', false],
  ['/assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod1.dae', false],
  ['/assets1/structures/production/prod_gen_refinedmetals_data/fx_decals-collision.dae', false]
]) assert.strictEqual(isSceneCacheCandidate(url), expected, url);
assert.strictEqual(sceneCachePathFor('/a/b/detail_m_main-lod0.dae'), '/a/b/detail_m_main-lod0.x4scene');
console.log('  ✓ effect, detail and production part_main parts qualify; animated and billboard parts do not');

// 2. Deep comparison of two scenes
function compareScenes(a, b, path = 'root', problems = []) {
  const eq = (what, x, y) => { if (!Object.is(x, y) && JSON.stringify(x) !== JSON.stringify(y)) problems.push(`${path}: ${what} ${JSON.stringify(x)?.slice(0, 80)} vs ${JSON.stringify(y)?.slice(0, 80)}`); };
  eq('type', a.isMesh ? 'Mesh' : 'Group', b.isMesh ? 'Mesh' : 'Group');
  for (const k of ['name', 'visible', 'castShadow', 'receiveShadow', 'renderOrder', 'frustumCulled']) eq(k, a[k], b[k]);
  eq('position', a.position.toArray(), b.position.toArray());
  eq('quaternion', a.quaternion.toArray(), b.quaternion.toArray());
  eq('scale', a.scale.toArray(), b.scale.toArray());
  const plain = (u) => Object.fromEntries(Object.entries(u).filter(([k, v]) => typeof v !== 'function' && k !== 'rawUvs' && !(v && typeof v === 'object' && (v.isObject3D || v.isTexture || v.isMaterial))));
  eq('userData', plain(a.userData), plain(b.userData));
  eq('has setBillboardState', typeof a.userData.setBillboardState, typeof b.userData.setBillboardState);
  const ra = a.userData.rawUvs, rb = b.userData.rawUvs;
  eq('rawUvs keys', ra && Object.keys(ra).sort(), rb && Object.keys(rb).sort());
  if (ra && rb) for (const k of Object.keys(ra)) if (!sameArray(ra[k], rb[k])) problems.push(`${path}: rawUvs.${k} differs`);
  if (a.isMesh && b.isMesh) {
    const ga = a.geometry, gb = b.geometry;
    eq('attributes', Object.keys(ga.attributes).sort(), Object.keys(gb.attributes).sort());
    for (const k of Object.keys(ga.attributes)) {
      const x = ga.attributes[k], y = gb.attributes[k];
      if (!y) continue;
      eq(`${k}.itemSize`, x.itemSize, y.itemSize);
      eq(`${k}.normalized`, x.normalized, y.normalized);
      if (!sameArray(x.array, y.array)) problems.push(`${path}: attribute ${k} values differ`);
    }
    eq('index', ga.index ? Array.from(ga.index.array) : null, gb.index ? Array.from(gb.index.array) : null);
    eq('groups', ga.groups, gb.groups);
    eq('drawRange', [ga.drawRange.start, ga.drawRange.count], [gb.drawRange.start, gb.drawRange.count]);
    const ma = [].concat(a.material), mb = [].concat(b.material);
    eq('material count', ma.length, mb.length);
    ma.forEach((m, i) => {
      const n = mb[i]; if (!n) return;
      for (const k of ['type', 'name', 'opacity', 'transparent', 'side', 'vertexColors', 'alphaTest', 'depthTest', 'depthWrite', 'visible', 'blending', 'emissiveIntensity', 'roughness', 'metalness', 'toneMapped']) eq(`material[${i}].${k}`, m[k], n[k]);
      for (const k of ['color', 'emissive', 'specular']) eq(`material[${i}].${k}`, m[k]?.getHex(), n[k]?.getHex());
      // after texturing: same textures (by source) on the same slots
      for (const slot of ['map', 'emissiveMap', 'alphaMap', 'normalMap']) eq(`material[${i}].${slot}`, texKey(m[slot]), texKey(n[slot]));
    });
  }
  eq('child count', a.children.length, b.children.length);
  a.children.forEach((c, i) => b.children[i] && compareScenes(c, b.children[i], `${path}/${c.name || i}`, problems));
  return problems;
}
function sameArray(x, y) {
  if (!x || !y || x.constructor !== y.constructor || x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false;
  return true;
}
const texKey = (t) => (t ? { name: t.name, image: Boolean(t.image), wrap: [t.wrapS, t.wrapT], repeat: t.repeat.toArray(), offset: t.offset.toArray(), colorSpace: t.colorSpace, flipY: t.flipY } : null);

// 3. Rebuild vs .dae for a spread of parts, before and after texturing
const host = { colladaCache: new Map(), colladaLoader: new ColladaLoader(), renderScene() {}, animatedTextures: [], animatedParts: [] };
const textureCache = new Map();
host.loadDdsTexture = async (url) => { if (!textureCache.has(url)) { const t = new THREE.Texture(); t.name = url; textureCache.set(url, t); } return textureCache.get(url); };
const urls = [
  '/assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.dae',
  '/assets1/structures/habitat/hab_arg_l_01_data/detail_m_main-lod0.dae',
  '/assets1/structures/production/prod_gen_fieldcoils_data/detail_l_main-lod0.dae',
  '/assets1/structures/landmarks/landmarks_kha_tetrahedron_02_data/detail_s_main-lod0.dae',
  '/assets1/structures/dock/dockingbay_arg_m_01_hightech_data/fx_lightcones-lod0.dae',
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_decals-lod0.dae',
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_glow-lod0.dae'
].filter(u => fs.existsSync('.' + u));
assert.ok(urls.length > 0, 'sample .dae parts exist in assets1');
let checked = 0;
for (const url of urls) {
  const original = await quiet(loadColladaModel)(host, url);
  const rebuilt = deserializeScene(serializeScene(original));
  const before = compareScenes(original, rebuilt);
  assert.deepStrictEqual(before, [], `${url}: rebuilt scene differs:\n  ${before.slice(0, 8).join('\n  ')}`);
  const a = original.clone(), b = rebuilt.clone();
  await quiet(applyTexturesToMeshGroup)(host, a, url, 1);
  await quiet(applyTexturesToMeshGroup)(host, b, url, 1);
  const after = compareScenes(a, b);
  assert.deepStrictEqual(after, [], `${url}: textured scenes differ:\n  ${after.slice(0, 8).join('\n  ')}`);
  checked++;
}
console.log(`  ✓ ${checked} parts rebuild identically to the .dae scene, before and after texturing`);

// 4. Generated cache files and manifest, when present
const manifestPath = '.' + SCENE_CACHE_MANIFEST_PATH;
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.version, SCENE_CACHE_VERSION, 'manifest version matches the format');
  const stale = Object.entries(manifest.files).filter(([url, info]) => !fs.existsSync('.' + url) || fs.statSync('.' + url).size !== info.daeBytes || Math.round(fs.statSync('.' + url).mtimeMs) !== info.daeMtime || !fs.existsSync('.' + sceneCachePathFor(url)));
  assert.deepStrictEqual(stale.map(([u]) => u), [], 'manifest entries whose .dae changed or whose cache file is missing (rerun npm run generate:scene-cache)');
  let fromDisk = 0;
  for (const url of urls) {
    if (!manifest.files[url]) continue;
    const file = fs.readFileSync('.' + sceneCachePathFor(url));
    const rebuilt = deserializeScene(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const problems = compareScenes(await quiet(loadColladaModel)(host, url), rebuilt);
    assert.deepStrictEqual(problems, [], `${url}: cache file differs from the .dae:\n  ${problems.slice(0, 8).join('\n  ')}`);
    fromDisk++;
  }
  console.log(`  ✓ manifest (${Object.keys(manifest.files).length} parts) is current; ${fromDisk} cache files on disk match their .dae`);
}

// 5. loadCachedScene: only parts the manifest lists, and a broken cache file falls back with a warning
{
  const listed = '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_glow-lod0.dae';
  const tmp = 'tests/.scene-cache-tmp';
  fs.mkdirSync(tmp, { recursive: true });
  const good = `/${tmp}/good-lod0.dae`, broken = `/${tmp}/broken-lod0.dae`;
  const source = await quiet(loadColladaModel)(host, listed);
  fs.writeFileSync('.' + sceneCachePathFor(good), Buffer.from(serializeScene(source)));
  fs.writeFileSync('.' + sceneCachePathFor(broken), '<!doctype html><html></html>');
  const cacheHost = { sceneCacheManifest: Promise.resolve({ version: SCENE_CACHE_VERSION, files: { [good]: {}, [broken]: {} } }) };
  const warnings = [];
  try {
    const scene = await loadCachedScene(cacheHost, good, (m, t) => warnings.push([m, t]));
    assert.deepStrictEqual(compareScenes(source, scene), [], 'listed part comes from its cache file');
    assert.strictEqual(await loadCachedScene(cacheHost, good), scene, 'cache files are loaded once per host');
    assert.strictEqual(await loadCachedScene(cacheHost, `/${tmp}/unlisted-lod0.dae`), null, 'unlisted part: null, nothing requested');
    assert.strictEqual(await loadCachedScene(cacheHost, broken, (m, t) => warnings.push([m, t])), null, 'unreadable cache file: null');
    assert.ok(warnings.length === 1 && warnings[0][1] === 'warn' && warnings[0][0].includes('broken-lod0.dae'), 'unreadable cache file reported once as a warning');
    assert.strictEqual(await loadCachedScene({ sceneCacheManifest: Promise.resolve(null) }, good), null, 'no manifest: null');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('  ✓ loadCachedScene uses only parts the manifest lists and falls back with a warning on a broken file');
}

// 6. Repeated vertex items are stored once and expanded bit for bit (-0, NaN, empty attributes)
{
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(3000);
  for (let i = 0; i < pos.length; i += 3) pos.set([[0, -0, 1.5], [NaN, 2, 3], [0.1, 0.2, 0.3]][(i / 3) % 3], i);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(4000).fill(1), 4));
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(0), 0));
  const unique = new Float32Array(2000).map((_, i) => i * 0.5);
  g.setAttribute('uv', new THREE.BufferAttribute(unique, 2));
  const root = new THREE.Group();
  root.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial()));
  const buf = serializeScene(root);
  assert.ok(buf.byteLength < pos.byteLength / 4 + 4000 * 4 / 4 + unique.byteLength + 2000, `repeated items stored once (${buf.byteLength} bytes)`);
  const back = deserializeScene(buf).children[0].geometry.attributes;
  const bits = (a) => Array.from(new Uint32Array(a.buffer, a.byteOffset, a.length));
  for (const k of ['position', 'color', 'uv', 'uv1']) {
    assert.strictEqual(back[k].array.constructor, g.attributes[k].array.constructor, `${k} type`);
    assert.deepStrictEqual(bits(back[k].array), bits(g.attributes[k].array), `${k} identical bit for bit`);
    assert.strictEqual(back[k].itemSize, g.attributes[k].itemSize, `${k} itemSize`);
  }
  console.log(`  ✓ repeated vertex items stored once and expanded bit for bit (${(buf.byteLength / 1024).toFixed(1)} KB for ${((pos.byteLength + 16000 + unique.byteLength) / 1024).toFixed(1)} KB of arrays)`);
}

// 7. Corrupt or foreign files are rejected
assert.throws(() => deserializeScene(new TextEncoder().encode('<!doctype html>').buffer), /not a scene cache file/);
const wrongVersion = serializeScene(new THREE.Group());
new DataView(wrongVersion).setUint32(4, SCENE_CACHE_VERSION + 1, true);
assert.throws(() => deserializeScene(wrongVersion), /version/);
console.log('  ✓ rejects files that are not scene caches or have another format version');

console.log('\n[PASS] test_scene_cache');
