import * as THREE from 'three';

const S_MAT = new THREE.Matrix4().set(
  1,  0,  0, 0,
  0,  1,  0, 0,
  0,  0, -1, 0,
  0,  0,  0, 1
);
const M_BASE_MESH = new THREE.Matrix4().makeRotationY(Math.PI);

export function computeModuleGroupRotation(yawDeg, pitchDeg, rollDeg) {
  const eulerX4 = new THREE.Euler(
    (pitchDeg || 0) * Math.PI / 180,
    (yawDeg || 0) * Math.PI / 180,
    -(rollDeg || 0) * Math.PI / 180,
    'YXZ'
  );
  const Mx4 = new THREE.Matrix4().makeRotationFromEuler(eulerX4);
  const M_three = new THREE.Matrix4().copy(S_MAT).multiply(Mx4).multiply(S_MAT).multiply(M_BASE_MESH);
  return new THREE.Euler().setFromRotationMatrix(M_three, 'YXZ');
}

export function computeX4RotationFromModuleGroup(moduleGroup) {
  const M_three = new THREE.Matrix4().makeRotationFromEuler(moduleGroup.rotation);
  const Mx4 = new THREE.Matrix4().copy(S_MAT).multiply(M_three).multiply(M_BASE_MESH).multiply(S_MAT);
  const eX4 = new THREE.Euler().setFromRotationMatrix(Mx4, 'YXZ');
  let yaw = Math.round(THREE.MathUtils.radToDeg(eX4.y)) % 360;
  let pitch = Math.round(THREE.MathUtils.radToDeg(eX4.x)) % 360;
  let roll = -Math.round(THREE.MathUtils.radToDeg(eX4.z)) % 360;
  if (yaw > 180) yaw -= 360;
  if (yaw <= -180) yaw += 360;
  if (pitch > 180) pitch -= 360;
  if (pitch <= -180) pitch += 360;
  if (roll > 180) roll -= 360;
  if (roll <= -180) roll += 360;
  return { yaw, pitch, roll };
}
