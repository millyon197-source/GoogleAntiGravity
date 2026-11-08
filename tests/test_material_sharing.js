/**
 * Identical materials are shared across a plan, effects and small parts cast no shadows, and a single
 * module's glow change still affects only that module (it gets its own copies first).
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}
const THREE = await import('three');
const { materialShareKey, shareModuleMaterials, ownModuleMaterials, castsShadow, isSharedMaterial } = await import('../packages/adapter-three/src/materials/material-sharing.js');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing material sharing and shadow casting...');

const texture = new THREE.Texture(); texture.name = 'hull_diff';
const otherTexture = new THREE.Texture(); otherTexture.name = 'hull_diff'; // same name, different texture
const tint = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'); };
const hull = (overrides = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: 0x8d99ae, map: texture, roughness: 0.6, metalness: 0.2, emissive: 0x112233, emissiveIntensity: 1, vertexColors: true, ...overrides });
  m.name = 'generic_p1_hulltexture';
  m.onBeforeCompile = (shader) => tint(shader); // a new closure per material, as the texturing code makes
  return m;
};
const box = (size = 100) => new THREE.BoxGeometry(size, size, size);

// 1. Share keys
{
  const plainMesh = new THREE.Mesh(box());
  assert.strictEqual(materialShareKey(hull(), plainMesh), materialShareKey(hull(), plainMesh), 'identical materials (separate hook closures with the same code) share a key');
  for (const [what, m] of [
    ['colour', hull({ color: 0xff0000 })],
    ['texture object', hull({ map: otherTexture })],
    ['transparency', hull({ transparent: true })],
    ['emissive intensity', hull({ emissiveIntensity: 2 })]
  ]) assert.notStrictEqual(materialShareKey(m, plainMesh), materialShareKey(hull(), plainMesh), `${what} differs`);
  const otherHook = hull(); otherHook.onBeforeCompile = (shader) => { shader.fragmentShader += '// other'; };
  assert.notStrictEqual(materialShareKey(otherHook, plainMesh), materialShareKey(hull(), plainMesh), 'different shader hook code differs');
  const withDefines = hull(); withDefines.defines = { USE_X: '' };
  assert.notStrictEqual(materialShareKey(withDefines, plainMesh), materialShareKey(hull(), plainMesh), 'defines differ');
  const scanlineMesh = new THREE.Mesh(box()); scanlineMesh.userData.scanlineVOffset = { value: 0 };
  assert.strictEqual(materialShareKey(hull(), scanlineMesh), null, 'a mesh with its own shader uniform keeps its material');
  const tagged = hull(); tagged.userData.note = 'x';
  assert.strictEqual(materialShareKey(tagged, plainMesh), null, 'materials carrying userData are not shared');
  console.log('  ✓ materials share a key only when everything that affects drawing is identical');
}

// 2. Sharing across modules, and copies for a single module
const moduleOf = (index) => {
  const root = new THREE.Group(); root.userData.index = index;
  const a = new THREE.Mesh(box(), hull()); a.name = 'hull';
  const b = new THREE.Mesh(box(), [hull(), hull({ transparent: true, opacity: 0.5 })]); b.name = 'multi';
  const sign = new THREE.Mesh(box(), hull()); sign.userData.scanlineVOffset = { value: 0 };
  root.add(a, b, sign);
  return root;
};
{
  const registry = new Map();
  const m1 = moduleOf(1), m2 = moduleOf(2);
  assert.strictEqual(shareModuleMaterials(m1, registry), 1, 'within a module: the duplicate in the multi-material mesh');
  assert.strictEqual(shareModuleMaterials(m2, registry), 3, 'second module: all three sharable materials reused');
  const hullA = m1.children[0].material, hullB = m2.children[0].material;
  assert.strictEqual(hullA, hullB, 'identical materials are the same object across modules');
  assert.strictEqual(m1.children[1].material[0], hullA, 'arrays of materials are shared element by element');
  assert.notStrictEqual(m1.children[1].material[1], hullA, 'a different material stays different');
  assert.notStrictEqual(m1.children[2].material, m2.children[2].material, 'the scanline sign keeps its own material');
  assert.ok(isSharedMaterial(hullA));

  // a single module gets its own copies before a change
  assert.strictEqual(ownModuleMaterials(m1), 2, 'one copy per shared material');
  const own = m1.children[0].material;
  assert.notStrictEqual(own, hullA);
  assert.strictEqual(m1.children[1].material[0], own, "the module's meshes share its copy");
  assert.strictEqual(own.onBeforeCompile, hullA.onBeforeCompile, 'the copy keeps the shader hook');
  assert.strictEqual(own.map, hullA.map);
  assert.strictEqual(ownModuleMaterials(m1), 0, 'already owned: no further copies');
  assert.strictEqual(m2.children[0].material, hullA, 'other modules keep the shared material');
  console.log('  ✓ identical materials shared across modules; a module can take its own copies');
}

// 3. Shadow casting
{
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), hull())), true, 'large opaque part casts');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), hull({ transparent: true }))), false, 'transparent effect casts none');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), hull({ blending: THREE.AdditiveBlending }))), false, 'additive glow casts none');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), hull({ depthWrite: false }))), false, 'decal (no depth write) casts none');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), hull({ visible: false }))), false, 'hidden material casts none');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(5), hull())), false, 'part under 15 m casts none');
  const scaled = new THREE.Mesh(box(5), hull()); scaled.scale.setScalar(10); scaled.updateMatrixWorld();
  assert.strictEqual(castsShadow(scaled), true, 'size is measured in world units');
  assert.strictEqual(castsShadow(new THREE.Mesh(box(100), [hull({ transparent: true }), hull()])), true, 'a mesh with any opaque material casts');
  console.log('  ✓ effects and parts under 15 m cast no shadows');
}

// 4. Viewer: per-module glow changes only that module; a plan load shares materials and sets shadows
{
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  const registry = new Map();
  const a = moduleOf(1), b = moduleOf(2);
  shareModuleMaterials(a, registry); shareModuleMaterials(b, registry);
  v.modulesGroup.add(a, b);
  v.setEmissiveIntensity(4, 2);
  assert.strictEqual(b.children[0].material.emissiveIntensity, 4, 'selected module glows brighter');
  assert.strictEqual(a.children[0].material.emissiveIntensity, 1, 'the other module is unchanged');
  v.setEmissiveIntensity(3);
  assert.ok(a.children[0].material.emissiveIntensity === 3 && b.children[0].material.emissiveIntensity === 3, 'the global setting reaches every module');
  console.log("  ✓ a single module's glow change leaves the other modules alone");

  const w = Object.create(StationViewer.prototype);
  w.scene = new THREE.Scene(); w.camera = new THREE.PerspectiveCamera();
  w.modulesGroup = new THREE.Group(); w.scene.add(w.modulesGroup);
  w.hiddenMacros = new Set();
  for (const name of ['deselect', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) w[name] = () => {};
  w.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  w.loadModuleMesh = async (mod) => {
    const root = new THREE.Group();
    const big = new THREE.Mesh(box(200), hull()); big.name = 'big';
    const glow = new THREE.Mesh(box(200), hull({ blending: THREE.AdditiveBlending })); glow.name = 'glow';
    const tiny = new THREE.Mesh(box(4), hull()); tiny.name = 'tiny';
    root.add(big, glow, tiny);
    return root;
  };
  const plan = { modules: [1, 2, 3].map(index => ({ index, macro: 'struct_arg_cross_01_macro', position: { x: index * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  await w.loadStationPlan(plan);
  const mats = new Set(); w.modulesGroup.traverse(o => { if (o.isMesh) mats.add(o.material); });
  assert.strictEqual(mats.size, 2, 'three modules x three meshes share two materials');
  const byName = (n) => { const out = []; w.modulesGroup.traverse(o => { if (o.name === n) out.push(o); }); return out; };
  assert.ok(byName('big').every(m => m.castShadow && m.receiveShadow), 'large parts cast and receive');
  assert.ok(byName('glow').every(m => !m.castShadow && m.receiveShadow), 'glows cast none');
  assert.ok(byName('tiny').every(m => !m.castShadow && m.receiveShadow), 'tiny parts cast none');
  console.log('  ✓ a plan load shares materials across modules and sets shadow casting per mesh');
}

console.log('\n[PASS] test_material_sharing');
