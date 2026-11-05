import * as THREE from 'three';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

console.log('[*] Testing cross connector offset math for snap points...');

const snaps = getModuleSnapPoints('prod_gen_refinedmetals_macro');

for (const snap of snaps) {
  const p = snap.pos; // [x, y, z]
  const absX = Math.abs(p[0]);
  const absY = Math.abs(p[1]);
  const absZ = Math.abs(p[2]);

  let normal = new THREE.Vector3(0, -1, 0);
  if (absY >= absX && absY >= absZ) {
    normal.set(0, p[1] >= 0 ? 1 : -1, 0);
  } else if (absX >= absY && absX >= absZ) {
    normal.set(p[0] >= 0 ? 1 : -1, 0, 0);
  } else {
    normal.set(0, 0, p[2] >= 0 ? 1 : -1);
  }

  // Cross connector center: 200m along outward normal from snap point
  const crossCenter = new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(normal, 200);
  // Mating port on cross connector: 200m along -normal from crossCenter
  const matingPort = crossCenter.clone().addScaledVector(normal, -200);

  console.log(`Snap ${snap.name}: [${p}]`);
  console.log(`  Normal: [${normal.x}, ${normal.y}, ${normal.z}]`);
  console.log(`  Cross Center: [${crossCenter.x}, ${crossCenter.y}, ${crossCenter.z}]`);
  console.log(`  Mating Port: [${matingPort.x}, ${matingPort.y}, ${matingPort.z}] (matches snap: ${matingPort.distanceTo(new THREE.Vector3(...p)) < 0.001})`);
}
