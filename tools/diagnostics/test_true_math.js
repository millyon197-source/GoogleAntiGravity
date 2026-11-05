import * as THREE from 'three';

// Let's test what transformation makes:
// Snap 5460 world Z == 222.988
// Snap 5461 world Z == 222.989
// and Snap 5460 world X == -28.515
// and Snap 5461 world X == -28.516

const mod5460 = {
  position: { x: 971.42, y: 428.317, z: -211.65 },
  rotation: { yaw: 89.35033, pitch: 0, roll: 0 }
};

const mod5461 = {
  position: { x: -228.503, y: 428.317, z: -225.256 },
  rotation: { yaw: 89.35033, pitch: 0, roll: 0 }
};

// What if in X4 space:
// We rotate the snap in X4 space FIRST:
// R_x4(yaw, pitch, roll) * (snap.x, snap.y, snap.z) + mod.position
// Then we convert the final world coordinate to Three.js: (worldX, worldY, -worldZ)!
function worldSnapViaX4(mod, snapPos) {
  // In X4, yaw is around Y
  const yawRad = mod.rotation.yaw * Math.PI / 180;
  // Rotation matrix around +Y:
  // X' = X cos(yaw) + Z sin(yaw)
  // Z' = -X sin(yaw) + Z cos(yaw)
  // Wait! In X4, does (0, 0, -1000) rotate to (-1000, 0, 0) with yaw = +90?
  // With X' = X cos + Z sin: 0 + (-1000) * sin(90) = -1000! YES!
  // And Z' = -0 * sin + (-1000) * cos(90) = -1000 * cos(90)!
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);

  const localX = snapPos[0];
  const localY = snapPos[1];
  const localZ = snapPos[2];

  const rotX = localX * cosY + localZ * sinY;
  const rotY = localY;
  const rotZ = -localX * sinY + localZ * cosY;

  const worldX = mod.position.x + rotX;
  const worldY = mod.position.y + rotY;
  const worldZ = mod.position.z + rotZ;

  // Convert to Three.js space:
  return new THREE.Vector3(worldX, worldY, -worldZ);
}

const w0 = worldSnapViaX4(mod5460, [0, 0, -1000]);
const w1 = worldSnapViaX4(mod5461, [0, 0, 200]);

console.log('--- VIA PURE X4 MATHEMATICAL DEFINITION ---');
console.log('Snap 5460:', w0);
console.log('Snap 5461:', w1);
console.log('Distance:', w0.distanceTo(w1).toFixed(6), 'meters!');
