import { Vector3D } from '../value-objects/vector3d.js';
import { EulerRotation } from '../value-objects/euler-rotation.js';

/**
 * Pure domain entity representing an individual X4 Station Module.
 * Decoupled from Three.js scene-graph objects.
 */
export class StationModule {
  /**
   * @param {{
   *   id?: string,
   *   index: number,
   *   macro: string,
   *   position?: Vector3D|{x: number, y: number, z: number},
   *   rotation?: EulerRotation|{yaw: number, pitch: number, roll: number},
   *   connection?: string,
   *   isVisible?: boolean,
   *   category?: string
   * }} params
   */
  constructor({
    id,
    index,
    macro,
    position = new Vector3D(0, 0, 0),
    rotation = new EulerRotation(0, 0, 0),
    connection = '',
    isVisible = true,
    category = 'Structure'
  }) {
    this.id = id || `module_${index}_${Date.now()}`;
    this.index = Number(index) || 1;
    this.macro = String(macro || '').trim();
    this._position = position instanceof Vector3D ? position : Vector3D.fromObject(position);
    this._rotation = rotation instanceof EulerRotation ? rotation : EulerRotation.fromObject(rotation);
    this.connection = String(connection || '').trim();
    this.isVisible = isVisible !== false;
    this.category = category;
  }

  get position() {
    return this._position;
  }

  get rotation() {
    return this._rotation;
  }

  /**
   * Move module to new 3D coordinates.
   * @param {Vector3D|{x: number, y: number, z: number}} newPos
   */
  moveTo(newPos) {
    this._position = newPos instanceof Vector3D ? newPos : Vector3D.fromObject(newPos);
  }

  /**
   * Rotate module to new Euler rotation.
   * @param {EulerRotation|{yaw: number, pitch: number, roll: number}} newRot
   */
  rotateTo(newRot) {
    this._rotation = newRot instanceof EulerRotation ? newRot : EulerRotation.fromObject(newRot);
  }

  /**
   * Toggle or explicitly set module visibility.
   * @param {boolean} [visible]
   */
  setVisibility(visible) {
    this.isVisible = visible !== undefined ? !!visible : !this.isVisible;
  }

  /**
   * Serialize module to a standard plain DTO matching X4 parser format.
   * @returns {{
   *   index: number,
   *   macro: string,
   *   connection: string,
   *   position: { x: number, y: number, z: number },
   *   rotation: { yaw: number, pitch: number, roll: number }
   * }}
   */
  toDto() {
    return {
      index: this.index,
      macro: this.macro,
      connection: this.connection,
      position: this._position.toObject(),
      rotation: this._rotation.toObject()
    };
  }

  /**
   * Reconstitute module from a standard DTO.
   * @param {object} dto
   * @param {string} [category]
   * @returns {StationModule}
   */
  static fromDto(dto, category = 'Structure') {
    return new StationModule({
      id: dto.id || `mod_${dto.index}`,
      index: dto.index,
      macro: dto.macro,
      position: Vector3D.fromObject(dto.position),
      rotation: EulerRotation.fromObject(dto.rotation),
      connection: dto.connection || '',
      category
    });
  }
}
