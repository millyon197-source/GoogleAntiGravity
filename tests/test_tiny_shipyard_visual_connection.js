import fs from 'fs';
import * as THREE from 'three';
import assert from 'assert';
import { parseConstructionPlan } from '../src/parser.js';
import PART_MAIN_OFFSETS from '../src/part-main-offsets.json' with { type: 'json' };
import { getModuleSnapPoints } from '../src/snap-points-db.js';

console.log('[*] Testing Tiny Shipyard pier_arg_harbor_02 visual and snap connection...');

const xmlPath = 'tests/fixtures/tiny shipyard.xml';
assert(fs.existsSync(xmlPath), 'tiny shipyard.xml must exist on disk');

const plan = parseConstructionPlan(fs.readFileSync(xmlPath, 'utf8'));

const m7 = plan.modules.find(m => m.index === 7);
const m22 = plan.modules.find(m => m.index === 22);

assert(m7 && m22, 'Plan must contain modules #7 and #22');
assert.strictEqual(m7.macro, 'pier_arg_harbor_02_macro');
assert.strictEqual(m22.macro, 'pier_arg_harbor_02_macro');

const S_MAT = new THREE.Matrix4().set(
  1,  0,  0, 0,
  0,  1,  0, 0,
  0,  0, -1, 0,
  0,  0,  0, 1
);
const M_BASE_MESH = new THREE.Matrix4().makeRotationY(Math.PI);

function computeModuleGroupRotation(yawDeg, pitchDeg, rollDeg) {
  const eulerX4 = new THREE.Euler(
    (pitchDeg || 0) * Math.PI / 180,
    (yawDeg || 0) * Math.PI / 180,
    (rollDeg || 0) * Math.PI / 180,
    'YXZ'
  );
  const Mx4 = new THREE.Matrix4().makeRotationFromEuler(eulerX4);
  const M_three = new THREE.Matrix4().copy(S_MAT).multiply(Mx4).multiply(S_MAT).multiply(M_BASE_MESH);
  return new THREE.Euler().setFromRotationMatrix(M_three, 'YXZ');
}

function buildModule(mod) {
  const baseName = mod.macro.replace('_macro', '').toLowerCase();
  const moduleRoot = new THREE.Group();
  moduleRoot.name = `module_${mod.index}`;

  const meshGroup = new THREE.Group();
  meshGroup.name = 'module_mesh_group';

  const offset = PART_MAIN_OFFSETS[baseName];
  if (offset) {
    meshGroup.position.set(-offset[0], offset[1], offset[2]);
  }
  moduleRoot.add(meshGroup);

  // Add snap dots
  const snapsGroup = new THREE.Group();
  snapsGroup.name = 'module_snaps_group';
  const snaps = getModuleSnapPoints(mod.macro);
  for (const snap of snaps) {
    const dot = new THREE.Object3D();
    dot.name = `snap_dot_${snap.name}`;
    dot.position.set(-snap.pos[0], snap.pos[1], snap.pos[2]);
    snapsGroup.add(dot);
  }
  moduleRoot.add(snapsGroup);

  // Position and rotation of moduleRoot
  moduleRoot.position.set(mod.position.x, mod.position.y, -mod.position.z);
  moduleRoot.rotation.order = 'YXZ';
  moduleRoot.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));

  return moduleRoot;
}

const g7 = buildModule(m7);
const g22 = buildModule(m22);

const scene = new THREE.Scene();
scene.add(g7);
scene.add(g22);
scene.updateMatrixWorld(true);

const snapDot7 = g7.getObjectByName('snap_dot_ConnectionSnap002');
const snapDot22 = g22.getObjectByName('snap_dot_ConnectionSnap002');
const wSnap7 = snapDot7.getWorldPosition(new THREE.Vector3());
const wSnap22 = snapDot22.getWorldPosition(new THREE.Vector3());
const snapDist = wSnap7.distanceTo(wSnap22);
console.log(`Module #7 to Module #22 snap connection distance: ${snapDist.toFixed(4)}m`);
assert(snapDist < 0.01, `Module #7 and #22 snap dots must align (< 0.01m), got ${snapDist.toFixed(4)}m`);

console.log('[PASS] pier_arg_harbor_02 snap dots align with 0.00m error in tiny shipyard.xml!');
