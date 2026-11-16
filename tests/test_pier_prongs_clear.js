/**
 * Pier prongs stay clear out to the plot wall: no other module may sit in the space a pier's
 * prongs reach through (its box, and a tunnel from each docking clamp to the plot wall). No module or
 * pier may be in those exclusion zones, snapped to the pier or not: they move out, inside the plot.
 * Applied after every docks layout.
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

console.log('[*] Testing that nothing blocks a pier\'s prongs out to the plot wall...');
const GAP = 15;
const PLOT = { enabled: true, x: { plus: 10, minus: 10 }, z: { plus: 8, minus: 8 }, y: { plus: 5, minus: 5 } };

function box(name, size, center) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial());
  m.name = name;
  m.position.set(...center);
  return m;
}
// pier_arg_harbor_04: lanes along X4 -X, i.e. mesh +X; prongs extend that way from its snap at the
// origin. Plan yaw 180 turns mesh +X to scene +X, so by default the lanes face the +X wall.
function makePier(index, pos, yaw = 180) {
  const g = new THREE.Group();
  g.userData = { index, macro: 'pier_arg_harbor_04_macro', initialSize: new THREE.Vector3(1000, 200, 600) };
  g.add(box('part_main-lod0', [1000, 200, 600], [500, 0, 0]));
  const lane = box('geometryinvisible-lod0', [4000, 2000, 2000], [2000, 0, 0]);
  lane.userData.isGeometryInvisible = true;
  g.add(lane);
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
function makeViewer(mods, predecessors = {}) {
  const v = Object.create(StationViewer.prototype);
  v.modulesGroup = new THREE.Group();
  v.currentPlotConfig = PLOT;
  v.renderScene = () => {};
  v.stationPlotGroup = null;
  mods.forEach(m => v.modulesGroup.add(m));
  v.modulesGroup.updateMatrixWorld(true);
  v.currentPlan = {
    modules: mods.map(m => ({
      index: m.userData.index, macro: m.userData.macro,
      position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 },
      ...(predecessors[m.userData.index] !== undefined ? { predecessor: { index: predecessors[m.userData.index], connection: 'connectionsnap001' } } : {})
    }))
  };
  return v;
}
const byIndex = (v, i) => v.modulesGroup.children.find(m => m.userData.index === i);
const overlaps = (a, b) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5 &&
  Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.5;

function assertClear(v, label, exempt = new Set()) {
  assertNoPierOverlap(v, label);
  const pb = panel.getPlotBoundingBox(PLOT);
  for (const pier of v.modulesGroup.children.filter(m => panel.isPierModule(m))) {
    const cs = panel.getPierProngCorridors(pier, pb, v);
    for (const m of v.modulesGroup.children) {
      if (m === pier || exempt.has(m.userData.index)) continue;
      assert.ok(!cs.some(c => overlaps(c, v.getModuleWorldBoundingBox(m))), `${label}: ${m.userData.macro}#${m.userData.index} blocks pier #${pier.userData.index}'s prongs`);
    }
  }
}

function assertNoPierOverlap(v, label) {
  for (const pier of v.modulesGroup.children.filter(m => panel.isPierModule(m))) {
    const pb = v.getModuleWorldBoundingBox(pier);
    for (const m of v.modulesGroup.children) {
      if (m !== pier) assert.ok(!overlaps(pb, v.getModuleWorldBoundingBox(m)), `${label}: pier #${pier.userData.index}'s BB overlaps ${m.userData.macro}#${m.userData.index}`);
    }
  }
}

// 1. The corridors: the pier's own box, and a square zone from its clamp (pier_arg_harbor_04 has one, at
// mesh (263.7, 31.2, 0) facing mesh +X) out to the wall
const H = panel.PIER_CLAMP_TUNNEL_HALF;
{
  const pier = makePier(1, [2000, 0, 0]);
  const v = makeViewer([pier]);
  const pb = panel.getPlotBoundingBox(PLOT);
  const [own, ...tunnels] = panel.getPierProngCorridors(pier, pb, v);
  const b = v.getModuleWorldBoundingBox(pier);
  assert.deepStrictEqual(own, { min: { ...b.min }, max: { ...b.max } }, 'the pier\'s own box');
  assert.strictEqual(tunnels.length, 1, 'one tunnel for the one clamp');
  const t = tunnels[0];
  const clamp = pier.localToWorld(new THREE.Vector3(263.724, 31.223, 0));
  assert.ok(Math.abs(t.min.x - clamp.x) < 1e-3 && Math.abs(t.max.x - pb.maxX) < 1e-6, 'tunnel runs from the clamp to the +X wall');
  assert.ok(Math.abs(t.min.z - (clamp.z - H)) < 1e-3 && Math.abs(t.max.z - (clamp.z + H)) < 1e-3, 'as wide as the tunnel, centred on the clamp');
  assert.ok(Math.abs(t.min.y - (clamp.y - H)) < 1e-3 && Math.abs(t.max.y - (clamp.y + H)) < 1e-3, 'as tall as wide, centred on the clamp');
  // The square is 4000 m on a side
  assert.strictEqual(panel.PIER_PRONG_ZONE_SIZE, 4000, 'zone side 4000 m');
  assert.strictEqual(2 * H, panel.PIER_PRONG_ZONE_SIZE);
  // Turned 90°: the lane runs along scene ∓Z
  const turned = makePier(2, [0, 0, 0], 90);
  assert.ok(Math.abs(Math.abs(panel.getPierLaneWorldDirection(turned).z) - 1) < 1e-9, 'yaw 90: lane along Z');
  const v2 = makeViewer([turned]);
  const dir = panel.getPierLaneWorldDirection(turned);
  const t2 = panel.getPierProngCorridors(turned, pb, v2)[1];
  if (dir.z > 0) assert.ok(Math.abs(t2.max.z - pb.maxZ) < 1e-6);
  else assert.ok(Math.abs(t2.min.z - pb.minZ) < 1e-6, 'turned pier: tunnel to the Z wall its clamp faces');
  // The drawn shape (viewer exclusion zones) is the same tunnel
  const [shape] = panel.getPierClampTunnelShapes(pier, pb, v);
  assert.ok(Math.abs(shape.length - (t.max.x - t.min.x)) < 1e-3 && Math.abs(shape.width - (t.max.z - t.min.z)) < 1e-3 && Math.abs(shape.height - (t.max.y - t.min.y)) < 1e-3, 'shape sized as the tunnel');
  assert.ok(Math.abs(shape.center.x - (t.min.x + t.max.x) / 2) < 1e-3 && Math.abs(Math.cos(shape.yaw) - 1) < 1e-6, 'shape centred on the tunnel, facing +X');
  // Every pier's prongs get the same square, whatever the pier's own size
  const narrow = makePier(3, [2000, 0, 0]);
  narrow.children[0].geometry = new THREE.BoxGeometry(1000, 200, 200);
  const v3 = makeViewer([narrow]);
  const nt = panel.getPierProngCorridors(narrow, pb, v3)[1];
  assert.ok(Math.abs((nt.max.z - nt.min.z) - 2 * H) < 1e-3 && Math.abs((nt.max.y - nt.min.y) - 2 * H) < 1e-3, 'same square on a narrow pier');
  console.log('  ✓ prong corridors: pier box, and a tunnel from the clamp out to the wall it faces');
}

// 1b. A pier with clamps facing several ways (pier_arg_harbor_01: mesh +Z, -Z and +X) gets a tunnel
// for each; a module beside a sideways clamp moves out, one beside the pier but off every tunnel stays
{
  const PLOT_BIG = { enabled: true, x: { plus: 12, minus: 12 }, z: { plus: 12, minus: 12 }, y: { plus: 5, minus: 5 } };
  const mk = (index, pos) => {
    const g = new THREE.Group();
    g.userData = { index, macro: 'pier_arg_harbor_01_macro', initialSize: new THREE.Vector3(2400, 400, 3600) };
    g.add(box('part_main-lod0', [2400, 400, 3600], [600, 0, 0]));
    g.rotation.copy(computeModuleGroupRotation(180, 0, 0));
    g.position.set(...pos);
    return g;
  };
  const pier = mk(1, [0, 0, 0]);
  const v0 = makeViewer([pier]);
  v0.currentPlotConfig = PLOT_BIG;
  const pb = panel.getPlotBoundingBox(PLOT_BIG);
  const tunnels = panel.getPierProngCorridors(pier, pb, v0).slice(1);
  assert.strictEqual(tunnels.length, 3, 'three clamps, three tunnels');
  const reaches = (wall) => tunnels.some(t => Math.abs((wall.startsWith('max') ? t.max : t.min)[wall.slice(3).toLowerCase()] - pb[wall]) < 1e-6);
  for (const w of ['maxZ', 'minZ']) assert.ok(reaches(w), `a tunnel reaches the ${w} wall`);
  assert.ok(reaches('maxX') || reaches('minX'), 'the main clamp\'s tunnel reaches its X wall');

  // A module 3 km out from the pier on scene +Z: in front of the +Z clamp
  const sideBlocker = makeModule(2, 'hab_arg_l_01_macro', [400, 300, 400], [0, 0, 4000]);
  // One off to the side of the +Z tunnel, out of every tunnel and the pier box
  const offTunnel = makeModule(3, 'hab_arg_l_01_macro', [400, 300, 400], [-2500, 0, 4000]);
  const v = makeViewer([mk(1, [0, 0, 0]), sideBlocker, offTunnel]);
  v.currentPlotConfig = PLOT_BIG;
  const before = offTunnel.position.clone();
  const startTunnels = panel.getPierProngCorridors(byIndex(v, 1), pb, v).slice(1);
  assert.ok(startTunnels.some(t => overlaps(t, v.getModuleWorldBoundingBox(sideBlocker))), 'blocker starts in a sideways tunnel');
  assert.ok(!overlaps(v.getModuleWorldBoundingBox(byIndex(v, 1)), v.getModuleWorldBoundingBox(sideBlocker)), 'and off the pier itself');
  assert.ok(!startTunnels.some(t => overlaps(t, v.getModuleWorldBoundingBox(offTunnel))), 'the other module starts off every tunnel');
  panel.clearPierProngCorridors(v.modulesGroup.children, pb, v, { gap: GAP });
  v.modulesGroup.updateMatrixWorld(true);
  const p = byIndex(v, 1);
  for (const c of panel.getPierProngCorridors(p, pb, v)) {
    assert.ok(!overlaps(c, v.getModuleWorldBoundingBox(byIndex(v, 2))), 'module in front of a sideways clamp moved out of its tunnel');
  }
  assert.ok(offTunnel.position.distanceTo(before) < 1e-6, 'a module off every tunnel stays');
  assertClear(v, 'multi-clamp pier');
  // Two T piers in one place: their side prongs' zones run along each other, so one has to move a
  // whole zone away (measured from its zones, not its box)
  const twins = makeViewer([mk(1, [0, 0, 0]), mk(2, [0, 0, 0])]);
  twins.currentPlotConfig = PLOT_BIG;
  panel.clearPierProngCorridors(twins.modulesGroup.children, pb, twins, { gap: GAP });
  twins.modulesGroup.updateMatrixWorld(true);
  assertClear(twins, 'two T piers in one place');
  console.log('  ✓ a pier with clamps facing three ways keeps all three tunnels clear');
}

// 1c. Diagonal clamps (pier_ter_tradestation_01 has six, some at 45°) give tunnels as short pieces
// that stay near the clamp's line
{
  const g = new THREE.Group();
  g.userData = { index: 1, macro: 'pier_ter_tradestation_01_macro', initialSize: new THREE.Vector3(600, 200, 600) };
  g.add(box('part_main-lod0', [600, 200, 600], [0, 0, 0]));
  const v = makeViewer([g]);
  const PLOT_BIG = { enabled: true, x: { plus: 12, minus: 12 }, z: { plus: 12, minus: 12 }, y: { plus: 5, minus: 5 } };
  const pb = panel.getPlotBoundingBox(PLOT_BIG);
  const pieces = panel.getPierProngCorridors(g, pb, v).slice(1);
  assert.ok(pieces.length > 6, 'diagonal tunnels are split into pieces');
  const clamp = g.localToWorld(new THREE.Vector3(1955.013, -41.028, 1955.014));
  const shape = panel.getPierClampTunnelShapes(g, pb, v).find(t => Math.hypot(t.clamp.x - clamp.x, t.clamp.z - clamp.z) < 1);
  assert.ok(shape && shape.pieces.length >= 2, 'pieces run out along the diagonal');
  const n = { x: -shape.direction.z, z: shape.direction.x };
  for (const pc of shape.pieces) {
    // Each 500 m piece's corners stay within half a piece of the tunnel's sides
    for (const x of [pc.min.x, pc.max.x]) for (const z of [pc.min.z, pc.max.z]) {
      const off = Math.abs((x - clamp.x) * n.x + (z - clamp.z) * n.z);
      assert.ok(off < H + 250 + 1, 'a piece hugs its diagonal tunnel');
    }
  }
  console.log('  ✓ diagonal clamp tunnels are covered by short pieces along the diagonal');
}

// 1d. Every pier gets its zones, whatever its orientation: a tilted pier's zone tilts with it out to
// the plot face it reaches; a pier outside the plot keeps a zone one zone length long
{
  const pb = panel.getPlotBoundingBox(PLOT);
  for (const [yaw, pitch, roll] of [[180, 40, 0], [180, 90, 0], [90, 0, 60], [30, -70, 20]]) {
    const g = makePier(1, [0, 0, 0]);
    g.rotation.copy(computeModuleGroupRotation(yaw, pitch, roll));
    const v = makeViewer([g]);
    const shapes = panel.getPierClampTunnelShapes(g, pb, v);
    assert.strictEqual(shapes.length, 1, `yaw ${yaw} pitch ${pitch} roll ${roll}: the clamp has its zone`);
    const t = shapes[0];
    // The zone's way out is the clamp's mesh +X turned with the pier
    const want = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
    assert.ok(Math.abs(t.direction.x - want.x) < 1e-6 && Math.abs(t.direction.y - want.y) < 1e-6 && Math.abs(t.direction.z - want.z) < 1e-6, 'zone tilts with the pier');
    const end = ['x', 'y', 'z'].map(k => t.clamp[k] + t.direction[k] * t.length);
    const onFace = [['x', pb.minX, pb.maxX], ['y', pb.minY, pb.maxY], ['z', pb.minZ, pb.maxZ]]
      .some(([k, lo, hi], i) => Math.abs(end[i] - lo) < 1e-3 || Math.abs(end[i] - hi) < 1e-3);
    assert.ok(onFace, 'zone runs to a plot face');
    assert.ok(t.pieces.length >= 1 && Math.abs(t.width - 2 * H) < 1e-9 && Math.abs(t.height - 2 * H) < 1e-9, 'same square');
    // Something in a tilted pier's zone moves out of it
    const mid = ['x', 'y', 'z'].map(k => t.clamp[k] + t.direction[k] * Math.min(t.length, 3000));
    const blocker = makeModule(2, 'hab_arg_l_01_macro', [300, 300, 300], mid);
    const v2 = makeViewer([makePier(1, [0, 0, 0]), blocker]);
    byIndex(v2, 1).rotation.copy(g.rotation);
    v2.modulesGroup.updateMatrixWorld(true);
    panel.clearPierProngCorridors(v2.modulesGroup.children, pb, v2, { gap: GAP });
    v2.modulesGroup.updateMatrixWorld(true);
    assertClear(v2, `tilted pier yaw ${yaw} pitch ${pitch} roll ${roll}`);
  }
  // The layouts level a tilted pier (keeping its heading) and turn its lanes out through the nearest wall
  for (const [pos, rot] of [[[0, 4000, 0], [0, 0, Math.PI / 2]], [[0, -4000, 0], [0, 0, -Math.PI / 2]], [[6000, 0, 0], [0.4, 0.3, 0.7]]]) {
    const g = makePier(1, pos);
    g.rotation.set(...rot);
    const v = makeViewer([g]);
    panel.orientPierLanesOutward([g], pb, v);
    const lane = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion);
    const n = panel.nearestPlotWallNormal({ x: pos[0], z: pos[2] }, pb);
    assert.ok(up.y > 0.9999, `tilted pier ${rot}: levelled`);
    assert.ok(lane.x * n.x + lane.z * n.z > 0.9999, `tilted pier ${rot}: lanes out through the nearest wall`);
  }
  // Outside the plot
  const out = makePier(1, [20000, 0, 0]);
  const vo = makeViewer([out]);
  const so = panel.getPierClampTunnelShapes(out, pb, vo);
  assert.strictEqual(so.length, 1, 'pier outside the plot keeps its zone');
  assert.strictEqual(so[0].length, panel.PIER_PRONG_ZONE_SIZE, 'one zone length long');
  console.log('  ✓ every pier has its zones: tilted ones tilt with it, ones outside the plot keep one zone length');
}

// 2. Blockers move out, also one snapped to the pier; a snapped module off the tunnels stays
{
  const pier = makePier(1, [2000, 0, 0]);
  const inFront = makeModule(2, 'hab_arg_l_01_macro', [600, 400, 600], [6000, 0, 0]);   // between the prongs and the wall
  const onProngs = makeModule(3, 'storage_arg_l_liquid_01_macro', [500, 500, 500], [2600, 0, 0]); // on the prongs
  const attached = makeModule(4, 'struct_arg_base_01_macro', [400, 400, 400], [2000, 300, 0]); // snapped on top of the pier
  const behind = makeModule(5, 'prod_gen_energycells_macro', [800, 400, 1500], [-3000, 0, 0]); // behind the pier: not in the way
  const snappedInTunnel = makeModule(6, 'struct_arg_base_01_macro', [400, 400, 400], [4500, 0, 0]); // snapped, but in the clamp's tunnel
  const v = makeViewer([pier, inFront, onProngs, attached, behind, snappedInTunnel], { 4: 1, 6: 1 });
  const before = { attached: attached.position.clone(), behind: behind.position.clone() };
  const moves = panel.clearPierProngCorridors(v.modulesGroup.children, panel.getPlotBoundingBox(PLOT), v, { gap: GAP });
  assert.ok(moves >= 3, `blocking modules moved (${moves})`);
  assertClear(v, 'blockers');
  assert.ok(attached.position.equals(before.attached), 'module snapped to the pier stays');
  assert.ok(behind.position.equals(before.behind), 'module behind the pier stays');
  assert.strictEqual(v.checkPlotBoundViolations(), false, 'moved modules stay inside the plot');
  for (const m of [inFront, onProngs, snappedInTunnel]) {
    for (const o of v.modulesGroup.children) {
      if (o !== m) assert.ok(!overlaps(v.getModuleWorldBoundingBox(m), v.getModuleWorldBoundingBox(o)), `moved #${m.userData.index} not onto #${o.userData.index}`);
    }
  }
  const pm = v.currentPlan.modules.find(m => m.index === 2);
  assert.deepStrictEqual([pm.position.x, pm.position.y, pm.position.z], [Math.round(inFront.position.x), Math.round(inFront.position.y), Math.round(-inFront.position.z)], 'plan position synced');
  console.log('  ✓ modules in front of or on the prongs move out; snapped ones too; modules off the tunnels stay');
}

// 3. Another pier in a pier's way moves too, and its own corridor is then kept clear
{
  const a = makePier(1, [0, 0, 0]);
  const b = makePier(2, [4000, 0, 0]);
  const v = makeViewer([a, b]);
  panel.clearPierProngCorridors(v.modulesGroup.children, panel.getPlotBoundingBox(PLOT), v, { gap: GAP });
  assertClear(v, 'pier in a pier\'s way');
  // Two piers in the same place (a stack collapsed to one level), with a module where the first
  // escape would land: the move goes on past it
  const p1 = makePier(1, [3000, 0, 0]);
  const p2 = makePier(2, [3000, 0, 0]);
  const neighbour = makeModule(3, 'hab_arg_l_01_macro', [1000, 400, 1000], [3500, 0, 950]);
  const v2 = makeViewer([p1, p2, neighbour]);
  panel.clearPierProngCorridors(v2.modulesGroup.children, panel.getPlotBoundingBox(PLOT), v2, { gap: GAP });
  assertClear(v2, 'piers in one place');
  for (const [x, y] of [[p1, p2], [p1, neighbour], [p2, neighbour]]) {
    assert.ok(!overlaps(v2.getModuleWorldBoundingBox(x), v2.getModuleWorldBoundingBox(y)), `#${x.userData.index} and #${y.userData.index} apart`);
  }
  console.log('  ✓ piers clear of each other\'s prongs, also when two share one place');
}

// 3b. No pier BB overlaps into any module: a module snapped to the pier but inside its box moves out;
// a pier on a fixed module moves itself
{
  const pier = makePier(1, [2000, 0, 0]);
  const snappedInside = makeModule(2, 'struct_arg_base_01_macro', [400, 400, 400], [2600, 0, 0]);
  const v = makeViewer([pier, snappedInside], { 2: 1 });
  panel.clearPierProngCorridors(v.modulesGroup.children, panel.getPlotBoundingBox(PLOT), v, { gap: GAP });
  assertNoPierOverlap(v, 'snapped module inside the pier');

  const pier2 = makePier(1, [2000, 0, 0]);
  const fixed = makeModule(2, 'dockarea_arg_m_station_01_lowtech_macro', [400, 260, 400], [2500, 0, 0]);
  const v2 = makeViewer([pier2, fixed]);
  const fixedAt = fixed.position.clone();
  panel.clearPierProngCorridors(v2.modulesGroup.children, panel.getPlotBoundingBox(PLOT), v2, { gap: GAP, isFixed: m => m === fixed });
  assert.ok(fixed.position.equals(fixedAt), 'fixed module stays');
  assertClear(v2, 'pier on a fixed module');
  // A fixed module in the pier's tunnel (not on the pier): the pier moves its tunnel off it
  const pier3 = makePier(1, [2000, 0, 0]);
  const fixedAhead = makeModule(2, 'dockarea_arg_m_station_01_lowtech_macro', [400, 260, 400], [6000, 0, 0]);
  const v3 = makeViewer([pier3, fixedAhead]);
  const pb3 = panel.getPlotBoundingBox(PLOT);
  assert.ok(panel.getPierProngCorridors(pier3, pb3, v3).slice(1).some(c => overlaps(c, v3.getModuleWorldBoundingBox(fixedAhead))), 'fixed module starts in the tunnel');
  const aheadAt = fixedAhead.position.clone();
  panel.clearPierProngCorridors(v3.modulesGroup.children, pb3, v3, { gap: GAP, isFixed: m => m === fixedAhead });
  assert.ok(fixedAhead.position.equals(aheadAt), 'fixed module stays');
  assertClear(v3, 'fixed module in the tunnel');
  console.log('  ✓ no pier BB overlaps into any module, snapped or fixed; no fixed module left in a tunnel');
}

// 4. After the docks layouts: Perimeter (all options) and vertical orientation
panel.addActionableElement({ id: 'layers:docks', decoratorId: 'layers', category: 'docks', layerNumber: 1, elementName: 'Docks-1' });
const station = () => [
  makePier(1, [0, 0, 0], 30),
  makePier(2, [-2000, 500, 3000], 200),
  makeModule(3, 'hab_arg_l_01_macro', [600, 400, 600], [8000, 0, 0]),
  makeModule(4, 'storage_arg_l_liquid_01_macro', [500, 500, 500], [-8000, 0, 0]),
  makeModule(5, 'prod_gen_energycells_macro', [800, 400, 1500], [0, 0, 6000]),
  makeModule(6, 'prod_gen_energycells_macro', [800, 400, 1500], [0, 0, -6000]),
  makeModule(7, 'dockarea_arg_m_station_01_lowtech_macro', [400, 260, 400], [3000, 0, -3000])
];
for (const orient of ['top', 'center', 'bottom']) {
  for (const sel of [['stacked'], ['spread', 'lanes'], ['lanes'], ['spread', 'stacked', 'lanes']]) {
    const v = makeViewer(station());
    panel.setDocksVerticalOrientation(orient, v);
    panel.applyDocksPerimeterPlacement(new Set(sel), v);
    assertClear(v, `perimeter ${orient} ${sel.join('+')}`);
    assert.strictEqual(v.checkPlotBoundViolations(), false, `perimeter ${orient} ${sel.join('+')}: inside the plot`);
  }
  const v = makeViewer(station());
  panel.applyDocksVerticalOrientation(orient, v);
  assertClear(v, `vertical ${orient}`);
  // a module snapped to a pier is left behind when the docks move: it may not end up inside the pier
  // or its tunnels
  const v2 = makeViewer([makePier(1, [0, 0, 0]), makeModule(2, 'struct_arg_base_01_macro', [400, 400, 400], [500, 3000, 0])], { 2: 1 });
  byIndex(v2, 2).position.y = orient === 'top' ? 4900 : (orient === 'bottom' ? -4900 : 0);
  panel.applyDocksVerticalOrientation(orient, v2);
  assertClear(v2, `vertical ${orient}, snapped module`);
}
// Perimeter "lanes" keeps piers where they are: a module between a pier and its wall must move
{
  const v = makeViewer([makePier(1, [5000, 0, 0], 0)]);
  panel.setDocksVerticalOrientation('center', v); // runs the vertical layout itself, before the blocker exists
  const blocker = makeModule(2, 'hab_arg_l_01_macro', [400, 400, 400], [8000, 0, 0]);
  v.modulesGroup.add(blocker);
  v.currentPlan.modules.push({ index: 2, macro: blocker.userData.macro, position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });
  panel.applyDocksPerimeterPlacement(new Set(['lanes']), v);
  assert.ok(panel.getPierLaneWorldDirection(byIndex(v, 1)).x > 0.99, 'pier lanes turned out through the nearest (+X) wall');
  assertClear(v, 'perimeter lanes, module in front of the pier');
}
console.log('  ✓ prongs clear after Perimeter placement and docks vertical orientation');

console.log('\n[SUCCESS] Nothing blocks a pier\'s prongs');
