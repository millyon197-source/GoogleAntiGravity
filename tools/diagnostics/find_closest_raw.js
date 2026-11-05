import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { computeModuleGroupRotation } from '../../src/rotation-math.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/A040 HQ SHIPYARD 1.xml';
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const mod = plan.modules.find(m => m.index === 457);
const parent = plan.modules.find(m => m.index === mod.predecessor.index);

const parentG = new THREE.Group();
parentG.position.set(parent.position.x, parent.position.y, -parent.position.z);
parentG.rotation.copy(computeModuleGroupRotation(parent.rotation?.yaw, parent.rotation?.pitch, parent.rotation?.roll));
const parentSnap = getModuleSnapPoints(parent.macro).find(s => s.name.toLowerCase() === mod.predecessor.connection.toLowerCase());
const vParentSnap = new THREE.Vector3(-parentSnap.pos[0], parentSnap.pos[1], parentSnap.pos[2]).applyEuler(parentG.rotation).add(parentG.position);

const pierG = new THREE.Group();
pierG.position.set(mod.position.x, mod.position.y, -mod.position.z);
pierG.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));

const offset = [-798.8782, 0, 0];
const meshGroupPos = new THREE.Vector3(-offset[0], offset[1], offset[2]);

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

let minDist = Infinity, bestRaw = null;
const temp = new THREE.Vector3();
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  temp.set(vx, vy, vz).add(meshGroupPos).applyEuler(pierG.rotation).add(pierG.position);
  const d = temp.distanceTo(vParentSnap);
  if (d < minDist) {
    minDist = d;
    bestRaw = { vx, vy, vz, d };
  }
}
console.log('Vertex closest to parent snap:', bestRaw);
