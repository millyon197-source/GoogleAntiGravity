/**
 * Shader programs are compiled ahead, in parallel, instead of synchronously by the first frame that
 * draws a new material (a cold first load froze the page for over 12 s that way):
 * - precompileShaders compiles for the bloom composer's render target when frames go through it,
 *   restores the previous target, and never fails the load;
 * - loadStationPlan compiles each module before adding it, keeps the modules' lights off until the
 *   plan is in (so the light count every program is built for stays the same), then switches them
 *   on and compiles the scene once while frames are held.
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

console.log('[*] Testing shader precompilation...');

function makeRenderer(events, viewer) {
  let target = null;
  return {
    getRenderTarget: () => target,
    setRenderTarget: (t) => { target = t; },
    compileAsync(object, camera, targetScene) {
      const lightsOn = [];
      const countLights = (root) => root && root.traverseVisible(o => { if (o.isPointLight) lightsOn.push(o.name); });
      countLights(object);
      if (targetScene && targetScene !== object) countLights(targetScene);
      events.push({
        type: 'compile', object, camera, targetScene, renderTarget: target,
        inScene: object.parent !== null || object === viewer.scene, lightsOn: lightsOn.sort(), renderHeld: viewer.renderHeld === true
      });
      return Promise.resolve(object);
    }
  };
}

// 1. precompileShaders
{
  const events = [];
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.renderer = makeRenderer(events, v);
  const composerTarget = { name: 'readBuffer' };
  const screenTarget = { name: 'previous' };
  v.composer = { readBuffer: composerTarget, render: () => events.push({ type: 'render' }) };
  v.bloomEnabled = true;
  v.renderer.setRenderTarget(screenTarget);
  const obj = new THREE.Group();
  await v.precompileShaders(obj);
  assert.strictEqual(events[0].object, obj);
  assert.strictEqual(events[0].targetScene, v.scene, 'an object not yet added is compiled for the scene it joins');
  assert.strictEqual(events[0].renderTarget, composerTarget, "compiled for the composer's render target");
  assert.strictEqual(v.renderer.getRenderTarget(), screenTarget, 'previous render target restored');
  await v.precompileShaders();
  assert.strictEqual(events[1].object, v.scene);
  assert.strictEqual(events[1].targetScene, null, 'the whole scene is compiled as itself');
  v.bloomEnabled = false;
  await v.precompileShaders(obj);
  assert.strictEqual(events[2].renderTarget, null, 'without bloom: compiled for the screen');
  // Failures never break a load
  v.renderer.compileAsync = () => { throw new Error('context lost'); };
  await v.precompileShaders(obj);
  assert.strictEqual(v.renderer.getRenderTarget(), screenTarget, 'target restored after a failure');
  v.renderer.compileAsync = () => Promise.reject(new Error('lost'));
  await v.precompileShaders(obj);
  await Object.create(StationViewer.prototype).precompileShaders(obj); // no renderer at all
  // renderScene draws nothing while held
  v.bloomEnabled = true;
  const before = events.filter(e => e.type === 'render').length;
  v.renderHeld = true; v.renderScene();
  assert.strictEqual(events.filter(e => e.type === 'render').length, before, 'no frame while held');
  v.renderHeld = false; v.renderScene();
  assert.strictEqual(events.filter(e => e.type === 'render').length, before + 1, 'frames resume');
  console.log("  ✓ precompileShaders: composer target, restored target, failures ignored; renderScene honours renderHeld");
}

// 2. loadStationPlan
{
  const events = [];
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.renderer = makeRenderer(events, v);
  v.composer = { readBuffer: { name: 'readBuffer' }, render: () => events.push({ type: 'render', held: v.renderHeld === true }) };
  v.bloomEnabled = true;
  v.modulesGroup = new THREE.Group();
  v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['clear', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  const baseLight = new THREE.PointLight(); baseLight.name = 'scene_light'; v.scene.add(baseLight);
  const hiddenOnPurpose = new THREE.PointLight(); hiddenOnPurpose.name = 'off_light'; hiddenOnPurpose.visible = false;
  v.loadModuleMesh = async (mod) => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    if (mod.index === 1 || mod.index === 3) { const l = new THREE.PointLight(); l.name = `light_${mod.index}`; root.add(l); }
    if (mod.index === 2) root.add(hiddenOnPurpose);
    // a frame drawn mid-load (texturing code renders when a sign switches)
    v.renderScene();
    return root;
  };
  const plan = { modules: [1, 2, 3].map(index => ({ index, macro: 'struct_arg_cross_01_macro', position: { x: index * 1000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  await v.loadStationPlan(plan);

  const compiles = events.filter(e => e.type === 'compile');
  const moduleCompiles = compiles.filter(e => e.object !== v.scene);
  assert.strictEqual(moduleCompiles.length, 3, 'every module compiled');
  for (const c of moduleCompiles) {
    assert.ok(!c.inScene, 'a module is compiled before it is added');
    assert.strictEqual(c.targetScene, v.scene, '...for the scene it joins');
    assert.deepStrictEqual(c.lightsOn, ['scene_light'], "...with the modules' lights still off (constant light count)");
    assert.ok(!c.renderHeld, 'frames keep drawing while modules load');
  }
  const final = compiles.filter(e => e.object === v.scene);
  assert.strictEqual(final.length, 1, 'the scene is compiled once at the end');
  assert.deepStrictEqual(final[0].lightsOn, ['light_1', 'light_3', 'scene_light'], 'with every module light on');
  assert.ok(final[0].renderHeld, 'while frames are held');
  assert.strictEqual(compiles.indexOf(final[0]), compiles.length - 1, 'after all modules');
  assert.ok(events.filter(e => e.type === 'render').every(e => !e.held), 'no frame drawn while held');
  assert.strictEqual(v.renderHeld, false, 'frames resume after the load');
  assert.strictEqual(hiddenOnPurpose.visible, false, 'a light that was off stays off');
  let on = 0; v.modulesGroup.traverse(o => { if (o.isPointLight && o.visible) on++; });
  assert.strictEqual(on, 2, 'module lights are on after the load');
  assert.strictEqual(v.modulesGroup.children.length, 3);
  console.log("  ✓ loadStationPlan: modules compiled before being added with lights held off, then one scene compile with every light on while frames wait");
}

console.log('\n[PASS] test_shader_precompile');
