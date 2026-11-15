/**
 * Opening a plan while another is still loading (e.g. a blueprint picked while the startup plan
 * loads): the older load stops and discards what it built, so the scene holds only the newer plan's
 * modules and animations.
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
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing a newer plan load supersedes an older one...');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeViewer() {
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group();
  v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  v.animatedParts = [];
  v.animatedTextures = [];
  for (const name of ['clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.clear = function () {
    while (this.modulesGroup.children.length) this.modulesGroup.remove(this.modulesGroup.children[0]);
    this.animatedParts = [];
    this.animatedTextures = [];
  };
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  // Each module mesh registers a part animation and an animated texture, as real loads do
  v.loadModuleMesh = async (mod) => {
    await sleep(mod.delay);
    const g = new THREE.Group();
    g.name = `${mod.plan}_${mod.index}`;
    const tex = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: tex }));
    g.add(mesh);
    v.animatedParts.push({ object: mesh, moduleIndex: mod.index, update: () => {} });
    v.animatedTextures.push({ texture: tex, moduleIndex: mod.index });
    return g;
  };
  return v;
}

const planOf = (name, delays) => ({
  name,
  modules: delays.map((delay, i) => ({
    plan: name, delay, index: i + 1, macro: 'struct_arg_cross_01_macro',
    position: { x: i * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 }
  }))
});

// 1. Second plan opened while the first is half loaded
{
  const v = makeViewer();
  const first = planOf('docks', [30, 30, 30, 30, 30, 30]);
  const second = planOf('various', [5, 5, 5, 5, 5]);
  const firstLoad = v.loadStationPlan(first);
  await sleep(45); // the first plan has placed a module or so and has more loading ahead
  const secondLoad = v.loadStationPlan(second);
  const [firstResult] = await Promise.all([firstLoad, secondLoad]);
  await sleep(250); // let the abandoned look-ahead loads finish and be discarded

  assert.deepStrictEqual(firstResult, { superseded: true }, 'the older load reports it was superseded');
  assert.deepStrictEqual(v.modulesGroup.children.map(c => c.userData.macro && c.name), ['various_1', 'various_2', 'various_3', 'various_4', 'various_5'],
    'only the newer plan\'s modules are in the scene');
  assert.strictEqual(v.animatedParts.length, 5, 'no part animations left from the older plan');
  assert.ok(v.animatedParts.every(p => p.object.parent && p.object.parent.name.startsWith('various_')), 'animations belong to the newer plan');
  assert.strictEqual(v.animatedTextures.length, 5, 'no texture animations left from the older plan');
  assert.strictEqual(v.planLoading, false, 'loading state is cleared once the newer load ends');
  console.log('  ✓ older load stops, discards its modules and animations; scene holds only the newer plan');
}

// 2. The older load finishes its current module after the newer load has completed
{
  const v = makeViewer();
  const slow = planOf('slow', [120]);
  const fast = planOf('fast', [5, 5]);
  const slowLoad = v.loadStationPlan(slow);
  await sleep(10);
  await v.loadStationPlan(fast);
  assert.strictEqual(v.planLoading, false);
  assert.deepStrictEqual(await slowLoad, { superseded: true });
  assert.deepStrictEqual(v.modulesGroup.children.map(c => c.name), ['fast_1', 'fast_2'], 'a late module of the older plan is not added');
  assert.strictEqual(v.planLoading, false, 'the older load does not touch the loading state');
  console.log('  ✓ a module the older load finishes late is discarded, not placed');
}

// 3. A single load is unaffected
{
  const v = makeViewer();
  await v.loadStationPlan(planOf('solo', [5, 1, 3]));
  assert.deepStrictEqual(v.modulesGroup.children.map(c => c.name), ['solo_1', 'solo_2', 'solo_3']);
  assert.strictEqual(v.animatedParts.length, 3);
  console.log('  ✓ a lone load places every module');
}

console.log('\n[SUCCESS] Newer plan loads supersede older ones cleanly');
