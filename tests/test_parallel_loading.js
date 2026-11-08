/**
 * Loading overlaps instead of running strictly one step at a time:
 * - loadModuleMesh loads a module's parts concurrently, but assembles them and registers their
 *   animations in file order whatever order they finish in; a failing part is skipped as before;
 * - loadStationPlan keeps up to four modules loading at once while placing them in plan order.
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
const { loadModuleMesh } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing parallel loading...');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1. Parts of one module
{
  const files = ['part_main-lod0.dae', 'anim_vent-lod0.dae', 'fx_glow-lod0.dae', 'anim_arm-lod0.dae', 'broken-lod0.dae'];
  const delays = { part_main: 40, anim_vent: 30, fx_glow: 5, anim_arm: 15, broken: 1 };
  let inFlight = 0, maxInFlight = 0;
  const finished = [];
  const fakeScene = (name) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); m.name = name; g.add(m); return g; };
  const host = {
    glowingEmissiveIntensity: 2.2, animatedParts: [],
    resolveModuleAssetEntry: () => ({ baseName: 'test_mod', folderPath: '/x/test_mod_data', defaultFiles: files }),
    getModuleActiveComponentFiles: () => files,
    loadCachedScene: async (url) => {
      const part = url.split('/').pop().replace('-lod0.dae', '');
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(delays[part]);
      inFlight--; finished.push(part);
      if (part === 'broken') throw new Error('corrupt');
      return fakeScene(part);
    },
    loadColladaModel: async () => { throw new Error('not expected'); },
    loadBinaryModel: async () => { throw new Error('not expected'); },
    applyTexturesToMeshGroup: async () => {}
  };
  const logged = [];
  const root = await loadModuleMesh(host, { macro: 'test_mod_macro', index: 3 }, { log: (m, t) => logged.push([m, t]) });
  assert.ok(maxInFlight >= 4, `parts load concurrently (max ${maxInFlight} at once)`);
  assert.notDeepStrictEqual(finished, ['part_main', 'anim_vent', 'fx_glow', 'anim_arm', 'broken'], 'parts finished out of order in this setup');
  const group = root.getObjectByName('module_mesh_group');
  assert.deepStrictEqual(group.children.map(c => c.name), ['part_main', 'anim_vent', 'fx_glow', 'anim_arm'], 'parts assembled in file order');
  assert.deepStrictEqual(host.animatedParts.map(a => a.object.name), ['anim_vent', 'anim_arm'], 'animations registered in file order');
  assert.ok(logged.some(([m, t]) => t === 'warn' && m.includes('broken-lod0.dae') && m.includes('corrupt')), 'a failing part is reported and skipped');
  console.log(`  ✓ loadModuleMesh: ${maxInFlight} parts loading at once, assembled and animated in file order, failures skipped`);
}

// 2. Modules of a plan
{
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group();
  v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['clear', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  let inFlight = 0, maxInFlight = 0;
  const started = [];
  const delays = [50, 5, 30, 10, 40, 1, 20, 15];
  v.loadModuleMesh = async (mod) => {
    started.push(mod.index);
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(delays[mod.index - 1]);
    inFlight--;
    const g = new THREE.Group(); g.name = `module_${mod.index}`;
    return g;
  };
  const plan = { modules: delays.map((_, i) => ({ index: i + 1, macro: 'struct_arg_cross_01_macro', position: { x: i * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  await v.loadStationPlan(plan);
  assert.deepStrictEqual(v.modulesGroup.children.map(c => c.userData.index), [1, 2, 3, 4, 5, 6, 7, 8], 'modules placed in plan order');
  assert.deepStrictEqual([...started].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], 'every module loaded once');
  assert.ok(maxInFlight > 1 && maxInFlight <= 4, `up to four modules load at once (max ${maxInFlight})`);

  // An error loading a module still fails the plan load, as before
  v.loadModuleMesh = async (mod) => { if (mod.index === 2) throw new Error('boom'); return new THREE.Group(); };
  await assert.rejects(v.loadStationPlan({ modules: plan.modules.slice(0, 4) }), /boom/);
  console.log(`  ✓ loadStationPlan: up to ${maxInFlight} modules loading at once, placed in plan order; errors still surface`);
}

console.log('\n[PASS] test_parallel_loading');
