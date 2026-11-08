/**
 * 1. The " (Procedural)" label a placeholder module type gets is reset when the next plan load
 *    starts (it used to stick for the whole session after one failed load).
 * 2. Billboard background panels are built only from quads that exist: struct_arg_base_03's
 *    anim_cross has 14 quads, and reading quads up to 21 filled bg_info/bg_food/bg_tools with NaN.
 */
import assert from 'node:assert';
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
const { StationViewer, labelModuleAsProcedural, resetProceduralLabels } = await import('../src/viewer.js');
const { MACRO_TO_NAME_DB } = await import('../packages/catalog/src/index.js');

console.log('[*] Testing placeholder labels and billboard background panels...');

// 1. Labels
const named = 'pier_arg_harbor_03_macro';
const original = MACRO_TO_NAME_DB[named];
labelModuleAsProcedural(named, 'fallback');
labelModuleAsProcedural(named, 'fallback'); // marking twice in one load must not double the suffix
assert.strictEqual(MACRO_TO_NAME_DB[named], `${original} (Procedural)`);
labelModuleAsProcedural('zz_unknown_module_macro', 'Unknown Module');
assert.strictEqual(MACRO_TO_NAME_DB.zz_unknown_module_macro, 'Unknown Module (Procedural)');
resetProceduralLabels();
assert.strictEqual(MACRO_TO_NAME_DB[named], original, 'name restored when the next load starts');
assert.ok(!('zz_unknown_module_macro' in MACRO_TO_NAME_DB), 'names that did not exist are removed again');
console.log('  ✓ " (Procedural)" labels are restored when a new plan load starts');

// 2. Background panels (same viewer setup as test_struct_arg_cross_01_billboards)
const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.colladaCache = new Map();
viewer.modulesGroup = new THREE.Group();
viewer.scene = new THREE.Scene();
viewer.renderScene = () => {};
const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
viewer.colladaLoader = new ColladaLoader();
const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

for (const [module, expectPanels] of [['struct_arg_base_03', ['bg_cross', 'bg_info']], ['struct_arg_cross_01', ['bg_cross', 'bg_info', 'bg_food', 'bg_tools']]]) {
  const url = `/assets1/structures/connectionmodules/${module}_data/anim_cross-lod0.dae`;
  const scene = (await viewer.loadColladaModel(url)).clone();
  await viewer.applyTexturesToMeshGroup(scene, url, 1);
  let crossMesh = null;
  scene.traverse(o => { if (o.isMesh && o.userData?.isolatedBackgrounds) crossMesh = o; });
  assert.ok(crossMesh, `${module}: background panels were built`);
  const panels = crossMesh.userData.isolatedBackgrounds;
  assert.deepStrictEqual(Object.keys(panels).sort(), [...expectPanels].sort(), `${module}: panels built from existing quads only`);
  for (const [name, mesh] of Object.entries(panels)) {
    const a = mesh.geometry.attributes.position.array;
    assert.ok(a.length > 0 && a.every(Number.isFinite), `${module} ${name}: every vertex is a real number`);
    mesh.geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius), `${module} ${name}: bounding sphere is valid`);
  }
  console.log(`  ✓ ${module}: panels ${Object.keys(panels).join(', ')} with valid geometry`);
}

console.log('\n[PASS] test_procedural_labels_and_bg_panels');
