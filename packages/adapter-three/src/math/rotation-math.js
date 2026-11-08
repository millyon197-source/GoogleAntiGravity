import * as THREE from 'three';

const S_MAT = new THREE.Matrix4().set(
  1,  0,  0, 0,
  0,  1,  0, 0,
  0,  0, -1, 0,
  0,  0,  0, 1
);
const M_BASE_MESH = new THREE.Matrix4().makeRotationY(Math.PI);

/**
 * Three.js rotation for a module whose X4 plan rotation is (yaw, pitch, roll) in degrees, as written
 * in <rotation yaw pitch roll/>. X4's pitch and roll attributes rotate the opposite way to this
 * maths' X and Z axes, hence the negations: with them, 98.7% of the connections recorded in plans
 * exported from X4 meet exactly (tests/test_plan_snap_connections.js).
 */
export function computeModuleGroupRotation(yawDeg, pitchDeg, rollDeg) {
  const eulerX4 = new THREE.Euler(
    -(pitchDeg || 0) * Math.PI / 180,
    (yawDeg || 0) * Math.PI / 180,
    -(rollDeg || 0) * Math.PI / 180,
    'YXZ'
  );
  const Mx4 = new THREE.Matrix4().makeRotationFromEuler(eulerX4);
  const M_three = new THREE.Matrix4().copy(S_MAT).multiply(Mx4).multiply(S_MAT).multiply(M_BASE_MESH);
  return new THREE.Euler().setFromRotationMatrix(M_three, 'YXZ');
}

/** Inverse of computeModuleGroupRotation: the X4 plan (yaw, pitch, roll) of a module group, rounded to whole degrees. */
export function computeX4RotationFromModuleGroup(moduleGroup) {
  const M_three = new THREE.Matrix4().makeRotationFromEuler(moduleGroup.rotation);
  const Mx4 = new THREE.Matrix4().copy(S_MAT).multiply(M_three).multiply(M_BASE_MESH).multiply(S_MAT);
  const eX4 = new THREE.Euler().setFromRotationMatrix(Mx4, 'YXZ');
  let yaw = Math.round(THREE.MathUtils.radToDeg(eX4.y)) % 360;
  let pitch = -Math.round(THREE.MathUtils.radToDeg(eX4.x)) % 360;
  let roll = -Math.round(THREE.MathUtils.radToDeg(eX4.z)) % 360;
  if (yaw > 180) yaw -= 360;
  if (yaw <= -180) yaw += 360;
  if (pitch > 180) pitch -= 360;
  if (pitch <= -180) pitch += 360;
  if (roll > 180) roll -= 360;
  if (roll <= -180) roll += 360;
  // `|| 0` turns -0 (from rounding tiny negative angles) into 0
  return { yaw: yaw || 0, pitch: pitch || 0, roll: roll || 0 };
}
