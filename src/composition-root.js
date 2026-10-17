import {
  UndoRedoManager,
  CostCalculator,
  StationPlanInteractor
} from '@x4/application';
import {
  XmlBlueprintParser,
  XmlBlueprintExporter
} from '@x4/adapter-xml';
import {
  ThreeRenderEngine
} from '@x4/adapter-three';
import { getFriendlyName, estimateModuleCosts } from './modules.js';

/**
 * Composition Root for X4 Station Visualizer.
 * Wires the Hexagonal Architecture:
 * - Pure Domain core (@x4/domain)
 * - Application Use Cases & Interactors (@x4/application)
 * - Outbound Adapters (@x4/adapter-three, @x4/adapter-xml)
 * - Dependency Injection container
 */
export class CompositionRoot {
  /**
   * @param {object} [options]
   * @param {object} [options.viewer] Optional StationViewer instance
   */
  constructor({ viewer = null } = {}) {
    // 1. Outbound Adapters
    this.blueprintParser = new XmlBlueprintParser();
    this.blueprintExporter = new XmlBlueprintExporter();
    this.renderEngine = new ThreeRenderEngine(viewer);

    // 2. Application Services & Use Cases
    this.historyManager = new UndoRedoManager({ getFriendlyName });
    this.costCalculator = new CostCalculator(estimateModuleCosts);
    this.stationPlanInteractor = new StationPlanInteractor({
      renderEngine: this.renderEngine,
      parser: this.blueprintParser,
      blueprintParser: this.blueprintParser,
      blueprintExporter: this.blueprintExporter,
      historyManager: this.historyManager
    });
  }

  /**
   * Set or update the active viewer instance in the render engine adapter.
   * @param {object} viewer - StationViewer instance
   */
  setViewer(viewer) {
    this.renderEngine.viewer = viewer;
  }

  /**
   * Singleton instance accessor for easy app-wide access.
   * @param {object} [options]
   * @returns {CompositionRoot}
   */
  static getInstance(options = {}) {
    if (!CompositionRoot._instance) {
      CompositionRoot._instance = new CompositionRoot(options);
    } else if (options.viewer && !CompositionRoot._instance.renderEngine.viewer) {
      CompositionRoot._instance.setViewer(options.viewer);
    }
    return CompositionRoot._instance;
  }

  /**
   * Reset instance (useful for clean unit test state).
   */
  static resetInstance() {
    CompositionRoot._instance = null;
  }
}

export const compositionRoot = CompositionRoot.getInstance();
