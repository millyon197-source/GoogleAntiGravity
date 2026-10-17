import { Vector3D } from './vector3d.js';
import { BoundingBox3D } from './bounding-box-3d.js';

/**
 * Pure domain value object representing the X4 Station Plot boundary configuration.
 * Encapsulates game constraints (max 20km per axis, min 1km) and 3D coordinate space mappings.
 */
export class PlotBounds {
  /**
   * @param {{
   *   enabled?: boolean,
   *   x?: { plus: number, minus: number },
   *   y?: { plus: number, minus: number },
   *   z?: { plus: number, minus: number }
   * }} config
   */
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.x = PlotBounds.normalizeAxis(config.x);
    this.y = PlotBounds.normalizeAxis(config.y);
    this.z = PlotBounds.normalizeAxis(config.z);

    // Three.js world coordinates in meters (1 km = 1,000 meters)
    // Three.js Z axis is inverted relative to X4 game coordinate definitions
    this.minX = -this.x.minus * 1000;
    this.maxX = this.x.plus * 1000;
    this.minY = -this.y.minus * 1000;
    this.maxY = this.y.plus * 1000;
    this.minZ = -this.z.plus * 1000;
    this.maxZ = this.z.minus * 1000;

    this.widthX = Math.max(1000, this.maxX - this.minX);
    this.heightY = Math.max(1000, this.maxY - this.minY);
    this.depthZ = Math.max(1000, this.maxZ - this.minZ);

    this.centerX = (this.minX + this.maxX) / 2;
    this.centerY = (this.minY + this.maxY) / 2;
    this.centerZ = (this.minZ + this.maxZ) / 2;

    Object.freeze(this);
  }

  /**
   * Normalizes an axis plus/minus configuration honoring game constraints:
   * 1. 0 <= plus, minus <= 20
   * 2. 1 <= plus + minus <= 20
   * @param {{ plus?: number, minus?: number }} [axisObj]
   * @param {number} [defVal=10]
   * @returns {{ plus: number, minus: number }}
   */
  static normalizeAxis(axisObj, defVal = 10) {
    let plus = Math.max(0, Math.min(20, Number(axisObj?.plus ?? defVal)));
    let minus = Math.max(0, Math.min(20, Number(axisObj?.minus ?? defVal)));

    if (plus + minus > 20) {
      minus = Math.max(0, 20 - plus);
    }
    if (plus + minus < 1) {
      plus = Math.max(1, plus);
      minus = 0;
    }
    return { plus, minus };
  }

  /**
   * Convert plot bounds to a 3D AABB BoundingBox3D.
   * @returns {BoundingBox3D}
   */
  toBoundingBox() {
    return new BoundingBox3D(this.minX, this.maxX, this.minY, this.maxY, this.minZ, this.maxZ);
  }

  /**
   * @returns {Vector3D}
   */
  getCenter() {
    return new Vector3D(this.centerX, this.centerY, this.centerZ);
  }

  /**
   * @returns {Vector3D}
   */
  getSize() {
    return new Vector3D(this.widthX, this.heightY, this.depthZ);
  }

  /**
   * Clamp a 3D module position strictly within plot boundaries,
   * honoring the module's bounding box dimensions.
   *
   * @param {Vector3D|{x: number, y: number, z: number}} pos
   * @param {Vector3D|{x: number, y: number, z: number}} size
   * @returns {Vector3D}
   */
  clampPosition(pos, size) {
    if (!pos) return new Vector3D(0, 0, 0);

    const halfX = ((size?.x ?? size?.[0]) || 0) / 2;
    const halfY = ((size?.y ?? size?.[1]) || 0) / 2;
    const halfZ = ((size?.z ?? size?.[2]) || 0) / 2;

    let cx = pos.x;
    let cy = pos.y;
    let cz = pos.z;

    if (this.widthX >= (size?.x || 0)) {
      cx = Math.max(this.minX + halfX, Math.min(this.maxX - halfX, cx));
    } else {
      cx = this.centerX;
    }

    if (this.heightY >= (size?.y || 0)) {
      cy = Math.max(this.minY + halfY, Math.min(this.maxY - halfY, cy));
    } else {
      cy = this.centerY;
    }

    if (this.depthZ >= (size?.z || 0)) {
      cz = Math.max(this.minZ + halfZ, Math.min(this.maxZ - halfZ, cz));
    } else {
      cz = this.centerZ;
    }

    return new Vector3D(cx, cy, cz);
  }

  /**
   * Check if a module position + dimensions is fully contained within the plot.
   *
   * @param {Vector3D|{x: number, y: number, z: number}} pos
   * @param {Vector3D|{x: number, y: number, z: number}} size
   * @returns {boolean}
   */
  contains(pos, size) {
    if (!pos) return false;
    const halfX = ((size?.x ?? size?.[0]) || 0) / 2;
    const halfY = ((size?.y ?? size?.[1]) || 0) / 2;
    const halfZ = ((size?.z ?? size?.[2]) || 0) / 2;

    return (
      pos.x - halfX >= this.minX && pos.x + halfX <= this.maxX &&
      pos.y - halfY >= this.minY && pos.y + halfY <= this.maxY &&
      pos.z - halfZ >= this.minZ && pos.z + halfZ <= this.maxZ
    );
  }

  /**
   * Export to configuration format compatible with UI and persistence.
   * @returns {{ enabled: boolean, x: {plus: number, minus: number}, y: {plus: number, minus: number}, z: {plus: number, minus: number} }}
   */
  toConfig() {
    return {
      enabled: this.enabled,
      x: { plus: this.x.plus, minus: this.x.minus },
      y: { plus: this.y.plus, minus: this.y.minus },
      z: { plus: this.z.plus, minus: this.z.minus }
    };
  }

  /**
   * Standard default 20x20x20km plot bounds.
   */
  static defaultBounds() {
    return new PlotBounds({
      enabled: true,
      x: { plus: 10, minus: 10 },
      y: { plus: 10, minus: 10 },
      z: { plus: 10, minus: 10 }
    });
  }
}
