/**
 * Discarded modules release the geometry made for them. three keeps every drawn geometry's attributes
 * and GPU buffers in its vertex-array cache until geometry.dispose(), so per-module geometry (the sign
 * and background panels built while texturing) piled up with every plan load. Geometry shared with
 * cached part templates stays, so reloading a plan does not upload it again.
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
const { cloneSharingRawUvs, disposeModuleGeometry } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing geometry release for discarded modules...');

const disposals = new Map();
const tracked = (name) => {
  const g = new THREE.BufferGeometry();
  g.name = name;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.addEventListener('dispose', () => disposals.set(name, (disposals.get(name) || 0) + 1));
  return g;
};
const mesh = (g) => new THREE.Mesh(g, new THREE.MeshStandardMaterial());

function buildModule() {
  const template = new THREE.Group();
  template.add(mesh(tracked('template')));
  const part = cloneSharingRawUvs(template); // shares the template geometry
  const panelGeometry = tracked('panel');
  part.add(mesh(panelGeometry));
  part.add(mesh(panelGeometry)); // same geometry on two meshes
  const signMesh = mesh(tracked('sign_in_userData'));
  const stateA = mesh(tracked('sign_state_a'));
  part.children[0].userData.isolatedBillboards = { billboard_cross: signMesh, physicalSigns: [{ name: 'Sign 1', stateA }] };
  part.children[0].userData.isolatedBillboards.physicalSigns[0].owner = part.children[0].userData.isolatedBillboards; // a cycle
  const root = new THREE.Group();
  const meshGroup = new THREE.Group(); meshGroup.name = 'module_mesh_group';
  meshGroup.add(part);
  root.add(meshGroup);
  return root;
}

// 1. disposeModuleGeometry
{
  disposals.clear();
  const count = disposeModuleGeometry(buildModule());
  assert.strictEqual(count, 3, 'three geometries made for the module');
  assert.deepStrictEqual(Object.fromEntries(disposals), { panel: 1, sign_in_userData: 1, sign_state_a: 1 }, 'each disposed once, template geometry kept');
  console.log('  ✓ disposeModuleGeometry: module geometry (also meshes kept in userData) disposed once each; template geometry kept');
}

// 2. Replacing a plan disposes the previous modules' geometry
{
  disposals.clear();
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  v.deselect = () => {};
  v.clearFilterHighlights = () => {};
  v.modulesGroup.add(buildModule());
  v.modulesGroup.add(buildModule());
  v.clear();
  assert.strictEqual(v.modulesGroup.children.length, 0, 'modules removed');
  assert.deepStrictEqual(Object.fromEntries(disposals), { panel: 2, sign_in_userData: 2, sign_state_a: 2 }, 'their own geometry released, templates kept');
  console.log('  ✓ clear(): the replaced plan releases its modules\' geometry');
}

// 3. releaseUnusedTemplates: cached templates the current plan does not use are dropped and released
const { releaseUnusedTemplates } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
const templateOf = (name) => { const t = new THREE.Group(); t.add(mesh(tracked(name))); t.add(mesh(tracked(name + '_2'))); return t; };
{
  disposals.clear();
  const used = templateOf('used'), unused = templateOf('unused'), unusedScene = templateOf('unused_scene');
  const failed = Promise.reject(new Error('404')); failed.catch(() => {});
  const host = {
    colladaCache: new Map([['/a.dae', Promise.resolve(used)], ['/b.bin', Promise.resolve(unused)], ['/c.dae', failed]]),
    sceneCacheCache: new Map([['/d.x4scene', Promise.resolve(unusedScene)]])
  };
  const released = await releaseUnusedTemplates(host, new Set([used]));
  assert.strictEqual(released, 2);
  assert.deepStrictEqual([...host.colladaCache.keys()], ['/a.dae', '/c.dae'], 'used template kept (failed entries are left to their own cleanup)');
  assert.deepStrictEqual([...host.sceneCacheCache.keys()], [], 'unused scene cache template dropped');
  assert.deepStrictEqual(Object.fromEntries(disposals), { unused: 1, unused_2: 1, unused_scene: 1, unused_scene_2: 1 }, 'released templates disposed, used one untouched');
  assert.strictEqual(await releaseUnusedTemplates({}, new Set()), 0, 'a host without caches is fine');
  console.log('  ✓ releaseUnusedTemplates: unused templates dropped from both caches and disposed; used ones kept');
}

// 4. A plan load records the templates it uses and releases the rest afterwards; a failed load releases nothing
{
  disposals.clear();
  const oldTemplate = templateOf('old_plan_part');
  const newTemplate = templateOf('new_plan_part');
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group();
  v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['deselect', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  v.animatedParts = [];
  v.colladaCache = new Map([['/old.dae', Promise.resolve(oldTemplate)]]);
  v.sceneCacheCache = new Map([['/new.x4scene', Promise.resolve(newTemplate)]]);
  // the real loadModuleMesh, with a host whose only part comes from the scene cache
  v.resolveModuleAssetEntry = () => ({ baseName: 'm', folderPath: '/x', defaultFiles: ['part_main-lod0.dae'] });
  v.getModuleActiveComponentFiles = () => ['part_main-lod0.dae'];
  v.loadCachedScene = () => v.sceneCacheCache.get('/new.x4scene');
  v.applyTexturesToMeshGroup = async () => {};
  const plan = { modules: [1, 2].map(index => ({ index, macro: 'struct_arg_cross_01_macro', position: { x: index * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  await v.loadStationPlan(plan);
  assert.ok(v.templatesInUse.has(newTemplate), 'the template the modules were cloned from is recorded');
  assert.deepStrictEqual([...v.colladaCache.keys()], [], "the previous plan's template is released");
  assert.deepStrictEqual([...v.sceneCacheCache.keys()], ['/new.x4scene'], 'the template in use stays cached');
  assert.deepStrictEqual(Object.fromEntries(disposals), { old_plan_part: 1, old_plan_part_2: 1 }, 'only the old template disposed');

  // failed load: nothing released
  disposals.clear();
  v.colladaCache.set('/other.dae', Promise.resolve(templateOf('other')));
  v.loadModuleMesh = async () => { throw new Error('boom'); };
  await assert.rejects(v.loadStationPlan(plan), /boom/);
  assert.ok(v.colladaCache.has('/other.dae') && v.sceneCacheCache.has('/new.x4scene'), 'a failed load releases no templates');
  assert.ok(!('other' in Object.fromEntries(disposals)), 'nothing disposed after a failed load');
  console.log("  ✓ loadStationPlan: templates in use recorded, the previous plan's templates released; nothing released when a load fails");
}

console.log('\n[PASS] test_module_geometry_dispose');
