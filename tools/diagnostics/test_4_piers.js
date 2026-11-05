import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';
import * as THREE from 'three';
import { isPierHarbor } from '../../src/modules.js';

const xml = fs.readFileSync('C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/4 E Piers.xml', 'utf8');
const plan = parseConstructionPlan(xml);

const centerMod = plan.modules.find(m => String(m.index) === '2');
console.log('Center module:', centerMod.macro, 'pos:', centerMod.position, 'roll:', centerMod.rotation.roll);

for (const m of plan.modules) {
  if (!isPierHarbor(m.macro)) continue;

  const g = new THREE.Group();
  g.position.set(m.position.x, m.position.y, -m.position.z);
  g.rotation.order = 'YXZ';
  g.rotation.y = m.rotation.yaw * Math.PI / 180;
  g.rotation.x = (m.rotation.pitch + 180) * Math.PI / 180;
  g.rotation.z = (m.rotation.roll + 180) * Math.PI / 180;

  const s = new THREE.Group();
  g.add(s);
  g.updateMatrixWorld(true);

  // In raw mesh, prongs are at +X (600), connector at -X (-200)
  const prong = new THREE.Vector3(600, 0, 0).applyMatrix4(s.matrixWorld);
  const conn = new THREE.Vector3(-200, 0, 0).applyMatrix4(s.matrixWorld);
  const prongDir = prong.clone().sub(conn).normalize();

  // Vector from center module to this pier:
  const fromCenter = new THREE.Vector3(
    m.position.x - centerMod.position.x,
    m.position.y - centerMod.position.y,
    0
  ).normalize();

  const dot = prongDir.dot(fromCenter);

  console.log(`\nPier #${m.index} (roll=${m.rotation.roll}°): pos=(${m.position.x.toFixed(1)}, ${m.position.y.toFixed(1)})`);
  console.log(`  fromCenter vector: (${fromCenter.x.toFixed(2)}, ${fromCenter.y.toFixed(2)}, 0)`);
  console.log(`  prongDir:          (${prongDir.x.toFixed(2)}, ${prongDir.y.toFixed(2)}, ${prongDir.z.toFixed(2)})`);
  console.log(`  dot with fromCenter: ${dot.toFixed(2)} -> ${dot > 0.9 ? 'PERFECTLY OUTWARD (points to corner!)' : (dot < -0.9 ? 'POINTS INWARD TO CENTER!' : 'OTHER')}`);
}
