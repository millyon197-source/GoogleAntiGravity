/**
 * Releasing the move or rotate gizmo with a module (or a selection) reaching outside the plot BB
 * moves it to the closest place inside, along each axis; a selection keeps its arrangement.
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

console.log('[*] Testing that a gizmo release outside the plot lands the module inside it...');
const PLOT = { enabled: true, x: { plus: 5, minus: 5 }, z: { plus: 5, minus: 5 }, y: { plus: 2, minus: 2 } };
const pb = panel.getPlotBoundingBox(PLOT);

function makeModule(index, size, pos) {
  const g = new THREE.Group();
  g.userData = { index, macro: 'hab_arg_l_01_macro', initialSize: new THREE.Vector3(...size) };
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial());
  m.name = 'part_main-lod0';
  g.add(m);
  g.position.set(...pos);
  return g;
}
function makeViewer(mods) {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  mods.forEach(m => v.modulesGroup.add(m));
  v.modulesGroup.updateMatrixWorld(true);
  v.currentPlotConfig = PLOT;
  v.stationPlotGroup = null;
  v.renderScene = () => {};
  v.restoreFullPlanGrid = () => {};
  v.selectionHelper = null;
  v.dimensionOverlayGroup = null;
  v.currentPlan = { modules: mods.map(m => ({ index: m.userData.index, macro: m.userData.macro, position: { x: m.position.x, y: m.position.y, z: -m.position.z }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) };
  v.commits = [];
  v.onMoveCommitted = (e) => v.commits.push(e);
  return v;
}
const inside = (b) => b.min.x >= pb.minX - 0.5 && b.max.x <= pb.maxX + 0.5 && b.min.y >= pb.minY - 0.5 &&
  b.max.y <= pb.maxY + 0.5 && b.min.z >= pb.minZ - 0.5 && b.max.z <= pb.maxZ + 0.5;

// 1. Dragged past the +X wall and below the floor: lands against both, Z unchanged
{
  const mod = makeModule(1, [400, 200, 400], [0, 0, 0]);
  const v = makeViewer([mod]);
  v.dragStartPosition = { x: 0, y: 0, z: 0 };
  mod.position.set(5600, -2500, 1234);
  v.transformControls = { object: mod, axis: 'XYZ' };
  v.hasGizmoMoved = true;
  v.handleModuleDragEnd();
  const b = v.getModuleWorldBoundingBox(mod);
  assert.ok(inside(b), 'released module inside the plot');
  assert.ok(Math.abs(b.max.x - pb.maxX) < 1, 'against the +X wall');
  assert.ok(Math.abs(b.min.y - pb.minY) < 1, 'on the floor');
  assert.strictEqual(mod.position.z, 1234, 'Z kept: already inside');
  const pm = v.currentPlan.modules[0];
  assert.deepStrictEqual([pm.position.x, pm.position.y, pm.position.z], [Math.round(mod.position.x), Math.round(mod.position.y), Math.round(-mod.position.z)], 'plan synced');
  assert.ok(v.commits.some(c => c.type === 'move' && c.to.x === pm.position.x), 'move recorded for undo with the landed position');
  console.log('  ✓ a module released outside lands at the closest place inside, per axis');
}

// 2. Inside already: left exactly where released
{
  const mod = makeModule(1, [400, 200, 400], [0, 0, 0]);
  const v = makeViewer([mod]);
  v.dragStartPosition = { x: 0, y: 0, z: 0 };
  mod.position.set(1000, 500, -700);
  v.transformControls = { object: mod, axis: 'X' };
  v.hasGizmoMoved = true;
  v.handleModuleDragEnd();
  assert.deepStrictEqual(mod.position.toArray(), [1000, 500, -700], 'inside: not moved');
  console.log('  ✓ a module released inside stays where it was put');
}

// 3. A selection of two dragged past the -Z wall moves as one block
{
  const a = makeModule(1, [400, 200, 400], [0, 0, 0]);
  const c = makeModule(2, [400, 200, 400], [1000, 0, 0]);
  const v = makeViewer([a, c]);
  const pivot = new THREE.Object3D();
  pivot.position.set(500, 0, 0);
  v.multiSelectPivot = pivot;
  v.pivotDragStart = pivot.position.clone();
  v.selectedModules = [a, c];
  a.userData.multiDragStartPos = a.position.clone();
  c.userData.multiDragStartPos = c.position.clone();
  for (const m of [a, c]) m.position.z += 6000;
  pivot.position.z += 6000;
  v.transformControls = { object: pivot, axis: 'Z' };
  v.hasGizmoMoved = true;
  v.handleModuleDragEnd();
  for (const m of [a, c]) assert.ok(inside(v.getModuleWorldBoundingBox(m)), 'each selected module inside');
  assert.strictEqual(c.position.x - a.position.x, 1000, 'arrangement kept');
  assert.strictEqual(a.position.z, c.position.z, 'moved together');
  console.log('  ✓ a selection released outside moves inside as one block');
}

// 4. Rotated so its BB swings past a wall: pulled back in, and the move is recorded
{
  const mod = makeModule(1, [3000, 200, 200], [4000, 0, 0]);
  const v = makeViewer([mod]);
  v.dragStartRotation = { yaw: 0, pitch: 0, roll: 0 };
  mod.rotation.set(0, Math.PI / 2, 0); // long side now along Z: still inside
  mod.position.set(4600, 0, 4000);     // at the corner: reaches past +Z
  v.transformControlsRotate = { object: mod };
  v.hasGizmoMoved = true;
  v.handleModuleRotateEnd();
  assert.ok(inside(v.getModuleWorldBoundingBox(mod)), 'rotated module inside the plot');
  assert.ok(v.commits.some(c => c.type === 'move'), 'the pull back is recorded');
  console.log('  ✓ a module turned past a wall is pulled back inside');
}

// 5. While outside the plot (any move, before any release) a module turns red: itself, its BB and its
// selection outline; back inside, all as before. Modules sharing its material are not touched.
{
  const shared = new THREE.MeshStandardMaterial({ color: 0x8899aa });
  const a = makeModule(1, [400, 200, 400], [0, 0, 0]);
  const c = makeModule(2, [400, 200, 400], [1000, 0, 0]);
  a.children[0].material = shared;
  c.children[0].material = shared;
  const v = makeViewer([a, c]);
  v.scene = new THREE.Scene();
  v.selectionHelper = new THREE.BoxHelper(a, 0xFFFF00);
  a.position.x = 5300;
  a.updateMatrixWorld(true);
  v.updateOutsidePlotFeedback();
  const mat = a.children[0].material;
  assert.notStrictEqual(mat, shared, 'outside: the module has its own red material');
  assert.ok(mat.color.r > 0.6 && mat.color.r > 3 * mat.color.g, 'outside: module tinted red');
  assert.strictEqual(c.children[0].material, shared, 'the other module keeps the shared material');
  assert.strictEqual(shared.color.getHex(), 0x8899aa, 'shared material unchanged');
  const boxes = (v.outsidePlotGroup?.children || []).filter(o => o.userData.isOutsidePlotBox);
  assert.deepStrictEqual(boxes.map(o => o.userData.moduleIndex), [1], 'outside: a red BB for the module');
  assert.strictEqual(v.selectionHelper.material.color.getHex(), 0xFF1133, 'outside: selection outline red');
  a.position.x = 0;
  a.updateMatrixWorld(true);
  v.updateOutsidePlotFeedback();
  assert.strictEqual(a.children[0].material, shared, 'back inside: original material restored');
  assert.strictEqual(v.outsidePlotGroup, null, 'back inside: no red BB');
  assert.strictEqual(v.selectionHelper.material.color.getHex(), 0xFFFF00, 'back inside: selection outline yellow');
  console.log('  ✓ a module outside the plot turns red (module, BB, outline) and back');
}

// 6. Releasing leaves nothing in a pier's exclusion zones: a released pier stays where it was put and
// what its zones now cover moves out; a module dropped into a zone moves out itself. Recorded for undo.
{
  const { computeModuleGroupRotation } = await import('../packages/adapter-three/src/math/rotation-math.js');
  const ov = (a, b) => Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5 && Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.5;
  const makePier = (index, pos) => {
    // pier_arg_harbor_04: one prong, lanes along mesh +X (scene +X at yaw 180)
    const g = makeModule(index, [1000, 200, 600], pos);
    g.userData.macro = 'pier_arg_harbor_04_macro';
    g.children[0].position.x = 500;
    g.rotation.copy(computeModuleGroupRotation(180, 0, 0));
    return g;
  };
  const assertZonesClear = (v, label) => {
    v.modulesGroup.updateMatrixWorld(true);
    for (const p of v.modulesGroup.children.filter(m => panel.isPierModule(m))) {
      const zs = panel.getPierProngCorridors(p, pb, v);
      for (const m of v.modulesGroup.children) if (m !== p) assert.ok(!zs.some(z => ov(z, v.getModuleWorldBoundingBox(m))), `${label}: #${m.userData.index} in pier #${p.userData.index}'s zones`);
    }
  };

  // A pier dragged so its zone runs over a habitat
  {
    const pier = makePier(1, [-4000, 0, 3000]);
    const hab = makeModule(2, [400, 200, 400], [2000, 0, 0]);
    const v = makeViewer([pier, hab]);
    v.dragStartPosition = { x: -4000, y: 0, z: -3000 };
    pier.position.set(-4000, 0, 0);
    v.transformControls = { object: pier, axis: 'Z' };
    v.hasGizmoMoved = true;
    v.handleModuleDragEnd();
    assert.deepStrictEqual(pier.position.toArray(), [-4000, 0, 0], 'released pier stays where it was put');
    assertZonesClear(v, 'pier released over a module');
    assert.notDeepStrictEqual(hab.position.toArray(), [2000, 0, 0], 'the habitat moved out of the zone');
    const pm = v.currentPlan.modules.find(m => m.index === 2);
    assert.deepStrictEqual([pm.position.x, pm.position.y, pm.position.z], [hab.position.x, hab.position.y, -hab.position.z], 'its plan position synced');
    assert.ok(v.commits.some(c => c.type === 'move' && c.moduleIndex === 2), 'its move recorded for undo');
  }
  // A module dropped into a pier's zone
  {
    const pier = makePier(1, [-4000, 0, 0]);
    const hab = makeModule(2, [400, 200, 400], [0, 0, 3000]);
    const v = makeViewer([pier, hab]);
    v.dragStartPosition = { x: 0, y: 0, z: -3000 };
    hab.position.set(2000, 0, 0);
    v.transformControls = { object: hab, axis: 'Z' };
    v.hasGizmoMoved = true;
    v.handleModuleDragEnd();
    assert.deepStrictEqual(pier.position.toArray(), [-4000, 0, 0], 'the pier stays');
    assertZonesClear(v, 'module dropped in a zone');
    assert.deepStrictEqual(v.dragStartPosition, { x: hab.position.x, y: hab.position.y, z: -hab.position.z }, 'drag start follows where it ended');
  }
  console.log('  ✓ on release nothing is left in a pier\'s exclusion zones, and the moves can be undone');
}

// 7. A module whose box is off its origin (like most X4 modules), released past the +X wall onto a
// module standing at that wall: pulled in, pushed off the overlap, and still inside the plot at the end
{
  const { StationLayoutEngine } = await import('../packages/domain/src/services/station-layout-engine.js');
  const wallMod = makeModule(2, [600, 200, 600], [4700, 0, 0]);          // box x 4400..5000
  const off = makeModule(1, [600, 200, 600], [0, 0, 0]);
  off.children[0].position.x = 1000;                                       // box x origin+700..origin+1300
  const v = makeViewer([off, wallMod]);
  v.dragStartPosition = { x: 0, y: 0, z: 0 };
  off.position.set(4000, 0, 100);                                          // box x 4700..5300: past the wall, on wallMod
  v.transformControls = { object: off, axis: 'X' };
  v.hasGizmoMoved = true;
  v.handleModuleDragEnd();
  v.modulesGroup.updateMatrixWorld(true);
  const b = v.getModuleWorldBoundingBox(off);
  assert.ok(inside(b), `off-centre module inside the plot after release (box x ${Math.round(b.min.x)}..${Math.round(b.max.x)})`);
  const w = v.getModuleWorldBoundingBox(wallMod);
  const ovl = Math.min(b.max.x, w.max.x) - Math.max(b.min.x, w.min.x) > 0.5 && Math.min(b.max.y, w.max.y) - Math.max(b.min.y, w.min.y) > 0.5 && Math.min(b.max.z, w.max.z) - Math.max(b.min.z, w.min.z) > 0.5;
  assert.ok(!ovl, 'and off the module at the wall');
  assert.ok(!v.isModuleOutsidePlot(wallMod), 'the module at the wall still inside');

  // The overlap step itself keeps the box (not the origin) inside the plot
  const mover = makeModule(3, [600, 200, 600], [3700, 0, 0]);
  mover.children[0].position.x = 1000;
  const v2 = makeViewer([mover, makeModule(4, [600, 200, 600], [4700, 0, 0])]);
  StationLayoutEngine.moveMovingModuleOutsideOverlap(mover, [v2.modulesGroup.children[1]], PLOT, {
    gap: 5, fromPos: { x: 2000, y: 0, z: 0 }, dragAxis: 'X',
    getSize: (m) => v2.getModuleInitialSize(m), getModuleWorldBox: (m) => v2.getModuleWorldBoundingBox(m), applyToObject: true
  });
  assert.ok(inside(v2.getModuleWorldBoundingBox(mover)), 'overlap step: box kept inside the plot');
  console.log('  ✓ an off-centre module released past a wall onto another ends inside the plot, off the overlap');
}

console.log('\n[SUCCESS] Gizmo releases outside the plot land inside it');
