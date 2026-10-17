import { CompositionRoot, compositionRoot } from '../src/composition-root.js';
import { StationPlanInteractor, UndoRedoManager, CostCalculator } from '@x4/application';
import { XmlBlueprintParser, XmlBlueprintExporter } from '@x4/adapter-xml';
import { ThreeRenderEngine } from '@x4/adapter-three';

console.log('[*] Testing Hexagonal Architecture Composition Root...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Dependency Wiring Verification
console.log('\n--- Test Group 1: Dependency Wiring & Port Compliance ---');
assert(compositionRoot instanceof CompositionRoot, 'compositionRoot is an instance of CompositionRoot');
assert(compositionRoot.blueprintParser instanceof XmlBlueprintParser, 'blueprintParser adapter is wired');
assert(compositionRoot.blueprintExporter instanceof XmlBlueprintExporter, 'blueprintExporter adapter is wired');
assert(compositionRoot.renderEngine instanceof ThreeRenderEngine, 'renderEngine adapter is wired');

assert(compositionRoot.historyManager instanceof UndoRedoManager, 'historyManager use case is wired');
assert(compositionRoot.costCalculator instanceof CostCalculator, 'costCalculator use case is wired');
assert(compositionRoot.stationPlanInteractor instanceof StationPlanInteractor, 'stationPlanInteractor use case is wired');

// 2. End-to-End Hexagonal Flow through Composition Root
console.log('\n--- Test Group 2: End-to-End Interactor Execution ---');
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="root_plan_01" name="Root Test Station" description="DI Flow Verification">
    <entry index="1" macro="dock_ter_m_01_macro">
      <offset>
        <position x="0" y="0" z="0"/>
        <rotation yaw="0" pitch="0" roll="0"/>
      </offset>
    </entry>
  </plan>
</plans>`;

const plan = await compositionRoot.stationPlanInteractor.loadPlan(sampleXml);
assert(plan.name === 'Root Test Station', 'Interactor loads and parses plan via composition root');
assert(plan.moduleCount === 1, 'Plan contains 1 module');

// Move module via interactor and check history
compositionRoot.stationPlanInteractor.moveModule(1, { x: 50, y: 10, z: -20 });
assert(compositionRoot.historyManager.canUndo(), 'Move operation recorded in historyManager via interactor');

// 3. Dynamic Adapter Binding (Viewer)
console.log('\n--- Test Group 3: Dynamic Adapter Binding ---');
const mockViewer = {
  id: 'mock_viewer_v1',
  setModulePosition: () => {}
};

compositionRoot.setViewer(mockViewer);
assert(compositionRoot.renderEngine.viewer === mockViewer, 'setViewer updates render engine adapter');

// 4. Test Isolation
console.log('\n--- Test Group 4: Instance Reset & Isolation ---');
CompositionRoot.resetInstance();
const newInstance = CompositionRoot.getInstance();
assert(newInstance !== compositionRoot, 'resetInstance creates fresh DI container');

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n[PASS] All Composition Root tests completed successfully!');
}
