/**
 * Exports the current station plan as an X4 construction-plan blueprint .xml.
 * Extracted from main.js.
 */
import { downloadXMLFile, generatePlanXML, getFefbModuleIndex, showCreateBlueprintModal } from '../blueprint-exporter.js';
import { computeX4RotationFromModuleGroup } from '../rotation-math.js';

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
  const viewer = deps.getViewer();
  const activeModules = (viewer && viewer.modulesGroup && viewer.modulesGroup.children.length > 0)
    ? exportModulesFromScene(viewer, deps.getCurrentPlan())
    : deps.getCurrentPlan().modules;

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

/**
 * Plan modules as they are now in the 3D scene (moved/rotated by the user), in X4 plan coordinates,
 * ready for generatePlanXML. Used by exportCurrentPlanAsBlueprint.
 * @param {{ modulesGroup: { children: object[] }, getModuleCalculatedRotation?: (index: number) => object }} viewer
 * @param {{ modules?: object[] }} plan the loaded plan (supplies macro/connection/predecessor fallbacks)
 */
export function exportModulesFromScene(viewer, plan) {
  return viewer.modulesGroup.children.map((child, idx) => {
    const origMod = (plan.modules && plan.modules.find(m => m.index === child.userData.index)) || {};
    const pos = child.position;

    // 6 decimals like X4's own exports: whole degrees would turn e.g. yaw -112.49992 into -112.
    // Same inverse as StationViewer.getModuleCalculatedRotation when the viewer does not provide it.
    const rotationOptions = { decimals: 6 };
    const rotation = (viewer.getModuleCalculatedRotation && viewer.getModuleCalculatedRotation(child.userData.index, rotationOptions))
      || computeX4RotationFromModuleGroup(child, rotationOptions);

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
      rotation: { yaw: rotation.yaw, pitch: rotation.pitch, roll: rotation.roll }
    };
  });
}
