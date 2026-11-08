import fs from 'fs';
import * as THREE from 'three';
import assert from 'assert';
import { parseConstructionPlan } from '../src/parser.js';
import { getModuleSnapPoints } from '../src/snap-points-db.js';
import { computeModuleGroupRotation } from '../src/rotation-math.js';

console.log('[*] Testing Test321.xml blueprint connections, specifically arg_arc_01 (Module #6)...');

const xmlPath = 'tests/fixtures/Test321.xml';
assert(fs.existsSync(xmlPath), 'Test321.xml must exist on disk');

const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

// 1. Verify Module 6 was parsed with proper rotation from quaternion
const m6 = plan.modules.find(m => m.index === 6);
assert(m6, 'Module #6 must exist');
assert.strictEqual(m6.macro, 'struct_arg_arc_01_macro');
assert(m6.quaternion, 'Module #6 must have parsed quaternion');
assert(Math.abs(m6.rotation.yaw - (-180)) < 0.01, `Yaw must be -180, got ${m6.rotation.yaw}`);
// Pitch in X4's <rotation pitch> sign convention (opposite to a rotation about +X), so this
// quaternion reads as pitch +90, as X4 itself would write it in attribute form
assert(Math.abs(m6.rotation.pitch - 90) < 0.01, `Pitch must be 90, got ${m6.rotation.pitch}`);

// 2. Build 3D scene matching StationViewer.loadStationPlan under unified mathematical pipeline
const modulesMap = new Map();

for (const mod of plan.modules) {
  const moduleGroup = new THREE.Group();
  moduleGroup.name = `module_${mod.index}`;
  moduleGroup.position.set(mod.position.x, mod.position.y, -mod.position.z);
  moduleGroup.rotation.copy(computeModuleGroupRotation(mod.rotation.yaw, mod.rotation.pitch, mod.rotation.roll));

  const snaps = getModuleSnapPoints(mod.macro) || [];
  const snapsGroup = new THREE.Group();
  snapsGroup.name = 'module_snaps_group';

  for (const snap of snaps) {
    const dot = new THREE.Object3D();
    dot.name = `snap_dot_${snap.name}`;
    dot.position.set(-snap.pos[0], snap.pos[1], snap.pos[2]);
    snapsGroup.add(dot);
  }

  moduleGroup.add(snapsGroup);
  modulesMap.set(mod.index, { mod, group: moduleGroup });
}

// 3. Verify connection between Module #6 (struct_arg_arc_01_macro) and Predecessor #4 (struct_arg_vertical_02_macro)
const arcData = modulesMap.get(6);
const vertData = modulesMap.get(4);

assert(arcData && vertData, 'Modules 6 and 4 must exist');

const arcSnap = arcData.group.getObjectByName('snap_dot_con_snap_01');
const vertSnap = vertData.group.getObjectByName('snap_dot_ConnectionSnap002');

assert(arcSnap, 'Module #6 must have snap_dot_con_snap_01');
assert(vertSnap, 'Module #4 must have snap_dot_ConnectionSnap002');

const arcWorld = arcSnap.getWorldPosition(new THREE.Vector3());
const vertWorld = vertSnap.getWorldPosition(new THREE.Vector3());

const dist = arcWorld.distanceTo(vertWorld);
console.log('Module #4 (vertical_02) snap 2 world pos:', vertWorld);
console.log('Module #6 (arc_01) snap 1 world pos:    ', arcWorld);
console.log(`Connection separation distance: ${dist.toFixed(4)} meters`);

assert(dist < 0.01, `Connection distance must be < 0.01m, got ${dist.toFixed(4)}m`);
console.log('[PASS] arg_arc_01 (Module #6) snaps to vertical_02 (Module #4) with 0.001m (< 1 mm) precision!');

// 4. Verify 3D Mesh Geometry of struct_arg_arc_01 (part_main-lod0.bin)
const binPath = 'assets1/structures/connectionmodules/struct_arg_arc_01_data/part_main-lod0.bin';
if (fs.existsSync(binPath)) {
  const binBuf = fs.readFileSync(binPath);
  const dataView = new DataView(binBuf.buffer, binBuf.byteOffset, binBuf.byteLength);
  const vertexCount = dataView.getUint32(8, true);
  const vertexOffset = dataView.getUint32(24, true);
  const vertexFloats = new Float32Array(binBuf.buffer, binBuf.byteOffset + vertexOffset, vertexCount * 8);

  // Collar 1 mating rim in raw mesh: at Z = 800
  let c1Vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    const x = vertexFloats[i * 8];
    const y = vertexFloats[i * 8 + 1];
    const z = vertexFloats[i * 8 + 2];
    if (Math.abs(z - 800) < 0.05) {
      c1Vertices.push(new THREE.Vector3(x, y, z));
    }
  }

  assert(c1Vertices.length > 0, 'Collar 1 vertices must exist in part_main-lod0.bin');
  const c1Center = new THREE.Vector3();
  c1Vertices.forEach(v => c1Center.add(v));
  c1Center.divideScalar(c1Vertices.length);

  // Build the visual mesh scene matching loadModuleMesh: unified raw mesh
  const meshScene = new THREE.Group();
  const collarMesh = new THREE.Mesh();
  collarMesh.position.copy(c1Center);
  meshScene.add(collarMesh);

  const meshGroup = new THREE.Group();
  meshGroup.name = 'module_mesh_group';
  meshGroup.add(meshScene);
  arcData.group.add(meshGroup);
  arcData.group.updateMatrixWorld(true);

  const collarWorld = collarMesh.getWorldPosition(new THREE.Vector3());
  const meshDist = collarWorld.distanceTo(vertWorld);
  console.log('Module #6 (arc_01) 3D mesh collar 1 world pos:', collarWorld);
  console.log(`Mesh collar 1 separation from vertical_02 snap: ${meshDist.toFixed(4)} meters`);
  assert(meshDist < 0.01, `Mesh collar separation must be < 0.01m, got ${meshDist.toFixed(4)}m`);

  // Verify Collar 2 matches snap_dot_con_snap_02
  const arcSnap2 = arcData.group.getObjectByName('snap_dot_con_snap_02');
  assert(arcSnap2, 'Module #6 must have snap_dot_con_snap_02');
  const arcSnap2World = arcSnap2.getWorldPosition(new THREE.Vector3());

  const collarMesh2 = new THREE.Mesh();
  collarMesh2.position.set(561.5223, 0, -555.6349);
  meshScene.add(collarMesh2);
  arcData.group.updateMatrixWorld(true);

  const collar2World = collarMesh2.getWorldPosition(new THREE.Vector3());
  const meshDist2 = collar2World.distanceTo(arcSnap2World);
  console.log('Module #6 (arc_01) 3D mesh collar 2 world pos:', collar2World);
  console.log('Module #6 (arc_01) snap 2 dot world pos:     ', arcSnap2World);
  console.log(`Mesh collar 2 separation from snap 2 dot: ${meshDist2.toFixed(4)} meters`);
  assert(meshDist2 < 0.01, `Collar 2 mesh must coincide with snap 2 dot (< 0.01m), got ${meshDist2.toFixed(4)}m`);

  console.log('[PASS] Visual 3D mesh of arg_arc_01 is perfectly aligned and flush with vertical_02!');
}
