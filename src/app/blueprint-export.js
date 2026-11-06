/**
 * Exports the current station plan as an X4 construction-plan blueprint .xml.
 * Extracted from main.js.
 */
import * as THREE from 'three';
import { downloadXMLFile, generatePlanXML, getFefbModuleIndex, showCreateBlueprintModal } from '../blueprint-exporter.js';

/**
 * Controller state and actions supplied by main.js via initBlueprintExport().
 * - getViewer(): main.js `viewer`
 * - getCurrentPlan(): main.js `currentPlan`
 * - loadPlanFromXml(...)
 * - updatePlanMetadata(...)
 * - selectModule(...)
 * - showNotification(...)
 */
let deps = null;

/** Connects this module to the app controller (called once by main.js). */
export function initBlueprintExport(controller) {
  deps = controller;
}

/**
 * Export current station plan as an X4 construction plan blueprint .XML
 */
export function exportCurrentPlanAsBlueprint() {
  if (!deps.getCurrentPlan() || !deps.getCurrentPlan().modules || deps.getCurrentPlan().modules.length === 0) {
    deps.showNotification('No station plan loaded or current plan is empty.', 'error');
    return;
  }

  // Gather active/updated module positions and rotations from viewer.modulesGroup or currentPlan.modules
  let activeModules = [];
  if (deps.getViewer() && deps.getViewer().modulesGroup && deps.getViewer().modulesGroup.children.length > 0) {
    activeModules = deps.getViewer().modulesGroup.children.map((child, idx) => {
      const origMod = (deps.getCurrentPlan().modules && deps.getCurrentPlan().modules.find(m => m.index === child.userData.index)) || {};
      const pos = child.position;
      
      const calcRot = deps.getViewer().getModuleCalculatedRotation ? deps.getViewer().getModuleCalculatedRotation(child.userData.index) : null;
      let yaw = 0, pitch = 0, roll = 0;
      if (calcRot) {
        yaw = calcRot.yaw;
        pitch = calcRot.pitch;
        roll = calcRot.roll;
      } else {
        child.rotation.order = 'YXZ';
        yaw = Math.round(THREE.MathUtils.radToDeg(child.rotation.y)) % 360;
        pitch = Math.round(THREE.MathUtils.radToDeg(child.rotation.x) - 180) % 360;
        roll = Math.round(THREE.MathUtils.radToDeg(child.rotation.z) - 180) % 360;
      }

      if (yaw > 180) yaw -= 360;
      if (yaw <= -180) yaw += 360;
      if (pitch > 180) pitch -= 360;
      if (pitch <= -180) pitch += 360;
      if (roll > 180) roll -= 360;
      if (roll <= -180) roll += 360;

      yaw = Object.is(yaw, -0) ? 0 : yaw;
      pitch = Object.is(pitch, -0) ? 0 : pitch;
      roll = Object.is(roll, -0) ? 0 : roll;

      return {
        index: child.userData.index !== undefined ? child.userData.index : (idx + 1),
        macro: child.userData.macro || origMod.macro || '',
        connection: child.userData.connection || origMod.connection || '',
        predecessor: child.userData.predecessor || origMod.predecessor || null,
        position: {
          x: Math.round(pos.x * 1000) / 1000,
          y: Math.round(pos.y * 1000) / 1000,
          z: -Math.round(pos.z * 1000) / 1000
        },
        rotation: { yaw, pitch, roll }
      };
    });
  } else {
    activeModules = deps.getCurrentPlan().modules;
  }

  const defaultName = deps.getCurrentPlan().name || 'Custom Station Plan';
  const totalModules = activeModules.length;

  showCreateBlueprintModal({
    defaultName,
    totalModules,
    onSave: (chosenName) => {
      const fefbIdx = deps.getCurrentPlan()?.fefbModuleIndex ?? deps.getViewer()?.fefbModuleIndex ?? getFefbModuleIndex();
      const xmlContent = generatePlanXML(chosenName, deps.getCurrentPlan(), { modules: activeModules, fefbModuleIndex: fefbIdx });
      const safeFileName = chosenName.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Custom Station Plan';

      downloadXMLFile(xmlContent, `${safeFileName}.xml`);

      deps.getCurrentPlan().name = chosenName;
      deps.updatePlanMetadata(deps.getCurrentPlan());
      deps.showNotification(`Blueprint "${safeFileName}.xml" saved successfully!`, 'success');
    }
  });
}
