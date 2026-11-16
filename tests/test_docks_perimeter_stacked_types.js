/**
 * Perimeter placement with several docks of one type (Bright Promise Factory: 4 × pier_arg_harbor_01,
 * 2 × pier_arg_harbor_03): each type goes to the smallest plot wall that fits it, stacked vertically,
 * each module separated from the next by its own BB height plus the gap; piers' lanes out through
 * that wall; nothing else in the stacks' space; everything inside the plot.
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

console.log('[*] Testing Perimeter stacks repeated dock types on the smallest wall that fits...');
const GAP = 15;

function box(name, size, center) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial());
  m.name = name;
  m.position.set(center[0], center[1], center[2]);
  return m;
}

// Mesh space mirrors X4's X, so a lane along X4 -X runs along mesh +X: hulls extend that way from the origin
function makePier(index, macro, hull, { yaw = 0, pitch = 0, pos = [0, 0, 0], centerX = hull[0] / 2 } = {}) {
  const g = new THREE.Group();
  g.userData = { index, macro, initialSize: new THREE.Vector3(hull[0], hull[1], hull[2]) };
  g.add(box('part_main-lod0', hull, [centerX, 0, 0]));
  const lane = box('geometryinvisible-lod0', [4000, 2000, 2000], [hull[0] + 2000, 0, 0]);
  lane.userData.isGeometryInvisible = true;
  g.add(lane);
  g.rotation.copy(computeModuleGroupRotation(yaw, pitch, 0));
  g.position.set(...pos);
  return g;
}

function makeModule(index, macro, size, pos) {
  const g = new THREE.Group();
  g.userData = { index, macro, initialSize: new THREE.Vector3(...size) };
  g.add(box('part_main-lod0', size, [0, 0, 0]));
  g.position.set(...pos);
  return g;
}

function makeViewer(plot) {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  v.currentPlotConfig = plot;
  v.renderScene = () => {};
  v.stationPlotGroup = null;
  const mods = [
    // 4 × harbor_01 (T pier: hull mesh x -600..1800, z ±1800, prongs at +X and ±Z), one pitched in the blueprint
    makePier(1, 'pier_arg_harbor_01_macro', [2400, 400, 3600], { yaw: 30, pos: [0, 0, 0], centerX: 600 }),
    makePier(2, 'pier_arg_harbor_01_macro', [2400, 400, 3600], { yaw: 120, pitch: 40, pos: [2000, 500, 1000], centerX: 600 }),
    makePier(3, 'pier_arg_harbor_01_macro', [2400, 400, 3600], { yaw: 0, pos: [-3000, 0, 2000], centerX: 600 }),
    makePier(4, 'pier_arg_harbor_01_macro', [2400, 400, 3600], { yaw: 270, pos: [1000, -2000, -3000], centerX: 600 }),
    // 2 × harbor_03 (E pier): 800 m deep along its lanes, 6200 m wide across them, prongs 3000 m apart
    makePier(5, 'pier_arg_harbor_03_macro', [800, 400, 6200], { yaw: 90, pos: [-1000, 1000, -1000], centerX: 200 }),
    makePier(6, 'pier_arg_harbor_03_macro', [800, 400, 6200], { yaw: 180, pos: [500, 2000, 500], centerX: 200 }),
    // a single dock and some other modules
    makeModule(7, 'dockarea_arg_m_station_01_lowtech_macro', [400, 260, 400], [0, 3000, 0]),
    makeModule(8, 'hab_arg_l_01_macro', [600, 400, 600], [8500, 9500, 0]),
    makeModule(9, 'prod_gen_energycells_macro', [800, 400, 1500], [9000, 9000, -3000]),
    makeModule(10, 'storage_arg_l_liquid_01_macro', [500, 500, 500], [-9000, 9600, 0])
  ];
  mods.forEach(m => v.modulesGroup.add(m));
  v.currentPlan = { modules: mods.map(m => ({ index: m.userData.index, macro: m.userData.macro, position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  return v;
}

const wb = (v, m) => v.getModuleWorldBoundingBox(m);
// The room a pier takes in a stack: its box and its prongs' exclusion zone squares
const slot = (v, m) => panel.pierZoneSlotBox(m, v);
const ovl = (a, b) => Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5 &&
  Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.5;
const byIndex = (v, i) => v.modulesGroup.children.find(m => m.userData.index === i);

// Which wall (outward normal) a box is flush against
function wallOf(b, pb) {
  if (Math.abs(b.max.x - pb.maxX) < 0.5) return '+x';
  if (Math.abs(b.min.x - pb.minX) < 0.5) return '-x';
  if (Math.abs(b.max.z - pb.maxZ) < 0.5) return '+z';
  if (Math.abs(b.min.z - pb.minZ) < 0.5) return '-z';
  return null;
}
const NORMALS = { '+x': { x: 1, z: 0 }, '-x': { x: -1, z: 0 }, '+z': { x: 0, z: 1 }, '-z': { x: 0, z: -1 } };

function check(v, plot, orient, label, expectWalls) {
  const pb = panel.getPlotBoundingBox(plot);
  const groups = { 'pier_arg_harbor_01_macro': [1, 2, 3, 4], 'pier_arg_harbor_03_macro': [5, 6] };
  for (const [macro, indices] of Object.entries(groups)) {
    const mods = indices.map(i => byIndex(v, i));
    const boxes = mods.map(m => slot(v, m));
    const walls = mods.map(m => wallOf(wb(v, m), pb));
    assert.ok(walls.every(w => w && w === walls[0]), `${label}: every ${macro} on one wall (got ${walls})`);
    assert.strictEqual(walls[0], expectWalls[macro], `${label}: ${macro} on the smallest wall that fits it`);
    // one column: same footprint, levels stepped by the zone-inclusive height + gap
    const h = boxes[0].max.y - boxes[0].min.y;
    for (const b of boxes) {
      assert.ok(Math.abs(b.min.x - boxes[0].min.x) < 0.5 && Math.abs(b.min.z - boxes[0].min.z) < 0.5, `${label}: ${macro} stacked in one column`);
      assert.ok(Math.abs((b.max.y - b.min.y) - h) < 0.5, `${label}: ${macro} levelled, all the same height`);
    }
    const ys = boxes.map(b => b.min.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i] - ys[i - 1] - (h + GAP)) < 0.5, `${label}: ${macro} separated by zone height + gap`);
    if (orient === 'top') assert.ok(Math.abs(Math.max(...boxes.map(b => b.max.y)) - pb.maxY) < 0.5, `${label}: stack hangs from the plot top`);
    if (orient === 'bottom') assert.ok(Math.abs(Math.min(...boxes.map(b => b.min.y)) - pb.minY) < 0.5, `${label}: stack stands on the plot bottom`);
    if (orient === 'center') {
      const mid = (Math.min(...boxes.map(b => b.min.y)) + Math.max(...boxes.map(b => b.max.y))) / 2;
      assert.ok(Math.abs(mid - (pb.minY + pb.maxY) / 2) < 0.5, `${label}: stack centred vertically`);
    }
    // lanes out through that wall
    for (const m of mods) {
      const lane = panel.getPierLaneWorldDirection(m);
      const n = NORMALS[walls[0]];
      assert.ok(lane && lane.x * n.x + lane.z * n.z > 0.9999, `${label}: ${macro}#${m.userData.index} lane out through ${walls[0]}`);
    }
  }
  // nothing overlaps a stack or sits in any pier's exclusion zones, everything inside the plot
  const stacked = [1, 2, 3, 4, 5, 6].map(i => byIndex(v, i));
  for (const s of stacked) {
    const zones = panel.getPierProngCorridors(s, pb, v);
    for (const m of v.modulesGroup.children) {
      if (m === s) continue;
      const b = wb(v, m);
      assert.ok(!ovl(wb(v, s), b), `${label}: ${m.userData.macro}#${m.userData.index} must not overlap stacked ${s.userData.macro}#${s.userData.index}`);
      assert.ok(!zones.some(z => ovl(z, b)), `${label}: ${m.userData.macro}#${m.userData.index} in ${s.userData.macro}#${s.userData.index} exclusion zones`);
    }
  }
  assert.strictEqual(v.checkPlotBoundViolations(), false, `${label}: every module inside the plot`);
  // plan synced
  for (const m of v.modulesGroup.children) {
    const pm = v.currentPlan.modules.find(x => x.index === m.userData.index);
    assert.deepStrictEqual([pm.position.x, pm.position.y, pm.position.z], [Math.round(m.position.x), Math.round(m.position.y), Math.round(-m.position.z)], `${label}: plan position synced`);
  }
}

panel.addActionableElement({ id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' });

// Along the wall, harbor_03 takes 10000 m (outer prongs at ±3000 plus half a 4000 m zone each side)
// and harbor_01 a whole wall (its side prongs' zones run along the wall to the corners).
// ±X walls (12 km) are the smallest: harbor_03 (larger, placed first) takes +X; harbor_01 no longer
// fits beside it (10000 + 15 + 4000) and goes to -X
const WIDE_X = { enabled: true, x: { plus: 10, minus: 10 }, z: { plus: 6, minus: 6 }, y: { plus: 10, minus: 10 } };
// ±Z walls (8 km) are the smallest: too short for harbor_03, which goes to +X; harbor_01 takes +Z
const WIDE_Z = { enabled: true, x: { plus: 4, minus: 4 }, z: { plus: 10, minus: 10 }, y: { plus: 10, minus: 10 } };
const cases = [
  [WIDE_X, { 'pier_arg_harbor_01_macro': '-x', 'pier_arg_harbor_03_macro': '+x' }],
  [WIDE_Z, { 'pier_arg_harbor_01_macro': '+z', 'pier_arg_harbor_03_macro': '+x' }]
];
for (const [plot, walls] of cases) {
  for (const orient of ['top', 'center', 'bottom']) {
    for (const sel of [['stacked'], ['spread', 'lanes'], ['lanes'], ['spread', 'stacked', 'lanes']]) {
      const v = makeViewer(plot);
      panel.setDocksVerticalOrientation(orient, v);
      panel.applyDocksPerimeterPlacement(new Set(sel), v);
      check(v, plot, orient, `${plot === WIDE_X ? 'wide X' : 'wide Z'} ${orient} ${sel.join('+')}`, walls);
    }
  }
}
console.log('  ✓ each repeated type on the smallest wall that fits, stacked by zone height + gap, lanes out, zones clear, inside the plot');

// A type taller than the plot continues in another column along the same wall
{
  const LOW = { enabled: true, x: { plus: 10, minus: 10 }, z: { plus: 6, minus: 6 }, y: { plus: 0.45, minus: 0.45 } };
  const v = makeViewer(LOW);
  panel.setDocksVerticalOrientation('bottom', v);
  const pb = panel.getPlotBoundingBox(LOW);
  const stacked = panel.stackRepeatedDockTypes([1, 2, 3, 4].map(i => byIndex(v, i)), pb, v, { orient: 'bottom', gap: GAP });
  assert.strictEqual(stacked.size, 4);
  const boxes = [1, 2, 3, 4].map(i => wb(v, byIndex(v, i)));
  const columns = new Set(boxes.map(b => `${Math.round(b.min.x)},${Math.round(b.min.z)}`));
  assert.strictEqual(columns.size, 4, '900 m of height holds one pier with its 4000 m zones per column: four columns');
  assert.ok(boxes.every(b => b.min.y >= pb.minY - 0.5 && b.max.y <= pb.maxY + 0.5), 'piers fit the plot height');
  console.log('  ✓ a stack taller than the plot continues in further columns on the same wall');
}

// Single docks are not stacked
{
  const v = makeViewer(WIDE_X);
  const pb = panel.getPlotBoundingBox(WIDE_X);
  const stacked = panel.stackRepeatedDockTypes([byIndex(v, 7), byIndex(v, 1)], pb, v, {});
  assert.strictEqual(stacked.size, 0, 'no type with more than one module: nothing stacked');
  // Dock areas never stack, even several of one type; only piers do
  const twin = makeModule(11, 'dockarea_arg_m_station_01_lowtech_macro', [400, 260, 400], [3000, 0, 0]);
  v.modulesGroup.add(twin);
  const twinAt = twin.position.clone(), sevenAt = byIndex(v, 7).position.clone();
  const areas = panel.stackRepeatedDockTypes([byIndex(v, 7), twin], pb, v, {});
  assert.strictEqual(areas.size, 0, 'two identical dock areas: not stacked');
  assert.ok(twin.position.equals(twinAt) && byIndex(v, 7).position.equals(sevenAt), 'dock areas left where they are');
  console.log('  ✓ single docks keep the ordinary Perimeter placement');
}

console.log('\n[SUCCESS] Repeated dock types stack on the smallest wall that fits them');
