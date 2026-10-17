/**
 * Inbound (Primary) Port for Station Construction Plan operations.
 * Defines the driving contract for creating, loading, transforming, and arranging station modules.
 *
 * @interface IStationPlanUseCases
 */
export class IStationPlanUseCases {
  /**
   * Load and validate a construction plan.
   * @param {string|object} source - Raw XML string or parsed DTO
   * @returns {Promise<object>} The loaded domain StationPlan
   */
  async loadPlan(source) {
    throw new Error('Not implemented: IStationPlanUseCases.loadPlan');
  }

  /**
   * Move an individual module to target 3D coordinates.
   * @param {number} moduleIndex
   * @param {{x: number, y: number, z: number}} newPosition
   * @param {boolean} [recordInHistory=true]
   */
  moveModule(moduleIndex, newPosition, recordInHistory = true) {
    throw new Error('Not implemented: IStationPlanUseCases.moveModule');
  }

  /**
   * Move multiple modules together by delta or absolute positions.
   * @param {Array<{moduleIndex: number, from: object, to: object}>} moves
   * @param {boolean} [recordInHistory=true]
   */
  moveModulesGroup(moves, recordInHistory = true) {
    throw new Error('Not implemented: IStationPlanUseCases.moveModulesGroup');
  }

  /**
   * Rotate a module by Euler angles in degrees.
   * @param {number} moduleIndex
   * @param {{yaw: number, pitch: number, roll: number}} newRotation
   * @param {boolean} [recordInHistory=true]
   */
  rotateModule(moduleIndex, newRotation, recordInHistory = true) {
    throw new Error('Not implemented: IStationPlanUseCases.rotateModule');
  }

  /**
   * Delete a module from the current plan.
   * @param {number} moduleIndex
   * @param {boolean} [recordInHistory=true]
   */
  deleteModule(moduleIndex, recordInHistory = true) {
    throw new Error('Not implemented: IStationPlanUseCases.deleteModule');
  }

  /**
   * Toggle visibility of a module or category.
   * @param {number} moduleIndex
   * @param {boolean} [isVisible]
   */
  setModuleVisibility(moduleIndex, isVisible) {
    throw new Error('Not implemented: IStationPlanUseCases.setModuleVisibility');
  }

  /**
   * Center all modules or active selection within the station plot.
   * @param {number[]} [moduleIndices] - If null/empty, centers all modules
   */
  centerInPlot(moduleIndices = null) {
    throw new Error('Not implemented: IStationPlanUseCases.centerInPlot');
  }
}
