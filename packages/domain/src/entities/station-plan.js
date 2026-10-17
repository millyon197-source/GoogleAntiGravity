import { StationModule } from './station-module.js';
import { BoundingBox3D } from '../value-objects/bounding-box-3d.js';
import { Vector3D } from '../value-objects/vector3d.js';

/**
 * Pure domain Aggregate Root representing an X4 Station Construction Plan.
 * Encapsulates the collection of modules, builder sequencing, and collective spatial calculations.
 */
export class StationPlan {
  /**
   * @param {{
   *   id?: string,
   *   name?: string,
   *   description?: string,
   *   modules?: StationModule[]
   * }} params
   */
  constructor({
    id = 'unknown_plan',
    name = 'Unnamed Station Plan',
    description = '',
    modules = []
  } = {}) {
    this.id = id;
    this.name = name;
    this.description = description;
    /** @type {Map<number, StationModule>} */
    this._modules = new Map();

    modules.forEach(m => {
      this._modules.set(m.index, m);
    });
  }

  /**
   * Returns all modules sorted strictly by their build sequence index.
   * @returns {StationModule[]}
   */
  getModules() {
    return Array.from(this._modules.values()).sort((a, b) => a.index - b.index);
  }

  /**
   * @param {number} index
   * @returns {StationModule|undefined}
   */
  getModuleByIndex(index) {
    return this._modules.get(Number(index));
  }

  /**
   * @param {StationModule} module
   */
  addModule(module) {
    if (!module) return;
    this._modules.set(module.index, module);
  }

  /**
   * @param {number} index
   * @returns {boolean}
   */
  removeModule(index) {
    return this._modules.delete(Number(index));
  }

  /**
   * @returns {number}
   */
  get count() {
    return this._modules.size;
  }

  /**
   * @returns {number}
   */
  get moduleCount() {
    return this._modules.size;
  }

  /**
   * @returns {StationModule[]}
   */
  get modules() {
    return this.getModules();
  }

  /**
   * Computes the collective 3D bounding box for all modules in this plan.
   *
   * @param {(macro: string) => {x: number, y: number, z: number}} getModuleDimensions
   * @returns {BoundingBox3D}
   */
  computeCollectiveBounds(getModuleDimensions) {
    const mods = this.getModules();
    if (mods.length === 0) {
      return new BoundingBox3D(0, 0, 0, 0, 0, 0);
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const mod of mods) {
      const dims = (getModuleDimensions && getModuleDimensions(mod.macro)) || { x: 100, y: 100, z: 100 };
      const halfX = (dims.x || 100) / 2;
      const halfY = (dims.y || 100) / 2;
      const halfZ = (dims.z || 100) / 2;

      minX = Math.min(minX, mod.position.x - halfX);
      maxX = Math.max(maxX, mod.position.x + halfX);
      minY = Math.min(minY, mod.position.y - halfY);
      maxY = Math.max(maxY, mod.position.y + halfY);
      minZ = Math.min(minZ, mod.position.z - halfZ);
      maxZ = Math.max(maxZ, mod.position.z + halfZ);
    }

    return new BoundingBox3D(minX, maxX, minY, maxY, minZ, maxZ);
  }

  /**
   * Export to standard plan DTO.
   * @returns {{
   *   id: string,
   *   name: string,
   *   description: string,
   *   modules: Array<{
   *     index: number,
   *     macro: string,
   *     connection: string,
   *     position: { x: number, y: number, z: number },
   *     rotation: { yaw: number, pitch: number, roll: number }
   *   }>
   * }}
   */
  toDto() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      modules: this.getModules().map(m => m.toDto())
    };
  }

  /**
   * Reconstitute StationPlan from standard parser DTO.
   * @param {object} dto
   * @param {(macro: string) => string} [getCategoryFn]
   * @returns {StationPlan}
   */
  static fromDto(dto, getCategoryFn) {
    if (!dto) return new StationPlan();
    const modules = Array.isArray(dto.modules)
      ? dto.modules.map(m => StationModule.fromDto(m, getCategoryFn ? getCategoryFn(m.macro) : 'Structure'))
      : [];

    return new StationPlan({
      id: dto.id || 'unknown_plan',
      name: dto.name || 'Unnamed Station Plan',
      description: dto.description || '',
      modules
    });
  }
}
