import { lookupModuleBounds, getInitialModuleSize, getInitialModuleDimensions, getInitialModuleBounds } from './module-bounds-hashtable.js';
import { getModuleCategory } from './modules.js';

const STORAGE_KEY = 'x4_module_display_panel_config';
const PLOT_STORAGE_KEY = 'x4_layout_plot_config';
const BLUEPRINT_PLOT_STORAGE_KEY = 'x4_blueprint_plot_configs';

let activeBlueprintId = null;
let activeBlueprintName = null;

/**
 * Default station plot boundary configuration.
 * Units are in km (1 unit = 1 km = 1,000 meters in 3D scene).
 * Order of axes: X, Z, and Y.
 * Cumulative constraint across each input: |plus| + |minus| <= 20.
 */
export const DEFAULT_PLOT_CONFIG = {
  enabled: true,
  x: { plus: 10, minus: 10 },
  z: { plus: 10, minus: 10 },
  y: { plus: 10, minus: 10 }
};

/**
 * Default values configuration.
 * Each value defines how modules are to be displayed/placed,
 * and contains up to 5 checkboxes that can be named by an edit later.
 */
export const DEFAULT_DISPLAY_VALUES = [
  {
    id: 'order-of-layout',
    name: 'Order of Layout',
    checkboxes: [
      { id: 'layout-blueprint', name: 'Blueprint', isDefault: true, checked: true, behaviorKey: 'blueprint' },
      { id: 'order-layers', name: 'Layers Order', isDefault: false, checked: false, behaviorKey: 'order-layers' },
      { id: 'order-size', name: 'Component Size', isDefault: false, checked: false, behaviorKey: 'order-size' },
      { id: 'order-cluster', name: 'Category Clusters', isDefault: false, checked: false, behaviorKey: 'order-cluster' },
      { id: 'order-custom', name: 'Custom Order', isDefault: false, checked: false, behaviorKey: 'order-custom' }
    ]
  },
  {
    id: 'layout-mode',
    name: 'Layout Mode',
    checkboxes: [
      { id: 'layout-clusters', name: 'Category Clusters', isDefault: false, checked: false, behaviorKey: 'clusters' },
      { id: 'layout-planar', name: 'Planar Row', isDefault: false, checked: false, behaviorKey: 'planar' },
      { id: 'layout-grid', name: 'Grid Matrix', isDefault: false, checked: false, behaviorKey: 'grid' },
      { id: 'layout-height', name: 'Height Cascade', isDefault: false, checked: false, behaviorKey: 'height' },
      { id: 'layout-compact', name: 'Compact Block', isDefault: false, checked: false, behaviorKey: 'compact' }
    ]
  },
  {
    id: 'layers',
    name: 'Layers',
    checkboxes: [
      { id: 'layer-1', name: 'Docks-1', isDefault: true, checked: true, behaviorKey: 'layer-docks' },
      { id: 'layer-2', name: 'Storage-2', isDefault: false, checked: false, behaviorKey: 'layer-storage' },
      { id: 'layer-3', name: 'Production-3', isDefault: false, checked: false, behaviorKey: 'layer-production' },
      { id: 'layer-4', name: 'Habitats-4', isDefault: false, checked: false, behaviorKey: 'layer-habitats' },
      { id: 'layer-5', name: 'Defense-5', isDefault: false, checked: false, behaviorKey: 'layer-defense' }
    ]
  },
  {
    id: 'spacing-offset',
    name: 'Spacing & Offset',
    checkboxes: [
      { id: 'spacing-0', name: 'Exact (0m)', isDefault: true, checked: true, behaviorKey: 'spacing-0' },
      { id: 'spacing-25', name: 'Pad (+25m)', isDefault: false, checked: false, behaviorKey: 'spacing-25' },
      { id: 'spacing-50', name: 'Pad (+50m)', isDefault: false, checked: false, behaviorKey: 'spacing-50' },
      { id: 'spacing-100', name: 'Pad (+100m)', isDefault: false, checked: false, behaviorKey: 'spacing-100' },
      { id: 'spacing-2x', name: 'Scale (2.0x)', isDefault: false, checked: false, behaviorKey: 'spacing-2x' }
    ]
  },
  {
    id: 'alignment-anchor',
    name: 'Alignment Anchor',
    checkboxes: [
      { id: 'align-origin', name: 'Origin (0,0,0)', isDefault: true, checked: true, behaviorKey: 'align-origin' },
      { id: 'align-ground', name: 'Ground Floor', isDefault: false, checked: false, behaviorKey: 'align-ground' },
      { id: 'align-center', name: 'Bounding Center', isDefault: false, checked: false, behaviorKey: 'align-center' },
      { id: 'align-x-mirror', name: 'X-Reflection', isDefault: false, checked: false, behaviorKey: 'align-x-mirror' },
      { id: 'align-compact', name: 'Compact Core', isDefault: false, checked: false, behaviorKey: 'align-compact' }
    ]
  },
  {
    id: 'module-scope',
    name: 'Module Scope',
    checkboxes: [
      { id: 'scope-all', name: 'All Modules', isDefault: true, checked: true, behaviorKey: 'scope-all' },
      { id: 'scope-prod', name: 'Production Only', isDefault: false, checked: false, behaviorKey: 'scope-prod' },
      { id: 'scope-docks', name: 'Docks & Piers', isDefault: false, checked: false, behaviorKey: 'scope-docks' },
      { id: 'scope-defense', name: 'Defense Modules', isDefault: false, checked: false, behaviorKey: 'scope-defense' },
      { id: 'scope-hab-store', name: 'Habitats & Storage', isDefault: false, checked: false, behaviorKey: 'scope-hab-store' }
    ]
  }
];

// Active in-memory state of display panel values and plot config
let displayValues = loadDisplayPanelConfig();
let plotConfig = loadPlotConfig();
let activeViewerInstance = null;
let editingCheckboxState = null; // { valueId, checkboxIndex }
let isPlotMinimized = true; // Start any load with the Plot pill minimized

/**
 * Returns whether the Plot pill is currently minimized.
 */
export function isPlotPillMinimized() {
  return isPlotMinimized;
}

/**
 * Minimize the Plot pill on the Layout row.
 */
export function minimizePlotPill() {
  isPlotMinimized = true;
  renderPlotPillHeader();
}

/**
 * Expand the Plot pill on the Layout row.
 */
export function expandPlotPill() {
  isPlotMinimized = false;
  renderPlotPillHeader();
}

/**
 * Toggle the Plot pill minimized state.
 */
export function togglePlotPill(force = null) {
  isPlotMinimized = force !== null ? !force : !isPlotMinimized;
  renderPlotPillHeader();
}

/**
 * Load saved plot configuration from localStorage, or return defaults.
 */
export function loadPlotConfig() {
  if (typeof localStorage === 'undefined') {
    return JSON.parse(JSON.stringify(DEFAULT_PLOT_CONFIG));
  }
  try {
    const raw = localStorage.getItem(PLOT_STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PLOT_CONFIG));
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const parseAxis = (axisObj, defVal = 10) => {
        let plus = Math.max(0, Math.min(20, Number(axisObj?.plus ?? defVal)));
        let minus = Math.max(0, Math.min(20, Number(axisObj?.minus ?? defVal)));
        if (plus + minus > 20) {
          minus = Math.max(0, 20 - plus);
        }
        if (plus + minus < 1) {
          plus = Math.max(1, plus);
          minus = 0;
        }
        return { plus, minus };
      };

      return {
        enabled: parsed.enabled !== false,
        x: parseAxis(parsed.x, 10),
        z: parseAxis(parsed.z, 10),
        y: parseAxis(parsed.y, 10)
      };
    }
  } catch (e) {
    console.warn('[DisplayPanel] Error reading plot config:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_PLOT_CONFIG));
}

/**
 * Persist plot configuration to localStorage (globally and for the active blueprint).
 */
export function savePlotConfig(config) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PLOT_STORAGE_KEY, JSON.stringify(config));
    if (activeBlueprintId && activeBlueprintId !== 'unknown_plan') {
      saveBlueprintPlotConfig(activeBlueprintId, config);
    }
    if (activeBlueprintName) {
      saveBlueprintPlotConfig(activeBlueprintName, config);
    }
  } catch (e) {
    console.warn('[DisplayPanel] Error saving plot config:', e);
  }
}

/**
 * Persist a plot configuration for a specific blueprint in localStorage.
 */
export function saveBlueprintPlotConfig(blueprintKey, config) {
  if (typeof localStorage === 'undefined' || !blueprintKey || !config) return;
  try {
    const raw = localStorage.getItem(BLUEPRINT_PLOT_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[blueprintKey] = JSON.parse(JSON.stringify(config));
    localStorage.setItem(BLUEPRINT_PLOT_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[DisplayPanel] Error saving blueprint plot config:', e);
  }
}

/**
 * Load saved plot configuration for a specific blueprint from localStorage.
 */
export function loadBlueprintPlotConfig(planId, planName) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BLUEPRINT_PLOT_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (!map || typeof map !== 'object') return null;

    let found = null;
    if (planId && planId !== 'unknown_plan' && map[planId]) {
      found = map[planId];
    } else if (planName && map[planName]) {
      found = map[planName];
    }

    if (found && typeof found === 'object') {
      const parseAxis = (axisObj, defVal = 10) => {
        let plus = Math.max(0, Math.min(20, Number(axisObj?.plus ?? defVal)));
        let minus = Math.max(0, Math.min(20, Number(axisObj?.minus ?? defVal)));
        if (plus + minus > 20) {
          minus = Math.max(0, 20 - plus);
        }
        if (plus + minus < 1) {
          plus = Math.max(1, plus);
          minus = 0;
        }
        return { plus, minus };
      };

      return {
        enabled: found.enabled !== false,
        x: parseAxis(found.x, 10),
        z: parseAxis(found.z, 10),
        y: parseAxis(found.y, 10)
      };
    }
  } catch (e) {
    console.warn('[DisplayPanel] Error reading blueprint plot config:', e);
  }
  return null;
}

/**
 * Set the currently active blueprint, restoring its custom plot configuration if stored.
 */
export function setActiveBlueprint(planId, planName) {
  activeBlueprintId = planId || null;
  activeBlueprintName = planName || null;

  const savedBpConfig = loadBlueprintPlotConfig(planId, planName);
  if (savedBpConfig) {
    setPlotConfig(savedBpConfig, true);
  } else {
    setPlotConfig(DEFAULT_PLOT_CONFIG, true);
  }
}

/**
 * Get the currently active blueprint ID and Name.
 */
export function getActiveBlueprint() {
  return { id: activeBlueprintId, name: activeBlueprintName };
}

export function getCurrentPlotConfig() {
  return JSON.parse(JSON.stringify(plotConfig));
}

export function setPlotConfig(newConfig, updateViewer = true) {
  if (!newConfig) return;
  plotConfig = JSON.parse(JSON.stringify(newConfig));
  savePlotConfig(plotConfig);
  renderPlotPillHeader();
  if (updateViewer && activeViewerInstance) {
    activeViewerInstance.updatePlotBox(plotConfig);
  }
}

/**
 * Load saved configuration from localStorage, or return defaults.
 */
export function loadDisplayPanelConfig() {
  if (typeof localStorage === 'undefined') {
    return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_VALUES));
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_VALUES));
    let parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // 1. Remove Display Shading pill from Layout panel
      parsed = parsed.filter(v => v.id !== 'display-shading' && !(v.name && v.name.toLowerCase().includes('display shading')));

      // 2. Ensure Order of Layout exists and is placed under Layout (at top of list)
      let orderVal = parsed.find(v => v.id === 'order-of-layout' || (v.name && v.name.toLowerCase() === 'order of layout'));
      if (!orderVal) {
        const defOrder = DEFAULT_DISPLAY_VALUES.find(v => v.id === 'order-of-layout');
        if (defOrder) {
          orderVal = JSON.parse(JSON.stringify(defOrder));
          parsed.unshift(orderVal);
        }
      } else {
        // Ensure Blueprint is in Order of Layout
        const hasBp = orderVal.checkboxes && orderVal.checkboxes.some(cb =>
          cb.id === 'layout-blueprint' || (cb.name && cb.name.toLowerCase().includes('blueprint'))
        );
        if (!hasBp) {
          orderVal.checkboxes.unshift({ id: 'layout-blueprint', name: 'Blueprint', isDefault: true, checked: true, behaviorKey: 'blueprint' });
          if (orderVal.checkboxes.length > 5) orderVal.checkboxes.pop();
        }
      }

      // 3. Move Blueprint out of layout-mode (remove from layout-mode since it is in Order of Layout)
      const layoutModeVal = parsed.find(v => v.id === 'layout-mode');
      if (layoutModeVal && Array.isArray(layoutModeVal.checkboxes)) {
        layoutModeVal.checkboxes = layoutModeVal.checkboxes.filter(cb =>
          cb.id !== 'layout-blueprint' && !(cb.name && cb.name.toLowerCase().includes('blueprint'))
        );
      }

      // Ensure Ground Floor in alignment-anchor has clean name and key
      const alignVal = parsed.find(v => v.id === 'alignment-anchor');
      if (alignVal && Array.isArray(alignVal.checkboxes)) {
        alignVal.checkboxes.forEach(cb => {
          if (cb.id === 'align-ground' || cb.name.toLowerCase().includes('ground floor') || cb.name.toLowerCase().includes('lowest y')) {
            cb.name = 'Ground Floor';
            cb.behaviorKey = 'align-ground';
          }
        });
      }

      // Ensure Layers row exists in parsed configuration
      const hasLayersRow = parsed.some(v => v.id === 'layers' || (v.name && v.name.trim().toLowerCase() === 'layers'));
      if (!hasLayersRow) {
        const layoutModeIdx = parsed.findIndex(v => v.id === 'layout-mode');
        const insertIdx = layoutModeIdx !== -1 ? layoutModeIdx + 1 : 1;
        const layersVal = DEFAULT_DISPLAY_VALUES.find(v => v.id === 'layers');
        if (layersVal) {
          parsed.splice(insertIdx, 0, JSON.parse(JSON.stringify(layersVal)));
        }
      }

      // In Layout, remove the second pill with Layers name:
      // 1. If multiple rows have the name "Layers", remove the second (and subsequent) one!
      let seenLayersRow = false;
      parsed = parsed.filter(v => {
        const isLayers = (v.id === 'layers') || (v.name && v.name.trim().toLowerCase() === 'layers');
        if (isLayers) {
          if (seenLayersRow) {
            console.log('[DisplayPanel] Removed second row with Layers name:', v.id);
            return false;
          }
          seenLayersRow = true;
          // Ensure the single retained Layers row has complete configuration and dropdown behavior
          if (v.id !== 'layers' || !v.checkboxes || v.checkboxes.length === 0 || !v.checkboxes.some(cb => cb.name && cb.name.includes('-'))) {
            const defLayers = DEFAULT_DISPLAY_VALUES.find(dv => dv.id === 'layers');
            if (defLayers) {
              v.id = defLayers.id;
              v.name = defLayers.name;
              v.checkboxes = JSON.parse(JSON.stringify(defLayers.checkboxes));
            }
          }
        }
        return true;
      });

      // 2. If multiple checkboxes (pills) with name "Layers" exist, remove the second one!
      let seenLayersPill = false;
      parsed.forEach(v => {
        if (Array.isArray(v.checkboxes)) {
          v.checkboxes = v.checkboxes.filter(cb => {
            const isLayersCb = cb.name && cb.name.trim().toLowerCase() === 'layers';
            if (isLayersCb) {
              if (seenLayersPill) {
                console.log(`[DisplayPanel] Removed second pill with Layers name from row ${v.id}:`, cb.id);
                return false;
              }
              seenLayersPill = true;
            }
            return true;
          });
        }
      });

      return parsed;
    }
  } catch (e) {
    console.warn('[DisplayPanel] Error reading localStorage, using defaults:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_VALUES));
}

/**
 * Persist current configuration to localStorage.
 */
export function saveDisplayPanelConfig() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(displayValues));
  } catch (e) {
    console.warn('[DisplayPanel] Error saving to localStorage:', e);
  }
}

/**
 * Set all checkboxes per pill across the Layout panel to DEF (default).
 * In Order of Layout, only Blueprint is checked. In layout-mode, checkboxes are unchecked.
 * In all other rows, only the DEF checkbox is checked.
 */
export function setAllPillsToDefault(displayValuesArray = displayValues) {
  if (!Array.isArray(displayValuesArray)) return;
  displayValuesArray.forEach(row => {
    if (row.id === 'layout-mode') {
      if (Array.isArray(row.checkboxes)) {
        row.checkboxes.forEach(cb => { cb.checked = false; });
      }
    } else if (Array.isArray(row.checkboxes)) {
      row.checkboxes.forEach((cb, idx) => {
        cb.checked = !!cb.isDefault || (!row.checkboxes.some(c => c.isDefault) && idx === 0);
      });
    }
  });
}

/**
 * Returns true if Blueprint mode is currently checked and active in Order of Layout.
 */
export function isBlueprintModeActive() {
  const orderVal = (typeof displayValues !== 'undefined' && Array.isArray(displayValues))
    ? displayValues.find(v => v.id === 'order-of-layout' || (v.name && v.name.toLowerCase().includes('order of layout')))
    : null;
  if (orderVal && Array.isArray(orderVal.checkboxes)) {
    const bpCb = orderVal.checkboxes.find(cb =>
      cb.id === 'layout-blueprint' ||
      cb.id === 'order-blueprint' ||
      (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
      (cb.name && cb.name.toLowerCase().includes('blueprint')) ||
      cb.isDefault
    );
    if (bpCb) {
      return !!bpCb.checked;
    }
  }

  const layoutVal = (typeof displayValues !== 'undefined' && Array.isArray(displayValues))
    ? displayValues.find(v => v.id === 'layout-mode')
    : null;
  if (!layoutVal || !Array.isArray(layoutVal.checkboxes)) return true;
  const bpCb = layoutVal.checkboxes.find(cb =>
    cb.id === 'layout-blueprint' ||
    (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
    (cb.name && cb.name.toLowerCase().includes('blueprint'))
  );
  if (bpCb) {
    const anyNonBpChecked = layoutVal.checkboxes.some(cb => cb !== bpCb && cb.checked);
    return !!(bpCb.checked && !anyNonBpChecked);
  }
  return false;
}

/**
 * Examine the five checkboxes for a non-default entry and use that value as a behavior
 * for module placement and display.
 * 
 * @param {string} valueId - Identifier of the value configuration row
 * @param {number|null} triggeredIndex - Optional index of checkbox clicked by user
 * @returns {object|null} Examination result containing nonDefaultEntry and behaviorValue
 */
export function examineFiveCheckboxes(valueId, triggeredIndex = null, forceChecked = null) {
  const valueObj = displayValues.find(v => v.id === valueId);
  if (!valueObj) return null;

  const checkboxes = valueObj.checkboxes; // Array of up to 5 checkboxes

  // If a specific checkbox was clicked/triggered
  if (triggeredIndex !== null && triggeredIndex >= 0 && triggeredIndex < checkboxes.length) {
    const clickedCb = checkboxes[triggeredIndex];
    if (forceChecked !== null) {
      clickedCb.checked = !!forceChecked;
    } else {
      clickedCb.checked = !clickedCb.checked;
    }

    if (valueId === 'order-of-layout') {
      const isBlueprint = clickedCb.id === 'layout-blueprint' ||
                          clickedCb.id === 'order-blueprint' ||
                          (clickedCb.behaviorKey && clickedCb.behaviorKey.toLowerCase().includes('blueprint')) ||
                          (clickedCb.name && clickedCb.name.toLowerCase().includes('blueprint')) ||
                          clickedCb.isDefault;

      if (isBlueprint && clickedCb.checked) {
        // In Order of Layout, if Blueprint is checked, set all other checkboxes to false and reset all pills to DEF!
        checkboxes.forEach((cb, idx) => {
          if (idx !== triggeredIndex) cb.checked = false;
        });
        setAllPillsToDefault(displayValues);
      } else if (!isBlueprint && clickedCb.checked) {
        // If a non-blueprint order checkbox is checked, uncheck Blueprint
        const bp = checkboxes.find(cb =>
          cb.id === 'layout-blueprint' ||
          cb.id === 'order-blueprint' ||
          (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
          (cb.name && cb.name.toLowerCase().includes('blueprint')) ||
          cb.isDefault
        );
        if (bp) bp.checked = false;
        checkboxes.forEach((cb, idx) => {
          if (idx !== triggeredIndex) cb.checked = false;
        });

        // Ensure a layout mode in layout-mode is checked
        const layoutRow = displayValues.find(v => v.id === 'layout-mode');
        if (layoutRow && Array.isArray(layoutRow.checkboxes) && !layoutRow.checkboxes.some(c => c.checked)) {
          layoutRow.checkboxes[0].checked = true;
        }
      }

      // If user unchecked this checkbox and none remain checked, fallback to default (Blueprint)
      const anyChecked = checkboxes.some(cb => cb.checked);
      if (!anyChecked) {
        const def = checkboxes.find(cb => cb.isDefault) || checkboxes[0];
        if (def) {
          def.checked = true;
          setAllPillsToDefault(displayValues);
        }
      }
    } else if (valueId === 'layout-mode') {
      if (clickedCb.checked) {
        // Single selection in layout-mode
        checkboxes.forEach((cb, idx) => {
          if (idx !== triggeredIndex) cb.checked = false;
        });
        // Uncheck Blueprint in Order of Layout when an explicit layout mode is selected!
        const orderRow = displayValues.find(v => v.id === 'order-of-layout');
        if (orderRow && Array.isArray(orderRow.checkboxes)) {
          const bp = orderRow.checkboxes.find(cb =>
            cb.id === 'layout-blueprint' ||
            cb.id === 'order-blueprint' ||
            (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
            (cb.name && cb.name.toLowerCase().includes('blueprint')) ||
            cb.isDefault
          );
          if (bp) bp.checked = false;
          if (!orderRow.checkboxes.some(cb => cb.checked)) {
            const nonBp = orderRow.checkboxes.find(cb => cb !== bp) || orderRow.checkboxes[1];
            if (nonBp) nonBp.checked = true;
          }
        }
      } else {
        const anyChecked = checkboxes.some(cb => cb.checked);
        if (!anyChecked) {
          // If all layout modes unchecked, fallback to Blueprint in Order of Layout
          const orderRow = displayValues.find(v => v.id === 'order-of-layout');
          if (orderRow && Array.isArray(orderRow.checkboxes)) {
            const def = orderRow.checkboxes.find(cb => cb.isDefault) || orderRow.checkboxes[0];
            if (def) def.checked = true;
          }
          setAllPillsToDefault(displayValues);
        }
      }
    } else if (valueId === 'alignment-anchor') {
      // Allow multiple checkbox selections for Alignment Anchor!
      // If user unchecked this checkbox and none remain checked, fallback to default
      const anyChecked = checkboxes.some(cb => cb.checked);
      if (!anyChecked) {
        const def = checkboxes.find(cb => cb.isDefault) || checkboxes[0];
        if (def) def.checked = true;
      }
    } else {
      if (clickedCb.checked) {
        // Single-choice active behavior within the 5 checkboxes for other rows
        checkboxes.forEach((cb, idx) => {
          if (idx !== triggeredIndex) cb.checked = false;
        });
      } else {
        const anyChecked = checkboxes.some(cb => cb.checked);
        if (!anyChecked) {
          const def = checkboxes.find(cb => cb.isDefault) || checkboxes[0];
          if (def) def.checked = true;
        }
      }
    }
  }

  // Active entries
  const checkedEntries = checkboxes.filter(cb => cb.checked);
  let nonDefaultEntry = checkboxes.find(cb => cb.checked && !cb.isDefault);

  if (!nonDefaultEntry) {
    nonDefaultEntry = checkboxes.find(cb => cb.checked) ||
                      checkboxes.find(cb => cb.isDefault) ||
                      checkboxes[0];
  }

  const behaviorValue = checkedEntries.length > 0
    ? checkedEntries.map(cb => cb.name).join(', ')
    : (nonDefaultEntry ? nonDefaultEntry.name : 'Default');
  const behaviorKey = checkedEntries.length > 0
    ? checkedEntries.map(cb => cb.behaviorKey || cb.name).join('+')
    : (nonDefaultEntry ? (nonDefaultEntry.behaviorKey || nonDefaultEntry.name) : 'default');
  const isNonDefault = checkedEntries.some(cb => !cb.isDefault);

  console.log(`[DisplayPanel] Value "${valueObj.name}" examined checkboxes -> Active: "${behaviorValue}" (isNonDefault: ${isNonDefault})`);

  saveDisplayPanelConfig();

  return {
    valueId: valueObj.id,
    valueName: valueObj.name,
    checkboxes,
    checkedEntries,
    nonDefaultEntry,
    behaviorValue,
    behaviorKey,
    isNonDefault
  };
}

/**
 * Rename a checkbox ("named by an edit later").
 * 
 * @param {string} valueId 
 * @param {number} checkboxIndex 
 * @param {string} newName 
 */
export function renameCheckbox(valueId, checkboxIndex, newName) {
  if (!newName || !newName.trim()) return false;
  const valueObj = displayValues.find(v => v.id === valueId);
  if (!valueObj || !valueObj.checkboxes[checkboxIndex]) return false;

  const cb = valueObj.checkboxes[checkboxIndex];
  const oldName = cb.name;
  cb.name = newName.trim();
  console.log(`[DisplayPanel] Renamed checkbox [${valueId}][${checkboxIndex}] from "${oldName}" to "${cb.name}"`);

  saveDisplayPanelConfig();

  // If this checkbox is currently the active entry, re-examine and reapply behavior with new name
  if (cb.checked) {
    const result = examineFiveCheckboxes(valueId, checkboxIndex, true);
    if (result && activeViewerInstance) {
      applyModuleDisplayBehavior(result.valueId, result.behaviorValue, result.behaviorKey, activeViewerInstance);
    }
  }

  renderDisplayPanel();
  return true;
}

/**
 * Add a new checkbox to a value (up to 5 maximum).
 */
export function addCheckboxToValue(valueId, name = null) {
  const valueObj = displayValues.find(v => v.id === valueId);
  if (!valueObj) return false;
  if (valueObj.checkboxes.length >= 5) {
    if (typeof alert !== 'undefined') {
      alert('Each value can have up to five checkboxes maximum.');
    }
    return false;
  }

  const newIdx = valueObj.checkboxes.length + 1;
  const cbName = name || `Option ${newIdx}`;
  const newCb = {
    id: `${valueId}-custom-${Date.now()}`,
    name: cbName,
    isDefault: false,
    checked: false,
    behaviorKey: `custom-${cbName.toLowerCase().replace(/\s+/g, '-')}`
  };

  valueObj.checkboxes.push(newCb);
  saveDisplayPanelConfig();
  renderDisplayPanel();
  return true;
}

export const LAYER_CATEGORIES = ['Docks', 'Storage', 'Production', 'Habitats', 'Defense'];

/**
 * Parse category name and layer number from a layer checkbox name (e.g. "Docks-1" or "Habitats-4").
 */
export function parseLayerCheckbox(cb, defaultIndex = 0) {
  const name = (cb.name || '').trim();
  const match = name.match(/^(Docks|Storage|Production|Habitats|Defense)[-\s]*(\d+)/i);
  if (match) {
    const canonical = LAYER_CATEGORIES.find(c => c.toLowerCase() === match[1].toLowerCase()) || match[1];
    return {
      category: canonical,
      number: match[2]
    };
  }
  for (const cat of LAYER_CATEGORIES) {
    if (name.toLowerCase().includes(cat.toLowerCase())) {
      const numMatch = name.match(/(\d+)/);
      return {
        category: cat,
        number: numMatch ? numMatch[1] : String(defaultIndex + 1)
      };
    }
  }
  return {
    category: LAYER_CATEGORIES[defaultIndex % LAYER_CATEGORIES.length],
    number: String(defaultIndex + 1)
  };
}

/**
 * Retrieve the current category placement order from Layout, Layers.
 * Order of layer slots: Layer 1, Layer 2, Layer 3, Layer 4, Layer 5.
 * Returns array of category keys matching getModuleCategory:
 * e.g. ['docks', 'storage', 'production', 'habitation', 'defense', 'structure']
 */
export function getLayerPlacementCategoryOrder() {
  let layersRow = null;
  if (typeof displayValues !== 'undefined' && Array.isArray(displayValues)) {
    layersRow = displayValues.find(v => v.id === 'layers');
  }
  if (!layersRow) {
    const cfg = loadDisplayPanelConfig();
    layersRow = cfg.find(v => v.id === 'layers');
  }

  if (!layersRow || !Array.isArray(layersRow.checkboxes) || layersRow.checkboxes.length === 0) {
    return ['docks', 'storage', 'production', 'habitation', 'defense', 'structure'];
  }

  const categoryMap = {
    'docks': 'docks',
    'dock': 'docks',
    'storage': 'storage',
    'production': 'production',
    'habitats': 'habitation',
    'habitat': 'habitation',
    'defense': 'defense',
    'defence': 'defense'
  };

  const parsedItems = layersRow.checkboxes.map((cb, idx) => {
    const parsed = parseLayerCheckbox(cb, idx);
    const num = parseInt(parsed.number, 10) || (idx + 1);
    const catLower = parsed.category.toLowerCase();
    const catKey = categoryMap[catLower] || 'structure';
    return { catKey, num };
  });

  // Sort by layer number (1, 2, 3, 4, 5)
  parsedItems.sort((a, b) => a.num - b.num);

  const order = parsedItems.map(p => p.catKey);
  if (!order.includes('structure')) {
    order.push('structure');
  }
  return order;
}

/**
 * Sort an array of modules according to the current Layers category order.
 */
export function sortModulesByLayerCategoryOrder(modules, layerOrder = null) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  const order = layerOrder || getLayerPlacementCategoryOrder();
  const buckets = {};
  order.forEach(cat => {
    buckets[cat] = [];
  });
  const unclassified = [];

  modules.forEach(mod => {
    const macro = mod.userData?.macro || mod.macro || mod.key || '';
    const cat = getModuleCategory(macro);
    if (buckets[cat]) {
      buckets[cat].push(mod);
    } else {
      unclassified.push(mod);
    }
  });

  const sorted = [];
  order.forEach(cat => {
    if (buckets[cat]) sorted.push(...buckets[cat]);
  });
  sorted.push(...unclassified);
  return sorted;
}

/**
 * Retrieve the exact world-space bounding box and dimensions for the active Plot
 * in Three.js coordinates.
 *
 * X4 Coordinates:
 *   X: -minusX to +plusX km -> Three.js X: -minusX * 1000 to +plusX * 1000 m
 *   Y: -minusY to +plusY km -> Three.js Y: -minusY * 1000 to +plusY * 1000 m
 *   Z: -minusZ to +plusZ km -> Three.js Z: -plusZ * 1000 to +minusZ * 1000 m (inverted Z)
 */
export function getPlotBoundingBox(plotCfg = null) {
  const pConfig = plotCfg || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  const plusX = Math.max(0, Number(pConfig.x?.plus ?? 10));
  const minusX = Math.max(0, Number(pConfig.x?.minus ?? 10));
  const plusY = Math.max(0, Number(pConfig.y?.plus ?? 10));
  const minusY = Math.max(0, Number(pConfig.y?.minus ?? 10));
  const plusZ = Math.max(0, Number(pConfig.z?.plus ?? 10));
  const minusZ = Math.max(0, Number(pConfig.z?.minus ?? 10));

  const minX = -minusX * 1000;
  const maxX = plusX * 1000;
  const minY = -minusY * 1000;
  const maxY = plusY * 1000;
  const minZ = -plusZ * 1000;
  const maxZ = minusZ * 1000;

  const widthX = Math.max(1000, maxX - minX);
  const heightY = Math.max(1000, maxY - minY);
  const depthZ = Math.max(1000, maxZ - minZ);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return {
    minX, maxX,
    minY, maxY,
    minZ, maxZ,
    widthX, heightY, depthZ,
    centerX, centerY, centerZ
  };
}

/**
 * Clamp a 3D module position strictly within the plot boundaries,
 * honoring the module's bounding box size so no part of the module
 * is outside the current plot size BB location.
 */
export function clampModulePositionToPlot(pos, size, plotCfg = null) {
  if (!pos) return;
  const bb = getPlotBoundingBox(plotCfg);

  const halfX = (size?.x ?? 0) / 2;
  const halfY = (size?.y ?? 0) / 2;
  const halfZ = (size?.z ?? 0) / 2;

  // Clamp X
  if (bb.maxX - bb.minX >= (size?.x ?? 0)) {
    pos.x = Math.max(bb.minX + halfX, Math.min(bb.maxX - halfX, pos.x));
  } else {
    pos.x = bb.centerX;
  }

  // Clamp Y
  if (bb.maxY - bb.minY >= (size?.y ?? 0)) {
    pos.y = Math.max(bb.minY + halfY, Math.min(bb.maxY - halfY, pos.y));
  } else {
    pos.y = bb.centerY;
  }

  // Clamp Z
  if (bb.maxZ - bb.minZ >= (size?.z ?? 0)) {
    pos.z = Math.max(bb.minZ + halfZ, Math.min(bb.maxZ - halfZ, pos.z));
  } else {
    pos.z = bb.centerZ;
  }
}

/**
 * Swap layer categories between the selected checkbox and the matching checkbox.
 * E.g., if Docks is -1 and Habitats is -4, selecting Habitats on slot 1 swaps the two names
 * to make it Habitats-1 and Docks-4.
 */
export function swapLayerCheckboxCategory(targetCheckboxIndex, newCategory) {
  const layersRow = displayValues.find(v => v.id === 'layers');
  if (!layersRow || !Array.isArray(layersRow.checkboxes)) return;

  const targetCb = layersRow.checkboxes[targetCheckboxIndex];
  if (!targetCb) return;

  const currentParsed = parseLayerCheckbox(targetCb, targetCheckboxIndex);
  const currentCat = currentParsed.category;
  const currentNum = currentParsed.number;

  if (currentCat.toLowerCase() === newCategory.toLowerCase()) {
    targetCb.checked = true;
    saveDisplayPanelConfig();
    renderDisplayPanel();
    return;
  }

  // Find the other checkbox in Layers currently holding newCategory
  let otherIdx = layersRow.checkboxes.findIndex((cb, i) => {
    if (i === targetCheckboxIndex) return false;
    const p = parseLayerCheckbox(cb, i);
    return p.category.toLowerCase() === newCategory.toLowerCase();
  });

  if (otherIdx !== -1) {
    const otherCb = layersRow.checkboxes[otherIdx];
    const otherParsed = parseLayerCheckbox(otherCb, otherIdx);
    const otherNum = otherParsed.number;

    // Swap names while preserving each checkbox slot's number
    targetCb.name = `${newCategory}-${currentNum}`;
    targetCb.behaviorKey = `layer-${newCategory.toLowerCase()}`;

    otherCb.name = `${currentCat}-${otherNum}`;
    otherCb.behaviorKey = `layer-${currentCat.toLowerCase()}`;
  } else {
    targetCb.name = `${newCategory}-${currentNum}`;
    targetCb.behaviorKey = `layer-${newCategory.toLowerCase()}`;
  }

  // Highlight the target checkbox
  layersRow.checkboxes.forEach((cb, idx) => {
    cb.checked = (idx === targetCheckboxIndex);
  });

  saveDisplayPanelConfig();

  // Apply behavior to viewer
  const result = examineFiveCheckboxes('layers', targetCheckboxIndex, true);
  if (result && activeViewerInstance) {
    applyModuleDisplayBehavior(result.valueId, result.behaviorValue, result.behaviorKey, activeViewerInstance, true, result.checkedEntries);
  }

  renderDisplayPanel();
}

/**
 * Test whether two 3D bounding boxes overlap, accounting for an optional safety margin.
 *
 * @param {object} posA - Center { x, y, z }
 * @param {object} sizeA - Dimensions { x, y, z }
 * @param {object} posB - Center { x, y, z }
 * @param {object} sizeB - Dimensions { x, y, z }
 * @param {number} margin - Additional separation gap (default 0)
 * @returns {boolean} True if bounding boxes overlap across all 3 axes
 */
export function doBoxesOverlap(posA, sizeA, posB, sizeB, margin = 0) {
  if (!posA || !sizeA || !posB || !sizeB) return false;
  const halfXA = ((sizeA.x ?? sizeA[0]) || 0) / 2;
  const halfYA = ((sizeA.y ?? sizeA[1]) || 0) / 2;
  const halfZA = ((sizeA.z ?? sizeA[2]) || 0) / 2;

  const halfXB = ((sizeB.x ?? sizeB[0]) || 0) / 2;
  const halfYB = ((sizeB.y ?? sizeB[1]) || 0) / 2;
  const halfZB = ((sizeB.z ?? sizeB[2]) || 0) / 2;

  const distX = Math.abs(posA.x - posB.x);
  const distY = Math.abs(posA.y - posB.y);
  const distZ = Math.abs(posA.z - posB.z);

  const overlapX = distX < (halfXA + halfXB + margin - 0.05);
  const overlapY = distY < (halfYA + halfYB + margin - 0.05);
  const overlapZ = distZ < (halfZA + halfZB + margin - 0.05);

  return overlapX && overlapY && overlapZ;
}

/**
 * For any component placement, insure no bounding box overlaps another component's BB.
 * Checks all module bounding boxes pairwise. If any overlap is detected, resolves it
 * by shifting along the best axis (X, Z, or Y) and stacking layers if needed,
 * while keeping all components strictly within current plot size.
 *
 * @param {Array} modules - Array of placed modules (objects or Three.js meshes)
 * @param {object} plotConfig - Current plot boundaries
 * @param {object} options - Options { gap, getModuleSize, applyToObjects }
 * @returns {number} Number of overlaps resolved
 */
export function ensureNoBoundingBoxOverlaps(modules, plotConfig = null, options = {}) {
  if (!Array.isArray(modules) || modules.length < 2) return 0;

  const pConfig = plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  const gap = typeof options.gap === 'number' ? options.gap : 15;
  const getSize = options.getModuleSize || ((m) => {
    if (m.initialSize) return m.initialSize;
    if (m.userData?.initialSize) return m.userData.initialSize;
    const macro = m.userData?.macro || m.macro || m.key || '';
    const arr = getInitialModuleSize(macro);
    return { x: arr[0], y: arr[1], z: arr[2] };
  });

  const getPos = (m) => {
    if (m.position && typeof m.position.x === 'number') return m.position;
    if (typeof m.x === 'number') return m;
    return { x: 0, y: 0, z: 0 };
  };

  const bb = getPlotBoundingBox(pConfig);
  const { minX, maxX, minY, maxY, minZ, maxZ } = bb;

  let totalResolved = 0;
  let iterations = 0;
  const maxIterations = 40;

  while (iterations++ < maxIterations) {
    let hadOverlapInPass = false;

    for (let i = 0; i < modules.length; i++) {
      const modA = modules[i];
      const posA = getPos(modA);
      const sizeA = getSize(modA);
      const halfXA = (sizeA.x || 100) / 2;
      const halfYA = (sizeA.y || 100) / 2;
      const halfZA = (sizeA.z || 100) / 2;

      for (let j = i + 1; j < modules.length; j++) {
        const modB = modules[j];
        const posB = getPos(modB);
        const sizeB = getSize(modB);
        const halfXB = (sizeB.x || 100) / 2;
        const halfYB = (sizeB.y || 100) / 2;
        const halfZB = (sizeB.z || 100) / 2;

        if (doBoxesOverlap(posA, sizeA, posB, sizeB, gap)) {
          hadOverlapInPass = true;
          totalResolved++;

          const dx = (halfXA + halfXB + gap) - Math.abs(posA.x - posB.x);
          const dy = (halfYA + halfYB + gap) - Math.abs(posA.y - posB.y);
          const dz = (halfZA + halfZB + gap) - Math.abs(posA.z - posB.z);

          const signX = posB.x >= posA.x ? 1 : -1;
          const signZ = posB.z >= posA.z ? 1 : -1;
          const signY = posB.y >= posA.y ? 1 : -1;

          let resolved = false;

          // Try 1: Separate along X
          const targetXB = posB.x + signX * dx;
          if (targetXB + halfXB <= maxX && targetXB - halfXB >= minX) {
            posB.x = targetXB;
            resolved = true;
          } else {
            const targetXA = posA.x - signX * dx;
            if (targetXA + halfXA <= maxX && targetXA - halfXA >= minX) {
              posA.x = targetXA;
              resolved = true;
            }
          }

          // Try 2: If X cannot accommodate without exceeding plot, separate along Z
          if (!resolved) {
            const targetZB = posB.z + signZ * dz;
            if (targetZB + halfZB <= maxZ && targetZB - halfZB >= minZ) {
              posB.z = targetZB;
              resolved = true;
            } else {
              const targetZA = posA.z - signZ * dz;
              if (targetZA + halfZA <= maxZ && targetZA - halfZA >= minZ) {
                posA.z = targetZA;
                resolved = true;
              }
            }
          }

          // Try 3: If Z cannot accommodate, separate along Y (new layer)
          if (!resolved) {
            const targetYB = posB.y + (signY || 1) * dy;
            if (targetYB + halfYB <= maxY && targetYB - halfYB >= minY) {
              posB.y = targetYB;
              resolved = true;
            } else {
              const targetYA = posA.y - (signY || 1) * dy;
              if (targetYA + halfYA <= maxY && targetYA - halfYA >= minY) {
                posA.y = targetYA;
                resolved = true;
              }
            }
          }

          // Try 4: Fallback upward in Y
          if (!resolved) {
            posB.y = Math.min(maxY - halfYB, posB.y + dy);
          }

          clampModulePositionToPlot(posA, sizeA, pConfig);
          clampModulePositionToPlot(posB, sizeB, pConfig);

          if (options.applyToObjects) {
            const targetA = modA.module || modA;
            const targetB = modB.module || modB;
            if (typeof targetA.position?.set === 'function') targetA.position.set(posA.x, posA.y, posA.z);
            else if (targetA.position) { targetA.position.x = posA.x; targetA.position.y = posA.y; targetA.position.z = posA.z; }
            if (typeof targetB.position?.set === 'function') targetB.position.set(posB.x, posB.y, posB.z);
            else if (targetB.position) { targetB.position.x = posB.x; targetB.position.y = posB.y; targetB.position.z = posB.z; }
          }
        }
      }
    }

    if (!hadOverlapInPass) break;
  }

  return totalResolved;
}

/**
 * Calculate layer-by-layer component placement honoring:
 * 1. Multiple selections in Alignment Anchor defining start of placement.
 * 2. Component bounding box dimensions (width X, height Y, depth Z).
 * 3. Sequential placement: components placed one at a time.
 * 4. Layer filling: once a layer fills (cannot fit next component without exceeding plot boundaries),
 *    a new layer is started (stacking in Y) and placement continues.
 * 5. Strict plot boundary confinement (never outside plot size).
 * 6. Insure no bounding box overlaps another component's BB.
 *
 * @param {Array} modules - Array of module objects or Three.js meshes
 * @param {object|Array|string} alignmentAnchor - Active entries, key string, or config object
 * @param {object} plotConfig - Current plot boundaries { x: { plus, minus }, y: { plus, minus }, z: { plus, minus } }
 * @param {Array} layerOrder - Canonical category order (from Layout, Layers)
 * @param {object} options - Optional config { gap, getModuleSize, applyToObjects }
 * @returns {Array} Array of placed module data { module, position, layerIndex, initialSize }
 */
export function calculateLayeredPlacement(modules, alignmentAnchor = null, plotConfig = null, layerOrder = null, options = {}) {
  if (!Array.isArray(modules) || modules.length === 0) return [];

  const pConfig = plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  const order = layerOrder || getLayerPlacementCategoryOrder();

  // 1. Sort modules by Layout, Layers category order
  const sortedModules = sortModulesByLayerCategoryOrder(modules, order);

  // 2. Parse plot bounds from getPlotBoundingBox
  const bb = getPlotBoundingBox(pConfig);
  const { minX, maxX, minY, maxY, minZ, maxZ, centerX, centerY, centerZ } = bb;

  // 3. Parse active alignment anchor selections (allow multiple selections to define start of placement)
  let activeKeys = [];
  if (Array.isArray(alignmentAnchor)) {
    activeKeys = alignmentAnchor.map(e => (e.behaviorKey || e.id || e.name || '').toLowerCase());
  } else if (typeof alignmentAnchor === 'string') {
    activeKeys = alignmentAnchor.toLowerCase().split('+').map(k => k.trim());
  } else if (alignmentAnchor && typeof alignmentAnchor === 'object') {
    if (Array.isArray(alignmentAnchor.activeEntries)) {
      activeKeys = alignmentAnchor.activeEntries.map(e => (e.behaviorKey || e.id || e.name || '').toLowerCase());
    } else {
      activeKeys = [alignmentAnchor.key || alignmentAnchor.behaviorKey || alignmentAnchor.name || ''].map(k => k.toLowerCase());
    }
  } else if (typeof displayValues !== 'undefined' && Array.isArray(displayValues)) {
    const alignVal = displayValues.find(v => v.id === 'alignment-anchor');
    if (alignVal && Array.isArray(alignVal.checkboxes)) {
      activeKeys = alignVal.checkboxes.filter(cb => cb.checked).map(cb => (cb.behaviorKey || cb.name || '').toLowerCase());
    }
  }

  const hasGround = activeKeys.some(k => k.includes('ground') || k.includes('floor') || k.includes('lowest'));
  const hasTop = activeKeys.some(k => k.includes('ceiling') || k.includes('top') || k.includes('highest'));
  const hasOrigin = activeKeys.some(k => k.includes('origin') || k.includes('0,0,0'));
  const hasCenter = activeKeys.some(k => k.includes('center') || k.includes('middle'));
  const hasXMirror = activeKeys.some(k => k.includes('x-mirror') || k.includes('reflection') || k.includes('min-x') || k.includes('left'));
  const hasRight = activeKeys.some(k => k.includes('max-x') || k.includes('right'));
  const hasFront = activeKeys.some(k => k.includes('min-z') || k.includes('front'));
  const hasBack = activeKeys.some(k => k.includes('max-z') || k.includes('back'));
  const hasCompact = activeKeys.some(k => k.includes('compact') || k.includes('core'));

  // 4. Define Start of Placement
  // Vertical start (Y): Ground Floor value becomes lowest Y value as defined in plot size
  let startFloorY;
  if (hasGround) {
    startFloorY = minY;
  } else if (hasTop) {
    startFloorY = maxY;
  } else if (hasOrigin && !hasCenter) {
    startFloorY = Math.max(minY, Math.min(maxY, 0));
  } else if (hasCenter) {
    startFloorY = centerY;
  } else {
    startFloorY = minY; // Default to ground floor
  }

  // Horizontal start (X):
  let startX;
  if (hasXMirror) {
    startX = minX;
  } else if (hasRight) {
    startX = maxX;
  } else if (hasOrigin && !hasCenter && !hasXMirror) {
    startX = Math.max(minX, Math.min(maxX, 0));
  } else if (hasCenter || hasCompact) {
    startX = centerX;
  } else {
    startX = minX;
  }

  // Depth start (Z):
  let startZ;
  if (hasFront) {
    startZ = maxZ;
  } else if (hasBack) {
    startZ = minZ;
  } else if (hasOrigin && !hasCenter && !hasFront && !hasBack) {
    startZ = Math.max(minZ, Math.min(maxZ, 0));
  } else if (hasCenter || hasCompact) {
    startZ = centerZ;
  } else {
    startZ = minZ;
  }

  const gap = typeof options.gap === 'number' ? options.gap : 35;
  const getSize = options.getModuleSize || ((m) => {
    if (m.userData?.initialSize) return m.userData.initialSize;
    const macro = m.userData?.macro || m.macro || m.key || '';
    const arr = getInitialModuleSize(macro);
    return { x: arr[0], y: arr[1], z: arr[2] };
  });

  const dirX = hasRight ? -1 : 1;
  const dirZ = hasFront ? -1 : 1;
  const dirY = hasTop ? -1 : 1;

  let currentLayer = 0;
  let currentFloorY = startFloorY;
  let currentLayerMaxH = 0;

  let currentRowZ = startZ;
  let currentRowMaxD = 0;

  let currentCursorX = startX;
  let modulesInRow = 0;
  let rowsInLayer = 0;

  const placedResults = [];

  // Place components one at a time honoring bounding box
  sortedModules.forEach((mod) => {
    const s = getSize(mod);
    const halfX = (s.x || 100) / 2;
    const halfY = (s.y || 100) / 2;
    const halfZ = (s.z || 100) / 2;

    let candX;
    if (modulesInRow === 0) {
      candX = currentCursorX + dirX * halfX;
    } else {
      candX = currentCursorX + dirX * (gap + halfX);
    }

    const exceedsX = (dirX > 0)
      ? (candX + halfX > maxX + 0.1)
      : (candX - halfX < minX - 0.1);

    // Check if candidate position would collide with any previously placed module's bounding box
    let candPos = { x: candX, y: currentFloorY + dirY * halfY, z: currentRowZ + dirZ * halfZ };
    let collides = placedResults.some(p => doBoxesOverlap(candPos, s, p.position, p.initialSize, 0));

    if ((exceedsX || collides) && modulesInRow > 0) {
      // Row fills! Advance to next row along Z in current layer
      const candRowZ = currentRowZ + dirZ * (currentRowMaxD + gap);
      const candEdgeZ = candRowZ + dirZ * (2 * halfZ);
      const exceedsZ = (dirZ > 0)
        ? (candEdgeZ > maxZ + 0.1)
        : (candEdgeZ < minZ - 0.1);

      const candRowPos = { x: startX + dirX * halfX, y: currentFloorY + dirY * halfY, z: candRowZ + dirZ * halfZ };
      const rowCollides = placedResults.some(p => doBoxesOverlap(candRowPos, s, p.position, p.initialSize, 0));

      if ((exceedsZ || rowCollides) && rowsInLayer > 0) {
        // Once a layer fills, start a new layer and continue placing!
        currentLayer++;
        currentFloorY = currentFloorY + dirY * (currentLayerMaxH + gap);
        currentLayerMaxH = s.y || 100;
        if (dirY > 0 && currentFloorY + 2 * halfY > maxY + 0.1) {
          currentFloorY = minY; // Wrap within vertical plot limits
        } else if (dirY < 0 && currentFloorY - 2 * halfY < minY - 0.1) {
          currentFloorY = maxY - (s.y || 100);
        }

        // Reset cursor to start of new layer
        currentRowZ = startZ;
        currentRowMaxD = s.z || 100;
        rowsInLayer = 1;

        currentCursorX = startX;
        candX = currentCursorX + dirX * halfX;
        modulesInRow = 1;
      } else {
        // Start next row in current layer
        currentRowZ = candRowZ;
        currentRowMaxD = s.z || 100;
        rowsInLayer++;

        currentCursorX = startX;
        candX = currentCursorX + dirX * halfX;
        modulesInRow = 1;
      }
    } else {
      modulesInRow++;
      if (rowsInLayer === 0) rowsInLayer = 1;
    }

    // Position of component
    const posX = candX;
    const posY = currentFloorY + dirY * halfY;
    const posZ = currentRowZ + dirZ * halfZ;

    // Advance cursor X
    currentCursorX = candX + dirX * halfX;
    currentRowMaxD = Math.max(currentRowMaxD, s.z || 100);
    currentLayerMaxH = Math.max(currentLayerMaxH, s.y || 100);

    const pos = { x: posX, y: posY, z: posZ };
    clampModulePositionToPlot(pos, s, pConfig);

    if (options.applyToObjects) {
      if (typeof mod.position?.set === 'function') {
        mod.position.set(pos.x, pos.y, pos.z);
      } else if (mod.position) {
        mod.position.x = pos.x;
        mod.position.y = pos.y;
        mod.position.z = pos.z;
      }
    }

    placedResults.push({
      module: mod,
      macro: mod.userData?.macro || mod.macro || '',
      position: pos,
      initialSize: s,
      layerIndex: currentLayer,
      rowIndex: rowsInLayer - 1
    });
  });

  // If Bounding Center or Compact Core is selected, horizontally center within plot
  if (hasCenter || hasCompact) {
    let pMinX = Infinity, pMaxX = -Infinity, pMinZ = Infinity, pMaxZ = -Infinity;
    placedResults.forEach(r => {
      pMinX = Math.min(pMinX, r.position.x - r.initialSize.x / 2);
      pMaxX = Math.max(pMaxX, r.position.x + r.initialSize.x / 2);
      pMinZ = Math.min(pMinZ, r.position.z - r.initialSize.z / 2);
      pMaxZ = Math.max(pMaxZ, r.position.z + r.initialSize.z / 2);
    });

    if (isFinite(pMinX) && isFinite(pMaxX)) {
      const curCenterX = (pMinX + pMaxX) / 2;
      const curCenterZ = (pMinZ + pMaxZ) / 2;
      const shiftX = centerX - curCenterX;
      const shiftZ = centerZ - curCenterZ;

      placedResults.forEach(r => {
        r.position.x += shiftX;
        r.position.z += shiftZ;
        clampModulePositionToPlot(r.position, r.initialSize, pConfig);
        if (options.applyToObjects) {
          if (typeof r.module.position?.set === 'function') {
            r.module.position.set(r.position.x, r.position.y, r.position.z);
          } else if (r.module.position) {
            r.module.position.x = r.position.x;
            r.module.position.z = r.position.z;
          }
        }
      });
    }
  }

  // For any component placement, insure no bounding box overlaps another component's BB
  ensureNoBoundingBoxOverlaps(placedResults, pConfig, {
    gap: Math.max(10, gap * 0.5),
    getModuleSize: (m) => m.initialSize,
    applyToObjects: options.applyToObjects
  });

  return placedResults;
}

/**
 * In Layout, remove the second pill with Layers name.
 * Removes any duplicate/second row with the name "Layers" as well as any
 * duplicate/second checkbox (pill) with the name "Layers".
 */
export function removeSecondPillWithLayersName() {
  let removed = false;

  // 1. Remove duplicate/second row with the name 'Layers'
  let seenLayersRow = false;
  displayValues = displayValues.filter(v => {
    const isLayers = (v.id === 'layers') || (v.name && v.name.trim().toLowerCase() === 'layers');
    if (isLayers) {
      if (seenLayersRow) {
        console.log('[DisplayPanel] Removed second row with Layers name:', v.id);
        removed = true;
        return false;
      }
      seenLayersRow = true;
    }
    return true;
  });

  // 2. Remove duplicate/second checkbox (pill) with the name 'Layers'
  let seenLayersPill = false;
  displayValues.forEach(v => {
    if (Array.isArray(v.checkboxes)) {
      v.checkboxes = v.checkboxes.filter(cb => {
        const isLayersCb = cb.name && cb.name.trim().toLowerCase() === 'layers';
        if (isLayersCb) {
          if (seenLayersPill) {
            console.log(`[DisplayPanel] Removed second pill with Layers name from row ${v.id}:`, cb.id);
            removed = true;
            return false;
          }
          seenLayersPill = true;
        }
        return true;
      });
    }
  });

  saveDisplayPanelConfig();
  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
  return removed;
}

/**
 * Add a new custom value row.
 */
export function addCustomDisplayValue(valueName = null) {
  const name = valueName || `Custom Value ${displayValues.length + 1}`;
  const id = `val-custom-${Date.now()}`;
  const newValue = {
    id,
    name,
    checkboxes: [
      { id: `${id}-opt-1`, name: 'Default State', isDefault: true, checked: true, behaviorKey: 'default' },
      { id: `${id}-opt-2`, name: 'Option 2', isDefault: false, checked: false, behaviorKey: 'opt-2' },
      { id: `${id}-opt-3`, name: 'Option 3', isDefault: false, checked: false, behaviorKey: 'opt-3' }
    ]
  };

  displayValues.push(newValue);
  saveDisplayPanelConfig();
  renderDisplayPanel();
  return newValue;
}

/**
 * Trigger FIT for center on station (matching the FIT button on main display).
 */
export function triggerFitForCenterOnStation(viewer = activeViewerInstance) {
  const targetViewer = viewer || activeViewerInstance;
  if (!targetViewer) return;

  // Visual pulse on the FIT button in the main screen toolbar
  if (typeof document !== 'undefined') {
    const btnFit = document.getElementById('view-fit');
    if (btnFit) {
      btnFit.classList.add('active');
      setTimeout(() => btnFit.classList.remove('active'), 350);
    }
  }

  // Camera center and framing on the station
  if (typeof targetViewer.fitCameraToStation === 'function') {
    targetViewer.fitCameraToStation();
  }
}

/**
 * Apply the non-default examined value as a behavior for module placement and display.
 */
export function applyModuleDisplayBehavior(valueId, behaviorValue, behaviorKey, viewer = null, triggerFit = false, activeEntries = null) {
  const targetViewer = viewer || activeViewerInstance;
  if (!targetViewer) {
    console.warn('[DisplayPanel] No active viewer instance to apply display behavior:', behaviorValue);
    return;
  }

  console.log(`[DisplayPanel] Using examined value "${behaviorValue}" (${behaviorKey}) as behavior for ${valueId}`);

  // Dispatch to viewer placement and display pipeline
  if (typeof targetViewer.applyDisplayPlacementBehavior === 'function') {
    targetViewer.applyDisplayPlacementBehavior(valueId, behaviorKey, behaviorValue, activeEntries);
  }

  // After selecting any checkbox in Layout, trigger FIT for center on station
  if (triggerFit) {
    triggerFitForCenterOnStation(targetViewer);
  }

  // Update DOM active status badges in panel
  if (typeof document !== 'undefined') {
    const badgeEl = document.getElementById(`active-behavior-badge-${valueId}`);
    if (badgeEl) {
      badgeEl.textContent = behaviorValue;
    }
  }

  // Also dispatch global event for other components if needed
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('x4-module-display-behavior-changed', {
      detail: { valueId, behaviorValue, behaviorKey }
    }));
  }
}

/**
 * Calculates module placement for any Layout concern for any of the three dimensions being considered (X, Y, Z).
 * The macro name is used as the key into module-bounds-hashtable to obtain initial bounding box sizes.
 * 
 * @param {Array<object>} modules - Array of modules (with macro / userData.macro, position)
 * @param {object} options
 * @param {string} [options.mode='planar'] - Layout mode ('planar', 'grid', 'height', 'clusters', 'ground', 'center')
 * @param {string} [options.dimension='x'] - Dimension being considered: 'x', 'y', 'z', 'x-z', 'x-y', 'y-z'
 * @param {number} [options.gap=50] - Gap in meters between module bounding boxes
 * @returns {Array<{ index: number, macro: string, position: { x: number, y: number, z: number }, initialSize: { x: number, y: number, z: number } }>}
 */
export function calculateLayoutPlacement(modules, options = {}) {
  if (!Array.isArray(modules) || modules.length === 0) return [];

  const mode = (options.mode || 'planar').toLowerCase();
  const dimension = (options.dimension || 'x').toLowerCase();
  const gap = typeof options.gap === 'number' ? options.gap : 50;

  // Retrieve initial bounding box sizes for each module using macro name as key into module-bounds-hashtable
  const moduleData = modules.map((m, idx) => {
    const macro = m.macro || m.userData?.macro || m.key || '';
    const initialSize = getInitialModuleDimensions(macro);
    return {
      index: m.index !== undefined ? m.index : (m.userData?.index !== undefined ? m.userData.index : idx),
      macro,
      initialSize,
      origPos: m.position ? { x: m.position.x, y: m.position.y, z: m.position.z } : { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 }
    };
  });

  // Consider the order of Layout, Layers to select which category of modules to place first
  const layerOrder = getLayerPlacementCategoryOrder();
  const sortedModuleData = sortModulesByLayerCategoryOrder(moduleData, layerOrder);

  const curPlotCfg = getCurrentPlotConfig();
  const bb = getPlotBoundingBox(curPlotCfg);

  if (mode.includes('blueprint')) {
    sortedModuleData.forEach(m => {
      m.position = { ...m.origPos };
    });
  } else if (mode.includes('height') || dimension === 'y') {
    // Dimension considered: Y (height)
    let currentY = 0;
    sortedModuleData.forEach((m, i) => {
      const h = m.initialSize.y;
      if (i > 0) currentY += h / 2;
      m.position = { x: bb.centerX, y: currentY, z: bb.centerZ };
      currentY += h / 2 + gap;
    });
    const totalSpan = currentY - gap;
    sortedModuleData.forEach(m => { m.position.y = bb.centerY + (m.position.y - totalSpan / 2); });
  } else if (mode.includes('grid')) {
    // 2D grid matrix: dimensions considered dim1, dim2
    let dim1 = 'x', dim2 = 'z', dimOther = 'y';
    if (dimension.includes('x-y')) { dim1 = 'x'; dim2 = 'y'; dimOther = 'z'; }
    else if (dimension.includes('y-z')) { dim1 = 'y'; dim2 = 'z'; dimOther = 'x'; }

    const n = sortedModuleData.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    const colWidths = new Array(cols).fill(0);
    const rowDepths = new Array(rows).fill(0);

    sortedModuleData.forEach((m, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      if (m.initialSize[dim1] > colWidths[c]) colWidths[c] = m.initialSize[dim1];
      if (m.initialSize[dim2] > rowDepths[r]) rowDepths[r] = m.initialSize[dim2];
    });

    const colPos = new Array(cols).fill(0);
    const rowPos = new Array(rows).fill(0);

    let cur1 = 0;
    for (let c = 0; c < cols; c++) {
      if (c === 0) { colPos[c] = colWidths[c] / 2; cur1 = colWidths[c]; }
      else { colPos[c] = cur1 + gap + colWidths[c] / 2; cur1 += gap + colWidths[c]; }
    }
    let cur2 = 0;
    for (let r = 0; r < rows; r++) {
      if (r === 0) { rowPos[r] = rowDepths[r] / 2; cur2 = rowDepths[r]; }
      else { rowPos[r] = cur2 + gap + rowDepths[r] / 2; cur2 += gap + rowDepths[r]; }
    }

    sortedModuleData.forEach((m, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      m.position[dim1] = bb[dim1 === 'x' ? 'centerX' : dim1 === 'y' ? 'centerY' : 'centerZ'] + (colPos[c] - cur1 / 2);
      m.position[dim2] = bb[dim2 === 'x' ? 'centerX' : dim2 === 'y' ? 'centerY' : 'centerZ'] + (rowPos[r] - cur2 / 2);
      m.position[dimOther] = bb[dimOther === 'x' ? 'centerX' : dimOther === 'y' ? 'centerY' : 'centerZ'];
    });
  } else {
    // Planar Row along dimension X (default) or Z
    const dim = dimension === 'z' ? 'z' : 'x';
    let currentOffset = 0;
    sortedModuleData.forEach((m, i) => {
      const s = m.initialSize[dim];
      if (i > 0) currentOffset += s / 2;
      m.position = { x: bb.centerX, y: bb.centerY, z: bb.centerZ };
      m.position[dim] = currentOffset;
      currentOffset += s / 2 + gap;
    });
    const totalSpan = currentOffset - gap;
    sortedModuleData.forEach(m => {
      m.position[dim] = bb[dim === 'x' ? 'centerX' : 'centerZ'] + (m.position[dim] - totalSpan / 2);
    });
  }

  // Ensure no module is placed outside the current plot size
  sortedModuleData.forEach(m => {
    clampModulePositionToPlot(m.position, m.initialSize, curPlotCfg);
  });

  // For any component placement, insure no bounding box overlaps another component's BB
  ensureNoBoundingBoxOverlaps(sortedModuleData, curPlotCfg, {
    gap: Math.max(10, gap * 0.5),
    getModuleSize: (m) => m.initialSize
  });

  return sortedModuleData;
}

/**
 * Render the Plot pill on the Layout row, centered on the line.
 * Features a collapse arrow to minimize/expand the plot pill.
 * Starts any load with the Plot pill minimized.
 * Upon expansion of the Plot pill, allows overlap on any lower pill below.
 */
export function renderPlotPillHeader() {
  if (typeof document === 'undefined') return;

  let slot = document.getElementById('layout-plot-pill-slot');
  if (!slot) {
    const headerEl = document.getElementById('display-panel-header') || (typeof document.querySelector === 'function' ? document.querySelector('.display-panel-header') : null);
    if (!headerEl) return;
    slot = document.createElement('div');
    slot.id = 'layout-plot-pill-slot';
    slot.className = 'plot-pill-slot';
    const actions = headerEl.querySelector('.display-panel-header-actions');
    if (actions) {
      headerEl.insertBefore(slot, actions);
    } else {
      headerEl.appendChild(slot);
    }
  }

  slot.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'plot-pill-wrapper';
  wrapper.id = 'plot-pill-wrapper';

  // 1. Minimized Pill Button (Centered on the Layout row line)
  const pillBtn = document.createElement('button');
  pillBtn.type = 'button';
  pillBtn.id = 'plot-pill-btn';
  pillBtn.className = `plot-pill-btn ${isPlotMinimized ? '' : 'active expanded'}`;
  pillBtn.title = isPlotMinimized ? 'Expand Station Plot boundaries' : 'Minimize Station Plot boundaries';

  // Collapse arrow indicator (rotates when expanded, allows minimizing)
  const arrowSpan = document.createElement('span');
  arrowSpan.className = `plot-collapse-arrow ${isPlotMinimized ? '' : 'expanded'}`;
  arrowSpan.id = 'plot-collapse-arrow';
  arrowSpan.innerHTML = '&#9660;'; // ▼ down triangle
  arrowSpan.title = isPlotMinimized ? 'Expand Plot pill' : 'Minimize Plot pill';
  pillBtn.appendChild(arrowSpan);

  const titleSpan = document.createElement('span');
  titleSpan.className = 'plot-pill-title';
  titleSpan.textContent = 'Plot';
  pillBtn.appendChild(titleSpan);

  const totalX = plotConfig.x.plus + plotConfig.x.minus;
  const totalY = plotConfig.y.plus + plotConfig.y.minus;
  const totalZ = plotConfig.z.plus + plotConfig.z.minus;

  const summaryBadge = document.createElement('span');
  summaryBadge.className = 'plot-dims-summary';
  summaryBadge.id = 'plot-dims-summary-badge';
  summaryBadge.textContent = `${totalX} × ${totalY} × ${totalZ} km`;
  pillBtn.appendChild(summaryBadge);

  pillBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPlotMinimized = !isPlotMinimized;
    renderPlotPillHeader();
  });

  wrapper.appendChild(pillBtn);

  // 2. Overlapping Dropdown Popover (Floats over lower pills below upon expansion)
  const dropdown = document.createElement('div');
  dropdown.className = 'plot-pill-dropdown';
  dropdown.id = 'plot-pill-dropdown';
  dropdown.style.display = isPlotMinimized ? 'none' : 'block';

  // Dropdown Header
  const ddHeader = document.createElement('div');
  ddHeader.className = 'plot-dropdown-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'plot-dropdown-title-group';

  const dot = document.createElement('span');
  dot.className = 'header-dot glow-dot';
  titleGroup.appendChild(dot);

  const ddTitle = document.createElement('span');
  ddTitle.className = 'plot-dropdown-title';
  ddTitle.textContent = 'Station Plot Boundaries';
  titleGroup.appendChild(ddTitle);
  ddHeader.appendChild(titleGroup);

  const ddActions = document.createElement('div');
  ddActions.className = 'plot-dropdown-actions';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'plot-toggle-label';
  toggleLabel.title = 'Toggle Plot boundary box visibility';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'plot-toggle-checkbox';
  toggleInput.className = 'cyber-checkbox-input';
  toggleInput.checked = plotConfig.enabled !== false;

  const toggleBox = document.createElement('span');
  toggleBox.className = 'cyber-checkbox-box';

  const toggleText = document.createElement('span');
  toggleText.className = 'checkbox-name-text';
  toggleText.textContent = 'Visible';

  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleBox);
  toggleLabel.appendChild(toggleText);
  ddActions.appendChild(toggleLabel);

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.className = 'btn-xs-cyber';
  btnReset.title = 'Reset Plot extents to default (10 km each)';
  btnReset.textContent = 'Reset';
  ddActions.appendChild(btnReset);

  // Collapse / Minimize arrow button inside the dropdown header
  const btnMinimize = document.createElement('button');
  btnMinimize.type = 'button';
  btnMinimize.id = 'plot-dropdown-minimize-btn';
  btnMinimize.className = 'plot-minimize-btn';
  btnMinimize.title = 'Minimize Plot pill';
  btnMinimize.innerHTML = '&#9650; Minimize';
  btnMinimize.addEventListener('click', (e) => {
    e.stopPropagation();
    isPlotMinimized = true;
    renderPlotPillHeader();
  });
  ddActions.appendChild(btnMinimize);

  ddHeader.appendChild(ddActions);
  dropdown.appendChild(ddHeader);

  // Inputs Container: X, Y, and Z horizontal placement order
  const inputsContainer = document.createElement('div');
  inputsContainer.className = 'plot-inputs-container';

  const axes = [
    { key: 'x', label: 'X', sublabel: 'Width' },
    { key: 'y', label: 'Y', sublabel: 'Height' },
    { key: 'z', label: 'Z', sublabel: 'Depth' }
  ];

  axes.forEach(({ key, label, sublabel }) => {
    const colEl = document.createElement('div');
    colEl.className = 'plot-axis-col';
    colEl.setAttribute('data-axis', key);

    const colHeader = document.createElement('div');
    colHeader.className = 'plot-axis-header';

    const axisLabel = document.createElement('span');
    axisLabel.className = 'plot-axis-title';
    axisLabel.innerHTML = `<strong>${label}</strong> <span class="plot-axis-sub">(${sublabel})</span>`;

    const axisTotal = document.createElement('span');
    axisTotal.className = 'plot-axis-total';
    axisTotal.id = `plot-${key}-total`;
    const curTotal = plotConfig[key].plus + plotConfig[key].minus;
    axisTotal.textContent = `${curTotal}/20 km`;

    colHeader.appendChild(axisLabel);
    colHeader.appendChild(axisTotal);
    colEl.appendChild(colHeader);

    const stackEl = document.createElement('div');
    stackEl.className = 'plot-val-stack';

    // Positive (+) row
    const plusRow = document.createElement('div');
    plusRow.className = 'plot-val-row plot-plus-row';

    const plusSign = document.createElement('span');
    plusSign.className = 'plot-sign-lbl plus-sign';
    plusSign.title = `Positive +${label} extent`;
    plusSign.textContent = '+';

    const plusInput = document.createElement('input');
    plusInput.type = 'number';
    plusInput.className = 'plot-num-input';
    plusInput.id = `plot-${key}-plus`;
    plusInput.min = '0';
    plusInput.max = '20';
    plusInput.step = '1';
    plusInput.value = String(plotConfig[key].plus);
    plusInput.setAttribute('aria-label', `+${label} extent in km`);

    const plusUnit = document.createElement('span');
    plusUnit.className = 'plot-unit-lbl';
    plusUnit.textContent = 'km';

    plusRow.appendChild(plusSign);
    plusRow.appendChild(plusInput);
    plusRow.appendChild(plusUnit);
    stackEl.appendChild(plusRow);

    // Negative (-) row
    const minusRow = document.createElement('div');
    minusRow.className = 'plot-val-row plot-minus-row';

    const minusSign = document.createElement('span');
    minusSign.className = 'plot-sign-lbl minus-sign';
    minusSign.title = `Negative -${label} extent`;
    minusSign.textContent = '-';

    const minusInput = document.createElement('input');
    minusInput.type = 'number';
    minusInput.className = 'plot-num-input';
    minusInput.id = `plot-${key}-minus`;
    minusInput.min = '0';
    minusInput.max = '20';
    minusInput.step = '1';
    minusInput.value = String(plotConfig[key].minus);
    minusInput.setAttribute('aria-label', `-${label} extent in km`);

    const minusUnit = document.createElement('span');
    minusUnit.className = 'plot-unit-lbl';
    minusUnit.textContent = 'km';

    minusRow.appendChild(minusSign);
    minusRow.appendChild(minusInput);
    minusRow.appendChild(minusUnit);
    stackEl.appendChild(minusRow);

    colEl.appendChild(stackEl);

    // Progress Bar
    const barWrap = document.createElement('div');
    barWrap.className = 'plot-bar-wrap';
    const barFill = document.createElement('div');
    barFill.className = 'plot-bar-fill';
    barFill.id = `plot-${key}-bar`;
    const pct = Math.min(100, Math.max(0, (curTotal / 20) * 100));
    barFill.style.width = `${pct}%`;
    barWrap.appendChild(barFill);
    colEl.appendChild(barWrap);

    const handleInput = (changedSign) => {
      let p = parseFloat(plusInput.value.trim());
      let m = parseFloat(minusInput.value.trim());

      if (isNaN(p) || p < 0) p = 0;
      if (isNaN(m) || m < 0) m = 0;

      if (changedSign === 'plus') {
        if (p > 20) {
          p = 20;
          plusInput.value = '20';
        }
        if (p + m > 20) {
          m = Math.max(0, 20 - p);
          minusInput.value = String(m);
        }
        if (p + m < 1) {
          p = Math.max(p, 1 - m);
          plusInput.value = String(p);
        }
      } else {
        if (m > 20) {
          m = 20;
          minusInput.value = '20';
        }
        if (p + m > 20) {
          p = Math.max(0, 20 - m);
          plusInput.value = String(p);
        }
        if (p + m < 1) {
          m = Math.max(m, 1 - p);
          minusInput.value = String(m);
        }
      }

      plotConfig[key].plus = p;
      plotConfig[key].minus = m;

      const total = p + m;
      axisTotal.textContent = `${total}/20 km`;
      const fillPct = Math.min(100, (total / 20) * 100);
      barFill.style.width = `${fillPct}%`;

      updateSummaryBadges();
      savePlotConfig(plotConfig);

      if (activeViewerInstance) {
        activeViewerInstance.updatePlotBox(plotConfig);
      }
    };

    plusInput.addEventListener('input', () => handleInput('plus'));
    minusInput.addEventListener('input', () => handleInput('minus'));

    plusInput.addEventListener('blur', () => {
      if (plusInput.value.trim() === '' || isNaN(parseFloat(plusInput.value))) {
        let m = parseFloat(minusInput.value.trim());
        if (isNaN(m) || m < 0) m = 0;
        const p = m >= 1 ? 0 : 1 - m;
        plusInput.value = String(p);
      }
      handleInput('plus');
    });

    minusInput.addEventListener('blur', () => {
      if (minusInput.value.trim() === '' || isNaN(parseFloat(minusInput.value))) {
        let p = parseFloat(plusInput.value.trim());
        if (isNaN(p) || p < 0) p = 0;
        const m = p >= 1 ? 0 : 1 - p;
        minusInput.value = String(m);
      }
      handleInput('minus');
    });

    inputsContainer.appendChild(colEl);
  });

  dropdown.appendChild(inputsContainer);
  wrapper.appendChild(dropdown);
  slot.appendChild(wrapper);

  function updateSummaryBadges() {
    const totX = plotConfig.x.plus + plotConfig.x.minus;
    const totY = plotConfig.y.plus + plotConfig.y.minus;
    const totZ = plotConfig.z.plus + plotConfig.z.minus;
    const txt = `${totX} × ${totY} × ${totZ} km`;
    if (summaryBadge) summaryBadge.textContent = txt;
  }

  toggleInput.addEventListener('change', () => {
    plotConfig.enabled = toggleInput.checked;
    savePlotConfig(plotConfig);
    if (activeViewerInstance) {
      activeViewerInstance.updatePlotBox(plotConfig);
    }
  });

  btnReset.addEventListener('click', () => {
    plotConfig = JSON.parse(JSON.stringify(DEFAULT_PLOT_CONFIG));
    savePlotConfig(plotConfig);
    renderPlotPillHeader();
    if (activeViewerInstance) {
      activeViewerInstance.updatePlotBox(plotConfig);
    }
  });
}

/**
 * Backward-compatible helper for plot entry creation.
 */
export function createPlotEntryElement() {
  renderPlotPillHeader();
  return null;
}

/**
 * Render the entire panel DOM.
 */
export function renderDisplayPanel() {
  if (typeof document === 'undefined') return;

  // 1. Render the Plot pill in the Layout row (centered on the line, minimized by default)
  renderPlotPillHeader();

  const container = document.getElementById('display-panel-container');
  if (!container) return;

  container.innerHTML = '';

  // 2. Render Layout Values & Checkboxes (Lower pills below)
  displayValues.forEach(val => {
    const rowEl = document.createElement('div');
    rowEl.className = 'display-value-row';
    rowEl.id = `display-value-row-${val.id}`;

    // Get active behavior by examining the 5 checkboxes
    const examination = examineFiveCheckboxes(val.id);
    const activeName = examination ? examination.behaviorValue : 'Default';

    // 1. Row Header
    const headerEl = document.createElement('div');
    headerEl.className = 'display-value-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'display-value-title-group';

    const dot = document.createElement('span');
    dot.className = 'header-dot';
    titleGroup.appendChild(dot);

    const titleText = document.createElement('span');
    titleText.className = 'display-value-name';
    titleText.textContent = val.name;
    titleGroup.appendChild(titleText);

    headerEl.appendChild(titleGroup);

    // If fewer than 5 checkboxes, provide button to add up to 5
    if (val.checkboxes.length < 5) {
      const btnAddCb = document.createElement('button');
      btnAddCb.className = 'btn-xs-cyber';
      btnAddCb.title = 'Add an additional checkbox (up to 5 max)';
      btnAddCb.textContent = '+ Checkbox';
      btnAddCb.style.marginLeft = 'auto';
      btnAddCb.addEventListener('click', () => {
        addCheckboxToValue(val.id);
      });
      headerEl.appendChild(btnAddCb);
    }

    rowEl.appendChild(headerEl);

    // 2. Checkboxes Group (up to 5 checkboxes)
    const cbGroupEl = document.createElement('div');
    cbGroupEl.className = 'display-checkboxes-group';

    val.checkboxes.forEach((cb, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = `display-checkbox-item ${cb.checked ? 'is-checked' : ''} ${cb.isDefault ? 'is-default' : ''}`;

      const isEditingThis = editingCheckboxState &&
        editingCheckboxState.valueId === val.id &&
        editingCheckboxState.checkboxIndex === idx;

      if (val.id === 'layers') {
        const parsed = parseLayerCheckbox(cb, idx);
        const isHighlighted = !!cb.checked;

        const labelEl = document.createElement('label');
        labelEl.className = `display-cb-label layer-cb-label ${isHighlighted ? 'layer-highlighted' : ''}`;
        labelEl.title = `Layer ${parsed.number}: ${parsed.category} • Click to select / highlight`;

        const inputEl = document.createElement('input');
        inputEl.type = 'checkbox';
        inputEl.checked = isHighlighted;
        inputEl.className = 'cyber-checkbox-input';

        inputEl.addEventListener('change', () => {
          const result = examineFiveCheckboxes(val.id, idx, inputEl.checked);
          if (result && activeViewerInstance) {
            applyModuleDisplayBehavior(result.valueId, result.behaviorValue, result.behaviorKey, activeViewerInstance, true, result.checkedEntries);
          }
          renderDisplayPanel();
        });

        const customCheck = document.createElement('span');
        customCheck.className = 'cyber-checkbox-box';

        labelEl.appendChild(inputEl);
        labelEl.appendChild(customCheck);

        if (isHighlighted) {
          // Highlighted checkbox: allow drop-down selection of Docks, Storage, Production, Habitats or Defense
          const selectEl = document.createElement('select');
          selectEl.className = 'cyber-select-layer';
          selectEl.title = `Select category for Layer ${parsed.number}`;

          LAYER_CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat.toLowerCase() === parsed.category.toLowerCase()) {
              opt.selected = true;
            }
            selectEl.appendChild(opt);
          });
          selectEl.value = parsed.category;

          selectEl.addEventListener('click', (e) => {
            e.stopPropagation();
          });

          selectEl.addEventListener('change', (e) => {
            e.stopPropagation();
            swapLayerCheckboxCategory(idx, selectEl.value);
          });

          labelEl.appendChild(selectEl);

          const numBadge = document.createElement('span');
          numBadge.className = 'layer-number-badge';
          numBadge.textContent = `-${parsed.number}`;
          labelEl.appendChild(numBadge);
        } else {
          // Non-highlighted checkbox: show name (e.g. Storage-2) with quick dropdown arrow
          const nameSpan = document.createElement('span');
          nameSpan.className = 'checkbox-name-text layer-name-text';
          nameSpan.textContent = cb.name;
          labelEl.appendChild(nameSpan);

          const quickSelect = document.createElement('select');
          quickSelect.className = 'cyber-select-layer-quick';
          quickSelect.title = `Select category and swap`;

          const defOpt = document.createElement('option');
          defOpt.value = '';
          defOpt.textContent = '▼';
          defOpt.disabled = true;
          defOpt.selected = true;
          quickSelect.appendChild(defOpt);

          LAYER_CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            quickSelect.appendChild(opt);
          });

          quickSelect.addEventListener('click', (e) => {
            e.stopPropagation();
          });

          quickSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            if (quickSelect.value) {
              swapLayerCheckboxCategory(idx, quickSelect.value);
            }
          });

          labelEl.appendChild(quickSelect);
        }

        if (cb.isDefault) {
          const defBadge = document.createElement('span');
          defBadge.className = 'checkbox-default-tag';
          defBadge.textContent = 'DEF';
          labelEl.appendChild(defBadge);
        }

        itemEl.appendChild(labelEl);
      } else if (isEditingThis) {
        // Edit mode input
        const editWrap = document.createElement('div');
        editWrap.className = 'checkbox-edit-wrapper';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'cyber-input-edit';
        textInput.value = cb.name;
        textInput.placeholder = 'Name checkbox...';
        editWrap.appendChild(textInput);

        const btnSave = document.createElement('button');
        btnSave.className = 'btn-icon-save';
        btnSave.title = 'Save checkbox name';
        btnSave.textContent = '✓';
        btnSave.addEventListener('click', (e) => {
          e.stopPropagation();
          renameCheckbox(val.id, idx, textInput.value);
          editingCheckboxState = null;
        });
        editWrap.appendChild(btnSave);

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn-icon-cancel';
        btnCancel.title = 'Cancel editing';
        btnCancel.textContent = '✕';
        btnCancel.addEventListener('click', (e) => {
          e.stopPropagation();
          editingCheckboxState = null;
          renderDisplayPanel();
        });
        editWrap.appendChild(btnCancel);

        textInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            renameCheckbox(val.id, idx, textInput.value);
            editingCheckboxState = null;
          } else if (e.key === 'Escape') {
            editingCheckboxState = null;
            renderDisplayPanel();
          }
        });

        itemEl.appendChild(editWrap);
        setTimeout(() => textInput.focus(), 0);
      } else {
        // Standard view: Checkbox, Name, and Edit Icon ("can be named by an edit later")
        const labelEl = document.createElement('label');
        labelEl.className = 'display-cb-label';
        labelEl.title = `${cb.name}${cb.isDefault ? ' (Default)' : ''} • Click to toggle`;

        const inputEl = document.createElement('input');
        inputEl.type = 'checkbox';
        inputEl.checked = !!cb.checked;
        inputEl.className = 'cyber-checkbox-input';

        // When any checkbox is clicked: examine the 5 checkboxes and use that value as a behavior
        inputEl.addEventListener('change', () => {
          const result = examineFiveCheckboxes(val.id, idx, inputEl.checked);
          if (result && activeViewerInstance) {
            applyModuleDisplayBehavior(result.valueId, result.behaviorValue, result.behaviorKey, activeViewerInstance, true, result.checkedEntries);
          }
          renderDisplayPanel();
        });

        const customCheck = document.createElement('span');
        customCheck.className = 'cyber-checkbox-box';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'checkbox-name-text';
        nameSpan.textContent = cb.name;

        labelEl.appendChild(inputEl);
        labelEl.appendChild(customCheck);
        labelEl.appendChild(nameSpan);

        if (cb.isDefault) {
          const defBadge = document.createElement('span');
          defBadge.className = 'checkbox-default-tag';
          defBadge.textContent = 'DEF';
          labelEl.appendChild(defBadge);
        }

        itemEl.appendChild(labelEl);

        // Edit button to name the checkbox later
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit-checkbox';
        btnEdit.title = `Rename "${cb.name}"`;
        btnEdit.textContent = '✏️';
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          editingCheckboxState = { valueId: val.id, checkboxIndex: idx };
          renderDisplayPanel();
        });
        itemEl.appendChild(btnEdit);
      }

      cbGroupEl.appendChild(itemEl);
    });

    rowEl.appendChild(cbGroupEl);
    container.appendChild(rowEl);
  });
}

/**
 * Minimize the Layout panel (hide panel, deactivate toggle button, minimize plot pill).
 */
export function minimizeLayoutPanel() {
  if (typeof document === 'undefined') return;
  const panelCard = document.getElementById('module-display-panel');
  const btnToggle = document.getElementById('btn-toggle-display-panel');
  if (panelCard) {
    panelCard.style.display = 'none';
    panelCard.classList.add('hidden');
  }
  if (btnToggle) {
    btnToggle.classList.remove('active');
  }
  isPlotMinimized = true;
  renderPlotPillHeader();
}

/**
 * Initialize the Module Display & Placement panel.
 */
export function initModuleDisplayPanel(viewer) {
  activeViewerInstance = viewer;

  // Toggle button on main screen scene controls
  const btnToggle = document.getElementById('btn-toggle-display-panel');
  const panelCard = document.getElementById('module-display-panel');
  const btnClose = document.getElementById('btn-close-display-panel');
  const btnAddValue = document.getElementById('btn-add-display-value');

  // Always start any load with the Plot pill minimized
  isPlotMinimized = true;

  if (btnToggle && panelCard) {
    btnToggle.addEventListener('click', () => {
      const isHidden = panelCard.style.display === 'none' || panelCard.classList.contains('hidden');
      if (isHidden) {
        panelCard.style.display = 'flex';
        panelCard.classList.remove('hidden');
        btnToggle.classList.add('active');
        isPlotMinimized = true; // Start any load with the Plot pill minimized
        renderDisplayPanel();
      } else {
        minimizeLayoutPanel();
      }
    });
  }

  // Any loss of focus to the Layout panel minimizes the panel
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window._layoutPanelFocusListenerAttached) {
    window._layoutPanelFocusListenerAttached = true;

    // 1. Pointerdown / click outside the Layout panel minimizes the panel
    document.addEventListener('pointerdown', (e) => {
      const panel = document.getElementById('module-display-panel');
      const toggle = document.getElementById('btn-toggle-display-panel');
      if (!panel) return;

      const isOpen = panel.style.display !== 'none' && !panel.classList.contains('hidden');
      if (isOpen) {
        // If click is outside the Layout panel and not on the toggle button
        if (!panel.contains(e.target) && (!toggle || (!toggle.contains(e.target) && toggle !== e.target))) {
          minimizeLayoutPanel();
        }
      }
    });

    // 2. Escape key minimizes the panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = document.getElementById('module-display-panel');
        if (panel && panel.style.display !== 'none' && !panel.classList.contains('hidden')) {
          minimizeLayoutPanel();
        }
      }
    });
  }

  // Focusout on panelCard minimizes the panel if focus moves outside
  if (panelCard) {
    panelCard.addEventListener('focusout', (e) => {
      setTimeout(() => {
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        const toggle = document.getElementById('btn-toggle-display-panel');
        if (active && active !== document.body && !panelCard.contains(active) && (!toggle || (!toggle.contains(active) && toggle !== active))) {
          const isOpen = panelCard.style.display !== 'none' && !panelCard.classList.contains('hidden');
          if (isOpen) {
            minimizeLayoutPanel();
          }
        }
      }, 10);
    });
  }

  if (btnClose && panelCard) {
    btnClose.addEventListener('click', () => {
      minimizeLayoutPanel();
    });
  }

  if (btnAddValue) {
    btnAddValue.addEventListener('click', () => {
      const name = prompt('Enter a name for the new Display Value row:');
      if (name && name.trim()) {
        addCustomDisplayValue(name.trim());
      }
    });
  }

  // Ensure any duplicate/second pill or row with Layers name is cleaned up
  removeSecondPillWithLayersName();

  // Initial render
  renderDisplayPanel();

  // Apply initial saved/default behaviors to viewer if modules already present
  displayValues.forEach(val => {
    const result = examineFiveCheckboxes(val.id);
    if (result && viewer) {
      applyModuleDisplayBehavior(result.valueId, result.behaviorValue, result.behaviorKey, viewer);
    }
  });

  // Display initial station plot boundary box in the main display
  if (viewer) {
    viewer.updatePlotBox(plotConfig);
  }

  console.log('[DisplayPanel] Module Display & Placement panel initialized with 5-checkbox examination system and Station Plot controls.');
}
