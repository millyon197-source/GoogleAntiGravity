/**
 * Piers whose lane model was never extracted (spl harbors, most ter piers) get their lane volume from
 * the pier XML (src/pier-lane-boxes.json, generate_pier_lanes.js): a hidden box mesh the lane overlap
 * pass sees and module bounding boxes leave out. Piers with a lane model keep only that.
 */
import assert from 'assert';
import fs from 'fs';
import * as THREE from 'three';
import { laneBoxesFromXml, clampsFromXml } from '../generate_pier_lanes.js';
import { addXmlLaneBoxes } from '../packages/adapter-three/src/models/module-mesh-loader.js';
import { getDockInvisibleWorldBoundingBox, ensureNoDocksInvisibleOverlap } from '../src/module-display-panel.js';

console.log('[*] Testing pier lane boxes built from the pier XML...');

const BOXES = JSON.parse(fs.readFileSync(new URL('../src/pier-lane-boxes.json', import.meta.url), 'utf8'));
const OFFSETS = JSON.parse(fs.readFileSync(new URL('../src/component-offsets.json', import.meta.url), 'utf8'));
const PART_MAIN = JSON.parse(fs.readFileSync(new URL('../src/part-main-offsets.json', import.meta.url), 'utf8'));

// 1. XML parsing: half-extents from <size><max>, centre from the offset, X mirrored to mesh space
const xml = `<component><connections>
  <connection name="C1" tags="part dockingbay"><offset><position x="-1784" y="0" z="0"/></offset></connection>
  <connection name="C2" tags="part nocollision geometryinvisible  ">
    <offset><position x="-1600" y="10" z="5"/></offset>
    <parts><part name="bounding_box"><size><max x="2200" y="1000" z="3800"/><center x="0" y="0" z="0"/></size></part></parts>
  </connection>
  <connection name="C3" tags="part geometryinvisible">
    <offset><position x="0" y="0" z="0"/><quaternion qx="0" qy="0.7071068" qz="0" qw="0.7071068"/></offset>
    <parts><part name="lane_2"><size><max x="100" y="50" z="300"/><center x="0" y="0" z="200"/></size></part></parts>
  </connection>
</connections></component>`;
const parsed = laneBoxesFromXml(xml);
assert.strictEqual(parsed.length, 2, 'one box per geometryinvisible connection, docking bays ignored');
assert.deepStrictEqual(parsed[0], { part: 'bounding_box', center: [1600, 10, 5], halfSize: [2200, 1000, 3800], quaternion: [0, 0, 0, 1] });
// 90° yaw turns the size centre (0,0,200) to (200,0,0) in X4, (-200,0,0) mirrored
assert.deepStrictEqual(parsed[1].center, [-200, 0, 0]);
assert.deepStrictEqual(parsed[1].quaternion, [0, -0.707, 0, 0.707]);
console.log('  ✓ lane volumes read from the XML');

// 2. Generated data: the piers without a lane model are covered, and the mirroring matches the
// placement of extracted lane models (component-offsets.json)
const noModel = ['pier_spl_harbor_01', 'pier_spl_harbor_02', 'pier_spl_harbor_03', 'pier_ter_harbor_01',
  'pier_ter_harbor_02', 'pier_ter_harbor_04', 'pier_ter_harbor_05', 'pier_ter_tradestation_01'];
for (const key of noModel) assert.ok(BOXES[key]?.length >= 1, `${key} has an XML lane box`);
assert.strictEqual(BOXES.pier_bor_tradestation_01, undefined, 'bor_tradestation_01 defines no lane volume');
// Where a lane model was extracted, the XML box covers exactly the model's vertices as the loader
// places them (part-main shift + component offset)
const DOCK = new URL('../assets1/structures/dock/', import.meta.url);
let compared = 0;
for (const key of Object.keys(BOXES)) {
  const dir = new URL(`${key}_data/`, DOCK);
  if (!fs.existsSync(dir)) continue;
  const file = fs.readdirSync(dir).find(n => /^(bounding_box|geometryinvisible)-lod0\.dae$/.test(n));
  if (!file) continue;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const [, id, body] of fs.readFileSync(new URL(file, dir), 'utf8').matchAll(/<float_array id="([^"]+)"[^>]*>([^<]*)<\/float_array>/g)) {
    if (!/position/i.test(id)) continue;
    const v = body.trim().split(/\s+/).map(Number);
    for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[i + k]); max[k] = Math.max(max[k], v[i + k]); }
  }
  const off = OFFSETS[key]?.[file.split('-')[0]] || [0, 0, 0];
  const shift = PART_MAIN[key] ? [-PART_MAIN[key][0], PART_MAIN[key][1], PART_MAIN[key][2]] : [0, 0, 0];
  const b = BOXES[key][0];
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(min[k] + off[k] + shift[k] - (b.center[k] - b.halfSize[k])) < 1, `${key}: lane box min[${k}] matches its model`);
    assert.ok(Math.abs(max[k] + off[k] + shift[k] - (b.center[k] + b.halfSize[k])) < 1, `${key}: lane box max[${k}] matches its model`);
  }
  compared++;
}
if (fs.existsSync(DOCK)) assert.ok(compared >= 16, `compared ${compared} piers with an extracted lane model`);
// pier_ter_harbor_03's parts are placed by their XML offsets (they were all drawn at the origin)
const ter03 = OFFSETS.pier_ter_harbor_03;
assert.deepStrictEqual(ter03?.bounding_box?.map(v => Math.round(v) + 0), [1300, 0, 0], 'ter_harbor_03 lane model at its connection');
// The arrows' mesh has a <pivot> (0.619, 0.369, -79.495) on top of its connection (-440.638, -11.015, 0)
assert.ok(Math.abs(ter03.anim_arrows[0] - 440.0188) < 0.01 && Math.abs(ter03.anim_arrows[2] - -79.49484) < 0.01 &&
  Math.abs(ter03.fx_decals[0] - 200.6352) < 0.01, 'ter_harbor_03 arrows (with their pivot) and decals placed');
console.log(`  ✓ ${Object.keys(BOXES).length} piers with lane boxes; ${compared} match their extracted lane model exactly`);

// 3. Loader: a box is added only when no lane model loaded
function pier(macro, boxes, { laneModel = false, x = 0 } = {}) {
  const group = new THREE.Group();
  group.position.set(-1000, 0, 0); // a part-main shift
  const hull = new THREE.Group();
  hull.add(new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200)));
  const scenes = [hull];
  if (laneModel) {
    const lane = new THREE.Group();
    lane.userData.isGeometryInvisible = true;
    lane.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));
    scenes.push(lane);
  }
  scenes.forEach(s => group.add(s));
  const added = addXmlLaneBoxes(group, scenes, boxes);
  const root = new THREE.Group();
  root.add(group);
  root.userData.macro = macro;
  root.position.x = x;
  root.updateMatrixWorld(true);
  return { root, added };
}
const ter01 = BOXES.pier_ter_harbor_01;
const a = pier('pier_ter_harbor_01_macro', ter01);
assert.strictEqual(a.added.length, 1);
assert.strictEqual(a.added[0].visible, false, 'lane box hidden');
assert.ok(a.added[0].userData.isGeometryInvisible && a.added[0].userData.isBBox);
const box = getDockInvisibleWorldBoundingBox(a.root);
const c = ter01[0].center, h = ter01[0].halfSize;
for (const [i, k] of ['x', 'y', 'z'].entries()) {
  assert.ok(Math.abs(box.min[k] - (c[i] - h[i])) < 1e-6 && Math.abs(box.max[k] - (c[i] + h[i])) < 1e-6, `lane box ${k} in mesh space, despite the group shift`);
}
assert.strictEqual(pier('pier_arg_harbor_01_macro', BOXES.pier_arg_harbor_01, { laneModel: true }).added.length, 0, 'lane model present: no XML box');
assert.strictEqual(pier('pier_bor_tradestation_01_macro', undefined).added.length, 0, 'no lane data: nothing added');
console.log('  ✓ loader adds a hidden lane box only to piers without a lane model');

// 4. The lane overlap pass now separates two such piers
const p1 = pier('pier_ter_harbor_01_macro', ter01, { x: 0 }).root;
const p2 = pier('pier_ter_harbor_01_macro', ter01, { x: 1000 }).root;
ensureNoDocksInvisibleOverlap([p1, p2], null);
p1.updateMatrixWorld(true);
p2.updateMatrixWorld(true);
const b1 = getDockInvisibleWorldBoundingBox(p1), b2 = getDockInvisibleWorldBoundingBox(p2);
assert.ok(!b1.intersectsBox(b2), 'lane boxes from the XML no longer overlap');
console.log('  ✓ lanes of piers without a lane model are kept apart');

// 5. Clamps: one per exclusion zone, starting at the docking bay facing the same way next to it
// (X mirrored to mesh space); a zone with no bay close by starts at the zone; no zones -> the bays
const CLAMPS = JSON.parse(fs.readFileSync(new URL('../src/pier-clamps.json', import.meta.url), 'utf8'));
const clampXml = `<component><connections>
  <connection name="Z1" tags="exclusionzone ship_xl"><offset><position x="0" y="0" z="1887"/></offset></connection>
  <connection name="Z2" tags="exclusionzone ship_xl"><offset><position x="-1886" y="0" z="0"/><quaternion qx="0" qy="0.7071066" qz="0" qw="-0.7071069"/></offset></connection>
  <connection name="Z3" tags="exclusionzone ship_xl"><offset><position x="0" y="2000" z="0"/><quaternion qx="0" qy="-1" qz="0" qw="0"/></offset></connection>
  <connection name="B1" tags="dockingbay"><offset><position x="0.2" y="0" z="1784"/></offset></connection>
  <connection name="B2" tags="dockingbay"><offset><position x="-1783" y="0" z="0"/><quaternion qx="0" qy="0.7071068" qz="0" qw="-0.7071067"/></offset></connection>
</connections></component>`;
assert.deepStrictEqual(clampsFromXml(clampXml), [
  { position: [-0.2, 0, 1784], direction: [0, 0, 1] },
  { position: [1783, 0, 0], direction: [1, 0, 0] },
  { position: [0, 2000, 0], direction: [0, 0, -1] }
]);
assert.deepStrictEqual(clampsFromXml(`<connections><connection name="B" tags="dockingbay"><offset><position x="1864" y="31" z="0"/><quaternion qx="0" qy="-0.7071068" qz="0" qw="-0.7071067"/></offset></connection></connections>`),
  [{ position: [-1864, 31, 0], direction: [-1, 0, 0] }], 'no exclusion zones: the bays');
assert.strictEqual(CLAMPS.pier_arg_harbor_01.length, 3, 'arg_harbor_01: three clamps');
assert.strictEqual(CLAMPS.pier_ter_tradestation_01.length, 6, 'ter_tradestation_01: six clamps');
assert.ok(CLAMPS.pier_bor_harbor_02?.length === 1, 'bor_harbor_02 (no zones) uses its bay');
console.log(`  ✓ docking clamps of ${Object.keys(CLAMPS).length} piers read from the XML`);

console.log('\n[SUCCESS] Pier lane boxes from the XML work');
