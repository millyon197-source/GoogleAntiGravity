/**
 * Docks are placed first; the remaining modules are then placed one at a time, each checked for
 * overlap against the docks, every pier's exclusion zones and the modules placed before it
 * (placeModulesAroundDocks). Layouts settle this way (settlePierZonesAfterLayout).
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

console.log('[*] Testing that modules are placed around the docks and out of the pier zones...');
const PLOT = { enabled: true, x: { plus: 10, minus: 10 }, z: { plus: 8, minus: 8 }, y: { plus: 5, minus: 5 } };

function box(name, size, center) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial());
  m.name = name;
  m.position.set(...center);
  return m;
}
function makePier(index, pos, yaw = 180) {
  const g = new THREE.Group();
  g.userData = { index, macro: 'pier_arg_harbor_04_macro', initialSize: new THREE.Vector3(1000, 200, 600) };
  g.add(box('part_main-lod0', [1000, 200, 600], [500, 0, 0]));
  g.rotation.copy(computeModuleGroupRotation(yaw, 0, 0));
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
function makeViewer(mods) {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  v.currentPlotConfig = PLOT;
  v.renderScene = () => {};
  v.stationPlotGroup = null;
  mods.forEach(m => v.modulesGroup.add(m));
  v.modulesGroup.updateMatrixWorld(true);
  v.currentPlan = { modules: mods.map(m => ({ index: m.userData.index, macro: m.userData.macro, position: { x: 0, y: 0, z: 0 } })) };
  return v;
}
const overlaps = (a, b) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5 &&
  Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.5;
const wbox = (v, m) => { const b = v.getModuleWorldBoundingBox(m); return { min: { ...b.min }, max: { ...b.max } }; };

function checkClean(v, pb, label) {
  const mods = v.modulesGroup.children;
  const piers = mods.filter(m => panel.isPierModule(m));
  for (const m of mods) {
    const b = wbox(v, m);
    assert.ok(b.min.x >= pb.minX - 1 && b.max.x <= pb.maxX + 1 && b.min.y >= pb.minY - 1 && b.max.y <= pb.maxY + 1 &&
      b.min.z >= pb.minZ - 1 && b.max.z <= pb.maxZ + 1, `${label}: #${m.userData.index} inside the plot`);
    for (const p of piers) {
      if (p === m) continue;
      for (const c of panel.getPierProngCorridors(p, pb, v)) {
        assert.ok(!overlaps(b, c), `${label}: #${m.userData.index} out of pier #${p.userData.index}'s zones`);
      }
    }
    for (const o of mods) {
      if (o === m) continue;
      assert.ok(!overlaps(b, wbox(v, o)), `${label}: #${m.userData.index} does not overlap #${o.userData.index}`);
    }
  }
}

// --- Test 1: modules sitting in a pier's zone (and on each other) are placed around it ---
{
  const pier = makePier(0, [2000, 0, 0]);
  const a = makeModule(1, 'prod_gen_energycells_macro', [800, 400, 800], [5000, 0, 0]);
  const b = makeModule(2, 'prod_gen_energycells_macro', [800, 400, 800], [5200, 0, 100]); // on top of a
  const c = makeModule(3, 'struct_arg_cross_01_macro', [200, 200, 200], [-6000, 0, 3000]); // clear
  const v = makeViewer([pier, a, b, c]);
  const pb = panel.getPlotBoundingBox(PLOT);
  const cBefore = c.position.clone();
  const pierBefore = pier.position.clone();
  // The pier kept where it is (e.g. stacked): only the modules in its zone move
  const moved = panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v, { isFixed: (m) => m === pier });
  assert.ok(moved >= 2, 'the two modules in the zone moved');
  assert.ok(pier.position.distanceTo(pierBefore) < 1e-6, 'the pier (kept fixed) keeps its place');
  assert.ok(c.position.distanceTo(cBefore) < 1e-6, 'a module clear of everything keeps its place');
  assert.ok(Math.abs(a.position.y) < 1e-6 && Math.abs(b.position.y) < 1e-6, 'modules keep their level (sideways moves)');
  checkClean(v, pb, 'Test 1');
  console.log('  ✓ Modules in the zone are placed beside it, off each other; the pier and clear modules stay');
}

// --- Test 2: docks overlapping each other's zones are settled before the rest is placed ---
{
  const p1 = makePier(0, [2000, 0, 0]);
  const p2 = makePier(1, [4000, 0, 0]); // in p1's zone
  const mods = [p1, p2];
  for (let i = 0; i < 6; i++) mods.push(makeModule(10 + i, 'prod_gen_energycells_macro', [600, 300, 600], [3000 + i * 300, 0, (i % 2) * 300]));
  const v = makeViewer(mods);
  const pb = panel.getPlotBoundingBox(PLOT);
  panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v);
  checkClean(v, pb, 'Test 2');
  console.log('  ✓ Docks are settled first; then every other module is placed clear of all zones and modules');
}

// --- Test 2b: dock areas overlapping each other are separated before the rest is placed ---
{
  const pier = makePier(0, [2000, 0, 0]);
  const d1 = makeModule(1, 'dockarea_arg_m_station_01_macro', [800, 300, 800], [-3000, 0, -2000]);
  const d2 = makeModule(2, 'dockarea_arg_m_station_02_macro', [800, 300, 800], [-2800, 0, -1900]); // on d1
  const m = makeModule(3, 'prod_gen_energycells_macro', [600, 300, 600], [-2900, 0, -2000]); // on both
  const v = makeViewer([pier, d1, d2, m]);
  const pb = panel.getPlotBoundingBox(PLOT);
  panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v, { orient: 'center' });
  checkClean(v, pb, 'Test 2b');
  // Each dock area against an outside wall, as far from the pier's zones as any wall place allows
  const zones = panel.getPierProngCorridors(pier, pb, v);
  const gapTo = (b) => Math.min(...zones.map(z => Math.hypot(
    Math.max(0, b.min.x - z.max.x, z.min.x - b.max.x), Math.max(0, b.min.y - z.max.y, z.min.y - b.max.y), Math.max(0, b.min.z - z.max.z, z.min.z - b.max.z))));
  const onWall = (b) => Math.abs(b.max.x - pb.maxX) < 1 || Math.abs(b.min.x - pb.minX) < 1 || Math.abs(b.max.z - pb.maxZ) < 1 || Math.abs(b.min.z - pb.minZ) < 1;
  // The farthest a 800 x 300 x 800 box on a wall at its level (y 0) can be from the zones (coarse search)
  let farthest = 0;
  for (const y of [0]) for (let t = -1; t <= 1; t += 0.05) {
    for (const [cx, cz] of [[pb.maxX - 400, t * (pb.maxZ - 400)], [pb.minX + 400, t * (pb.maxZ - 400)], [t * (pb.maxX - 400), pb.maxZ - 400], [t * (pb.maxX - 400), pb.minZ + 400]]) {
      const b = { min: { x: cx - 400, y: y - 150, z: cz - 400 }, max: { x: cx + 400, y: y + 150, z: cz + 400 } };
      if (!zones.some(z => overlaps(b, z))) farthest = Math.max(farthest, gapTo(b));
    }
  }
  const b1 = wbox(v, d1), b2 = wbox(v, d2);
  assert.ok(onWall(b1) && onWall(b2), 'dock areas against an outside wall');
  assert.ok(Math.abs((b1.min.y + b1.max.y) / 2) < 1 && Math.abs((b2.min.y + b2.max.y) / 2) < 1, 'dock areas keep their level');
  assert.ok(gapTo(b1) >= farthest - 300, `the first dock area as far from the zones as a wall place allows (${Math.round(gapTo(b1))} of ${Math.round(farthest)})`);
  console.log('  ✓ Dock areas go to an outside wall at their level, out of the pier zones and as far from them as possible');
}

// --- Test 3: the layout settle step uses it ---
{
  const pier = makePier(0, [2000, 0, 0]);
  const mods = [pier];
  for (let i = 0; i < 10; i++) mods.push(makeModule(1 + i, 'prod_gen_energycells_macro', [700, 300, 700], [2500 + (i % 5) * 400, 0, Math.floor(i / 5) * 400]));
  const v = makeViewer(mods);
  v.updatePlotBoxViolations = () => {};
  v.settlePierZonesAfterLayout();
  checkClean(v, panel.getPlotBoundingBox(PLOT), 'Test 3');
  console.log('  ✓ settlePierZonesAfterLayout places the remaining modules around the docks');
}

// --- Test 4: with Docks 1 and Perimeter Stacked checked, a layout's settle step keeps the piers stacked ---
{
  const piers = [makePier(0, [-4000, 0, -2000]), makePier(1, [3000, 2000, 1000]), makePier(2, [0, -2000, 4000])];
  const mods = [...piers];
  for (let i = 0; i < 4; i++) mods.push(makeModule(10 + i, 'prod_gen_energycells_macro', [700, 300, 700], [8000, i * 500, 0]));
  const v = makeViewer(mods);
  v.updatePlotBoxViolations = () => {};
  const saved = panel.getActiveActionableElements();
  panel.saveActionableElements([...saved, { id: 'layers:docks-1', decoratorId: 'layers', elementName: 'Docks-1', category: 'Docks', layerNumber: 1 }]);
  localStorage.setItem(panel.DOCKS_PERIMETER_STORAGE_KEY, JSON.stringify(['stacked']));
  try {
    v.settlePierZonesAfterLayout();
    assert.ok(piers.every(p => p.userData.perimeterStacked), 'every pier of the type is stacked');
    const pb = panel.getPlotBoundingBox(PLOT);
    const xs = piers.map(p => { const b = wbox(v, p); return Math.round((b.min.x + b.max.x) / 2); });
    const zs = piers.map(p => { const b = wbox(v, p); return Math.round((b.min.z + b.max.z) / 2); });
    assert.ok(new Set(xs).size === 1 || new Set(zs).size === 1, `the piers share one wall (x ${xs}, z ${zs})`);
    for (const m of mods) {
      const b = wbox(v, m);
      assert.ok(b.min.x >= pb.minX - 1 && b.max.x <= pb.maxX + 1 && b.min.y >= pb.minY - 1 && b.max.y <= pb.maxY + 1 &&
        b.min.z >= pb.minZ - 1 && b.max.z <= pb.maxZ + 1, `Test 4: #${m.userData.index} inside the plot`);
      for (const o of mods) if (o !== m) assert.ok(!overlaps(b, wbox(v, o)), `Test 4: #${m.userData.index} does not overlap #${o.userData.index}`);
    }
  } finally {
    panel.saveActionableElements(saved);
    localStorage.removeItem(panel.DOCKS_PERIMETER_STORAGE_KEY);
  }
  console.log('  ✓ With Perimeter Stacked checked, a layout keeps the piers stacked on one wall');
}

// --- Test 5: with Docks 1 and no Perimeter option, a layout's settle step puts the docks at the
// Vertical Orientation level (dock areas on a wall at that level), out of every pier zone ---
{
  const pier = makePier(0, [2000, 0, 0]);
  const area = makeModule(1, 'dockarea_arg_m_station_01_macro', [800, 300, 800], [-2000, 1000, 500]);
  const mods = [pier, area];
  for (let i = 0; i < 4; i++) mods.push(makeModule(10 + i, 'prod_gen_energycells_macro', [700, 300, 700], [0, i * 500, 3000]));
  const v = makeViewer(mods);
  v.updatePlotBoxViolations = () => {};
  const saved = panel.getActiveActionableElements();
  panel.saveActionableElements([...saved, { id: 'layers:docks-1', decoratorId: 'layers', elementName: 'Docks-1', category: 'Docks', layerNumber: 1 }]);
  localStorage.removeItem(panel.DOCKS_PERIMETER_STORAGE_KEY);
  panel.setDocksVerticalOrientation('top', null);
  try {
    v.settlePierZonesAfterLayout();
    const pb = panel.getPlotBoundingBox(PLOT);
    assert.ok(Math.abs(wbox(v, pier).max.y - pb.maxY) < 1, 'the pier at the top');
    const ab = wbox(v, area);
    assert.ok(Math.abs(ab.max.y - pb.maxY) < 1, 'the dock area at the top');
    assert.ok(Math.abs(ab.max.x - pb.maxX) < 1 || Math.abs(ab.min.x - pb.minX) < 1 || Math.abs(ab.max.z - pb.maxZ) < 1 || Math.abs(ab.min.z - pb.minZ) < 1, 'the dock area on an outside wall');
    checkClean(v, pb, 'Test 5');
  } finally {
    panel.saveActionableElements(saved);
  }
  console.log('  ✓ With no Perimeter option, a layout puts the docks at the Vertical level, dock areas on a wall');
}

// --- Test 6: a gizmo release with a pier's zones over a Perimeter-stacked pier: the stacked pier
// gives way (no pier's box may stay in a zone) ---
{
  const a = makePier(0, [2000, 0, 0]);
  const b = makePier(1, [-6000, 0, -5000]);
  b.userData.perimeterStacked = true;
  const v = makeViewer([a, b]);
  v.updatePlotBoxViolations = () => {};
  v.getModuleInitialSize = (m) => m.userData.initialSize;
  const pb = panel.getPlotBoundingBox(PLOT);
  // Put b in the middle of one of a's prong tunnels
  const z = panel.getPierProngCorridors(a, pb, v)[1];
  const bb = wbox(v, b);
  b.position.x += (z.min.x + z.max.x) / 2 - (bb.min.x + bb.max.x) / 2;
  b.position.y += (z.min.y + z.max.y) / 2 - (bb.min.y + bb.max.y) / 2;
  b.position.z += (z.min.z + z.max.z) / 2 - (bb.min.z + bb.max.z) / 2;
  v.modulesGroup.updateMatrixWorld(true);
  assert.ok(panel.getPierProngCorridors(a, pb, v).some(c => overlaps(wbox(v, b), c)), 'b starts in a zone');
  const aAt = a.position.clone();
  v.clearPierZonesAfterRelease([a]);
  assert.ok(a.position.distanceTo(aAt) < 1, 'the released pier stays where it was put');
  assert.ok(!panel.getPierProngCorridors(a, pb, v).some(c => overlaps(wbox(v, b), c)), 'the stacked pier moved out of the released pier\'s zones');
  assert.ok(!b.userData.perimeterStacked, 'it is no longer kept as stacked');
  console.log('  ✓ A release whose zones cover a stacked pier moves that pier out');
}

// --- Test 7: piers whose zones overlap (one just beside another's tunnel, both lanes the same way)
// are moved so no pier's room (box, zone squares, tunnels) overlaps another's ---
{
  const a = makePier(0, [2000, 0, 0]);
  const b = makePier(1, [2000, 700, 0]); // above a, its tunnel through a's
  const v = makeViewer([a, b]);
  const pb = panel.getPlotBoundingBox(PLOT);
  const room = (m) => [panel.pierZoneSlotBox(m, v), ...panel.getPierProngCorridors(m, pb, v)];
  assert.ok(room(a).some(x => room(b).some(y => overlaps(x, y))), 'the zones start overlapping');
  panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v);
  assert.ok(!room(a).some(x => room(b).some(y => overlaps(x, y))), 'the piers\' zones are apart');
  checkClean(v, pb, 'Test 7');
  console.log('  ✓ Piers with overlapping zones are moved until their zones are apart');
}

// --- Test 8: a pier that only clears another's zones turned around (a plot 4 km tall and wide, the
// other pier kept in place, both tunnels the same way) is turned to a level heading that clears ---
{
  const NARROW = { enabled: true, x: { plus: 10, minus: 10 }, z: { plus: 2.2, minus: 2.2 }, y: { plus: 2.2, minus: 2.2 } };
  const a = makePier(0, [3000, 0, 0]);
  const b = makePier(1, [-3000, 0, 0]);
  const v = makeViewer([a, b]);
  v.currentPlotConfig = NARROW;
  const pb = panel.getPlotBoundingBox(NARROW);
  const room = (m) => [panel.pierZoneSlotBox(m, v), ...panel.getPierProngCorridors(m, pb, v)];
  const clash = () => room(a).some(x => room(b).some(y => overlaps(x, y)));
  const laneA = panel.getPierLaneWorldDirection(a), laneB0 = panel.getPierLaneWorldDirection(b);
  // Whichever way the lanes point, make b's tunnel run through a
  if (!clash()) { b.position.x = -b.position.x; v.modulesGroup.updateMatrixWorld(true); }
  assert.ok(clash(), 'b starts with its tunnel through a');
  panel.separatePierZones(v.modulesGroup.children, pb, v, { isFixed: (m) => m === a });
  assert.ok(!clash(), 'the piers\' zones are apart');
  const hb = wbox(v, b);
  assert.ok(Math.abs((hb.max.y - hb.min.y) - 200) < 1, 'b stays level (its box still 200 m tall)');
  const laneB = panel.getPierLaneWorldDirection(b);
  assert.ok(laneA && laneB0 && laneB && (Math.abs(laneB.x - laneB0.x) > 0.5 || Math.abs(laneB.z - laneB0.z) > 0.5), 'b was turned');
  console.log('  ✓ A pier with no straight way out is turned to a level heading that clears the zones');
}

// --- Test 9: Spread pushes a pier's prongs to the plot's edges (its clamp onto the wall its prongs
// face), keeping its level and heading, its zones apart from other piers' ---
{
  const a = makePier(0, [-2000, 1000, 1500]);
  const v = makeViewer([a]);
  const pb = panel.getPlotBoundingBox(PLOT);
  const lengths = () => (panel.getPierClampTunnelShapes(a, pb, v) || []).map(t => t.length);
  const before = lengths();
  const y0 = a.position.y, q0 = a.quaternion.clone();
  panel.pushPierProngsToEdges(v.modulesGroup.children, pb, v);
  const after = lengths();
  assert.ok(Math.max(...after) < Math.max(...before) - 1000, `its tunnel shortened (${before.map(Math.round)} -> ${after.map(Math.round)})`);
  // its box flush with the wall its prong faces
  const dir = (panel.getPierClampTunnelShapes(a, pb, v) || [])[0].direction;
  const fb = wbox(v, a);
  const flush = Math.abs(dir.x) > 0.5 ? (dir.x > 0 ? Math.abs(fb.max.x - pb.maxX) : Math.abs(fb.min.x - pb.minX)) : (dir.z > 0 ? Math.abs(fb.max.z - pb.maxZ) : Math.abs(fb.min.z - pb.minZ));
  assert.ok(flush < 1, `its box on the wall its prong faces (${Math.round(flush)} m off)`);
  assert.ok(Math.abs(a.position.y - y0) < 1e-6 && a.quaternion.angleTo(q0) < 1e-6, 'level and heading kept (the top and bottom do not count)');
  const b = wbox(v, a);
  assert.ok(b.min.x >= pb.minX - 1 && b.max.x <= pb.maxX + 1 && b.min.z >= pb.minZ - 1 && b.max.z <= pb.maxZ + 1, 'inside the plot');
  console.log('  ✓ Spread pushes a pier prong to the plot edge');
}

// --- Test 10: every placement puts a pier onto the wall its unpaired prong faces (a T pier's middle
// prong), so that exclusion zone is as short as it can be; level and heading kept ---
{
  const a = makePier(0, [-1000, 500, 1000]);
  const v = makeViewer([a]);
  const pb = panel.getPlotBoundingBox(PLOT);
  const before = Math.max(...(panel.getPierClampTunnelShapes(a, pb, v) || []).map(t => t.length));
  const y0 = a.position.y, z0 = a.position.z;
  panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v);
  const shapes = panel.getPierClampTunnelShapes(a, pb, v) || [];
  const dir = shapes[0].direction, fb = wbox(v, a);
  const flush = Math.abs(dir.x) > 0.5 ? (dir.x > 0 ? Math.abs(fb.max.x - pb.maxX) : Math.abs(fb.min.x - pb.minX)) : (dir.z > 0 ? Math.abs(fb.max.z - pb.maxZ) : Math.abs(fb.min.z - pb.minZ));
  assert.ok(flush < 1 && Math.max(...shapes.map(t => t.length)) < before, `onto the wall its prong faces (${Math.round(flush)} m off)`);
  assert.ok(Math.abs(a.position.y - y0) < 1e-6 && Math.abs(a.position.z - z0) < 1e-6, 'level kept, and no slide along the wall');
  console.log('  ✓ Every placement puts a pier onto the wall its unpaired prong faces');
}

// --- Test 11: 1M dock areas take the plot's corners; 3M, 8M and S/M maintenance bays the middle of a
// wall's length; all at their level, out of the zones ---
{
  const one = makeModule(1, 'dockarea_arg_m_station_01_lowtech_macro', [400, 200, 400], [0, 1000, 0]);
  const three = makeModule(2, 'dockarea_arg_m_station_02_lowtech_macro', [400, 240, 400], [500, 1000, 500]);
  const eight = makeModule(3, 'dockarea_arg_m_02_tradestation_01_macro', [1200, 240, 800], [-500, 1000, -500]);
  const bay = makeModule(4, 'buildmodule_gen_equip_m_dockarea_01_macro', [1200, 490, 800], [1500, 1000, 0]);
  assert.ok(panel.isCornerDockArea(one) && !panel.isCornerDockArea(three) && !panel.isCornerDockArea(eight) && !panel.isCornerDockArea(bay), '1M only takes corners');
  assert.ok(!panel.isCornerDockArea({ userData: { macro: 'dockarea_ter_m_station_01_hightech_macro' } }), 'a Terran 4M10S is not 1M');
  const v = makeViewer([one, three, eight, bay]);
  const pb = panel.getPlotBoundingBox(PLOT);
  panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v);
  const on = (b) => [Math.abs(b.max.x - pb.maxX) < 1, Math.abs(b.min.x - pb.minX) < 1, Math.abs(b.max.z - pb.maxZ) < 1, Math.abs(b.min.z - pb.minZ) < 1].filter(Boolean).length;
  const ob = wbox(v, one);
  assert.strictEqual(on(ob), 2, '1M dock area in a corner (on two walls)');
  for (const m of [three, eight, bay]) {
    const b = wbox(v, m);
    assert.strictEqual(on(b), 1, `#${m.userData.index} on one wall`);
    const alongX = Math.abs(b.max.z - pb.maxZ) < 1 || Math.abs(b.min.z - pb.minZ) < 1;
    const off = alongX ? Math.abs((b.min.x + b.max.x) / 2 - (pb.minX + pb.maxX) / 2) : Math.abs((b.min.z + b.max.z) / 2 - (pb.minZ + pb.maxZ) / 2);
    assert.ok(off < 1, `#${m.userData.index} in the middle of its wall (${Math.round(off)} m off)`);
  }
  for (const m of [one, three, eight, bay]) { const b = wbox(v, m); assert.ok(Math.abs((b.min.y + b.max.y) / 2 - 1000) < 1, `#${m.userData.index} keeps its level`); }
  checkClean(v, pb, 'Test 11');
  console.log('  ✓ 1M dock areas take the corners, the others the middle of a wall');
}

// --- Test 12: every dock area's longest side along its wall; no dock over or under another; with
// Spread, dock areas on walls of their own, as close as they can between the piers ---
{
  const longAlong = (v, m, pb) => {
    const b = wbox(v, m), lx = b.max.x - b.min.x, lz = b.max.z - b.min.z;
    const onX = Math.abs(b.max.x - pb.maxX) < 1 || Math.abs(b.min.x - pb.minX) < 1;
    const onZ = Math.abs(b.max.z - pb.maxZ) < 1 || Math.abs(b.min.z - pb.minZ) < 1;
    return (onX && lz >= lx - 1) || (onZ && lx >= lz - 1);
  };
  const footprintsApart = (v, mods) => {
    for (let i = 0; i < mods.length; i++) for (let j = i + 1; j < mods.length; j++) {
      if (panel.isPierModule(mods[i]) && panel.isPierModule(mods[j])) continue;
      const a = wbox(v, mods[i]), b = wbox(v, mods[j]);
      assert.ok(!(Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 && Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.5),
        `#${mods[i].userData.index} and #${mods[j].userData.index}: not over one another`);
    }
  };
  for (const spread of [false, true]) {
    const p1 = makePier(0, [6000, 0, -2000]);
    const p2 = makePier(1, [6000, 3000, 2500]);
    const areas = [
      makeModule(2, 'dockarea_arg_m_02_tradestation_01_macro', [1200, 240, 800], [0, 0, 0]),
      makeModule(3, 'buildmodule_gen_equip_m_dockarea_01_macro', [1200, 490, 800], [0, 2000, 0]),
      makeModule(4, 'dockarea_arg_m_station_02_lowtech_macro', [400, 240, 400], [0, 4000, 0])
    ];
    const v = makeViewer([p1, p2, ...areas]);
    const pb = panel.getPlotBoundingBox(PLOT);
    panel.placeModulesAroundDocks(v.modulesGroup.children, pb, v, { spread });
    // The S/M maintenance bay (#3) faces its wall with its short side; the others lie long side along it
    for (const m of areas) {
      if (panel.isShortSideToWallDock(m)) {
        const b = wbox(v, m), lx = b.max.x - b.min.x, lz = b.max.z - b.min.z;
        const onX = Math.abs(b.max.x - pb.maxX) < 1 || Math.abs(b.min.x - pb.minX) < 1;
        assert.ok(onX ? lx > lz + 1 : lz > lx + 1, `${spread ? 'spread' : 'plain'}: S/M bay #${m.userData.index} short side facing its wall (${Math.round(lx)} x ${Math.round(lz)})`);
      } else {
        assert.ok(longAlong(v, m, pb), `${spread ? 'spread' : 'plain'}: #${m.userData.index} long side along its wall`);
      }
    }
    assert.ok(panel.isShortSideToWallDock(areas[1]) && !panel.isShortSideToWallDock(areas[0]) && !panel.isShortSideToWallDock(areas[2]), 'only the S/M bay faces the wall short side');
    footprintsApart(v, v.modulesGroup.children);
    checkClean(v, pb, `Test 12 ${spread ? 'spread' : 'plain'}`);
    if (spread) {
      const wallOfBox = (b) => Math.abs(b.max.x - pb.maxX) < 1 ? '+x' : Math.abs(b.min.x - pb.minX) < 1 ? '-x' : Math.abs(b.max.z - pb.maxZ) < 1 ? '+z' : '-z';
      const walls = areas.map(m => wallOfBox(wbox(v, m)));
      assert.strictEqual(new Set(walls).size, 3, `spread: each dock area on a wall of its own (${walls})`);
    }
  }
  console.log('  ✓ Dock areas long side along their wall, none over another; Spread puts them on walls of their own');
}

console.log('✓ Verified: docks first, then the remaining modules placed with overlap checks against docks, pier zones and placed modules.');
