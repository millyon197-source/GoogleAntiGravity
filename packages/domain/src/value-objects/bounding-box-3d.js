import { Vector3D } from './vector3d.js';

/**
 * Pure domain value object representing an axis-aligned 3D bounding box (AABB).
 * Free of Three.js Box3 dependencies.
 */
export class BoundingBox3D {
  /**
   * @param {number} minX 
   * @param {number} maxX 
   * @param {number} minY 
   * @param {number} maxY 
   * @param {number} minZ 
   * @param {number} maxZ 
   */
  constructor(minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0) {
    this.minX = Math.min(minX, maxX);
    this.maxX = Math.max(minX, maxX);
    this.minY = Math.min(minY, maxY);
    this.maxY = Math.max(minY, maxY);
    this.minZ = Math.min(minZ, maxZ);
    this.maxZ = Math.max(minZ, maxZ);
    Object.freeze(this);
  }

  get widthX() {
    return this.maxX - this.minX;
  }

  get heightY() {
    return this.maxY - this.minY;
  }

  get depthZ() {
    return this.maxZ - this.minZ;
  }

  get center() {
    return new Vector3D(
      (this.minX + this.maxX) / 2,
      (this.minY + this.maxY) / 2,
      (this.minZ + this.maxZ) / 2
    );
  }

  get size() {
    return new Vector3D(this.widthX, this.heightY, this.depthZ);
  }

  /**
   * @param {Vector3D|{x: number, y: number, z: number}} point
   * @returns {boolean}
   */
  containsPoint(point) {
    if (!point) return false;
    return (
      point.x >= this.minX && point.x <= this.maxX &&
      point.y >= this.minY && point.y <= this.maxY &&
      point.z >= this.minZ && point.z <= this.maxZ
    );
  }

  /**
   * Check intersection with another bounding box with optional safety margin.
   * @param {BoundingBox3D} other
   * @param {number} [margin=0]
   * @returns {boolean}
   */
  intersectsBox(other, margin = 0) {
    if (!other) return false;
    return !(
      this.maxX + margin < other.minX ||
      this.minX - margin > other.maxX ||
      this.maxY + margin < other.minY ||
      this.minY - margin > other.maxY ||
      this.maxZ + margin < other.minZ ||
      this.minZ - margin > other.maxZ
    );
  }

  /**
   * Union with another bounding box.
   * @param {BoundingBox3D} other
   * @returns {BoundingBox3D}
   */
  union(other) {
    if (!other) return this;
    return new BoundingBox3D(
      Math.min(this.minX, other.minX),
      Math.max(this.maxX, other.maxX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxY, other.maxY),
      Math.min(this.minZ, other.minZ),
      Math.max(this.maxZ, other.maxZ)
    );
  }

  /**
   * Create from center point and dimensions.
   * @param {Vector3D|{x: number, y: number, z: number}} center
   * @param {Vector3D|{x: number, y: number, z: number}} size
   * @returns {BoundingBox3D}
   */
  static fromCenterAndSize(center, size) {
    const halfX = ((size?.x ?? size?.[0]) || 0) / 2;
    const halfY = ((size?.y ?? size?.[1]) || 0) / 2;
    const halfZ = ((size?.z ?? size?.[2]) || 0) / 2;
    const cx = center?.x || 0;
    const cy = center?.y || 0;
    const cz = center?.z || 0;

    return new BoundingBox3D(
      cx - halfX, cx + halfX,
      cy - halfY, cy + halfY,
      cz - halfZ, cz + halfZ
    );
  }
}
