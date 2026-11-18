import assert from 'assert';
import fs from 'fs';
import * as THREE from 'three';
import {
  getPierLaneDirection,
  getPierLaneWorldDirection,
  nearestPlotWallNormal,
  orientPierLanesOutward,
  applyDocksVerticalOrientation,
  applyDocksPerimeterPlacement,
  getPlotBoundingBox
} from '../src/module-display-panel.js';
import { computeModuleGroupRotation, computeX4RotationFromModuleGroup } from '../packages/adapter-three/src/math/rotation-math.js';
import { parseConnections, laneDirectionFromConnections } from '../generate_pier_lanes.js';

console.log('[*] Testing pier docking lanes always point out of the plot BB...');

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// 1. Lane data: from the attachment snap towards the docking bays
assert.deepStrictEqual(getPierLaneDirection('pier_arg_harbor_04_macro'), { x: -1, z: 0 });
assert.deepStrictEqual(getPierLaneDirection('pier_bor_harbor_02_macro'), { x: 1, z: 0 });
assert.deepStrictEqual(getPierLaneDirection('pier_arg_single_01_tradestation_01_macro'), { x: 0, z: 1 });
assert.strictEqual(getPierLaneDirection('pier_bor_harbor_04_macro'), null, 'hub pier with bays all around has no lane');
assert.strictEqual(getPierLaneDirection('dockarea_arg_m_station_01_macro'), null, 'docks are not piers');
// Unknown faction variant falls back to the same shape under another faction
assert.deepStrictEqual(getPierLaneDirection('pier_xen_harbor_01_macro'), null);
assert.deepStrictEqual(getPierLaneDirection('pier_tel_harbor_01_macro'), { x: -1, z: 0 });
console.log('  ✓ [PASS] lane directions per pier');

const harbor04 = parseConnections(fs.readFileSync(new URL('../assets1/structures/dock/pier_arg_harbor_04.xml', import.meta.url), 'utf8'));
assert.deepStrictEqual(laneDirectionFromConnections(harbor04), { x: -1, z: 0 }, 'generator reads snap at origin, bay at -263 X');
const hub = laneDirectionFromConnections([
  { tags: ['snap'], position: { x: 0, y: 0, z: 0 } },
  ...[[2000, 0], [0, 2000], [-2000, 0], [0, -2000]].map(([x, z]) => ({ tags: ['dockingbay'], position: { x, y: 0, z } }))
]);
assert.strictEqual(hub, null, 'bays all around give no lane');
console.log('  ✓ [PASS] generator derives lanes from component connections');

// 2. Scene direction: X4 component space mirrors X into the module mesh. Checked against the loaded
// pier_arg_harbor_04 at plan yaw 180, whose geometryinvisible lane volume sits 2000 m along scene +X.
function makePier(macro, index, yaw, pos) {
  const g = new THREE.Group();
  g.userData = { macro, index, initialSize: { x: 400, y: 100, z: 300 } };
  g.rotation.copy(computeModuleGroupRotation(yaw, 0, 0));
  g.position.set(pos.x, pos.y, pos.z);
  g.updateMatrixWorld(true);
  return g;
}
const at180 = getPierLaneWorldDirection(makePier('pier_arg_harbor_04_macro', 1, 180, { x: 0, y: 0, z: 0 }));
assert.ok(Math.abs(at180.x - 1) < 1e-6 && Math.abs(at180.z) < 1e-6, `yaw 180 lane must be +X, got ${JSON.stringify(at180)}`);
const at0 = getPierLaneWorldDirection(makePier('pier_arg_harbor_04_macro', 1, 0, { x: 0, y: 0, z: 0 }));
assert.ok(Math.abs(at0.x + 1) < 1e-6, 'yaw 0 lane must be -X');
console.log('  ✓ [PASS] lane direction in scene space follows module rotation');

// 3. Nearest wall
const pb = getPlotBoundingBox({ x: { plus: 10, minus: 10 }, y: { plus: 10, minus: 10 }, z: { plus: 10, minus: 10 } });
assert.deepStrictEqual(nearestPlotWallNormal({ x: 9000, z: 0 }, pb), { x: 1, z: 0 });
assert.deepStrictEqual(nearestPlotWallNormal({ x: -9000, z: 500 }, pb), { x: -1, z: 0 });
assert.deepStrictEqual(nearestPlotWallNormal({ x: 0, z: 9500 }, pb), { x: 0, z: 1 });
assert.deepStrictEqual(nearestPlotWallNormal({ x: 100, z: -9500 }, pb), { x: 0, z: -1 });
console.log('  ✓ [PASS] nearest plot wall normal');

// 4. Every dock orientation and perimeter placement turns the piers' lanes outwards
function makeViewer() {
  const piers = [
    makePier('pier_arg_harbor_04_macro', 1, 180, { x: -5400, y: 0, z: 5000 }),
    makePier('pier_bor_harbor_02_macro', 2, 0, { x: 8000, y: 0, z: 0 }),
    makePier('pier_tel_harbor_03_macro', 3, 90, { x: 0, y: 0, z: 8500 }),
    makePier('pier_arg_single_01_tradestation_01_macro', 4, 0, { x: 0, y: 0, z: -7000 }),
    makePier('pier_bor_harbor_04_macro', 5, 37, { x: 2000, y: 0, z: 2000 })
  ];
  const modulesGroup = new THREE.Group();
  piers.forEach(p => modulesGroup.add(p));
  const viewer = {
    currentPlotConfig: { x: { plus: 10, minus: 10 }, y: { plus: 10, minus: 10 }, z: { plus: 10, minus: 10 } },
    modulesGroup,
    currentPlan: { modules: piers.map(p => ({ index: p.userData.index, macro: p.userData.macro, position: { x: 0, y: 0, z: 0 }, rotation: computeX4RotationFromModuleGroup(p, { decimals: 3 }) })) },
    getModuleInitialSize: (m) => m.userData.initialSize,
    getModuleCalculatedRotation(index, options) {
      return computeX4RotationFromModuleGroup(modulesGroup.children.find(c => c.userData.index === index), options);
    }
  };
  return viewer;
}

function assertLanesOutward(viewer, label) {
  for (const mod of viewer.modulesGroup.children) {
    const dir = getPierLaneWorldDirection(mod);
    if (!dir) {
      assert.strictEqual(mod.userData.macro, 'pier_bor_harbor_04_macro', `${label}: only the hub pier has no lane`);
      assert.ok(Math.abs(mod.rotation.y - computeModuleGroupRotation(37, 0, 0).y) < 1e-9, `${label}: hub pier is left as it was`);
      continue;
    }
    const pb = getPlotBoundingBox(viewer.currentPlotConfig);
    const out = nearestPlotWallNormal(mod.position, pb);
    // Out through its nearest wall, or (Spread slides piers into corners) through a wall its box is on
    // (these piers have no geometry: their catalog size around their position stands for the box)
    const s = mod.userData.initialSize, half = Math.max(s.x, s.y, s.z) / 2 + 1, q = mod.position;
    const onWallItFaces = (dir.x > 0.9999 && pb.maxX - q.x <= half) || (dir.x < -0.9999 && q.x - pb.minX <= half) ||
      (dir.z > 0.9999 && pb.maxZ - q.z <= half) || (dir.z < -0.9999 && q.z - pb.minZ <= half);
    assert.ok(dir.x * out.x + dir.z * out.z > 0.9999 || onWallItFaces,
      `${label}: ${mod.userData.macro} lane ${JSON.stringify(dir)} must point out through wall ${JSON.stringify(out)}`);
    const planMod = viewer.currentPlan.modules.find(m => m.index === mod.userData.index);
    const rot = computeX4RotationFromModuleGroup(mod, { decimals: 3 });
    assert.strictEqual(planMod.rotation.yaw, rot.yaw, `${label}: plan yaw synced for ${mod.userData.macro}`);
  }
}

for (const orient of ['top', 'center', 'bottom']) {
  const viewer = makeViewer();
  applyDocksVerticalOrientation(orient, viewer);
  assertLanesOutward(viewer, `orientation ${orient}`);
}
console.log('  ✓ [PASS] top / center / bottom orientations point every pier lane out of the plot');

for (const sel of [['spread'], ['stacked'], ['lanes'], ['spread', 'stacked', 'lanes']]) {
  const viewer = makeViewer();
  applyDocksPerimeterPlacement(new Set(sel), viewer);
  assertLanesOutward(viewer, `perimeter ${sel.join('+')}`);
}
console.log('  ✓ [PASS] perimeter placements point every pier lane out of the plot');

// Already outward: no turn
{
  const viewer = makeViewer();
  orientPierLanesOutward(viewer.modulesGroup.children, getPlotBoundingBox(viewer.currentPlotConfig), viewer);
  assert.strictEqual(orientPierLanesOutward(viewer.modulesGroup.children, getPlotBoundingBox(viewer.currentPlotConfig), viewer), 0,
    'a second pass turns nothing');
}
console.log('  ✓ [PASS] orienting is idempotent');

console.log('\n[SUCCESS] Pier lanes point outwards from the plot BB for every dock orientation');
