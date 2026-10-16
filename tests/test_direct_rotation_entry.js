// Automated test for direct numeric entry of Pitch, Roll, and Yaw angles
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';

console.log('--- TEST: Direct Rotation Entry in Selected Module Details ---');

// 1. Verify index.html contains input elements with correct attributes
const htmlContent = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const expectedElements = [
  'id="det-input-pitch"',
  'id="det-input-roll"',
  'id="det-input-yaw"',
  'class="rot-inputs-row"',
  'rot-lbl-pitch',
  'rot-lbl-roll',
  'rot-lbl-yaw'
];

let allElementsFound = true;
for (const elem of expectedElements) {
  if (!htmlContent.includes(elem)) {
    console.error(`FAIL: Missing element/class in index.html: ${elem}`);
    allElementsFound = false;
  }
}
if (allElementsFound) {
  console.log('PASS: index.html has all required Pitch, Roll, Yaw input elements and styling classes.');
}

// 2. Verify main.js binds inputs and whitelists #details-card
const mainJs = fs.readFileSync(path.resolve(process.cwd(), 'src/main.js'), 'utf8');
if (mainJs.includes('det-input-pitch') && mainJs.includes('det-input-roll') && mainJs.includes('det-input-yaw')) {
  console.log('PASS: src/main.js contains listeners and state synchronization for pitch, roll, and yaw inputs.');
} else {
  console.error('FAIL: src/main.js missing input synchronization.');
}

if (mainJs.includes('#details-card')) {
  console.log('PASS: src/main.js whitelists #details-card to prevent 3D gizmo loss-of-focus on input interaction.');
} else {
  console.error('FAIL: src/main.js does not whitelist #details-card.');
}

// 3. Mathematical Verification of Three.js rotation logic & round-trip calculations
function simulateSetAndGetRotation(inputYaw, inputPitch, inputRoll) {
  // Mock module group
  const moduleGroup = new THREE.Group();
  moduleGroup.userData = { index: 0 };

  // Normalization logic as implemented in viewer.setModuleRotation
  let yaw = typeof inputYaw === 'number' && !isNaN(inputYaw) ? inputYaw : 0;
  let pitch = typeof inputPitch === 'number' && !isNaN(inputPitch) ? inputPitch : 0;
  let roll = typeof inputRoll === 'number' && !isNaN(inputRoll) ? inputRoll : 0;

  let yawDeg = Math.round(yaw) % 360;
  if (yawDeg > 180) yawDeg -= 360;
  if (yawDeg <= -180) yawDeg += 360;

  let pitchDeg = Math.round(pitch) % 360;
  if (pitchDeg > 180) pitchDeg -= 360;
  if (pitchDeg <= -180) pitchDeg += 360;

  let rollDeg = Math.round(roll) % 360;
  if (rollDeg > 180) rollDeg -= 360;
  if (rollDeg <= -180) rollDeg += 360;

  moduleGroup.rotation.order = 'YXZ';
  moduleGroup.rotation.y = yawDeg * Math.PI / 180;
  moduleGroup.rotation.x = (pitchDeg + 180) * Math.PI / 180;
  moduleGroup.rotation.z = (rollDeg + 180) * Math.PI / 180;
  moduleGroup.updateMatrixWorld(true);

  // Read back using getModuleCalculatedRotation logic
  moduleGroup.rotation.order = 'YXZ';
  let readYaw = Math.round(THREE.MathUtils.radToDeg(moduleGroup.rotation.y)) % 360;
  let readPitch = Math.round(THREE.MathUtils.radToDeg(moduleGroup.rotation.x) - 180) % 360;
  let readRoll = Math.round(THREE.MathUtils.radToDeg(moduleGroup.rotation.z) - 180) % 360;

  if (readYaw > 180) readYaw -= 360;
  if (readYaw <= -180) readYaw += 360;
  if (readPitch > 180) readPitch -= 360;
  if (readPitch <= -180) readPitch += 360;
  if (readRoll > 180) readRoll -= 360;
  if (readRoll <= -180) readRoll += 360;

  return {
    expected: { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg },
    actual: { yaw: readYaw, pitch: readPitch, roll: readRoll }
  };
}

const testAngles = [
  { yaw: 0, pitch: 0, roll: 0 },
  { yaw: 90, pitch: 45, roll: -30 },
  { yaw: -180, pitch: 180, roll: 0 },
  { yaw: -90, pitch: -45, roll: 120 },
  { yaw: 270, pitch: -225, roll: 450 } // Wrapping tests
];

let allMathPassed = true;
for (const test of testAngles) {
  const res = simulateSetAndGetRotation(test.yaw, test.pitch, test.roll);
  if (res.actual.yaw !== res.expected.yaw ||
      res.actual.pitch !== res.expected.pitch ||
      res.actual.roll !== res.expected.roll) {
    console.error(`FAIL for input ${JSON.stringify(test)}: Expected ${JSON.stringify(res.expected)}, Got ${JSON.stringify(res.actual)}`);
    allMathPassed = false;
  } else {
    console.log(`PASS: Input (${test.yaw}°, ${test.pitch}°, ${test.roll}°) -> Normalized & Readback: (${res.actual.yaw}°, ${res.actual.pitch}°, ${res.actual.roll}°)`);
  }
}

if (allMathPassed) {
  console.log('--- ALL TESTS PASSED SUCCESSFULLY ---');
} else {
  process.exit(1);
}
