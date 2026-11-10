/**
 * Verifies the model/texture loaders extracted into @x4/adapter-three work against a
 * plain host object (not a StationViewer), honour their caches, and that StationViewer
 * delegates to them.
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };

const THREE = await import('three');
const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js');
const {
  loadDdsTexture, loadBinaryModel, loadColladaModel, getRaceGlowColor, getRaceHullColor, applyTexturesToMeshGroup, loadModuleMesh
} = await import('@x4/adapter-three');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing @x4/adapter-three model loaders...');

// ---------------------------------------------------------------- loadDdsTexture
{
  const calls = [];
  const validTex = () => {
    const t = new THREE.Texture();
    t.format = THREE.RGBAFormat; t.image = { width: 4, height: 4 }; t.mipmaps = [{}];
    return t;
  };
  const host = {
    textureCache: new Map(),
    ddsLoader: {
      load(url, onLoad, _p, onError) {
        calls.push(url);
        setTimeout(() => {
          if (url.includes('broken')) onError(new Error('nope'));
          else if (url.includes('empty')) onLoad(new THREE.Texture());
          else onLoad(validTex());
        }, 0);
      }
    }
  };
  const [t1, t2] = await Promise.all([loadDdsTexture(host, 'a_diff.dds'), loadDdsTexture(host, 'a_diff.dds')]);
  assert.ok(t1 && t1 === t2, 'concurrent loads share one texture');
  assert.strictEqual(calls.filter(u => u === 'a_diff.dds').length, 1, 'DDS loader invoked once per URL');
  assert.strictEqual(t1.wrapS, THREE.RepeatWrapping);
  assert.strictEqual(await loadDdsTexture(host, 'a_diff.dds'), t1, 'cached texture returned');

  const alpha = await loadDdsTexture(host, 'x_alphatexture.dds');
  assert.deepStrictEqual([alpha.repeat.y, alpha.offset.y], [-1, 1], 'alphatexture flipped vertically');
  const decal = await loadDdsTexture(host, 'paint_p1_decal_01_diff.dds');
  assert.deepStrictEqual([decal.repeat.y, decal.offset.y], [-1, 1], 'decal flipped vertically');
  assert.strictEqual(await loadDdsTexture(host, 'broken.dds'), null, 'load error resolves null');
  assert.strictEqual(await loadDdsTexture(host, 'empty.dds'), null, 'invalid texture resolves null');
  assert.strictEqual(await loadDdsTexture(host, ''), null, 'empty url resolves null');
  console.log('  ✓ loadDdsTexture: per-URL caching, wrapping, alpha flip, null on failure');
}

// ---------------------------------------------------------------- loadBinaryModel
function binaryHost() {
  let meshLoads = 0;
  return {
    colladaCache: new Map(),
    glowingEmissiveIntensity: 2.2,
    animatedTextures: [],
    meshLoader: { loadMesh: async () => { meshLoads++; return {
      vertexBuffer: new Float32Array([0,0,0, 0,1,0, 0,0,  1,0,0, 0,1,0, 1,0,  0,0,1, 0,1,0, 0,1]),
      indexBuffer: new Uint32Array([0, 1, 2]),
      metadata: { boundingBox: { min: [0, 0, 0], max: [1, 1, 1] } } }; } },
    loadDdsTexture: async (url) => (url ? new THREE.Texture() : null),
    meshLoads: () => meshLoads
  };
}
{
  const host = binaryHost();
  const url = '/assets1/structures/dock/dockarea_arg_m_01_data/part_main-lod0.bin';
  const p1 = loadBinaryModel(host, url, url.replace('.bin', '.json'));
  assert.strictEqual(loadBinaryModel(host, url, 'x'), p1, 'same promise returned from cache');
  const group = await p1;
  assert.ok(group.isGroup, 'returns a THREE.Group');
  const mesh = group.children.find(c => c.isMesh);
  assert.ok(mesh && mesh.material.isMeshStandardMaterial, 'contains a standard-material mesh');
  assert.strictEqual(mesh.geometry.index.count, 3);
  assert.deepStrictEqual(mesh.geometry.boundingBox.max.toArray(), [1, 1, 1], 'bounding box taken from metadata');
  assert.strictEqual(host.meshLoads(), 1, 'worker mesh loaded once');
  console.log('  ✓ loadBinaryModel: builds mesh from worker buffers and caches per URL');

  // Escalator: registers UV-scroll textures on the host's animatedTextures array
  const h2 = binaryHost();
  const live = h2.animatedTextures;
  await loadBinaryModel(h2, '/assets1/structures/dock/dockarea_arg_m_01_data/anim_escalator-lod0.bin', 'j');
  assert.ok(live.length > 0 && live.every(a => a.speedY === 0.8), 'escalator textures scroll at 0.8 on V');

  // fx_glow: hidden mesh plus a point light coloured by faction
  const h3 = binaryHost();
  const glowUrl = '/assets1/structures/dock/dockarea_tel_m_01_data/fx_glow-lod0.bin';
  const g3 = await loadBinaryModel(h3, glowUrl, 'j');
  const light = g3.children.find(c => c.isPointLight);
  assert.ok(light, 'fx_glow adds a point light to the group');
  assert.strictEqual(light.color.getHex(), getRaceGlowColor(glowUrl).getHex(), 'light uses faction glow colour');
  assert.strictEqual(g3.children.find(c => c.isMesh).visible, false, 'fx_glow mesh hidden');
  console.log('  ✓ loadBinaryModel: animated-texture registration and fx_glow lighting via host');
}

// ---------------------------------------------------------------- loadColladaModel
{
  let renders = 0;
  const host = { colladaCache: new Map(), colladaLoader: new ColladaLoader(), renderScene: () => { renders++; } };
  const url = '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae';
  const p = loadColladaModel(host, url);
  assert.strictEqual(loadColladaModel(host, url), p, 'same promise returned from cache');
  const scene = await p;
  let signMesh = null;
  scene.traverse(o => { if (o.isMesh && o.userData.billboardStateBUvs) signMesh = o; });
  assert.ok(signMesh, 'connection-cross billboard mesh gets A/B UV states');
  assert.ok(signMesh.userData.rawUvs && signMesh.userData.rawUvs.tex0, 'raw UV channels captured');
  assert.strictEqual(signMesh.userData.currentBillboardState, 'A');
  scene.userData.setBillboardState('B');
  assert.strictEqual(signMesh.userData.currentBillboardState, 'B', 'scene-level state switch reaches meshes');
  assert.deepStrictEqual(Array.from(signMesh.geometry.attributes.uv.array), Array.from(signMesh.userData.billboardStateBUvs));
  assert.ok(renders > 0, 'host.renderScene called after billboard switch');
  console.log('  ✓ loadColladaModel: caching, raw UV capture, billboard A/B switching via host');
}

// ---------------------------------------------------------------- applyTexturesToMeshGroup
{
  const texLoads = [];
  const host = {
    colladaCache: new Map(), colladaLoader: new ColladaLoader(), renderScene() {},
    glowingEmissiveIntensity: 2.2, animatedTextures: [], animatedParts: [],
    loadDdsTexture: async (u) => { if (!u) return null; texLoads.push(u); const t = new THREE.Texture(); t.name = u; return t; }
  };
  const url = '/assets1/structures/buildmodule/buildmodule_gen_equip_m_dockarea_01_data/anim_forcefieldfx-lod0.dae';
  const scene = await loadColladaModel(host, url);
  await applyTexturesToMeshGroup(host, scene, url, 3);
  let mesh = null, light = null;
  scene.traverse(o => { if (o.isMesh) mesh = o; if (o.isPointLight) light = o; });
  const m = mesh.material;
  assert.ok(m.isMeshStandardMaterial, 'material replaced with MeshStandardMaterial');
  assert.ok(texLoads.length > 0, 'textures requested through host.loadDdsTexture');
  assert.ok(m.emissiveMap && m.emissiveMap.name.endsWith('p1_gate_haze_02_diff.dds'), 'forcefield gets haze emissive map');
  assert.strictEqual(m.blending, THREE.AdditiveBlending, 'forcefield blends additively');
  assert.ok(m.transparent && !m.depthWrite && !mesh.castShadow, 'forcefield is transparent, no depth write, no shadow');
  assert.ok(light, 'forcefield adds a point light');
  assert.deepStrictEqual(host.animatedTextures.map(a => [a.speedX, a.speedY]), [[0.04, 0.015]], 'forcefield UV scroll registered on host');
  console.log('  ✓ applyTexturesToMeshGroup: forcefield materials, light and UV scroll via plain host');
}

// ---------------------------------------------------------------- loadModuleMesh
{
  const calls = { bin: [], dae: [], apply: [], log: [] };
  const fakeScene = (name) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); m.name = name; g.add(m); return g; };
  const host = {
    glowingEmissiveIntensity: 2.2, animatedParts: [],
    resolveModuleAssetEntry: (macro) => (macro === 'test_mod_macro'
      ? { baseName: 'test_mod', folderPath: '/x/test_mod_data', defaultFiles: ['part_main-lod0.dae', 'anim_door-lod0.dae'] }
      : { baseName: 'none', folderPath: null, defaultFiles: [] }),
    getModuleActiveComponentFiles: (index, macro) => host.resolveModuleAssetEntry(macro).defaultFiles,
    loadBinaryModel: async (binUrl) => { calls.bin.push(binUrl); return fakeScene('bin_part'); },
    loadColladaModel: async (url) => { calls.dae.push(url); return fakeScene('dae_part'); },
    applyTexturesToMeshGroup: async (group, url, idx) => { calls.apply.push([url.split('/').pop(), idx]); }
  };
  const options = { componentOffsets: { test_mod: { anim_door: [1, 2, 3] } }, log: (msg) => calls.log.push(msg) };
  const root = await loadModuleMesh(host, { macro: 'test_mod_macro', index: 4 }, options);
  assert.ok(root && root.isGroup, 'returns a module root group');
  assert.ok(root.getObjectByName('module_mesh_group'), 'root contains module_mesh_group');
  assert.deepStrictEqual(calls.bin, ['/x/test_mod_data/part_main-lod0.bin'], 'plain hull part uses the binary fast path');
  assert.deepStrictEqual(calls.dae, ['/x/test_mod_data/anim_door-lod0.dae'], 'anim_* part is routed to the Collada loader');
  assert.deepStrictEqual(calls.log, [], 'parts that always come from the .dae are not reported as fallbacks');
  assert.deepStrictEqual(calls.apply.map(c => c[1]), [4, 4], 'materials applied per component with the module index');
  let door = null; root.traverse(o => { if (o.name === 'dae_part') door = o; });
  assert.ok(door, 'Collada component present in the assembled module');
  assert.ok(door.parent.position.equals(new THREE.Vector3(1, 2, 3)), 'componentOffsets applied to the component');
  assert.strictEqual(await loadModuleMesh(host, { macro: 'unknown_macro', index: 0 }), null, 'module without assets returns null (default options)');
  // Scene cache: listed .dae parts come from host.loadCachedScene, others still from ColladaLoader
  calls.dae.length = 0; calls.bin.length = 0;
  host.getModuleActiveComponentFiles = () => ['part_main-lod0.dae', 'fx_glow-lod0.dae', 'anim_door-lod0.dae'];
  const cached = [];
  host.loadCachedScene = async (url) => { cached.push(url); return url.includes('fx_glow') ? fakeScene('cached_part') : null; };
  const withCache = await loadModuleMesh(host, { macro: 'test_mod_macro', index: 5 }, options);
  assert.deepStrictEqual(cached, ['/x/test_mod_data/part_main-lod0.dae', '/x/test_mod_data/fx_glow-lod0.dae', '/x/test_mod_data/anim_door-lod0.dae'], 'the cache is consulted for every part first');
  assert.deepStrictEqual(calls.bin, ['/x/test_mod_data/part_main-lod0.bin'], 'a part the cache does not list still uses its .bin');
  assert.deepStrictEqual(calls.dae, ['/x/test_mod_data/anim_door-lod0.dae'], 'a cached part skips ColladaLoader; an uncached one still uses it');
  assert.ok(withCache.getObjectByName('cached_part'), 'cached scene is part of the module');
  // Placed parts share the template's raw UV arrays (no per-mesh JSON copy)
  const rawUvs = { tex0: new Float32Array([0.25, 0.5, 0.75, 1]) };
  const rawTemplate = fakeScene('raw_part');
  rawTemplate.children[0].userData.rawUvs = rawUvs;
  host.loadCachedScene = async (url) => (url.includes('fx_glow') ? rawTemplate : null);
  const withRaw = await loadModuleMesh(host, { macro: 'test_mod_macro', index: 8 }, options);
  const placed = withRaw.getObjectByName('raw_part');
  assert.ok(placed && placed !== rawTemplate.children[0], 'part placed as a clone');
  assert.strictEqual(placed.userData.rawUvs, undefined, 'raw UVs are dropped for parts that never use them');
  assert.strictEqual(rawTemplate.children[0].userData.rawUvs, undefined, '...from the cached template too');
  // cross module parts keep them, shared between the template and its clones
  const crossTemplate = fakeScene('cross_part');
  crossTemplate.children[0].userData.rawUvs = rawUvs;
  const resolveBefore = host.resolveModuleAssetEntry;
  host.resolveModuleAssetEntry = () => ({ baseName: 'struct_arg_cross_01', folderPath: '/x/connectionmodules/struct_arg_cross_01_data', defaultFiles: ['fx_glow-lod0.dae'] });
  host.getModuleActiveComponentFiles = () => ['fx_glow-lod0.dae'];
  host.loadCachedScene = async () => crossTemplate;
  const cross = await loadModuleMesh(host, { macro: 'struct_arg_cross_01_macro', index: 9 }, options);
  assert.strictEqual(cross.getObjectByName('cross_part').userData.rawUvs, rawUvs, 'cross parts share the template raw UVs');
  assert.strictEqual(crossTemplate.children[0].userData.rawUvs, rawUvs, 'and the template keeps them');
  host.resolveModuleAssetEntry = resolveBefore;
  host.getModuleActiveComponentFiles = () => ['part_main-lod0.dae', 'fx_glow-lod0.dae', 'anim_door-lod0.dae'];
  // A part without a .bin that the cache lists: no .bin request and no warning
  calls.bin.length = 0; calls.dae.length = 0;
  host.loadCachedScene = async (url) => (url.includes('part_main') ? fakeScene('cached_main') : null);
  const quietLog = [];
  const noBin = await loadModuleMesh(host, { macro: 'test_mod_macro', index: 7 }, { log: (msg, type) => quietLog.push([msg, type]) });
  assert.deepStrictEqual(calls.bin, [], 'cached part with no .bin: the .bin is not requested');
  assert.ok(noBin.getObjectByName('cached_main'), 'cached part used');
  assert.ok(!quietLog.some(([, t]) => t === 'warn'), 'no fallback warning for a cached part');
  // A missing .bin with no cache entry is a real fallback and is reported as a warning
  host.loadCachedScene = async () => null;
  host.loadBinaryModel = async () => { throw new Error('HTTP 404'); };
  calls.dae.length = 0;
  const logged = [];
  await loadModuleMesh(host, { macro: 'test_mod_macro', index: 6 }, { log: (msg, type) => logged.push([msg, type]) });
  assert.ok(calls.dae.includes('/x/test_mod_data/part_main-lod0.dae'), 'part_main falls back to its .dae');
  assert.ok(logged.some(([m, t]) => t === 'warn' && m.includes('part_main-lod0.dae') && m.includes('HTTP 404')), 'missing .bin reported as a warning');
  console.log('  ✓ loadModuleMesh: binary/Collada/scene-cache routing, offsets, logging and material application via plain host');
}

// ---------------------------------------------------------------- viewer delegates
{
  const v = Object.create(StationViewer.prototype);
  for (const s of ['', 'teladi', 'paranid', 'boron', 'terran', 'split', '/structures/dock/dockarea_arg_m_01_data/x.dae']) {
    assert.strictEqual(v.getRaceGlowColor(s).getHex(), getRaceGlowColor(s).getHex(), `glow delegate ${s}`);
    assert.strictEqual(v.getRaceHullColor(s).getHex(), getRaceHullColor(s).getHex(), `hull delegate ${s}`);
  }
  // Viewer-level overrides (as used by many tests) still take effect through the host argument
  Object.assign(v, binaryHost());
  let overridden = 0;
  v.loadDdsTexture = async () => { overridden++; return new THREE.Texture(); };
  await v.loadBinaryModel('/assets1/structures/dock/dockarea_arg_m_01_data/part_main-lod0.bin', 'j');
  assert.ok(overridden > 0, 'viewer.loadDdsTexture override used by loadBinaryModel');
  console.log('  ✓ StationViewer delegates to package loaders and keeps instance overrides');
}

console.log('\n[PASS] test_model_loaders');
