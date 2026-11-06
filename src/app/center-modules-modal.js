/**
 * "Center modules in plot bounding box" modal dialog.
 * Extracted from main.js.
 */
import { getFefbModuleIndex, setFefbModuleIndex } from '../blueprint-exporter.js';
import { recordMove } from './undo-history.js';

/**
 * Controller state and actions supplied by main.js via initCenterModulesModal().
 * - getViewer(): main.js `viewer`
 * - getCurrentPlan(): main.js `currentPlan`
 * - updateStationStats(...)
 * - recalculateMeasurements(...)
 * - showNotification(...)
 */
let deps = null;

/** Connects this module to the app controller (called once by main.js). */
export function initCenterModulesModal(controller) {
  deps = controller;
}

/**
 * Event listeners for Center Modules in Plot BB Modal Dialog
 */
export function setupCenterModulesModalEvents() {
  const centerModal = document.getElementById('center-modules-modal');
  const btnClose = document.getElementById('btn-close-center-modal');
  const btnCancel = document.getElementById('btn-center-modal-cancel');
  const btnConfirm = document.getElementById('btn-center-modal-confirm');
  const btnFefb = document.getElementById('btn-center-modal-fefb');

  const closeCenterModal = () => {
    if (centerModal) {
      centerModal.classList.remove('active');
    }
  };

  [btnClose, btnCancel].forEach(btn => {
    if (btn) btn.addEventListener('click', closeCenterModal);
  });

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (deps.getViewer()) {
        deps.getViewer().executePendingCenterAction();
        deps.getViewer().restoreFullPlanGrid();
        deps.updateStationStats();
        deps.recalculateMeasurements();
        deps.showNotification('Selected modules centered within Plot Bounding Box', 'success');
      }
      closeCenterModal();
    });
  }

  if (btnFefb) {
    btnFefb.addEventListener('click', () => {
      const targetMod = deps.getViewer()?.pendingSingleModule || (deps.getViewer()?.selectedModules?.length === 1 ? deps.getViewer().selectedModules[0] : null) || (deps.getViewer()?.selectedModuleIndex !== null ? deps.getViewer().modulesGroup?.children?.find(m => m.userData?.index === deps.getViewer().selectedModuleIndex) : null);
      if (targetMod) {
        const modIndex = targetMod.userData?.index !== undefined ? targetMod.userData.index : 1;
        const macroName = targetMod.userData?.friendlyName || targetMod.userData?.macro || `Module #${modIndex}`;
        const prevFefb = deps.getViewer()?.fefbModuleIndex !== undefined ? deps.getViewer().fefbModuleIndex : (deps.getCurrentPlan()?.fefbModuleIndex !== undefined ? deps.getCurrentPlan().fefbModuleIndex : getFefbModuleIndex());
        if (deps.getViewer()) deps.getViewer().fefbModuleIndex = modIndex;
        if (deps.getCurrentPlan()) deps.getCurrentPlan().fefbModuleIndex = modIndex;
        setFefbModuleIndex(modIndex);
        recordMove({
          type: 'set_fefb',
          operation: 'diamond_fefb',
          previousFefb: prevFefb ?? null,
          newFefb: modIndex,
          moduleIndex: modIndex,
          macro: targetMod.userData?.macro,
          friendlyName: macroName,
          timestamp: Date.now()
        });
        deps.showNotification(`Module #${modIndex} (${macroName}) set as First Element for branching (FEFB)`, 'success');
      }
      closeCenterModal();
    });
  }

  if (centerModal) {
    centerModal.addEventListener('click', (e) => {
      if (e.target === centerModal) closeCenterModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && centerModal?.classList.contains('active')) {
      closeCenterModal();
    }
  });
}
