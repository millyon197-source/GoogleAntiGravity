/**
 * Undo history for module moves/rotations and the Undo button UI.
 * Extracted from main.js.
 */
import { compositionRoot } from '../composition-root.js';
import { getFriendlyName } from '@x4/catalog';
import { setFefbModuleIndex } from '../blueprint-exporter.js';
import { setPlotConfig } from '../module-display-panel.js';

/**
 * Controller state and actions supplied by main.js via initUndoHistory().
 * - getViewer(): main.js `viewer`
 * - getCurrentPlan(): main.js `currentPlan`
 * - getSelectedIndex(): main.js `selectedIndex`
 * - updateStationStats(...)
 * - recalculateMeasurements(...)
 * - selectModule(...)
 * - showNotification(...)
 */
let deps = null;

/** Connects this module to the app controller (called once by main.js). */
export function initUndoHistory(controller) {
  deps = controller;
}

// ==============================================================================
// Undo Move Management
// ==============================================================================
export const historyManager = compositionRoot.historyManager;
export const undoList = historyManager.undoStack;

/**
 * Collapse Undo history to zero entries and update UI
 */
export function collapseUndoHistory() {
  historyManager.clear();
  updateUndoButtonUI();
}

export function recordMove(move) {
  historyManager.recordAction(move);
  updateUndoButtonUI(true); // true = animate activation flash to show presence
}

export function updateUndoButtonUI(justActivated = false) {
  const btnUndo = document.getElementById('btn-undo');
  const undoHub = document.getElementById('undo-hub');
  const countBadge = document.getElementById('undo-count-badge');

  const count = historyManager.count;
  const isEnabled = historyManager.canUndo();

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
      btnUndo.title = historyManager.formatTooltip();

      if (countBadge) {
        countBadge.textContent = count;
        countBadge.style.display = 'inline-flex';
      }

      if (justActivated) {
        btnUndo.classList.remove('flash-activate');
        void btnUndo.offsetWidth; // Force reflow to replay flash
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

export function performUndo() {
  if (!historyManager.canUndo()) {
    deps.showNotification('Undo list is exhausted. No more moves to undo.', 'info');
    updateUndoButtonUI();
    return;
  }

  const lastMove = historyManager.undo();
  if (!lastMove || !deps.getViewer()) return;

  const friendlyName = lastMove.friendlyName || getFriendlyName(lastMove.macro || '');

  if (lastMove.type === 'group_move' && Array.isArray(lastMove.moves)) {
    lastMove.moves.forEach(m => {
      deps.getViewer().setModulePosition(m.moduleIndex, m.from);
      const coordCell = document.getElementById(`mod-coords-${m.moduleIndex}`);
      if (coordCell) {
        coordCell.textContent = `${m.from.x}, ${m.from.y}, ${m.from.z}`;
      }
    });

    if (deps.getViewer().multiSelectPivot && deps.getViewer().selectedModules && deps.getViewer().selectedModules.length > 0) {
      deps.getViewer().multiSelectPivot.position.set(0, 0, 0);
      let count = 0;
      deps.getViewer().selectedModules.forEach(mod => {
        deps.getViewer().multiSelectPivot.position.add(mod.position);
        count++;
        mod.userData.multiDragStartPos = mod.position.clone();
      });
      if (count > 0) {
        deps.getViewer().multiSelectPivot.position.divideScalar(count);
      }
      if (deps.getViewer().multiSelectPivot.userData) {
        deps.getViewer().multiSelectPivot.userData.dragStartPos = deps.getViewer().multiSelectPivot.position.clone();
      }
      deps.getViewer().pivotDragStart = deps.getViewer().multiSelectPivot.position.clone();
      if (deps.getViewer().multiSelectionHelpers) {
        deps.getViewer().multiSelectionHelpers.forEach(h => h.update());
      }
    }

    deps.updateStationStats();
    deps.recalculateMeasurements();
    deps.getViewer().restoreFullPlanGrid();

    const remaining = undoList.length;
    const prefix = lastMove.operation === 'diamond_center' ? 'Undid centering' : 'Undid multi-module move';
    deps.showNotification(`${prefix}: ${lastMove.moves.length} modules reverted to previous positions${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'move' && lastMove.from) {
    deps.getViewer().setModulePosition(lastMove.moduleIndex, lastMove.from);

    const coordCell = document.getElementById(`mod-coords-${lastMove.moduleIndex}`);
    if (coordCell) {
      coordCell.textContent = `${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z}`;
    }

    const detPos = document.getElementById('det-pos');
    if (detPos && deps.getSelectedIndex() === lastMove.moduleIndex) {
      detPos.textContent = `X: ${lastMove.from.x}m | Y: ${lastMove.from.y}m | Z: ${lastMove.from.z}m`;
    }

    deps.selectModule(lastMove.moduleIndex, false);
    deps.updateStationStats();
    deps.recalculateMeasurements();

    const remaining = undoList.length;
    const prefix = lastMove.operation === 'diamond_center' ? 'Undid centering' : 'Undid move';
    deps.showNotification(`${prefix}: Module #${lastMove.moduleIndex} (${friendlyName}) reverted to (${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z})${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'rotate' && lastMove.fromRot) {
    deps.getViewer().setModuleRotation(lastMove.moduleIndex, lastMove.fromRot);

    const detRot = document.getElementById('det-rot');
    if (detRot && deps.getSelectedIndex() === lastMove.moduleIndex) {
      detRot.textContent = `Yaw: ${lastMove.fromRot.yaw}° | Pitch: ${lastMove.fromRot.pitch}° | Roll: ${lastMove.fromRot.roll}°`;
    }
    const inputPitch = document.getElementById('det-input-pitch');
    const inputRoll = document.getElementById('det-input-roll');
    const inputYaw = document.getElementById('det-input-yaw');
    if (deps.getSelectedIndex() === lastMove.moduleIndex) {
      if (inputPitch) inputPitch.value = lastMove.fromRot.pitch;
      if (inputRoll) inputRoll.value = lastMove.fromRot.roll;
      if (inputYaw) inputYaw.value = lastMove.fromRot.yaw;
    }

    deps.selectModule(lastMove.moduleIndex, false);
    deps.updateStationStats();
    deps.recalculateMeasurements();

    const remaining = undoList.length;
    deps.showNotification(`Undid rotation: Module #${lastMove.moduleIndex} (${friendlyName}) reverted to Yaw: ${lastMove.fromRot.yaw}°, Pitch: ${lastMove.fromRot.pitch}°, Roll: ${lastMove.fromRot.roll}°${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'plot_resize' && lastMove.fromConfig) {
    setPlotConfig(lastMove.fromConfig, true);
    deps.getViewer().restoreFullPlanGrid();
    deps.getViewer().updatePlotBoxViolations();
    const cfg = lastMove.fromConfig;
    const totX = cfg.x.plus + cfg.x.minus;
    const totY = cfg.y.plus + cfg.y.minus;
    const totZ = cfg.z.plus + cfg.z.minus;
    deps.getViewer().showFloatingPlotSize(totX, totY, totZ);
    if (deps.getViewer().floatingHudTimeout) clearTimeout(deps.getViewer().floatingHudTimeout);
    deps.getViewer().floatingHudTimeout = setTimeout(() => deps.getViewer().hideFloatingPlotSize(), 1500);

    deps.updateStationStats();
    deps.recalculateMeasurements();

    const remaining = undoList.length;
    deps.showNotification(`Undid plot resize: Reverted Plot Bounding Box to ${totX}x${totY}x${totZ} km${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'set_fefb') {
    const prevFefb = lastMove.previousFefb;
    if (deps.getViewer()) deps.getViewer().fefbModuleIndex = prevFefb;
    if (deps.getCurrentPlan()) deps.getCurrentPlan().fefbModuleIndex = prevFefb;
    setFefbModuleIndex(prevFefb);

    const remaining = undoList.length;
    deps.showNotification(`Undid setting FEFB: Reverted FEFB to ${prevFefb !== null && prevFefb !== undefined ? `Module #${prevFefb}` : 'none'}${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');
  }

  updateUndoButtonUI();
}
