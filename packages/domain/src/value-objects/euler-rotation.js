/**
 * Pure domain value object representing an immutable 3D Euler rotation in degrees.
 * Represents X4 game standard rotation: yaw, pitch, roll.
 * Free of Three.js or DOM dependencies.
 */
export class EulerRotation {
  /**
   * @param {number} yaw - Rotation around Y axis in degrees
   * @param {number} pitch - Rotation around X axis in degrees
   * @param {number} roll - Rotation around Z axis in degrees
   */
  constructor(yaw = 0, pitch = 0, roll = 0) {
    this.yaw = Number(yaw) || 0;
    this.pitch = Number(pitch) || 0;
    this.roll = Number(roll) || 0;
    Object.freeze(this);
  }

  /**
   * Normalize angles to [-180, +180] degrees.
   * @returns {EulerRotation}
   */
  normalize() {
    const norm = (deg) => {
      let d = deg % 360;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    };
    return new EulerRotation(norm(this.yaw), norm(this.pitch), norm(this.roll));
  }

  /**
   * @param {EulerRotation|{yaw: number, pitch: number, roll: number}} r
   * @param {number} [epsilon=0.01]
   * @returns {boolean}
   */
  equals(r, epsilon = 0.01) {
    if (!r) return false;
    return (
      Math.abs(this.yaw - (r.yaw || 0)) <= epsilon &&
      Math.abs(this.pitch - (r.pitch || 0)) <= epsilon &&
      Math.abs(this.roll - (r.roll || 0)) <= epsilon
    );
  }

  /**
   * @returns {{yaw: number, pitch: number, roll: number}}
   */
  toObject() {
    return { yaw: this.yaw, pitch: this.pitch, roll: this.roll };
  }

  /**
   * @param {{yaw?: number, pitch?: number, roll?: number}} [obj]
   * @returns {EulerRotation}
   */
  static fromObject(obj) {
    if (!obj) return new EulerRotation(0, 0, 0);
    return new EulerRotation(obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
  }
}
