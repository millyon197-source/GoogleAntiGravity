import * as THREE from 'three';

console.log('[*] Analyzing X-axis local coordinate mapping:');

// Test object with local offset (+50m on X, 0 on Y, +100m on Z)
const localOffset = new THREE.Vector3(50, 0, 100);

// Case 1: Standard YXZ rotation with 0° Yaw
const g1 = new THREE.Group();
g1.rotation.order = 'YXZ';
g1.rotation.y = 0;
const p1 = localOffset.clone().applyEuler(g1.rotation);

// Case 2: YXZ rotation with 180° Yaw (+180° base offset)
const g2 = new THREE.Group();
g2.rotation.order = 'YXZ';
g2.rotation.y = Math.PI; // 180°
const p2 = localOffset.clone().applyEuler(g2.rotation);

console.log(`Original Local Offset: (${localOffset.x}, ${localOffset.y}, ${localOffset.z})`);
console.log(`World Offset at 0° Yaw:   (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}, ${p1.z.toFixed(1)})`);
console.log(`World Offset at 180° Yaw: (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}, ${p2.z.toFixed(1)})`);

console.log('\nConclusion: At 180° base Yaw, local +X (+50m) transforms to world -X (-50m), and local +Z (+100m) transforms to world -Z (-100m).');
