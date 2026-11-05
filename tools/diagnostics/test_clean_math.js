import * as THREE from 'three';

// Mod 5460:
// pos: (971.42, 428.317, -211.65)
// yaw: 89.35033
// snap: [0, 0, -1000]

// Mod 5461:
// pos: (-228.503, 428.317, -225.256)
// yaw: 89.35033
// snap: [0, 0, 200]

function buildGroupClean(mod, snapPos) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  // Reflect rotation for inverted Z:
  // yaw around Y is inverted (-yaw)
  // pitch around X is inverted (-pitch)
  // roll around Z is normal (roll)
  g.rotation.y = -mod.rotation.yaw * Math.PI / 180;
  g.rotation.x = -mod.rotation.pitch * Math.PI / 180;
  g.rotation.z = mod.rotation.roll * Math.PI / 180;
  g.position.set(mod.position.x, mod.position.y, -mod.position.z);

  // Local snap position in Three.js space: (x, y, -z)
  const dot = new THREE.Vector3(snapPos[0], snapPos[1], -snapPos[2]);
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

const p0 = buildGroupClean(mod5460, [0, 0, -1000]);
const p1 = buildGroupClean(mod5461, [0, 0, 200]);

console.log('Clean Three.js group snap 5460:', p0);
console.log('Clean Three.js group snap 5461:', p1);
console.log('Distance:', p0.distanceTo(p1).toFixed(6), 'meters!');
