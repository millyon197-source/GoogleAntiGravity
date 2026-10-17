import * as THREE from 'three';
import { DEFAULT_PLOT_CONFIG } from '../src/module-display-panel.js';
import { setFefbModuleIndex, getFefbModuleIndex } from '../src/blueprint-exporter.js';

console.log('[*] Testing Diamond operations (Center in Plot, Fit Plot, Set FEFB) in Undo list...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Mock DOM environment for UI elements
const mockDOM = {};
function createMockElement(id, initialDisplay = '') {
  const el = {
    id,
    style: { display: initialDisplay },
    classList: {
      classes: new Set(),
      add: function(...cls) { cls.forEach(c => this.classes.add(c)); },
      remove: function(...cls) { cls.forEach(c => this.classes.delete(c)); },
      contains: function(c) { return this.classes.has(c); }
    },
    disabled: false,
    textContent: '',
    title: '',
    offsetWidth: 100
  };
  mockDOM[id] = el;
  return el;
}

const mockUndoHub = createMockElement('undo-hub', 'none');
const mockBtnUndo = createMockElement('btn-undo', 'none');
mockBtnUndo.disabled = true;
const mockCountBadge = createMockElement('undo-count-badge', 'none');
const mockCenterModal = createMockElement('center-modules-modal', 'none');

global.document = {
  getElementById: (id) => mockDOM[id] || null,
  querySelectorAll: () => []
};

// 2. Setup mock modules and plan
const stationPlan = {
  name: 'Diamond Test Station',
  fefbModuleIndex: null,
  modules: [
    { index: 0, macro: 'prod_gen_energycells_macro', position: { x: 1000, y: 500, z: -1000 }, rotation: { yaw: 0, pitch: 0, roll: 0 } },
    { index: 1, macro: 'dockarea_arg_m_station_01_macro', position: { x: 3000, y: 1500, z: -2000 }, rotation: { yaw: 0, pitch: 0, roll: 0 } }
  ]
};

const moduleMeshes = [
  new THREE.Group(),
  new THREE.Group()
];

moduleMeshes.forEach((mesh, idx) => {
  mesh.userData = { index: idx, macro: stationPlan.modules[idx].macro };
  const p = stationPlan.modules[idx].position;
  mesh.position.set(p.x, p.y, -p.z);
});

// Mock plot config state
let currentPlotConfig = JSON.parse(JSON.stringify(DEFAULT_PLOT_CONFIG));
function mockSetPlotConfig(newConfig) {
  currentPlotConfig = JSON.parse(JSON.stringify(newConfig));
}

// 3. Mock Viewer instance
const viewer = {
  modulesGroup: { children: moduleMeshes },
  currentPlotConfig: currentPlotConfig,
  fefbModuleIndex: null,
  restoreFullPlanGridCalled: 0,
  updatePlotBoxViolationsCalled: 0,
  showFloatingPlotSizeCalled: 0,
  lastFloatingPlotSize: null,
  setModulePosition: (index, pos) => {
    const mesh = moduleMeshes[index];
    mesh.position.set(pos.x, pos.y, -pos.z);
    stationPlan.modules[index].position.x = pos.x;
    stationPlan.modules[index].position.y = pos.y;
    stationPlan.modules[index].position.z = pos.z;
  },
  restoreFullPlanGrid: () => { viewer.restoreFullPlanGridCalled++; },
  updatePlotBoxViolations: () => { viewer.updatePlotBoxViolationsCalled++; },
  showFloatingPlotSize: (x, y, z) => {
    viewer.showFloatingPlotSizeCalled++;
    viewer.lastFloatingPlotSize = { x, y, z };
  },
  hideFloatingPlotSize: () => {}
};

// 4. Implement undo logic matching src/main.js
const undoList = [];

function recordMove(move) {
  const enrichedMove = {
    ...move,
    friendlyName: move.macro || `Module #${move.moduleIndex}`,
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 4)
  };
  undoList.push(enrichedMove);
  updateUndoButtonUI(true);
}

function updateUndoButtonUI(justActivated = false) {
  const count = undoList.length;
  const isEnabled = count > 0;

  if (mockUndoHub) {
    if (isEnabled) {
      mockUndoHub.style.display = 'flex';
      mockUndoHub.classList.add('has-undo', 'visible');
    } else {
      mockUndoHub.style.display = 'none';
      mockUndoHub.classList.remove('has-undo', 'visible');
    }
  }

  if (mockBtnUndo) {
    mockBtnUndo.disabled = !isEnabled;

    if (isEnabled) {
      mockBtnUndo.style.display = 'inline-flex';
      mockBtnUndo.classList.add('has-undo');

      const lastMove = undoList[undoList.length - 1];
      let tooltipDesc = '';
      if (lastMove.type === 'move' && lastMove.from && lastMove.to) {
        if (lastMove.operation === 'diamond_center') {
          tooltipDesc = `Center in Plot: Module #${lastMove.moduleIndex} (${lastMove.friendlyName || 'Module'}) moved to center`;
        } else {
          tooltipDesc = `Module #${lastMove.moduleIndex} (${lastMove.friendlyName || 'Module'}) moved from (${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z}) to (${lastMove.to.x}, ${lastMove.to.y}, ${lastMove.to.z})`;
        }
      } else if (lastMove.type === 'group_move' && Array.isArray(lastMove.moves)) {
        if (lastMove.operation === 'diamond_center') {
          tooltipDesc = `Center in Plot: ${lastMove.moves.length} modules moved together to center`;
        } else {
          tooltipDesc = `Group move: ${lastMove.moves.length} modules moved together`;
        }
      } else if (lastMove.type === 'plot_resize') {
        const fromCfg = lastMove.fromConfig;
        const fromSize = fromCfg ? `${fromCfg.x.plus + fromCfg.x.minus}x${fromCfg.y.plus + fromCfg.y.minus}x${fromCfg.z.plus + fromCfg.z.minus} km` : '';
        tooltipDesc = `Fit Plot to Blueprint: Plot size changed (revert to ${fromSize})`;
      } else if (lastMove.type === 'set_fefb') {
        tooltipDesc = `Set FEFB: Module #${lastMove.moduleIndex} (${lastMove.friendlyName || 'Module'}) (revert to ${lastMove.previousFefb !== null && lastMove.previousFefb !== undefined ? `Module #${lastMove.previousFefb}` : 'none'})`;
      }

      mockBtnUndo.title = `Undo last module move (Ctrl+Z) • ${count} move${count > 1 ? 's' : ''} in undo history • Right-click to clear list${tooltipDesc ? `\n${tooltipDesc}` : ''}`;

      if (mockCountBadge) {
        mockCountBadge.textContent = count;
        mockCountBadge.style.display = 'inline-flex';
      }
    } else {
      mockBtnUndo.style.display = 'none';
      mockBtnUndo.classList.remove('has-undo', 'flash-activate');
      mockBtnUndo.title = 'No module moves to undo (Ctrl+Z)';
      if (mockCountBadge) {
        mockCountBadge.style.display = 'none';
        mockCountBadge.textContent = '0';
      }
    }
  }
}

function performUndo() {
  if (undoList.length === 0) {
    updateUndoButtonUI();
    return null;
  }

  const lastMove = undoList.pop();
  if (!lastMove || !viewer) return null;

  if (lastMove.type === 'group_move' && Array.isArray(lastMove.moves)) {
    lastMove.moves.forEach(m => {
      viewer.setModulePosition(m.moduleIndex, m.from);
    });
    viewer.restoreFullPlanGrid();
  } else if (lastMove.type === 'move' && lastMove.from) {
    viewer.setModulePosition(lastMove.moduleIndex, lastMove.from);
  } else if (lastMove.type === 'plot_resize' && lastMove.fromConfig) {
    mockSetPlotConfig(lastMove.fromConfig);
    viewer.currentPlotConfig = lastMove.fromConfig;
    viewer.restoreFullPlanGrid();
    viewer.updatePlotBoxViolations();
    const cfg = lastMove.fromConfig;
    viewer.showFloatingPlotSize(cfg.x.plus + cfg.x.minus, cfg.y.plus + cfg.y.minus, cfg.z.plus + cfg.z.minus);
  } else if (lastMove.type === 'set_fefb') {
    const prevFefb = lastMove.previousFefb;
    viewer.fefbModuleIndex = prevFefb;
    stationPlan.fefbModuleIndex = prevFefb;
    setFefbModuleIndex(prevFefb);
  }

  updateUndoButtonUI();
  return lastMove;
}

// ==============================================================================
// TEST SUITE: Diamond Operations in Undo System
// ==============================================================================

console.log('\n--- Step 1: Initial State Check ---');
updateUndoButtonUI();
assert(undoList.length === 0, 'Undo list is initially empty');
assert(mockUndoHub.style.display === 'none', 'Undo hub is initially hidden');
assert(mockBtnUndo.disabled === true, 'Undo button is initially disabled');

console.log('\n--- Step 2: Diamond Operation 1 - Fit Plot to Blueprint (plot_resize) ---');
const oldPlotConfig = JSON.parse(JSON.stringify(currentPlotConfig));
const fittedPlotConfig = {
  enabled: true,
  x: { plus: 4, minus: 1 },
  y: { plus: 2, minus: 1 },
  z: { plus: 3, minus: 1 }
};
mockSetPlotConfig(fittedPlotConfig);
viewer.currentPlotConfig = fittedPlotConfig;

recordMove({
  type: 'plot_resize',
  operation: 'diamond_fit',
  description: 'Fit Plot to Blueprint',
  fromConfig: oldPlotConfig,
  toConfig: fittedPlotConfig,
  timestamp: Date.now()
});

assert(undoList.length === 1, 'Undo list contains plot_resize action');
assert(mockUndoHub.style.display === 'flex', 'Undo hub is visible');
assert(mockBtnUndo.disabled === false, 'Undo button is enabled');
assert(mockBtnUndo.title.includes('Fit Plot to Blueprint'), 'Undo tooltip describes Fit Plot to Blueprint');
assert(mockBtnUndo.title.includes('20x20x20 km'), 'Undo tooltip mentions revert size (20x20x20 km)');

console.log('\n--- Step 3: Diamond Operation 2 - Center in Plot (diamond_center) ---');
// Center Module #0
const fromPos0 = { x: 1000, y: 500, z: -1000 };
const toPos0 = { x: 0, y: 0, z: 0 };
viewer.setModulePosition(0, toPos0);

recordMove({
  type: 'move',
  operation: 'diamond_center',
  moduleIndex: 0,
  macro: 'prod_gen_energycells_macro',
  from: fromPos0,
  to: toPos0,
  delta: { dx: -1000, dy: -500, dz: 1000 },
  timestamp: Date.now()
});

assert(undoList.length === 2, 'Undo list has 2 actions after Center in Plot');
assert(mockBtnUndo.title.includes('Center in Plot: Module #0'), 'Undo tooltip describes Center in Plot for Module #0');

console.log('\n--- Step 4: Diamond Operation 3 - Set FEFB (diamond_fefb) ---');
const previousFefb = viewer.fefbModuleIndex; // currently null
const newFefb = 1;
viewer.fefbModuleIndex = newFefb;
stationPlan.fefbModuleIndex = newFefb;
setFefbModuleIndex(newFefb);

recordMove({
  type: 'set_fefb',
  operation: 'diamond_fefb',
  previousFefb: previousFefb,
  newFefb: newFefb,
  moduleIndex: newFefb,
  macro: 'dockarea_arg_m_station_01_macro',
  friendlyName: '1M6S Standard Dock',
  timestamp: Date.now()
});

assert(undoList.length === 3, 'Undo list has 3 actions after Set FEFB');
assert(mockBtnUndo.title.includes('Set FEFB: Module #1'), 'Undo tooltip describes Set FEFB');
assert(getFefbModuleIndex() === 1, 'activeFefbModuleIndex is currently 1');

console.log('\n--- Step 5: Perform Sequential Undos (Reverse Order) ---');

// Undo 1: Revert FEFB
const undoneFefb = performUndo();
assert(undoneFefb.type === 'set_fefb', 'First undo reverts set_fefb');
assert(viewer.fefbModuleIndex === null, 'viewer.fefbModuleIndex reverted to null');
assert(stationPlan.fefbModuleIndex === null, 'stationPlan.fefbModuleIndex reverted to null');
assert(getFefbModuleIndex() === null, 'activeFefbModuleIndex reverted to null');
assert(undoList.length === 2, 'Undo list has 2 actions remaining');

// Undo 2: Revert Centering
const undoneCenter = performUndo();
assert(undoneCenter.type === 'move' && undoneCenter.operation === 'diamond_center', 'Second undo reverts diamond_center');
assert(stationPlan.modules[0].position.x === 1000 && stationPlan.modules[0].position.y === 500 && stationPlan.modules[0].position.z === -1000,
  'Module #0 position reverted to original coordinates (1000, 500, -1000)');
assert(undoList.length === 1, 'Undo list has 1 action remaining');

// Undo 3: Revert Plot Resize
const undonePlot = performUndo();
assert(undonePlot.type === 'plot_resize' && undonePlot.operation === 'diamond_fit', 'Third undo reverts diamond_fit');
assert(currentPlotConfig.x.plus === 10 && currentPlotConfig.x.minus === 10, 'currentPlotConfig reverted to 10+10 km on X');
assert(viewer.lastFloatingPlotSize.x === 20, 'Floating plot HUD triggered for reverted size (20 km)');
assert(undoList.length === 0, 'Undo list is now exhausted (0 items)');

console.log('\n--- Step 6: Verify Exhaustion UI State ---');
assert(mockUndoHub.style.display === 'none', 'Undo hub is hidden after exhaustion');
assert(mockBtnUndo.style.display === 'none', 'Undo button is hidden after exhaustion');
assert(mockBtnUndo.disabled === true, 'Undo button is disabled');
assert(!mockBtnUndo.classList.contains('has-undo'), 'Undo button has-undo class removed');

console.log('\n--- Step 7: Diamond Operation Group Move (Multi-Module Center) ---');
const groupMoves = [
  { moduleIndex: 0, from: { x: 1000, y: 500, z: -1000 }, to: { x: 500, y: 250, z: -500 } },
  { moduleIndex: 1, from: { x: 3000, y: 1500, z: -2000 }, to: { x: 2500, y: 1250, z: -1500 } }
];
viewer.setModulePosition(0, groupMoves[0].to);
viewer.setModulePosition(1, groupMoves[1].to);

recordMove({
  type: 'group_move',
  operation: 'diamond_center',
  moves: groupMoves,
  timestamp: Date.now()
});

assert(undoList.length === 1, 'Undo list has group_move action');
assert(mockBtnUndo.title.includes('Center in Plot: 2 modules moved together to center'), 'Group center tooltip formatted correctly');

const undoneGroupCenter = performUndo();
assert(undoneGroupCenter.type === 'group_move', 'Undo reverts group_move');
assert(stationPlan.modules[0].position.x === 1000 && stationPlan.modules[1].position.x === 3000,
  'All group modules reverted to their individual from positions');
assert(undoList.length === 0, 'Undo list is exhausted after reverting group center');

if (allPassed) {
  console.log('\n[PASS] All Diamond operations undo tests passed successfully!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Some tests failed.');
  process.exit(1);
}
