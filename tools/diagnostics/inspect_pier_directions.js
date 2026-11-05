import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const piers = plan.modules.filter(x => x.macro.includes('pier_arg_harbor_03'));

for (const p of piers) {
  // Compute prong direction in Three.js coordinates
  // Docking bays in local coordinates are at x = -593.19, so prong vector is (-1, 0, 0)
  const localProng = new THREE.Vector3(-1, 0, 0);

  // Group rotation in current viewer.js:
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.y = p.rotation.yaw * Math.PI / 180;
  g.rotation.x = (p.rotation.pitch + 180) * Math.PI / 180;
  g.rotation.z = (p.rotation.roll + 180) * Math.PI / 180;

  const worldProng = localProng.clone().applyEuler(g.rotation);

  console.log(`Pier #${p.index} (yaw=${p.rotation.yaw}, pitch=${p.rotation.pitch}, roll=${p.rotation.roll}):`);
  console.log(`   Pos: (${p.position.x}, ${p.position.y}, ${p.position.z})`);
  console.log(`   World Prong direction: (${worldProng.x.toFixed(3)}, ${worldProng.y.toFixed(3)}, ${worldProng.z.toFixed(3)})`);
}
