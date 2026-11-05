import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';
import { computeModuleGroupRotation } from '../src/rotation-math.js';
import { getModuleSnapPoints } from '../src/snap-points-db.js';
import PART_MAIN_OFFSETS from '../src/part-main-offsets.json' with { type: 'json' };

console.log('[*] Testing A040 HQ SHIPYARD 1.xml One-Dock Piers (pier_ter_harbor_02)...');

const xmlPath = 'tests/fixtures/A040 HQ SHIPYARD 1.xml';
if (!fs.existsSync(xmlPath)) {
  console.log(`[SKIP] File not found: ${xmlPath}`);
  process.exit(0);
}

const plan = parseConstructionPlan(fs.readFileSync(xmlPath, 'utf8'));

// Verify that part_main offset for pier_ter_harbor_02 is defined and equals [-798.8782, 0, 0]
assert(PART_MAIN_OFFSETS['pier_ter_harbor_02'], 'pier_ter_harbor_02 offset must be defined in part-main-offsets.json');
assert.strictEqual(PART_MAIN_OFFSETS['pier_ter_harbor_02'][0], -798.8782, 'pier_ter_harbor_02 offset X must be -798.8782');

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
assert(fs.existsSync(jsonPath) && fs.existsSync(binPath), 'pier_ter_harbor_02 asset files must exist');

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const pierIndices = [77, 457, 464, 471];

for (const pIdx of pierIndices) {
  const mod = plan.modules.find(m => m.index === pIdx);
  assert(mod, `Module #${pIdx} must exist in plan`);
  assert.strictEqual(mod.macro, 'pier_ter_harbor_02_macro', `Module #${pIdx} must be pier_ter_harbor_02_macro`);

  const parent = plan.modules.find(m => m.index === mod.predecessor.index);
  assert(parent, `Parent for #${pIdx} must exist`);

  // Parent snap point
  const parentG = new THREE.Group();
  parentG.position.set(parent.position.x, parent.position.y, -parent.position.z);
  parentG.rotation.copy(computeModuleGroupRotation(parent.rotation?.yaw, parent.rotation?.pitch, parent.rotation?.roll));
  const parentSnaps = getModuleSnapPoints(parent.macro);
  const parentSnap = parentSnaps.find(s => s.name.toLowerCase() === mod.predecessor.connection.toLowerCase());
  assert(parentSnap, `Parent snap point ${mod.predecessor.connection} must exist`);
  const vParentSnap = new THREE.Vector3(-parentSnap.pos[0], parentSnap.pos[1], parentSnap.pos[2]).applyEuler(parentG.rotation).add(parentG.position);

  // Pier Group
  const pierG = new THREE.Group();
  pierG.position.set(mod.position.x, mod.position.y, -mod.position.z);
  pierG.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));

  // Snap dot
  const pierSnaps = getModuleSnapPoints(mod.macro);
  const pierSnap = pierSnaps.find(s => s.name.toLowerCase() === mod.connection.toLowerCase());
  assert(pierSnap, `Pier snap point ${mod.connection} must exist`);
  const vPierSnap = new THREE.Vector3(-pierSnap.pos[0], pierSnap.pos[1], pierSnap.pos[2]).applyEuler(pierG.rotation).add(pierG.position);

  const snapDist = vPierSnap.distanceTo(vParentSnap);
  console.log(`Pier #${pIdx} Snap Connection distance: ${snapDist.toFixed(4)}m`);
  assert(snapDist < 0.015, `Snap distance for #${pIdx} must be < 0.015m, got ${snapDist}`);

  // Mesh scene with clean standard loading and offset [-offset[0], offset[1], offset[2]]
  const offset = PART_MAIN_OFFSETS['pier_ter_harbor_02'];
  const meshGroup = new THREE.Group();
  meshGroup.position.set(-offset[0], offset[1], offset[2]);

  const scene = new THREE.Group();

  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(meta.vertexCount * 3);
  for (let i = 0; i < meta.vertexCount; i++) {
    posArr[i * 3] = floats[i * stride];
    posArr[i * 3 + 1] = floats[i * stride + 1];
    posArr[i * 3 + 2] = floats[i * stride + 2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mesh = new THREE.Mesh(geo);
  scene.add(mesh);
  meshGroup.add(scene);
  pierG.add(meshGroup);
  pierG.updateMatrixWorld(true);

  // Find closest collar vertex to parent snap
  let minDist = Infinity;
  const temp = new THREE.Vector3();
  for (let i = 0; i < meta.vertexCount; i++) {
    temp.set(floats[i * stride], floats[i * stride + 1], floats[i * stride + 2]);
    temp.applyMatrix4(meshGroup.matrix).applyMatrix4(pierG.matrix);
    const d = temp.distanceTo(vParentSnap);
    if (d < minDist) {
      minDist = d;
    }
  }

  // Find outer dock world direction extending away from parent
  let sumMaxX = new THREE.Vector3(), countMax = 0;
  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride];
    if (vx > 950) {
      temp.set(vx, floats[i * stride + 1], floats[i * stride + 2]);
      temp.applyMatrix4(meshGroup.matrix).applyMatrix4(pierG.matrix);
      sumMaxX.add(temp);
      countMax++;
    }
  }
  const dockWorld = sumMaxX.divideScalar(countMax);
  const toDock = dockWorld.clone().sub(pierG.position).normalize();
  const fromParent = pierG.position.clone().sub(parentG.position).normalize();
  const dotOutward = fromParent.dot(toDock);

  console.log(`Pier #${pIdx} Collar distance: ${minDist.toFixed(4)}m, Dock direction dot: ${dotOutward.toFixed(2)}`);
  assert(minDist < 2.0, `Collar distance for #${pIdx} must be < 2.0m, got ${minDist}`);
  assert(dotOutward > 0.9, `Dock clamp for #${pIdx} must point outward into open space, got dot=${dotOutward}`);
}

console.log('[PASS] All 4 One-Dock Piers in A040 HQ SHIPYARD 1.xml snap correctly and point outward!');
