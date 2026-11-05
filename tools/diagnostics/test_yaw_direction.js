import * as THREE from 'three';

// In X4:
// A module at (0, 0, 0) with yaw = 90 deg.
// Snap point S is at (0, 0, 1000). (Forward in X4)
// In X4, yaw rotates around +Y (up).
// Under +90 deg yaw:
// Does (0, 0, 1000) rotate to (+1000, 0, 0) or (-1000, 0, 0)?
// In X4, Module 5460 is at (971, 428, -211) with yaw = 89.35 deg.
// Its snap ConnectionSnap001 is at (0, 0, -1000).
// In Plan 2, Module 5461 is connected to ConnectionSnap001 and is located at (-228, 428, -225)!
// Since -228 is LESS than 971 (towards -X):
// (0, 0, -1000) rotated to (-1200, 0, 0) along -X!
// That means (0, 0, -1) with yaw = +90 deg points along -X!
// Therefore (0, 0, +1) with yaw = +90 deg points along +X!

// Now let's test Three.js moduleGroup:
// In viewer.js:
// moduleGroup.rotation.order = 'YXZ';
// moduleGroup.rotation.y = yaw * Math.PI / 180;
// moduleGroup.rotation.x = (pitch + 180) * Math.PI / 180;
// moduleGroup.rotation.z = (roll + 180) * Math.PI / 180;
// dot.position.set(-snap.pos[0], snap.pos[1], -snap.pos[2]);

function testViewerGroup(yawDeg, snapPos) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.y = yawDeg * Math.PI / 180;
  g.rotation.x = 180 * Math.PI / 180;
  g.rotation.z = 180 * Math.PI / 180;

  const dot = new THREE.Vector3(-snapPos[0], snapPos[1], -snapPos[2]);
  dot.applyEuler(g.rotation);
  return dot;
}

const resSnap001 = testViewerGroup(89.35033, [0, 0, -1000]);
console.log('Rotated snap [0, 0, -1000] with yaw=89.35:');
console.log('Result in viewerGroup:', resSnap001);
console.log('Expected: X should be approximately -1000, Z should be near 0!');
