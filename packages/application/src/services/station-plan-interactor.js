import { IStationPlanUseCases } from '../ports/inbound/station-plan-use-cases.port.js';
import { StationPlan, StationModule, Vector3D, EulerRotation } from '@x4/domain';

/**
 * Main Application Use Case Interactor orchestrating Station Plan operations.
 * Implements IStationPlanUseCases. Coordinates domain entities with outbound ports.
 */
export class StationPlanInteractor extends IStationPlanUseCases {
  /**
   * @param {object} params
   * @param {import('../ports/outbound/render-engine.port.js').IRenderEnginePort} [params.renderEngine]
   * @param {import('../ports/outbound/blueprint-parser.port.js').IBlueprintParserPort} [params.parser]
   * @param {import('./undo-redo-manager.js').UndoRedoManager} [params.historyManager]
   */
  constructor({ renderEngine, parser, historyManager } = {}) {
    super();
    this.renderEngine = renderEngine;
    this.parser = parser;
    this.historyManager = historyManager;
    /** @type {StationPlan|null} */
    this.currentPlan = null;
  }

  /**
   * Load and validate a construction plan.
   * @param {string|object} source
   * @returns {Promise<StationPlan>}
   */
  async loadPlan(source) {
    if (typeof source === 'string' && this.parser) {
      this.currentPlan = this.parser.parse(source);
    } else if (source instanceof StationPlan) {
      this.currentPlan = source;
    } else if (source && typeof source === 'object') {
      this.currentPlan = StationPlan.fromDto(source);
    } else {
      throw new Error('Invalid plan source provided to StationPlanInteractor.loadPlan');
    }

    if (this.renderEngine && this.currentPlan) {
      this.renderEngine.renderStation(this.currentPlan);
    }

    if (this.historyManager) {
      this.historyManager.clear();
    }

    return this.currentPlan;
  }

  /**
   * Move an individual module to target 3D coordinates.
   * @param {number} moduleIndex
   * @param {{x: number, y: number, z: number}} newPosition
   * @param {boolean} [recordInHistory=true]
   */
  moveModule(moduleIndex, newPosition, recordInHistory = true) {
    if (!this.currentPlan) return;
    const mod = this.currentPlan.getModuleByIndex(moduleIndex);
    if (!mod) return;

    const fromPos = mod.position.toObject();
    const targetVector = newPosition instanceof Vector3D ? newPosition : Vector3D.fromObject(newPosition);
    mod.moveTo(targetVector);

    if (this.renderEngine) {
      this.renderEngine.setModulePosition(moduleIndex, mod.position.toObject());
    }

    if (recordInHistory && this.historyManager) {
      this.historyManager.recordAction({
        type: 'move',
        moduleIndex,
        macro: mod.macro,
        from: fromPos,
        to: mod.position.toObject(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Move multiple modules together.
   * @param {Array<{moduleIndex: number, from: object, to: object}>} moves
   * @param {boolean} [recordInHistory=true]
   */
  moveModulesGroup(moves, recordInHistory = true) {
    if (!this.currentPlan || !Array.isArray(moves)) return;

    moves.forEach(m => {
      const mod = this.currentPlan.getModuleByIndex(m.moduleIndex);
      if (mod) {
        mod.moveTo(m.to);
        if (this.renderEngine) {
          this.renderEngine.setModulePosition(m.moduleIndex, mod.position.toObject());
        }
      }
    });

    if (recordInHistory && this.historyManager && moves.length > 0) {
      this.historyManager.recordAction({
        type: 'group_move',
        moves: [...moves],
        timestamp: Date.now()
      });
    }
  }

  /**
   * Rotate a module by Euler angles in degrees.
   * @param {number} moduleIndex
   * @param {{yaw: number, pitch: number, roll: number}} newRotation
   * @param {boolean} [recordInHistory=true]
   */
  rotateModule(moduleIndex, newRotation, recordInHistory = true) {
    if (!this.currentPlan) return;
    const mod = this.currentPlan.getModuleByIndex(moduleIndex);
    if (!mod) return;

    const fromRot = mod.rotation.toObject();
    const targetRot = newRotation instanceof EulerRotation ? newRotation : EulerRotation.fromObject(newRotation);
    mod.rotateTo(targetRot);

    if (this.renderEngine) {
      this.renderEngine.setModuleRotation(moduleIndex, mod.rotation.toObject());
    }

    if (recordInHistory && this.historyManager) {
      this.historyManager.recordAction({
        type: 'rotate',
        moduleIndex,
        macro: mod.macro,
        fromRot,
        toRot: mod.rotation.toObject(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Delete a module from the plan.
   * @param {number} moduleIndex
   * @param {boolean} [recordInHistory=true]
   */
  deleteModule(moduleIndex, recordInHistory = true) {
    if (!this.currentPlan) return;
    const mod = this.currentPlan.getModuleByIndex(moduleIndex);
    if (!mod) return;

    this.currentPlan.removeModule(moduleIndex);

    if (recordInHistory && this.historyManager) {
      this.historyManager.recordAction({
        type: 'delete',
        moduleIndex,
        module: mod.toDto(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Toggle visibility of a module.
   * @param {number} moduleIndex
   * @param {boolean} [isVisible]
   */
  setModuleVisibility(moduleIndex, isVisible) {
    if (!this.currentPlan) return;
    const mod = this.currentPlan.getModuleByIndex(moduleIndex);
    if (!mod) return;

    mod.setVisibility(isVisible);
  }
}
