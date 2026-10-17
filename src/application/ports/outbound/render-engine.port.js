/**
 * Outbound (Secondary) Port for 3D Viewport Rendering.
 * Decouples the application core and use cases from Three.js (or any 3D engine).
 *
 * @interface IRenderEnginePort
 */
export class IRenderEnginePort {
  /**
   * Mount the 3D renderer inside a DOM container.
   * @param {HTMLElement} container
   */
  mount(container) {
    throw new Error('Not implemented: IRenderEnginePort.mount');
  }

  /**
   * Render or synchronize a full domain StationPlan in the 3D scene.
   * @param {object} plan - Domain StationPlan
   */
  renderStation(plan) {
    throw new Error('Not implemented: IRenderEnginePort.renderStation');
  }

  /**
   * Update the 3D position of a module.
   * @param {number} moduleIndex
   * @param {{x: number, y: number, z: number}} position
   */
  setModulePosition(moduleIndex, position) {
    throw new Error('Not implemented: IRenderEnginePort.setModulePosition');
  }

  /**
   * Update the 3D rotation of a module.
   * @param {number} moduleIndex
   * @param {{yaw: number, pitch: number, roll: number}} rotation
   */
  setModuleRotation(moduleIndex, rotation) {
    throw new Error('Not implemented: IRenderEnginePort.setModuleRotation');
  }

  /**
   * Focus camera onto a specific module.
   * @param {number} moduleIndex
   */
  focusOnModule(moduleIndex) {
    throw new Error('Not implemented: IRenderEnginePort.focusOnModule');
  }

  /**
   * Set active interactive gizmo mode ('combined', 'translate', 'rotate').
   * @param {string} mode
   */
  setGizmoMode(mode) {
    throw new Error('Not implemented: IRenderEnginePort.setGizmoMode');
  }

  /**
   * Update plot boundary wireframe visualization in the 3D scene.
   * @param {object} plotConfig
   */
  updatePlotBox(plotConfig) {
    throw new Error('Not implemented: IRenderEnginePort.updatePlotBox');
  }

  /**
   * Register event listener for renderer events ('moduleMoved', 'moduleRotated', 'moduleSelected').
   * @param {string} event
   * @param {Function} listener
   */
  on(event, listener) {
    throw new Error('Not implemented: IRenderEnginePort.on');
  }
}
