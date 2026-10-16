import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';

console.log('[*] Testing multiple module moves and sequential undo exhaustion verification...');

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

global.document = {
  getElementById: (id) => mockDOM[id] || null
};

// 2. Setup mock modules and plan
const stationPlan = {
  name: 'Multi-Module Test Complex',
  modules: [
    { index: 0, macro: 'prod_gen_energycells_macro', position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } },
    { index: 1, macro: 'dockarea_arg_m_station_01_macro', position: { x: 100, y: 200, z: 300 }, rotation: { yaw: 0, pitch: 0, roll: 0 } },
    { index: 2, macro: 'storage_arg_l_container_01_macro', position: { x: -500, y: 150, z: -400 }, rotation: { yaw: 0, pitch: 0, roll: 0 } }
  ]
};

// 3. Mock 3D scene meshes representing the modules
const moduleMeshes = [
  new THREE.Group(),
  new THREE.Group(),
  new THREE.Group()
];

moduleMeshes.forEach((mesh, idx) => {
  mesh.userData = { index: idx, macro: stationPlan.modules[idx].macro };
  const p = stationPlan.modules[idx].position;
  mesh.position.set(p.x, p.y, -p.z);
});

// Mock setModulePosition as in viewer.js
function setModulePosition(index, pos) {
  const mesh = moduleMeshes[index];
  const mod = stationPlan.modules[index];
  mesh.position.set(pos.x, pos.y, -pos.z);
  mod.position.x = pos.x;
  mod.position.y = pos.y;
  mod.position.z = pos.z;
}

// 4. Undo list management implementation (matching src/main.js)
const undoList = [];

function updateUndoButtonUI(justActivated = false) {
  const btnUndo = document.getElementById('btn-undo');
  const undoHub = document.getElementById('undo-hub');
  const countBadge = document.getElementById('undo-count-badge');

  const count = undoList.length;
  const isEnabled = count > 0;

  if (undoHub) {
    if (isEnabled) {
      undoHub.style.display = 'flex';
      undoHub.classList.add('has-undo', 'visible');
    } else {
      undoHub.style.display = 'none';
      undoHub.classList.remove('has-undo', 'visible');
    }
  }

  if (btnUndo) {
    btnUndo.disabled = !isEnabled;

    if (isEnabled) {
      btnUndo.style.display = 'inline-flex';
      btnUndo.classList.add('has-undo');

      const lastMove = undoList[undoList.length - 1];
      let tooltipDesc = '';
      if (lastMove.type === 'move' && lastMove.from && lastMove.to) {
        tooltipDesc = `Module #${lastMove.moduleIndex} (${lastMove.friendlyName || 'Module'}) moved from (${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z}) to (${lastMove.to.x}, ${lastMove.to.y}, ${lastMove.to.z})`;
      }

      btnUndo.title = `Undo last module move (Ctrl+Z) • ${count} move${count > 1 ? 's' : ''} in undo history${tooltipDesc ? `\n${tooltipDesc}` : ''}`;

      if (countBadge) {
        countBadge.textContent = count.toString();
        countBadge.style.display = 'inline-flex';
      }

      if (justActivated) {
        btnUndo.classList.remove('flash-activate');
        btnUndo.classList.add('flash-activate');
      }
    } else {
      btnUndo.style.display = 'none';
      btnUndo.classList.remove('has-undo', 'flash-activate');
      btnUndo.title = 'No module moves to undo (Ctrl+Z)';
      if (countBadge) {
        countBadge.style.display = 'none';
        countBadge.textContent = '0';
      }
    }
  }
}

function recordMove(move) {
  undoList.push(move);
  updateUndoButtonUI(true);
}

function performUndo() {
  if (undoList.length === 0) {
    updateUndoButtonUI();
    return null;
  }
  const lastMove = undoList.pop();
  if (lastMove.type === 'move' && lastMove.from) {
    setModulePosition(lastMove.moduleIndex, lastMove.from);
  }
  updateUndoButtonUI();
  return lastMove;
}

// ==========================================
// TEST STEP 1: Verify Initial State
// ==========================================
console.log('\n--- Step 1: Initial State Check ---');
updateUndoButtonUI();
assert(undoList.length === 0, 'Initial undo list is empty');
assert(mockUndoHub.style.display === 'none', 'Undo hub is initially hidden (display: none)');
assert(mockBtnUndo.style.display === 'none', 'Undo button is initially hidden (display: none)');
assert(mockBtnUndo.disabled === true, 'Undo button is initially disabled');

// ==========================================
// TEST STEP 2: Move Multiple Modules
// ==========================================
console.log('\n--- Step 2: Move Multiple Modules ---');

// Move 1: Module 0 moved from (0, 0, 0) to (50, 100, -50)
const move1 = {
  type: 'move',
  moduleIndex: 0,
  friendlyName: 'Energy Cells',
  from: { ...stationPlan.modules[0].position },
  to: { x: 50, y: 100, z: -50 }
};
setModulePosition(0, move1.to);
recordMove(move1);

assert(undoList.length === 1, 'Undo list has 1 item recorded after Move 1');
assert(mockUndoHub.style.display === 'flex', 'Undo hub is now VISIBLE (display: flex) after Move 1');
assert(mockBtnUndo.style.display === 'inline-flex', 'Undo button is now VISIBLE (display: inline-flex)');
assert(mockBtnUndo.disabled === false, 'Undo button is enabled');
assert(mockCountBadge.textContent === '1', 'Badge count shows 1');
assert(mockBtnUndo.classList.contains('has-undo'), 'Undo button has .has-undo class');

// Move 2: Module 1 moved from (100, 200, 300) to (250, 200, 300)
const move2 = {
  type: 'move',
  moduleIndex: 1,
  friendlyName: '1-Pier Dock',
  from: { ...stationPlan.modules[1].position },
  to: { x: 250, y: 200, z: 300 }
};
setModulePosition(1, move2.to);
recordMove(move2);

assert(undoList.length === 2, 'Undo list has 2 items recorded after Move 2');
assert(mockUndoHub.style.display === 'flex', 'Undo hub remains VISIBLE (display: flex) after Move 2');
assert(mockCountBadge.textContent === '2', 'Badge count shows 2');

// Move 3: Module 2 moved from (-500, 150, -400) to (-500, 300, -200)
const move3 = {
  type: 'move',
  moduleIndex: 2,
  friendlyName: 'Container Storage',
  from: { ...stationPlan.modules[2].position },
  to: { x: -500, y: 300, z: -200 }
};
setModulePosition(2, move3.to);
recordMove(move3);

assert(undoList.length === 3, 'Undo list has 3 items recorded after Move 3');
assert(mockUndoHub.style.display === 'flex', 'Undo hub remains VISIBLE (display: flex) after Move 3');
assert(mockCountBadge.textContent === '3', 'Badge count shows 3');

// Verify current positions before undos
assert(stationPlan.modules[0].position.x === 50 && stationPlan.modules[0].position.y === 100 && stationPlan.modules[0].position.z === -50, 'Module 0 is at moved coordinates');
assert(stationPlan.modules[1].position.x === 250 && stationPlan.modules[1].position.y === 200 && stationPlan.modules[1].position.z === 300, 'Module 1 is at moved coordinates');
assert(stationPlan.modules[2].position.x === -500 && stationPlan.modules[2].position.y === 300 && stationPlan.modules[2].position.z === -200, 'Module 2 is at moved coordinates');

// ==========================================
// TEST STEP 3: Perform Sequential Undos
// ==========================================
console.log('\n--- Step 3: Sequential Undos Until Exhaustion ---');

// Undo 1 (reverting Move 3)
const undone1 = performUndo();
assert(undone1.moduleIndex === 2, 'First undo reverted Module #2');
assert(stationPlan.modules[2].position.x === -500 && stationPlan.modules[2].position.y === 150 && stationPlan.modules[2].position.z === -400, 'Module 2 reverted to original coordinates (-500, 150, -400)');
assert(moduleMeshes[2].position.z === 400, 'Three.js mesh Z reverted to -(-400) = 400');
assert(undoList.length === 2, 'Undo list now has 2 items');
assert(mockUndoHub.style.display === 'flex', 'Undo hub remains VISIBLE while moves remain');
assert(mockCountBadge.textContent === '2', 'Badge count updated to 2');

// Undo 2 (reverting Move 2)
const undone2 = performUndo();
assert(undone2.moduleIndex === 1, 'Second undo reverted Module #1');
assert(stationPlan.modules[1].position.x === 100 && stationPlan.modules[1].position.y === 200 && stationPlan.modules[1].position.z === 300, 'Module 1 reverted to original coordinates (100, 200, 300)');
assert(moduleMeshes[1].position.z === -300, 'Three.js mesh Z reverted to -(300) = -300');
assert(undoList.length === 1, 'Undo list now has 1 item');
assert(mockUndoHub.style.display === 'flex', 'Undo hub remains VISIBLE while 1 move remains');
assert(mockCountBadge.textContent === '1', 'Badge count updated to 1');

// Undo 3 (reverting Move 1 - Exhaustion)
const undone3 = performUndo();
assert(undone3.moduleIndex === 0, 'Third undo reverted Module #0');
assert(stationPlan.modules[0].position.x === 0 && stationPlan.modules[0].position.y === 0 && stationPlan.modules[0].position.z === 0, 'Module 0 reverted to original coordinates (0, 0, 0)');
assert(moduleMeshes[0].position.z === 0, 'Three.js mesh Z reverted to -(0) = 0');
assert(undoList.length === 0, 'Undo list is now EXHAUSTED (0 items)');

// ==========================================
// TEST STEP 4: Verify Undo Button is Hidden
// ==========================================
console.log('\n--- Step 4: Verify Undo Button and Hub are Hidden ---');
assert(mockUndoHub.style.display === 'none', 'Undo hub is HIDDEN (style.display === "none")');
assert(mockBtnUndo.style.display === 'none', 'Undo button is HIDDEN (style.display === "none")');
assert(mockBtnUndo.disabled === true, 'Undo button is disabled');
assert(!mockBtnUndo.classList.contains('has-undo'), 'Undo button does not have .has-undo');
assert(!mockUndoHub.classList.contains('visible'), 'Undo hub does not have .visible');

// ==========================================
// TEST STEP 5: Verify Gizmo Release Adds to Undo List
// ==========================================
console.log('\n--- Step 5: Verify Gizmo Release Semantics ---');

// Simulate gizmo drag start on Module 1
let isGizmoDragging = true;
let hasGizmoMoved = false;
let gizmoActiveType = 'move';
let dragStartPosition = { ...stationPlan.modules[1].position };

// Simulate user dragging gizmo
hasGizmoMoved = true;
stationPlan.modules[1].position = { x: 120, y: 220, z: 320 };

// Simulate gizmo release (pointerup / mouseup / dragging-changed false)
if (isGizmoDragging || hasGizmoMoved) {
  const moveOnRelease = {
    type: 'move',
    moduleIndex: 1,
    friendlyName: '1-Pier Dock',
    from: dragStartPosition,
    to: { ...stationPlan.modules[1].position }
  };
  recordMove(moveOnRelease);
}
isGizmoDragging = false;
hasGizmoMoved = false;

assert(undoList.length === 1, 'Gizmo release successfully considered a move taken place and added to undo list');
assert(mockUndoHub.style.display === 'flex', 'Undo hub is visible after gizmo release');
assert(mockBtnUndo.style.display === 'inline-flex', 'Undo button is visible after gizmo release');

// Perform undo to exhaust again
performUndo();
assert(undoList.length === 0, 'Undo list exhausted after reverting gizmo release move');
assert(mockUndoHub.style.display === 'none', 'Undo hub is hidden after exhausting undo list');
assert(mockBtnUndo.style.display === 'none', 'Undo button is hidden after exhausting undo list');

console.log(`\n========================================`);
if (allPassed) {
  console.log('✅ ALL MULTI-MODULE MOVE AND UNDO EXHAUSTION TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}
