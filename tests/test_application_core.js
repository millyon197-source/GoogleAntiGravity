import {
  UndoRedoManager,
  CostCalculator,
  StationPlanInteractor,
  IStationPlanUseCases,
  IHistoryUseCases,
  ICostCalculationUseCases,
  IRenderEnginePort
} from '../src/application/index.js';
import { StationPlan, StationModule, Vector3D, EulerRotation } from '../src/domain/index.js';

console.log('[*] Testing Application Core (Hexagonal Architecture Ports & Use Cases)...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Inbound & Outbound Port Contract Verification
console.log('\n--- Test Group 1: Port Contracts & Inheritance ---');
const historyMgr = new UndoRedoManager({ getFriendlyName: (m) => `Friendly ${m}` });
assert(historyMgr instanceof IHistoryUseCases, 'UndoRedoManager implements IHistoryUseCases');

const costCalc = new CostCalculator((macro) => {
  if (macro === 'prod_claytronics') return { hullParts: 100, energyCells: 50 };
  if (macro === 'dock_standard') return { hullParts: 250, energyCells: 100 };
  return {};
});
assert(costCalc instanceof ICostCalculationUseCases, 'CostCalculator implements ICostCalculationUseCases');

const interactor = new StationPlanInteractor({ historyManager: historyMgr });
assert(interactor instanceof IStationPlanUseCases, 'StationPlanInteractor implements IStationPlanUseCases');

// 2. UndoRedoManager Operations
console.log('\n--- Test Group 2: UndoRedoManager Operations ---');
assert(!historyMgr.canUndo(), 'Initially cannot undo');
assert(historyMgr.count === 0, 'Initially count is 0');

let subscriberNotified = false;
const unsub = historyMgr.subscribe((state) => {
  subscriberNotified = true;
});

historyMgr.recordAction({
  type: 'move',
  moduleIndex: 1,
  macro: 'dock_standard',
  from: { x: 0, y: 0, z: 0 },
  to: { x: 100, y: 0, z: 0 }
});

assert(subscriberNotified, 'Subscriber notified when action recorded');
assert(historyMgr.canUndo(), 'canUndo returns true after recording action');
assert(historyMgr.count === 1, 'History count is 1');

const tooltip = historyMgr.formatTooltip();
assert(tooltip.includes('Friendly dock_standard') && tooltip.includes('(100, 0, 0)'),
  `formatTooltip generated descriptive text: ${tooltip}`);

// Test Undo & Redo
const undone = historyMgr.undo();
assert(undone && undone.moduleIndex === 1, 'undo() returns popped action');
assert(historyMgr.count === 0, 'Count is 0 after undo');
assert(historyMgr.canRedo(), 'canRedo is true after undo');

const redone = historyMgr.redo();
assert(redone && redone.moduleIndex === 1, 'redo() restores action');
assert(historyMgr.count === 1, 'Count is 1 after redo');

// Test Diamond Center tooltip formatting
historyMgr.recordAction({
  type: 'move',
  moduleIndex: 2,
  macro: 'dock_standard',
  operation: 'diamond_center',
  from: { x: 500, y: 0, z: 0 },
  to: { x: 0, y: 0, z: 0 }
});
const centerTooltip = historyMgr.formatTooltip();
assert(centerTooltip.includes('Center in Plot'), `Center in Plot tooltip: ${centerTooltip}`);

historyMgr.clear();
assert(!historyMgr.canUndo() && historyMgr.count === 0, 'clear() resets history');
unsub();

// 3. CostCalculator Use Cases
console.log('\n--- Test Group 3: CostCalculator Use Cases ---');
const testPlan = new StationPlan({
  id: 'cost_test_plan',
  modules: [
    new StationModule({ index: 1, macro: 'prod_claytronics' }),
    new StationModule({ index: 2, macro: 'prod_claytronics' }),
    new StationModule({ index: 3, macro: 'dock_standard' })
  ]
});

const stationCosts = costCalc.calculateStationCost(testPlan);
assert(stationCosts.hullParts === 100 + 100 + 250, `Hull Parts total is 450 (calculated: ${stationCosts.hullParts})`);
assert(stationCosts.energyCells === 50 + 50 + 100, `Energy Cells total is 200 (calculated: ${stationCosts.energyCells})`);

// 4. StationPlanInteractor & Outbound Mock Engine
console.log('\n--- Test Group 4: StationPlanInteractor & Outbound Engine ---');
const mockRenderCalls = [];
const mockRenderEngine = {
  renderStation: (p) => mockRenderCalls.push(['renderStation', p.id]),
  setModulePosition: (idx, pos) => mockRenderCalls.push(['setModulePosition', idx, pos]),
  setModuleRotation: (idx, rot) => mockRenderCalls.push(['setModuleRotation', idx, rot])
};

const fullInteractor = new StationPlanInteractor({
  renderEngine: mockRenderEngine,
  historyManager: historyMgr
});

fullInteractor.loadPlan({
  id: 'alpha_plan',
  name: 'Alpha Plan',
  modules: [
    { index: 1, macro: 'dock_standard', position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } },
    { index: 2, macro: 'hab_standard', position: { x: 100, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } }
  ]
});

assert(fullInteractor.currentPlan !== null, 'loadPlan loads StationPlan into interactor');
assert(mockRenderCalls.some(c => c[0] === 'renderStation' && c[1] === 'alpha_plan'),
  'loadPlan notifies renderEngine.renderStation via port');

// Move module
fullInteractor.moveModule(1, { x: 250, y: 50, z: -100 });
assert(fullInteractor.currentPlan.getModuleByIndex(1).position.equals(new Vector3D(250, 50, -100)),
  'moveModule updates domain StationModule position');
assert(mockRenderCalls.some(c => c[0] === 'setModulePosition' && c[1] === 1 && c[2].x === 250),
  'moveModule dispatches setModulePosition to renderEngine port');
assert(historyMgr.canUndo(), 'moveModule records action in historyManager');

// Rotate module
fullInteractor.rotateModule(2, { yaw: 90, pitch: 0, roll: 0 });
assert(fullInteractor.currentPlan.getModuleByIndex(2).rotation.equals(new EulerRotation(90, 0, 0)),
  'rotateModule updates domain StationModule rotation');
assert(mockRenderCalls.some(c => c[0] === 'setModuleRotation' && c[1] === 2 && c[2].yaw === 90),
  'rotateModule dispatches setModuleRotation to renderEngine port');

// Group Move
fullInteractor.moveModulesGroup([
  { moduleIndex: 1, from: { x: 250, y: 50, z: -100 }, to: { x: 300, y: 50, z: -100 } },
  { moduleIndex: 2, from: { x: 100, y: 0, z: 0 }, to: { x: 150, y: 0, z: 0 } }
]);
assert(fullInteractor.currentPlan.getModuleByIndex(1).position.x === 300, 'Group move updates module 1');
assert(fullInteractor.currentPlan.getModuleByIndex(2).position.x === 150, 'Group move updates module 2');

if (allPassed) {
  console.log('\n[PASS] All Application Layer unit tests passed successfully!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Some Application Layer unit tests failed.');
  process.exit(1);
}
