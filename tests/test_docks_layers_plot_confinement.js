/**
 * After Layers for Docks relocates modules (docks vertical orientation, Perimeter placements, or the
 * re-applied layout), every module's own bounding box stays inside the plot BB. The box is the
 * module as rendered: its rotation and where its geometry sits around its origin count; a pier's
 * lane (geometryinvisible) volume does not.
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
const storage = {};
globalThis.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k]; }
};

const THREE = await import('three');
const { StationViewer } = await import('../src/viewer.js');
const panel = await import('../src/module-display-panel.js');
const { computeModuleGroupRotation } = await import('../packages/adapter-three/src/math/rotation-math.js');

console.log('[*] Testing Layers for Docks keeps every module BB (lanes excluded) inside the plot...');

const PLOT = { enabled: true, x: { plus: 2, minus: 2 }, z: { plus: 2, minus: 2 }, y: { plus: 1, minus: 1 } };

function box(name, size, center) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial());
  m.name = name;
  m.position.set(center[0], center[1], center[2]);
  return m;
}

// A pier like pier_arg_harbor_04: origin at its station snap, hull 280 m long running off one side
// of it, and a 4 km lane volume beyond that
function makePier(index, yaw, pos) {
  const g = new THREE.Group();
  g.userData = { index, macro: 'pier_arg_harbor_04_macro', initialSize: new THREE.Vector3(280, 130, 230) };
  const hull = box('part_main-lod0', [280, 130, 230], [140, 0, 0]);
  const lane = box('geometryinvisible-lod0', [4000, 2000, 2000], [2000, 0, 0]);
  lane.userData.isGeometryInvisible = true;
  lane.userData.partName = 'geometryinvisible';
  g.add(hull, lane);
  g.rotation.copy(computeModuleGroupRotation(yaw, 0, 0));
  g.position.set(pos[0], pos[1], pos[2]);
  return g;
}

// A dock area whose hull is off-centre from its origin
function makeDock(index, pos, macro = 'dockarea_arg_m_02_tradestation_01_macro') {
  const g = new THREE.Group();
  g.userData = { index, macro, initialSize: new THREE.Vector3(1200, 240, 800) };
  g.add(box('part_main-lod0', [1200, 240, 800], [300, 0, 0]));
  g.position.set(pos[0], pos[1], pos[2]);
  return g;
}

function makeViewer() {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  v.currentPlotConfig = PLOT;
  v.renderScene = () => {};
  v.stationPlotGroup = null;
  const mods = [
    makeDock(1, [1500, 0, 1500]),
    makeDock(2, [-1700, 0, -1500], 'dockarea_arg_m_station_02_hightech_macro'),
    makePier(3, 0, [-1900, 0, 1800]),
    makePier(4, 90, [1800, 0, -1900])
  ];
  mods.forEach(m => v.modulesGroup.add(m));
  v.currentPlan = { modules: mods.map(m => ({ index: m.userData.index, macro: m.userData.macro, position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  return v;
}

const pb = panel.getPlotBoundingBox(PLOT);
function assertInside(v, label) {
  for (const mod of v.modulesGroup.children) {
    const b = v.getModuleWorldBoundingBox(mod);
    const size = b.getSize(new THREE.Vector3());
    assert.ok(size.x < 1300 && size.z < 1300, `${label}: ${mod.userData.macro} box excludes the lane volume (got ${size.toArray()})`);
    const tol = 0.5;
    assert.ok(b.min.x >= pb.minX - tol && b.max.x <= pb.maxX + tol &&
              b.min.y >= pb.minY - tol && b.max.y <= pb.maxY + tol &&
              b.min.z >= pb.minZ - tol && b.max.z <= pb.maxZ + tol,
      `${label}: ${mod.userData.macro} BB [${b.min.toArray().map(Math.round)}]..[${b.max.toArray().map(Math.round)}] must be inside the plot`);
    const planMod = v.currentPlan.modules.find(m => m.index === mod.userData.index);
    assert.deepStrictEqual([planMod.position.x, planMod.position.y, planMod.position.z],
      [Math.round(mod.position.x), Math.round(mod.position.y), Math.round(-mod.position.z)], `${label}: plan position synced`);
  }
  assert.strictEqual(v.checkPlotBoundViolations(), false, `${label}: plot BB not flagged as violated`);
}

// 1. The helper itself
{
  const v = makeViewer();
  const moved = panel.keepModulesInsidePlot(v.modulesGroup.children, pb, v);
  assert.ok(moved > 0, 'modules starting across the plot walls are moved');
  assertInside(v, 'keepModulesInsidePlot');
  assert.strictEqual(panel.keepModulesInsidePlot(v.modulesGroup.children, pb, v), 0, 'a second pass moves nothing');
  console.log('  ✓ keepModulesInsidePlot moves each module BB (lanes excluded) inside the plot');
}

// 2. Docks vertical orientation
panel.clearActionableElements?.();
panel.addActionableElement({ id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' });
for (const orient of ['top', 'center', 'bottom']) {
  const v = makeViewer();
  panel.applyDocksVerticalOrientation(orient, v);
  assertInside(v, `orientation ${orient}`);
}
console.log('  ✓ top / center / bottom keep every module inside the plot');

// 3. Perimeter placements
for (const sel of [['spread'], ['stacked'], ['lanes'], ['spread', 'stacked', 'lanes']]) {
  const v = makeViewer();
  panel.applyDocksPerimeterPlacement(new Set(sel), v);
  assertInside(v, `perimeter ${sel.join('+')}`);
}
console.log('  ✓ spread / stacked / lanes keep every module inside the plot');

// 4. Layers re-applying the active layout
panel.setBlueprintModeActive(false);
for (const layout of ['clusters', 'planar', 'grid', 'height']) {
  const v = makeViewer();
  v.highlightModulesByFilter = () => {};
  v.lastLayoutArgs = { key: layout, name: layout, activeEntries: null };
  v.applyLayersBehavior('docks', 'Docks-1');
  assertInside(v, `layers + ${layout} layout`);
}
console.log('  ✓ Layers re-applying clusters / planar / grid / height keeps every module inside the plot');

console.log('\n[SUCCESS] Layers for Docks never leaves a module BB outside the plot');
