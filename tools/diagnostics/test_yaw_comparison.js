import * as THREE from 'three';

// Mod 5460:
// macro: defence_arg_claim_01
// pos: (971.42, 428.317, -211.65)
// yaw: 89.35033
// snap 1: [0, 0, -1000]

// Mod 5461:
// macro: dockarea_arg_m_station_02_hightech
// pos: (-228.503, 428.317, -225.256)
// yaw: 89.35033
// snap 4: [0, 0, 200]

function buildGroup(mod, snapPos, yawSign = 1) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.y = yawSign * mod.rotation.yaw * Math.PI / 180;
  g.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
  g.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;
  g.position.set(mod.position.x, mod.position.y, -mod.position.z);

  const dot = new THREE.Vector3(-snapPos[0], snapPos[1], -snapPos[2]);
  dot.applyEuler(g.rotation);
  dot.add(g.position);
  return dot;
}

const mod5460 = {
  position: { x: 971.42, y: 428.317, z: -211.65 },
  rotation: { yaw: 89.35033, pitch: 0, roll: 0 }
};

const mod5461 = {
  position: { x: -228.503, y: 428.317, z: -225.256 },
  rotation: { yaw: 89.35033, pitch: 0, roll: 0 }
};

console.log('Testing with yawSign = +1 (current):');
const p0_pos = buildGroup(mod5460, [0, 0, -1000], 1);
const p1_pos = buildGroup(mod5461, [0, 0, 200], 1);
console.log('  Snap 5460:', p0_pos);
console.log('  Snap 5461:', p1_pos);
console.log('  Distance:', p0_pos.distanceTo(p1_pos).toFixed(4), 'm');

console.log('\nTesting with yawSign = -1:');
const p0_neg = buildGroup(mod5460, [0, 0, -1000], -1);
const p1_neg = buildGroup(mod5461, [0, 0, 200], -1);
console.log('  Snap 5460:', p0_neg);
console.log('  Snap 5461:', p1_neg);
console.log('  Distance:', p0_neg.distanceTo(p1_neg).toFixed(4), 'm');
