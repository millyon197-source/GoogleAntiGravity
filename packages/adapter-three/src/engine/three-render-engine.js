import { IRenderEnginePort } from '@x4/application';

/**
 * Adapter implementing IRenderEnginePort.
 * Delegates high-level use-case render requests to StationViewer while keeping
 * the application layer agnostic of Three.js.
 */
export class ThreeRenderEngine extends IRenderEnginePort {
  /**
   * @param {object} [viewer] Optional StationViewer instance
   */
  constructor(viewer = null) {
    super();
    this.viewer = viewer;
    this.listeners = new Map();
  }

  /**
   * Mount the 3D renderer inside a DOM container.
   * @param {HTMLElement} container
   */
  mount(container) {
    if (this.viewer && typeof this.viewer.init === 'function') {
      this.viewer.init();
    }
  }

  /**
   * Render or synchronize a full domain StationPlan in the 3D scene.
   * @param {object} plan - Domain StationPlan or DTO
   */
  renderStation(plan) {
    if (!this.viewer) return;
    const modules = typeof plan.getModules === 'function' ? plan.getModules().map(m => m.toDto()) : (plan.modules || []);
    if (typeof this.viewer.renderPlan === 'function') {
      this.viewer.renderPlan(plan);
    }
  }

  /**
   * Update the 3D position of a module.
   * @param {number} moduleIndex
   * @param {{x: number, y: number, z: number}} position
   */
  setModulePosition(moduleIndex, position) {
    if (this.viewer && typeof this.viewer.setModulePosition === 'function') {
      this.viewer.setModulePosition(moduleIndex, position);
    }
  }

  /**
   * Update the 3D rotation of a module.
   * @param {number} moduleIndex
   * @param {{yaw: number, pitch: number, roll: number}} rotation
   */
  setModuleRotation(moduleIndex, rotation) {
    if (this.viewer && typeof this.viewer.setModuleRotation === 'function') {
      this.viewer.setModuleRotation(moduleIndex, rotation);
    }
  }

  /**
   * Focus camera onto a specific module.
   * @param {number} moduleIndex
   */
  focusOnModule(moduleIndex) {
    if (this.viewer && typeof this.viewer.focusCameraOnModule === 'function') {
      this.viewer.focusCameraOnModule(moduleIndex);
    }
  }

  /**
   * Set active interactive gizmo mode ('combined', 'translate', 'rotate').
   * @param {string} mode
   */
  setGizmoMode(mode) {
    if (this.viewer && typeof this.viewer.setGizmoMode === 'function') {
      this.viewer.setGizmoMode(mode);
    }
  }

  /**
   * Update plot boundary wireframe visualization in the 3D scene.
   * @param {object} plotConfig
   */
  updatePlotBox(plotConfig) {
    if (this.viewer && typeof this.viewer.updatePlotBox === 'function') {
      this.viewer.updatePlotBox(plotConfig);
    }
  }

  /**
   * Register event listener for renderer events.
   * @param {string} event
   * @param {Function} listener
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
  }

  /**
   * Emit an event to registered listeners.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(data);
        } catch (err) {
          console.error(`Error in IRenderEnginePort listener for ${event}:`, err);
        }
      });
    }
  }
}
