/**
 * Pure domain value object representing an immutable 3D vector.
 * Free of any Three.js or DOM dependencies.
 */
export class Vector3D {
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.z = Number(z) || 0;
    Object.freeze(this);
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @returns {Vector3D}
   */
  add(v) {
    return new Vector3D(this.x + (v.x || 0), this.y + (v.y || 0), this.z + (v.z || 0));
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @returns {Vector3D}
   */
  sub(v) {
    return new Vector3D(this.x - (v.x || 0), this.y - (v.y || 0), this.z - (v.z || 0));
  }

  /**
   * @param {number} scalar
   * @returns {Vector3D}
   */
  scale(scalar) {
    return new Vector3D(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @returns {number}
   */
  dot(v) {
    return this.x * (v.x || 0) + this.y * (v.y || 0) + this.z * (v.z || 0);
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @returns {Vector3D}
   */
  cross(v) {
    const vx = v.x || 0, vy = v.y || 0, vz = v.z || 0;
    return new Vector3D(
      this.y * vz - this.z * vy,
      this.z * vx - this.x * vz,
      this.x * vy - this.y * vx
    );
  }

  /**
   * @returns {number}
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * @returns {number}
   */
  length() {
    return Math.sqrt(this.lengthSq());
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @returns {number}
   */
  distanceTo(v) {
    return this.sub(v).length();
  }

  /**
   * @param {number} [epsilon=0.0001]
   * @returns {Vector3D}
   */
  normalize(epsilon = 0.0001) {
    const len = this.length();
    if (len < epsilon) return new Vector3D(0, 0, 0);
    return this.scale(1 / len);
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} v
   * @param {number} [epsilon=0.0001]
   * @returns {boolean}
   */
  equals(v, epsilon = 0.0001) {
    if (!v) return false;
    return (
      Math.abs(this.x - (v.x || 0)) <= epsilon &&
      Math.abs(this.y - (v.y || 0)) <= epsilon &&
      Math.abs(this.z - (v.z || 0)) <= epsilon
    );
  }

  /**
   * @returns {{x: number, y: number, z: number}}
   */
  toObject() {
    return { x: this.x, y: this.y, z: this.z };
  }

  /**
   * @param {{x?: number, y?: number, z?: number}} [obj]
   * @returns {Vector3D}
   */
  static fromObject(obj) {
    if (!obj) return new Vector3D(0, 0, 0);
    return new Vector3D(obj.x || 0, obj.y || 0, obj.z || 0);
  }
}
