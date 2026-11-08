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
  ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae', true],
  ['/assets1/structures/habitat/hab_arg_l_01_data/anim_poslights-lod0.dae', true],
  ['/assets1/structures/x_data/billboard_ads-lod0.dae', true],
  ['/assets1/structures/production/prod_gen_advancedelectronics_data/anim_simon_container_01_dummy_01-lod0.dae', true],
  ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/part_main_wreck-lod0.dae', false],
  ['/assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod1.dae', false],
  ['/assets1/structures/production/prod_gen_refinedmetals_data/fx_decals-collision.dae', false]
]) assert.strictEqual(isSceneCacheCandidate(url), expected, url);
assert.strictEqual(sceneCachePathFor('/a/b/detail_m_main-lod0.dae'), '/a/b/detail_m_main-lod0.x4scene');
console.log('  ✓ every lod0 part the viewer loads from .dae qualifies (effect, animated, billboard, detail, production part_main); others and other LODs do not');

// 2. Deep comparison of two scenes
function compareScenes(a, b, path = 'root', problems = []) {
  const eq = (what, x, y) => { if (!Object.is(x, y) && JSON.stringify(x) !== JSON.stringify(y)) problems.push(`${path}: ${what} ${JSON.stringify(x)?.slice(0, 80)} vs ${JSON.stringify(y)?.slice(0, 80)}`); };
  eq('type', a.isMesh ? 'Mesh' : 'Group', b.isMesh ? 'Mesh' : 'Group');
  for (const k of ['name', 'visible', 'castShadow', 'receiveShadow', 'renderOrder', 'frustumCulled']) eq(k, a[k], b[k]);
  eq('position', a.position.toArray(), b.position.toArray());
  eq('quaternion', a.quaternion.toArray(), b.quaternion.toArray());
  eq('scale', a.scale.toArray(), b.scale.toArray());
  // userData compared structurally: meshes the texturing code keeps there (isolatedBillboards,
  // physicalSigns, ...) as meshes, typed arrays bit for bit, functions by presence; plain JSON would
  // include three's random uuids
  const deep = (x, y, where, seen = new Set()) => {
    if (x && typeof x === 'object' && seen.has(x)) return;
    if (x && typeof x === 'object') seen.add(x);
    if (x && x.isObject3D && y && y.isObject3D) return void compareScenes(x, y, `${path}/${where}`, problems);
    if (ArrayBuffer.isView(x) || ArrayBuffer.isView(y)) { if (!sameArray(x, y)) problems.push(`${path}: ${where} differs`); return; }
    if (typeof x === 'function' || typeof y === 'function') return eq(`${where} type`, typeof x, typeof y);
    if (x && typeof x === 'object' && !x.isTexture && !x.isMaterial && y && typeof y === 'object') {
      eq(`${where} keys`, Object.keys(x).sort(), Object.keys(y).sort());
      for (const k of Object.keys(x)) if (k in y) deep(x[k], y[k], `${where}.${k}`, seen);
      return;
    }
    if (x && (x.isTexture || x.isMaterial)) return eq(where, texKey(x.isTexture ? x : null) ?? x.name, texKey(y?.isTexture ? y : null) ?? y?.name);
    eq(where, x, y);
  };
  { const { rawUvs: _ra, ...ua } = a.userData, { rawUvs: _rb, ...ub } = b.userData; deep(ua, ub, 'userData'); }
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
// Expands indexed geometry back to non-indexed arrays, bit for bit (cache files store some geometry
// indexed; expanded, it must equal the .dae geometry exactly)
function expandIndexed(scene) {
  scene.traverse(o => {
    const g = o.isMesh && o.geometry;
    if (!g || !g.index) return;
    const idx = g.index.array;
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (attr.array.length === 0) continue;
      const k = attr.itemSize > 0 ? attr.itemSize : attr.array.length / (Math.max(...idx) + 1); // itemSize-0 channels: real width
      const out = new attr.array.constructor(idx.length * k);
      const ow = new Uint32Array(out.buffer), iw = new Uint32Array(attr.array.buffer, attr.array.byteOffset, attr.array.length);
      for (let i = 0; i < idx.length; i++) for (let j = 0; j < k; j++) ow[i * k + j] = iw[idx[i] * k + j];
      const na = new THREE.BufferAttribute(out, attr.itemSize, attr.normalized); na.name = attr.name;
      g.setAttribute(name, na);
    }
    g.setIndex(null);
  });
  return scene;
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
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_glow-lod0.dae',
  '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae',
  '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_cross-lod0.dae',
  '/assets1/structures/connectionmodules/struct_arg_base_03_data/anim_cross-lod0.dae',
  '/assets1/structures/habitat/hab_arg_l_01_data/anim_poslights-lod0.dae',
  '/assets1/structures/production/prod_gen_advancedelectronics_data/anim_simon_container_01_dummy_01-lod0.dae'
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

// 3b. Cross signs: the rebuilt anim_arrows mesh keeps the shared UV array and switches like the original
{
  const url = '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae';
  if (fs.existsSync('.' + url)) {
    host.colladaCache.delete(url);
    const original = await quiet(loadColladaModel)(host, url);
    let renders = 0;
    const rebuilt = deserializeScene(serializeScene(original), { renderScene: () => { renders++; } });
    const signMesh = (s) => { let m = null; s.traverse(o => { if (o.isMesh && typeof o.userData.setBillboardState === 'function') m = o; }); return m; };
    const a = signMesh(original), b = signMesh(rebuilt);
    assert.ok(a && b, 'sign mesh has its switch after rebuilding');
    assert.strictEqual(a.geometry.attributes.uv.array === a.userData.billboardStateAUvs, b.geometry.attributes.uv.array === b.userData.billboardStateAUvs, 'uv attribute shares the state A array exactly as in the original');
    assert.ok(b.userData.billboardStateBUvs instanceof Float32Array, 'state B UVs are a Float32Array');
    for (const state of ['B', 'A', 'B']) {
      original.userData.setBillboardState(state);
      rebuilt.userData.setBillboardState(state);
      assert.ok(sameArray(a.geometry.attributes.uv.array, b.geometry.attributes.uv.array), `UVs match after switching to ${state}`);
      assert.strictEqual(b.userData.currentBillboardState, state);
      assert.strictEqual(b.userData.manualBillboardState, a.userData.manualBillboardState);
    }
    assert.strictEqual(renders, 3, 'switching re-renders through the host given to the rebuild');
    host.colladaCache.delete(url); // the switches above changed this cached scene
    console.log('  ✓ cross sign mesh: shared UV array kept and A/B switching behaves as with the .dae');
  }
}

// 3c. Placing parts: cloneSharingRawUvs gives the same textured result as a plain clone, but the
//     clones use the template's raw UV arrays instead of a JSON copy per mesh
{
  const { cloneSharingRawUvs } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
  let parts = 0;
  for (const url of urls) {
    host.colladaCache.delete(url);
    const template = await quiet(loadColladaModel)(host, url);
    const before = []; template.traverse(o => before.push(o.userData.rawUvs));
    const plainClone = template.clone();
    const shared = cloneSharingRawUvs(template);
    const after = []; template.traverse(o => after.push(o.userData.rawUvs));
    assert.ok(before.every((r, i) => r === after[i]), `${url}: template keeps its own raw UVs`);
    const sharedRaw = []; shared.traverse(o => sharedRaw.push(o.userData.rawUvs));
    assert.ok(sharedRaw.every((r, i) => r === before[i]), `${url}: clones use the template's raw UV arrays`);
    assert.ok(shared !== template && sharedRaw.length === before.length, `${url}: a separate tree of the same shape`);
    // Texture both the way loadModuleMesh does, then compare (raw UVs: same values, typed arrays)
    await quiet(applyTexturesToMeshGroup)(host, plainClone, url, 1);
    await quiet(applyTexturesToMeshGroup)(host, shared, url, 1);
    const pa = [], pb = []; plainClone.traverse(o => pa.push(o)); shared.traverse(o => pb.push(o));
    pa.forEach((o, i) => {
      const x = o.userData.rawUvs, y = pb[i].userData.rawUvs;
      if (x || y) {
        assert.deepStrictEqual(Object.keys(x).sort(), Object.keys(y).sort(), `${url}: raw UV channels`);
        for (const k of Object.keys(x)) {
          assert.ok(ArrayBuffer.isView(y[k]), `${url}: shared raw UVs stay typed arrays`);
          assert.ok(Object.keys(x[k]).length === y[k].length && Array.from(y[k]).every((v, j) => Object.is(Math.fround(x[k][j] ?? NaN), v) || (Number.isNaN(v) && x[k][j] === null)), `${url}: raw UV ${k} values`);
        }
        delete o.userData.rawUvs; delete pb[i].userData.rawUvs;
      }
    });
    const problems = compareScenes(plainClone, shared);
    assert.deepStrictEqual(problems, [], `${url}: textured scene differs from a plain clone:\n  ${problems.slice(0, 8).join('\n  ')}`);
    host.colladaCache.delete(url); // texturing changed the shared geometry of this template
    parts++;
  }
  console.log(`  ✓ ${parts} parts: sharing raw UVs when placing a part gives the same textured result as a plain clone`);
}

// 3d. Indexed geometry: what the generator stores indexed expands to exactly the .dae geometry, textures
//     the same way, and parts whose quads the texturing code splits by vertex stay non-indexed
{
  const { mayIndexForCache, indexGeometryData } = await import('../packages/adapter-three/src/models/scene-cache.js');
  let indexedMeshes = 0, keptMeshes = 0, bytesBefore = 0, bytesAfter = 0;
  for (const url of urls) {
    host.colladaCache.delete(url);
    const original = await quiet(loadColladaModel)(host, url);
    const rebuilt = deserializeScene(serializeScene(original, { shouldIndex: (m) => mayIndexForCache(url, m) }));
    const sizes = (sc) => { let b = 0; sc.traverse(o => { if (o.isMesh) { for (const a of Object.values(o.geometry.attributes)) b += a.array.byteLength; if (o.geometry.index) b += o.geometry.index.array.byteLength; } }); return b; };
    bytesBefore += sizes(original); bytesAfter += sizes(rebuilt);
    const om = [], rm = []; original.traverse(o => o.isMesh && om.push(o)); rebuilt.traverse(o => o.isMesh && rm.push(o));
    om.forEach((o, i) => {
      if (rm[i].geometry.index) {
        indexedMeshes++;
        assert.ok(mayIndexForCache(url, o), `${url}: only qualifying meshes are indexed`);
        assert.strictEqual(rm[i].geometry.index.count, o.geometry.attributes.position.count, 'one index entry per original vertex');
      } else keptMeshes++;
    });
    if (/connectionmodules|anim_arrows|anim_cross/.test(url)) assert.ok(rm.every(m => !m.geometry.index), `${url}: quad-split parts stay non-indexed`);
    const problems = compareScenes(original, expandIndexed(deserializeScene(serializeScene(original, { shouldIndex: (m) => mayIndexForCache(url, m) }))));
    assert.deepStrictEqual(problems, [], `${url}: indexed geometry does not expand to the .dae geometry: ${problems.slice(0, 8).join(' | ')}`);
    // textured: the indexed rebuild gets the same materials as a plain clone of the .dae scene
    const a = original.clone(), b = rebuilt.clone();
    await quiet(applyTexturesToMeshGroup)(host, a, url, 1);
    await quiet(applyTexturesToMeshGroup)(host, b, url, 1);
    const after = compareScenes(a, expandIndexed(b));
    assert.deepStrictEqual(after, [], `${url}: textured indexed scene differs: ${after.slice(0, 8).join(' | ')}`);
    host.colladaCache.delete(url);
  }
  assert.ok(indexedMeshes > 0, 'some sample meshes are indexed');
  // a geometry that does not shrink is left alone; one with every vertex shared once collapses
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  assert.strictEqual(indexGeometryData(tri), null, 'no shared vertices: stays non-indexed');
  const quad = new THREE.BufferGeometry(); quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
  const q = indexGeometryData(quad);
  assert.ok(q && q.attributes.position.length === 12 && Array.from(q.index).join() === '0,1,2,0,2,3,0,1,2,0,2,3', 'shared vertices stored once, index keeps the original order');
  console.log(`  ✓ ${indexedMeshes} sample meshes stored indexed (${(bytesBefore / 1048576).toFixed(1)} -> ${(bytesAfter / 1048576).toFixed(1)} MB), ${keptMeshes} kept as they are; all expand to the .dae geometry and texture identically`);
}

// 4. Generated cache files and manifest, when present
const manifestPath = '.' + SCENE_CACHE_MANIFEST_PATH;
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.version, SCENE_CACHE_VERSION, 'manifest version matches the format');
  const stale = Object.entries(manifest.files).filter(([url, info]) => !fs.existsSync('.' + url) || fs.statSync('.' + url).size !== info.daeBytes || Math.round(fs.statSync('.' + url).mtimeMs) !== info.daeMtime || !fs.existsSync('.' + sceneCachePathFor(url)));
  assert.deepStrictEqual(stale.map(([u]) => u), [], 'manifest entries whose .dae changed or whose cache file is missing (rerun npm run generate:scene-cache)');
  let fromDisk = 0;
  host.colladaCache.clear(); // section 3's texturing changed the shared geometry of these cached scenes
  for (const url of urls) {
    if (!manifest.files[url]) continue;
    const file = fs.readFileSync('.' + sceneCachePathFor(url));
    const rebuilt = expandIndexed(deserializeScene(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)));
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

// 7. Decoding in a worker (SceneCacheDecoder), with fallback to this thread
{
  const { SceneCacheDecoder, decodeSceneBuffer, loadSceneCache } = await import('../packages/adapter-three/src/models/scene-cache.js');
  const url = urls[0];
  const cacheUrl = sceneCachePathFor(url);
  if (fs.existsSync('.' + cacheUrl)) {
    const file = fs.readFileSync('.' + cacheUrl);
    const expected = deserializeScene(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    // Stand-in for scene-cache-worker.js: same decode, answered asynchronously through onmessage
    class FakeWorker {
      constructor({ crashAfter = Infinity, fail = null } = {}) { this.received = []; this.crashAfter = crashAfter; this.fail = fail; this.terminated = false; }
      postMessage({ id, url: u }) {
        this.received.push(u);
        if (this.received.length > this.crashAfter) { setTimeout(() => this.onerror?.({ message: 'worker died' }), 0); return; }
        setTimeout(() => {
          if (this.fail) return this.onmessage({ data: { id, error: this.fail } });
          const f = fs.readFileSync('.' + u);
          this.onmessage({ data: { id, decoded: decodeSceneBuffer(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength)) } });
        }, 0);
      }
      terminate() { this.terminated = true; }
    }
    let created = 0, worker = null;
    const decoder = new SceneCacheDecoder(() => { created++; return (worker = new FakeWorker()); });
    assert.strictEqual(created, 0, 'worker is started on first use, not up front');
    const viaWorker = await loadSceneCache({ sceneCacheDecoder: decoder }, cacheUrl);
    assert.deepStrictEqual(compareScenes(expected, viaWorker), [], 'scene decoded in the worker is identical');
    assert.deepStrictEqual(worker.received, [cacheUrl], 'the worker fetched the file');
    await loadSceneCache({ sceneCacheDecoder: decoder }, cacheUrl);
    assert.strictEqual(created, 1, 'one worker serves every load');

    // Worker dies with requests in flight: they and later loads are decoded here
    let dying = null;
    const crashing = new SceneCacheDecoder(() => (dying = new FakeWorker({ crashAfter: 0 })));
    const crashHost = { sceneCacheDecoder: crashing };
    const [a, b] = await Promise.all([loadSceneCache(crashHost, cacheUrl), loadSceneCache(crashHost, cacheUrl)]);
    assert.deepStrictEqual(compareScenes(expected, a), [], 'in-flight load completed on this thread');
    assert.strictEqual(a, b, 'same URL shares one load per host');
    assert.ok(dying.terminated, 'failed worker terminated');
    const after = await loadSceneCache({ sceneCacheDecoder: crashing }, cacheUrl);
    assert.deepStrictEqual(compareScenes(expected, after), [], 'later loads decoded on this thread');
    assert.strictEqual(dying.received.length, 1, 'failed worker gets no further requests');

    // Worker cannot be created at all
    const noWorker = new SceneCacheDecoder(() => { throw new Error('blocked'); });
    assert.deepStrictEqual(compareScenes(expected, await loadSceneCache({ sceneCacheDecoder: noWorker }, cacheUrl)), [], 'no worker: decoded here');

    // An error reported by the worker (e.g. a missing file) reaches loadCachedScene, which falls back to the .dae
    const failing = new SceneCacheDecoder(() => new FakeWorker({ fail: 'HTTP 404 for x' }));
    const warned = [];
    const host2 = { sceneCacheDecoder: failing, sceneCacheManifest: Promise.resolve({ version: SCENE_CACHE_VERSION, files: { [url]: {} } }) };
    assert.strictEqual(await loadCachedScene(host2, url, (m, t) => warned.push(t)), null, 'worker error: null so the .dae is loaded');
    assert.deepStrictEqual(warned, ['warn'], 'worker error reported as a warning');
    console.log('  ✓ cache files decode in a worker; a failed or missing worker falls back to this thread');
  }
}

// 8. Corrupt or foreign files are rejected
assert.throws(() => deserializeScene(new TextEncoder().encode('<!doctype html>').buffer), /not a scene cache file/);
const wrongVersion = serializeScene(new THREE.Group());
new DataView(wrongVersion).setUint32(4, SCENE_CACHE_VERSION + 1, true);
assert.throws(() => deserializeScene(wrongVersion), /version/);
console.log('  ✓ rejects files that are not scene caches or have another format version');

console.log('\n[PASS] test_scene_cache');
