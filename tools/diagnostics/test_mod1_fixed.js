import * as THREE from 'three';

// If Module 1 is at (971.42, 3651, 1595) with yaw = 89 deg:
// What are the snap point positions on Module 1?
// Snap 1: [0, 0, -1000]
// Snap 2: [0, 0, 1000]
// Snap 3: [1000, 0, 0]
// Snap 4: [-1000, 0, 0]

const mod1 = {
  position: { x: 971.42, y: 3651, z: 1595 },
  rotation: { yaw: 89, pitch: 0, roll: 0 }
};

// Mod 2: dockarea_arg_m_station_02_hightech, conn 004 ([0, 0, 200]), pred 1 conn 001
const mod2 = {
  position: { x: -229, y: 3651, z: 1581 },
  rotation: { yaw: 89, pitch: 0, roll: 0 }
};

// Mod 3: dockarea_arg_m_station_02_hightech, conn 004 ([0, 0, 200]), pred 1 conn 002
const mod3 = {
  position: { x: 2171, y: 3651, z: 1608 },
  rotation: { yaw: -91, pitch: 0, roll: 0 }
};

// Mod 4: defence_arg_tube_01, conn 002 ([0, 0, 200]), pred 1 conn 003
const mod4 = {
  position: { x: 1098.505, y: 3651, z: 395 },
  rotation: { yaw: -1, pitch: 0, roll: 0 }
};

// Mod 5: defence_arg_tube_01, conn 001 ([0, 0, -200]), pred 1 conn 004
const mod5 = {
  position: { x: 958, y: 3651, z: 2795 },
  rotation: { yaw: -1, pitch: 0, roll: 0 }
};

function worldSnapX4(mod, snapPos) {
  const yawRad = mod.rotation.yaw * Math.PI / 180;
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const rx = snapPos[0] * cosY + snapPos[2] * sinY;
  const ry = snapPos[1];
  const rz = -snapPos[0] * sinY + snapPos[2] * cosY;
  return new THREE.Vector3(mod.position.x + rx, mod.position.y + ry, mod.position.z + rz);
}

console.log('--- TESTING MODULE 1 AT X=971.42 ---');
const s1_001 = worldSnapX4(mod1, [0, 0, -1000]);
const s2_004 = worldSnapX4(mod2, [0, 0, 200]);
console.log('Mod 1 Snap 001 vs Mod 2 Snap 004:');
console.log('  Mod 1 Snap:', s1_001);
console.log('  Mod 2 Snap:', s2_004);
console.log('  Distance:', s1_001.distanceTo(s2_004).toFixed(4), 'm');

const s1_002 = worldSnapX4(mod1, [0, 0, 1000]);
const s3_004 = worldSnapX4(mod3, [0, 0, 200]);
console.log('Mod 1 Snap 002 vs Mod 3 Snap 004:');
console.log('  Mod 1 Snap:', s1_002);
console.log('  Mod 3 Snap:', s3_004);
console.log('  Distance:', s1_002.distanceTo(s3_004).toFixed(4), 'm');

const s1_003 = worldSnapX4(mod1, [1000, 0, 0]);
const s4_002 = worldSnapX4(mod4, [0, 0, 200]);
console.log('Mod 1 Snap 003 vs Mod 4 Snap 002:');
console.log('  Mod 1 Snap:', s1_003);
console.log('  Mod 4 Snap:', s4_002);
console.log('  Distance:', s1_003.distanceTo(s4_002).toFixed(4), 'm');

const s1_004 = worldSnapX4(mod1, [-1000, 0, 0]);
const s5_001 = worldSnapX4(mod5, [0, 0, -200]);
console.log('Mod 1 Snap 004 vs Mod 5 Snap 001:');
console.log('  Mod 1 Snap:', s1_004);
console.log('  Mod 5 Snap:', s5_001);
console.log('  Distance:', s1_004.distanceTo(s5_001).toFixed(4), 'm');
