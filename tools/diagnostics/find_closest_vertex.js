import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { computeModuleGroupRotation } from '../../src/rotation-math.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/A040 HQ SHIPYARD 1.xml';
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const pierMod = plan.modules.find(m => m.index === 77);
const parentMod = plan.modules.find(m => m.index === 76);

const parentG = new THREE.Group();
parentG.position.set(parentMod.position.x, parentMod.position.y, -parentMod.position.z);
parentG.rotation.copy(computeModuleGroupRotation(parentMod.rotation?.yaw, parentMod.rotation?.pitch, parentMod.rotation?.roll));
const parentSnaps = getModuleSnapPoints(parentMod.macro);
const parentSnap = parentSnaps.find(s => s.name.toLowerCase() === 'connectionsnap001');
const vParentSnap = new THREE.Vector3(-parentSnap.pos[0], parentSnap.pos[1], parentSnap.pos[2]).applyEuler(parentG.rotation).add(parentG.position);
console.log('Parent Snap World Pos: [', vParentSnap.x.toFixed(3), vParentSnap.y.toFixed(3), vParentSnap.z.toFixed(3), ']');

// Pier Group at (px = 0)
const pierG = new THREE.Group();
pierG.position.set(pierMod.position.x, pierMod.position.y, -pierMod.position.z);
pierG.rotation.copy(computeModuleGroupRotation(pierMod.rotation?.yaw, pierMod.rotation?.pitch, pierMod.rotation?.roll));

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// For px = 0, let's find the vertex in pierG that is closest to vParentSnap:
let minDist = Infinity, bestV = null;
const temp = new THREE.Vector3();
for (let i = 0; i < meta.vertexCount; i++) {
  temp.set(floats[i * stride], floats[i * stride + 1], floats[i * stride + 2]);
  temp.applyEuler(pierG.rotation).add(pierG.position);
  const d = temp.distanceTo(vParentSnap);
  if (d < minDist) {
    minDist = d;
    bestV = {
      vx: floats[i * stride],
      vy: floats[i * stride + 1],
      vz: floats[i * stride + 2],
      world: temp.clone(),
      dist: d
    };
  }
}

console.log('With px = 0, closest vertex in mesh to parent snap:');
console.log(`  Local vertex in bin: [${bestV.vx.toFixed(2)}, ${bestV.vy.toFixed(2)}, ${bestV.vz.toFixed(2)}]`);
console.log(`  World pos: [${bestV.world.x.toFixed(2)}, ${bestV.world.y.toFixed(2)}, ${bestV.world.z.toFixed(2)}]`);
console.log(`  Distance to parent snap: ${bestV.dist.toFixed(2)} m`);
