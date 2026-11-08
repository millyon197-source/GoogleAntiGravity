/**
 * At most MAX_MODULE_LIGHTS module lights are on at once. Every lit shader repeats the lighting code
 * once per light and compile time grows faster than the light count: the 146 lights of the Prod Max
 * plan made the first frame after its load compile for minutes, hanging the page.
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
const { StationViewer, MAX_MODULE_LIGHTS, pickEvenly } = await import('../src/viewer.js');

console.log('[*] Testing the module light limit...');

// 1. pickEvenly
{
  const items = Array.from({ length: 40 }, (_, i) => i);
  const picked = pickEvenly(items, 16);
  assert.strictEqual(picked.length, 16);
  assert.strictEqual(new Set(picked).size, 16, 'no item picked twice');
  assert.deepStrictEqual([...picked].sort((a, b) => a - b), picked, 'kept in order');
  assert.strictEqual(picked[0], 0);
  assert.ok(picked[15] >= 36, 'spread to the end of the list');
  assert.deepStrictEqual(pickEvenly([1, 2, 3], 16), [1, 2, 3], 'short lists unchanged');
  assert.strictEqual(MAX_MODULE_LIGHTS, 16);
  console.log('  ✓ pickEvenly spreads the picks over the whole list');
}

function makeViewer(events) {
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene(); v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group(); v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['deselect', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  v.renderer = {
    getRenderTarget: () => null, setRenderTarget: () => {},
    compileAsync(object, camera, targetScene) {
      let lights = 0;
      if (targetScene) targetScene.traverseVisible(o => { if (o.isPointLight) lights++; });
      events.push({ batch: !object.isObject3D, lights });
      return Promise.resolve();
    }
  };
  return v;
}
const lightModule = (index, lightCount = 1) => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  for (let i = 0; i < lightCount; i++) { const l = new THREE.PointLight(); l.name = `light_${index}_${i}`; g.add(l); }
  return g;
};

// 2. A plan load switches on at most MAX_MODULE_LIGHTS module lights, spread over the plan
{
  const events = [];
  const v = makeViewer(events);
  const offOnPurpose = new THREE.PointLight(); offOnPurpose.visible = false;
  v.loadModuleMesh = async (mod) => { const g = lightModule(mod.index); if (mod.index === 2) g.add(offOnPurpose); return g; };
  const plan = { modules: Array.from({ length: 40 }, (_, i) => ({ index: i + 1, macro: 'struct_arg_cross_01_macro', position: { x: i * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  await v.loadStationPlan(plan);
  const lights = []; v.modulesGroup.traverse(o => { if (o.isPointLight) lights.push(o); });
  const on = lights.filter(l => l.visible);
  assert.strictEqual(on.length, MAX_MODULE_LIGHTS, `${MAX_MODULE_LIGHTS} of 41 module lights on`);
  assert.ok(lights.filter(l => !l.visible && l !== offOnPurpose).every(l => l.userData.offToLimitLights), 'the others are off and flagged');
  assert.ok(!offOnPurpose.visible && !offOnPurpose.userData.offToLimitLights, 'a light that was already off is left alone');
  const onModules = on.map(l => Number(l.name.split('_')[1]));
  assert.ok(onModules[0] === 1 && onModules[onModules.length - 1] >= 37, 'spread across the plan, first to last');
  const finalCompiles = events.filter(e => e.batch);
  assert.ok(finalCompiles.length > 0 && finalCompiles.every(e => e.lights === MAX_MODULE_LIGHTS), 'the final compile is for the capped light count');
  console.log(`  ✓ plan load: ${MAX_MODULE_LIGHTS} of 41 module lights on, spread over the plan; the final compile uses that count`);
}

// 3. Component swaps keep within the limit
{
  const v = makeViewer([]);
  for (let i = 0; i < 14; i++) v.modulesGroup.add(lightModule(i));
  const added = lightModule(99, 4);
  v.modulesGroup.add(added);
  assert.strictEqual(v.limitModuleLights(added), 2, 'two lights fit the budget, two are switched off');
  let on = 0; v.modulesGroup.traverse(o => { if (o.isPointLight && o.visible) on++; });
  assert.strictEqual(on, MAX_MODULE_LIGHTS);
  const more = lightModule(100, 1);
  v.modulesGroup.add(more);
  assert.strictEqual(v.limitModuleLights(more), 1, 'no budget left');
  assert.strictEqual(more.children[1].userData.offToLimitLights, true);
  console.log('  ✓ component swaps only add lights within the remaining budget');
}

console.log('\n[PASS] test_module_light_limit');
