import {
  lookupModuleBounds,
  getInitialModuleSize,
  getInitialModuleDimensions,
  getInitialModuleBounds,
  getModuleCategory
} from '@x4/catalog';
import { PlotBounds, StationLayoutEngine } from '@x4/domain';

const STORAGE_KEY = 'x4_module_display_panel_config';
const PLOT_STORAGE_KEY = 'x4_layout_plot_config';
const BLUEPRINT_PLOT_STORAGE_KEY = 'x4_blueprint_plot_configs';
export const DECORATOR_PIPELINE_STORAGE_KEY = 'x4_layout_active_decorator_pipeline';
export const ACTIONABLE_ELEMENTS_STORAGE_KEY = 'x4_actionable_decorator_elements';

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
 * Strictly only the five canonical layer categories.
 * No duplicates, only the five.
 */
export const LAYER_CATEGORIES = ['Docks', 'Storage', 'Production', 'Habitats', 'Defense'];

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
let activeActionableElements = loadActionableElements();
let activeDecoratorIds = [...new Set(activeActionableElements.map(e => e.decoratorId))];

/**
 * Load active actionable elements from localStorage.
 * Starts empty ([]) if no saved elements exist.
 */
export function loadActionableElements() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACTIONABLE_ELEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const seenSingleDecorators = new Set();
      const seenLayerCats = new Set();
      const sanitized = [];
      for (const item of parsed) {
        if (!item || !item.decoratorId) continue;
        if (item.decoratorId === 'layers') {
          const catLower = (item.category || '').toLowerCase();
          if (!catLower || seenLayerCats.has(catLower) || !LAYER_CATEGORIES.some(c => c.toLowerCase() === catLower)) {
            continue;
          }
          seenLayerCats.add(catLower);
        } else if (['order-of-layout', 'layout-mode', 'spacing-offset', 'alignment-anchor', 'module-scope'].includes(item.decoratorId)) {
          if (seenSingleDecorators.has(item.decoratorId)) {
            continue;
          }
          seenSingleDecorators.add(item.decoratorId);
        }
        sanitized.push(item);
      }
      return sanitized;
    }
  } catch (e) {
    console.warn('[DisplayPanel] Error reading actionable elements:', e);
  }
  return [];
}

/**
 * Persist active actionable elements to localStorage.
 */
export function saveActionableElements(elements) {
  activeActionableElements = Array.isArray(elements) ? [...elements] : [];
  activeDecoratorIds = [...new Set(activeActionableElements.map(e => e.decoratorId))];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ACTIONABLE_ELEMENTS_STORAGE_KEY, JSON.stringify(activeActionableElements));
      localStorage.setItem(DECORATOR_PIPELINE_STORAGE_KEY, JSON.stringify(activeDecoratorIds));
    } catch (e) {
      console.warn('[DisplayPanel] Error saving actionable elements:', e);
    }
  }
}

/**
 * Get a copy of active actionable elements in pipeline order.
 */
export function getActiveActionableElements() {
  return [...activeActionableElements];
}

/**
 * Load active decorator pipeline from localStorage (backward-compatible).
 */
export function loadActiveDecoratorPipeline() {
  return [...new Set(activeActionableElements.map(e => e.decoratorId))];
}

/**
 * Persist active decorator pipeline to localStorage.
 */
export function saveActiveDecoratorPipeline(ids) {
  activeDecoratorIds = Array.isArray(ids) ? [...ids] : [];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DECORATOR_PIPELINE_STORAGE_KEY, JSON.stringify(activeDecoratorIds));
    } catch (e) {
      console.warn('[DisplayPanel] Error saving decorator pipeline:', e);
    }
  }
}

/**
 * Get a copy of active decorator IDs in pipeline order.
 */
export function getActiveDecoratorIds() {
  return [...new Set(activeActionableElements.map(e => e.decoratorId))];
}

/**
 * Check if a decorator ID has active elements in the actionable list.
 */
export function isDecoratorInPipeline(decoratorId) {
  return activeActionableElements.some(e => e.decoratorId === decoratorId);
}

/**
 * Detect conflicts between a candidate element and existing members in the actionable list.
 *
 * Conflict rules:
 * 1. Duplicate: The same element is already present.
 * 2. Mutual Exclusivity: Order of Layout, Layout Mode, Spacing & Offset, and Module Scope
 *    only permit one active element at a time; candidate conflicts with and replaces previous member.
 * 3. Layer Slot Exclusivity: A layer element for the same slot number (e.g. Layer 1) conflicts
 *    with an existing element in that slot.
 * 4. Blueprint Exclusivity: Blueprint layout in Order of Layout conflicts with procedural Layout Modes.
 */
export function detectElementConflicts(candidate, existingElements = activeActionableElements) {
  const conflicts = [];
  let reason = '';

  for (const existing of existingElements) {
    // 1. Same exact element already present
    if (existing.decoratorId === candidate.decoratorId && existing.elementId === candidate.elementId) {
      conflicts.push(existing);
      reason = `"${candidate.elementName}" is already present in the Actionable Panel.`;
      break;
    }

    // 2. Mutual exclusivity within the same decorator:
    if (['order-of-layout', 'layout-mode', 'spacing-offset', 'alignment-anchor', 'module-scope'].includes(candidate.decoratorId)) {
      if (existing.decoratorId === candidate.decoratorId) {
        conflicts.push(existing);
        reason = `Conflicts with existing ${existing.decoratorName} selection "${existing.elementName}".`;
      }
    }

    // 3. Layers conflict: same category already present in Layers Actionable panel
    if (candidate.decoratorId === 'layers' && existing.decoratorId === 'layers') {
      const candCat = (candidate.category || '').toLowerCase();
      const existCat = (existing.category || '').toLowerCase();
      if (candCat && existCat && candCat === existCat) {
        conflicts.push(existing);
        reason = `Category "${candidate.category}" is already assigned as Layer ${existing.layerNumber}.`;
      }
    }

    // 4. Cross-decorator conflict: Blueprint in order-of-layout conflicts with procedural layout-mode
    if (candidate.decoratorId === 'order-of-layout' && (candidate.elementId === 'layout-blueprint' || (candidate.elementName && candidate.elementName.toLowerCase().includes('blueprint')))) {
      if (existing.decoratorId === 'layout-mode') {
        conflicts.push(existing);
        reason = `Blueprint layout mode conflicts with procedural Layout Mode "${existing.elementName}".`;
      }
    }
    if (candidate.decoratorId === 'layout-mode') {
      if (existing.decoratorId === 'order-of-layout' && (existing.elementId === 'layout-blueprint' || (existing.elementName && existing.elementName.toLowerCase().includes('blueprint')))) {
        conflicts.push(existing);
        reason = `Procedural Layout Mode "${candidate.elementName}" conflicts with Blueprint order.`;
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    reason
  };
}

/**
 * Refresh layer numbers across all active actionable layer elements
 * so their numbers 1, 2, 3... match their sequential order in the actionable panel.
 * The order of addition and placement establishes the order of evaluation.
 */
export function refreshLayerNumbers() {
  let count = 0;
  activeActionableElements.forEach(item => {
    if (item.decoratorId === 'layers') {
      count++;
      item.layerNumber = count;
      const catCap = item.category
        ? (item.category.charAt(0).toUpperCase() + item.category.slice(1))
        : `Layer ${count}`;
      item.elementName = `${catCap}-${count}`;
    }
  });
  syncLayersToDisplayValues();
}

/**
 * Synchronize the underlying displayValues for Layers with the active actionable layer order.
 * Ensures strictly only the five canonical categories (Docks, Storage, Production, Habitats, Defense)
 * are present in layersRow.checkboxes, numbered sequentially 1 to 5, with zero duplicate names.
 */
export function syncLayersToDisplayValues() {
  if (typeof displayValues === 'undefined' || !Array.isArray(displayValues)) return;
  const layersRow = displayValues.find(v => v.id === 'layers');
  if (!layersRow) return;

  const activeLayers = (typeof activeActionableElements !== 'undefined' && Array.isArray(activeActionableElements))
    ? activeActionableElements.filter(e => e.decoratorId === 'layers')
    : [];

  // 1. Gather active categories in their exact evaluation order (no duplicates)
  const activeCats = [];
  const seenActive = new Set();
  for (const item of activeLayers) {
    const raw = item.category || '';
    const canonical = LAYER_CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase());
    const cat = canonical || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Docks');
    const catLower = cat.toLowerCase();
    if (!seenActive.has(catLower) && LAYER_CATEGORIES.some(c => c.toLowerCase() === catLower)) {
      seenActive.add(catLower);
      activeCats.push(cat);
    }
  }

  // 2. Gather remaining categories from canonical LAYER_CATEGORIES not yet active
  const remainingCats = LAYER_CATEGORIES.filter(c => !seenActive.has(c.toLowerCase()));

  // 3. Exactly the five categories in order: active evaluation order first, then remaining canonical defaults
  const orderedCategories = [...activeCats, ...remainingCats].slice(0, 5);

  // 4. Construct the 5 unique checkboxes with zero duplicate names
  layersRow.checkboxes = orderedCategories.map((cat, idx) => {
    const num = idx + 1;
    const catLower = cat.toLowerCase();
    const isActive = idx < activeCats.length;
    return {
      id: `layer-${num}`,
      name: `${cat}-${num}`,
      isDefault: idx === 0,
      checked: activeCats.length === 0 ? (idx === 0) : isActive,
      behaviorKey: `layer-${catLower}`
    };
  });

  saveDisplayPanelConfig();
}

/**
 * Add only the selected drop-down element into the Actionable Panel,
 * deciding and resolving any conflicts with existing members.
 * For Layers additions, the order of addition establishes the order of evaluation.
 */
export function addActionableElement(decoratorId, elementIndex = 0, targetPosition = -1) {
  const decoratorObj = displayValues.find(v => v.id === decoratorId);
  if (!decoratorObj || !decoratorObj.checkboxes || !decoratorObj.checkboxes[elementIndex]) return null;

  const cb = decoratorObj.checkboxes[elementIndex];
  let layerInfo = {};
  if (decoratorId === 'layers') {
    const parsed = parseLayerCheckbox(cb, elementIndex);
    const existingLayers = activeActionableElements.filter(e => e.decoratorId === 'layers');
    const cat = parsed.category || LAYER_CATEGORIES[elementIndex % LAYER_CATEGORIES.length];
    const catLower = (cat || '').toLowerCase();
    const layerNumber = existingLayers.length + 1;
    layerInfo = {
      layerNumber,
      category: catLower,
      elementName: `${cat}-${layerNumber}`
    };
  }

  const candidate = {
    id: decoratorId === 'layers' ? `layers:${layerInfo.category}` : `${decoratorId}:${cb.id}`,
    decoratorId,
    decoratorName: decoratorObj.name,
    elementId: cb.id,
    elementName: layerInfo.elementName || cb.name,
    behaviorKey: cb.behaviorKey || cb.id,
    elementIndex,
    ...layerInfo
  };

  // Decide if there is any conflict with other members in the actionable list
  const conflictCheck = detectElementConflicts(candidate, activeActionableElements);
  if (conflictCheck.hasConflict) {
    console.log(`[DisplayPanel] Conflict detected: ${conflictCheck.reason}`);
    // Auto-resolve: remove conflicting members from the actionable list
    conflictCheck.conflicts.forEach(conf => {
      const idx = activeActionableElements.findIndex(e => e.id === conf.id);
      if (idx !== -1) {
        activeActionableElements.splice(idx, 1);
        console.log(`[DisplayPanel] Resolved conflict by replacing "${conf.elementName}" with "${candidate.elementName}".`);
      }
    });
  }

  // Add only this element to the Actionable Panel in the order clicked
  if (targetPosition >= 0 && targetPosition <= activeActionableElements.length) {
    activeActionableElements.splice(targetPosition, 0, candidate);
  } else {
    activeActionableElements.push(candidate);
  }
  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);

  // Sync checkbox state so internal examination reflects the selection
  examineFiveCheckboxes(decoratorId, elementIndex, true);

  // When Order of Layout is Blueprint, reload the blueprint name and skip procedural decorators
  if (isOrderOfLayoutBlueprint()) {
    reloadBlueprintName();
  }

  // Apply behavior to viewer
  if (activeViewerInstance) {
    applyModuleDisplayBehavior(decoratorId, cb.name, candidate.behaviorKey, activeViewerInstance, true);
  }

  activeDropdownDecoratorId = null;
  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }

  return candidate;
}

/**
 * Remove an element from the Actionable Panel.
 */
export function removeActionableElement(idOrElementId) {
  const idx = activeActionableElements.findIndex(e => e.id === idOrElementId || e.elementId === idOrElementId);
  if (idx !== -1) {
    const removed = activeActionableElements.splice(idx, 1)[0];
    refreshLayerNumbers();
    saveActionableElements(activeActionableElements);

    if (activeViewerInstance) {
      const layerOrder = getLayerPlacementCategoryOrder();
      applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
    }

    if (typeof document !== 'undefined') {
      renderDisplayPanel();
    }
    return removed;
  }
  return null;
}

/**
 * Move an actionable element up or down in progression.
 */
export function moveActionableElement(id, direction) {
  const idx = activeActionableElements.findIndex(e => e.id === id);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= activeActionableElements.length) return;
  const item = activeActionableElements.splice(idx, 1)[0];
  activeActionableElements.splice(newIdx, 0, item);
  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);

  if (activeViewerInstance) {
    const layerOrder = getLayerPlacementCategoryOrder();
    applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
  }

  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
}

/**
 * Reorder an actionable element to a specific target index via hand placement.
 */
export function reorderActionableElement(draggedId, targetIndex) {
  const idx = activeActionableElements.findIndex(e => e.id === draggedId);
  if (idx === -1) return;
  const item = activeActionableElements.splice(idx, 1)[0];
  if (targetIndex >= 0 && targetIndex <= activeActionableElements.length) {
    activeActionableElements.splice(targetIndex, 0, item);
  } else {
    activeActionableElements.push(item);
  }
  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);

  if (activeViewerInstance) {
    const layerOrder = getLayerPlacementCategoryOrder();
    applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
  }

  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
}

/**
 * Reorder a layer item position within the unified Layers card upon dragging and releasing.
 * Re-indexes all layer numbers and dynamically updates the category evaluation order.
 */
export function reorderLayerPosition(draggedId, targetLayerIndex) {
  const layerItems = activeActionableElements.filter(e => e.decoratorId === 'layers');
  const draggedItem = layerItems.find(e => e.id === draggedId);
  if (!draggedItem) return;

  const currentIdxInLayers = layerItems.findIndex(e => e.id === draggedId);
  if (currentIdxInLayers === -1) return;

  // Remove from activeActionableElements
  const originalIdx = activeActionableElements.findIndex(e => e.id === draggedId);
  activeActionableElements.splice(originalIdx, 1);

  // Find insertion point among remaining layers in activeActionableElements
  const remainingLayers = activeActionableElements.filter(e => e.decoratorId === 'layers');
  if (targetLayerIndex >= 0 && targetLayerIndex < remainingLayers.length) {
    const targetRef = remainingLayers[targetLayerIndex];
    const insertIdx = activeActionableElements.indexOf(targetRef);
    activeActionableElements.splice(insertIdx, 0, draggedItem);
  } else if (remainingLayers.length > 0) {
    const lastLayer = remainingLayers[remainingLayers.length - 1];
    const insertIdx = activeActionableElements.indexOf(lastLayer) + 1;
    activeActionableElements.splice(insertIdx, 0, draggedItem);
  } else {
    activeActionableElements.push(draggedItem);
  }

  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);

  if (activeViewerInstance) {
    const layerOrder = getLayerPlacementCategoryOrder();
    applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
  }

  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
}

/**
 * Clear the actionable panel back to empty state.
 */
export function clearActionableElements() {
  activeActionableElements = [];
  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);
  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
}

/**
 * Add a decorator by ID (adds its default element via addActionableElement).
 */
export function addDecoratorToPipeline(decoratorId, targetIndex = -1) {
  return addActionableElement(decoratorId, 0, targetIndex);
}

/**
 * Remove all elements associated with a decorator from the Actionable Panel.
 */
export function removeDecoratorFromPipeline(decoratorId) {
  activeActionableElements = activeActionableElements.filter(e => e.decoratorId !== decoratorId);
  refreshLayerNumbers();
  saveActionableElements(activeActionableElements);
  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
}

/**
 * Move a decorator element in pipeline progression order.
 */
export function moveDecoratorInPipeline(decoratorId, direction) {
  const item = activeActionableElements.find(e => e.decoratorId === decoratorId);
  if (item) {
    moveActionableElement(item.id, direction);
  }
}

/**
 * Clear the decorator pipeline back to its empty state.
 */
export function clearDecoratorPipeline() {
  clearActionableElements();
}

let activeDropdownDecoratorId = null;

export function getActiveDropdownDecoratorId() {
  return activeDropdownDecoratorId;
}

export function setActiveDropdownDecoratorId(id) {
  activeDropdownDecoratorId = id;
}

/**
 * Add a decorator element via selected drop-down element.
 */
export function addDecoratorWithSelectedElement(decoratorId, elementIndex) {
  return addActionableElement(decoratorId, elementIndex);
}

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

/**
 * When Order of Layout is Blueprint, reload the blueprint name and update related UI elements.
 */
export function reloadBlueprintName() {
  const bp = getActiveBlueprint();
  const bpName = bp?.name || null;

  if (typeof document !== 'undefined' && bpName) {
    const planNameEl = document.getElementById('plan-name');
    if (planNameEl) {
      planNameEl.textContent = bpName;
    }
    const sampleDropdownLabel = document.getElementById('sample-dropdown-current-label');
    if (sampleDropdownLabel) {
      sampleDropdownLabel.textContent = bpName;
    }
  }

  // Update any active blueprint actionable elements with the reloaded blueprint name
  if (typeof activeActionableElements !== 'undefined' && Array.isArray(activeActionableElements)) {
    activeActionableElements.forEach(item => {
      if (item.decoratorId === 'order-of-layout' && (item.elementId === 'layout-blueprint' || (item.elementName && item.elementName.toLowerCase().includes('blueprint')))) {
        item.blueprintName = bpName;
      }
    });
  }

  // Reload blueprint model original positions in active viewer instance if available
  if (activeViewerInstance && typeof activeViewerInstance.applyLayoutBehavior === 'function') {
    activeViewerInstance.applyLayoutBehavior('blueprint', 'Blueprint');
  }

  return bpName;
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

      // Ensure Ground Floor in alignment-anchor has clean name and key, and enforce single selection (mutually exclusive)
      const alignVal = parsed.find(v => v.id === 'alignment-anchor');
      if (alignVal && Array.isArray(alignVal.checkboxes)) {
        alignVal.checkboxes.forEach(cb => {
          if (cb.id === 'align-ground' || cb.name.toLowerCase().includes('ground floor') || cb.name.toLowerCase().includes('lowest y')) {
            cb.name = 'Ground Floor';
            cb.behaviorKey = 'align-ground';
          }
        });
        const checkedList = alignVal.checkboxes.filter(cb => cb.checked);
        if (checkedList.length > 1) {
          const toKeep = alignVal.checkboxes.find(cb => cb.checked && !cb.isDefault) || checkedList[0];
          alignVal.checkboxes.forEach(cb => {
            cb.checked = (cb === toKeep);
          });
        }
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

      // Strictly ensure the single Layers row contains only the five canonical categories without duplicate names
      const singleLayersRow = parsed.find(v => v.id === 'layers' || (v.name && v.name.trim().toLowerCase() === 'layers'));
      if (singleLayersRow) {
        singleLayersRow.id = 'layers';
        singleLayersRow.name = 'Layers';
        const existingCbs = Array.isArray(singleLayersRow.checkboxes) ? singleLayersRow.checkboxes : [];
        const seenCats = new Set();
        const cleanCbs = [];

        for (let i = 0; i < existingCbs.length; i++) {
          const cb = existingCbs[i];
          const parsedCb = parseLayerCheckbox(cb, i);
          const cat = parsedCb.category;
          const catLower = (cat || '').toLowerCase();
          if (!seenCats.has(catLower) && LAYER_CATEGORIES.some(c => c.toLowerCase() === catLower)) {
            seenCats.add(catLower);
            cleanCbs.push({
              id: `layer-${cleanCbs.length + 1}`,
              name: `${cat}-${cleanCbs.length + 1}`,
              isDefault: cleanCbs.length === 0,
              checked: !!cb.checked,
              behaviorKey: `layer-${catLower}`
            });
          }
        }

        // Fill in any missing categories from the canonical five
        for (const cat of LAYER_CATEGORIES) {
          const catLower = cat.toLowerCase();
          if (!seenCats.has(catLower) && cleanCbs.length < 5) {
            seenCats.add(catLower);
            cleanCbs.push({
              id: `layer-${cleanCbs.length + 1}`,
              name: `${cat}-${cleanCbs.length + 1}`,
              isDefault: cleanCbs.length === 0,
              checked: false,
              behaviorKey: `layer-${catLower}`
            });
          }
        }

        singleLayersRow.checkboxes = cleanCbs.slice(0, 5);
      }

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
 * Returns true if the Order of Layout is currently Blueprint (either via active actionable element or checked mode).
 */
export function isOrderOfLayoutBlueprint() {
  const orderElement = (typeof activeActionableElements !== 'undefined' && Array.isArray(activeActionableElements))
    ? activeActionableElements.find(e => e.decoratorId === 'order-of-layout')
    : null;

  if (orderElement) {
    return orderElement.elementId === 'layout-blueprint' ||
           orderElement.elementId === 'order-blueprint' ||
           (orderElement.behaviorKey && orderElement.behaviorKey.toLowerCase().includes('blueprint')) ||
           (orderElement.elementName && orderElement.elementName.toLowerCase().includes('blueprint'));
  }

  return isBlueprintModeActive();
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
        reloadBlueprintName();
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
          reloadBlueprintName();
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
    } else {
      if (clickedCb.checked) {
        // Single-choice active behavior within the 5 checkboxes (mutually exclusive)
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

  if (valueId === 'layers') {
    // Layers can only be one of the five canonical categories without duplicates
    const match = LAYER_CATEGORIES.find(c =>
      newName.trim().toLowerCase().startsWith(c.toLowerCase()) ||
      c.toLowerCase() === newName.trim().toLowerCase()
    );
    if (!match) {
      console.warn(`[DisplayPanel] Invalid layer category "${newName}". Only the five are allowed: ${LAYER_CATEGORIES.join(', ')}`);
      return false;
    }
    const matchLower = match.toLowerCase();
    const alreadyUsed = valueObj.checkboxes.some((cb, idx) => {
      if (idx === checkboxIndex) return false;
      const parsed = parseLayerCheckbox(cb, idx);
      return (parsed.category || '').toLowerCase() === matchLower;
    });
    if (alreadyUsed) {
      console.warn(`[DisplayPanel] Category "${match}" is already assigned. Layers elements cannot have duplicate names.`);
      return false;
    }
  }

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
  if (valueId === 'layers') {
    console.warn('[DisplayPanel] Layers strictly has only the five canonical categories. Additional elements cannot be added.');
    return false;
  }
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
  const categoryMap = {
    'docks': 'docks',
    'dock': 'docks',
    'storage': 'storage',
    'production': 'production',
    'habitats': 'habitation',
    'habitat': 'habitation',
    'defense': 'defense',
    'defence': 'defense',
    'structure': 'structure'
  };

  // If actionable layer elements exist, their order of addition / placement establishes the order of evaluation!
  if (typeof activeActionableElements !== 'undefined' && Array.isArray(activeActionableElements)) {
    const activeLayers = activeActionableElements.filter(e => e.decoratorId === 'layers');
    if (activeLayers.length > 0) {
      const order = [];
      activeLayers.forEach(l => {
        const catLower = (l.category || '').toLowerCase();
        const catKey = categoryMap[catLower] || catLower || 'structure';
        if (!order.includes(catKey)) {
          order.push(catKey);
        }
      });
      // Append standard defaults for categories not yet specified
      const defaults = ['docks', 'storage', 'production', 'habitation', 'defense', 'structure'];
      defaults.forEach(d => {
        if (!order.includes(d)) order.push(d);
      });
      return order;
    }
  }

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
  return StationLayoutEngine.sortByCategoryOrder(modules, layerOrder || getLayerPlacementCategoryOrder(), moduleCategoryOf);
}

/** Catalog category of a module object, mesh or placement record (by macro). */
function moduleCategoryOf(mod) {
  return getModuleCategory(mod.userData?.macro || mod.macro || mod.key || '');
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
  const bounds = new PlotBounds(pConfig);
  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
    widthX: bounds.widthX,
    heightY: bounds.heightY,
    depthZ: bounds.depthZ,
    centerX: bounds.centerX,
    centerY: bounds.centerY,
    centerZ: bounds.centerZ
  };
}

/**
 * Clamp a 3D module position strictly within the plot boundaries,
 * honoring the module's bounding box size so no part of the module
 * is outside the current plot size BB location.
 */
export function clampModulePositionToPlot(pos, size, plotCfg = null) {
  const pConfig = plotCfg || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  return StationLayoutEngine.clampModulePositionToPlot(pos, size, pConfig);
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
  return StationLayoutEngine.doBoxesOverlap(posA, sizeA, posB, sizeB, margin);
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
  const pConfig = plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  const opts = {
    ...options,
    getModuleSize: options.getModuleSize || ((m) => {
      if (m.initialSize) return m.initialSize;
      if (m.userData?.initialSize) return m.userData.initialSize;
      const macro = m.userData?.macro || m.macro || m.key || '';
      const arr = getInitialModuleSize(macro);
      return { x: arr[0], y: arr[1], z: arr[2] };
    })
  };
  return StationLayoutEngine.ensureNoBoundingBoxOverlaps(modules, pConfig, opts);
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

  // Default the anchor to the alignment checkboxes currently checked in the panel
  let defaultAlignmentKeys = [];
  if (typeof displayValues !== 'undefined' && Array.isArray(displayValues)) {
    const alignVal = displayValues.find(v => v.id === 'alignment-anchor');
    if (alignVal && Array.isArray(alignVal.checkboxes)) {
      defaultAlignmentKeys = alignVal.checkboxes.filter(cb => cb.checked).map(cb => (cb.behaviorKey || cb.name || '').toLowerCase());
    }
  }

  return StationLayoutEngine.calculateLayeredPlacement(modules, {
    plotBounds: plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG,
    categoryOrder: layerOrder || getLayerPlacementCategoryOrder(),
    getCategory: moduleCategoryOf,
    getModuleSize: options.getModuleSize || defaultModuleSize,
    alignmentAnchor,
    defaultAlignmentKeys,
    gap: options.gap,
    applyToObjects: options.applyToObjects
  });
}

/** Initial bounding-box size of a module object or mesh (userData.initialSize, else by macro). */
function defaultModuleSize(m) {
  if (m.userData?.initialSize) return m.userData.initialSize;
  const macro = m.userData?.macro || m.macro || m.key || '';
  const arr = getInitialModuleSize(macro);
  return { x: arr[0], y: arr[1], z: arr[2] };
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
  addDecoratorToPipeline(id);
  saveDisplayPanelConfig();
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

  // When Order of Layout is Blueprint, reload blueprint and skip all other actionable decorators
  if (isOrderOfLayoutBlueprint() && valueId !== 'order-of-layout') {
    console.log(`[DisplayPanel] Order of Layout is Blueprint: skipping actionable decorator "${valueId}"`);
    return;
  }

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
  return StationLayoutEngine.calculateLayoutPlacement(modules, {
    plotBounds: getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG,
    categoryOrder: getLayerPlacementCategoryOrder(),
    getCategory: moduleCategoryOf,
    getInitialSize: getInitialModuleDimensions,
    mode: options.mode,
    dimension: options.dimension,
    gap: options.gap,
    useBlueprintOrder: isOrderOfLayoutBlueprint()
  });
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
 * Create an Actionable Element Card DOM element carrying its parent Decorator heading,
 * displaying only the selected element, and providing drag-reorder & delete controls.
 */
export function createActionableElementCard(item, activeIndex, totalActive) {
  const cardEl = document.createElement('div');

  const bpIsOrder = isOrderOfLayoutBlueprint();
  const isThisItemBlueprint = item.decoratorId === 'order-of-layout' && (
    item.elementId === 'layout-blueprint' ||
    item.elementId === 'order-blueprint' ||
    (item.behaviorKey && item.behaviorKey.toLowerCase().includes('blueprint')) ||
    (item.elementName && item.elementName.toLowerCase().includes('blueprint'))
  );

  let extraClasses = '';
  if (item.decoratorId === 'layers') extraClasses += ' is-actionable-layer';
  if (bpIsOrder) {
    if (isThisItemBlueprint) {
      extraClasses += ' is-blueprint-active';
    } else {
      extraClasses += ' is-skipped-by-blueprint';
    }
  }

  cardEl.className = 'display-value-row is-decorator is-actionable-element' + extraClasses;
  cardEl.id = `actionable-element-${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  cardEl.draggable = true;
  cardEl.title = 'Drag with hand to reorder placement (establishes evaluation order)';

  // Drag and drop reordering inside the actionable pipeline via hand placement
  cardEl.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.setData('source-index', String(activeIndex));
    e.dataTransfer.effectAllowed = 'move';
    cardEl.classList.add('is-dragging');
  });

  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('is-dragging');
  });

  // Calculate precise top or bottom placement indicator on dragover
  cardEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = cardEl.getBoundingClientRect();
    const isTop = (e.clientY - rect.top) < (rect.height / 2);
    if (isTop) {
      cardEl.classList.add('drag-placement-top');
      cardEl.classList.remove('drag-placement-bottom');
    } else {
      cardEl.classList.add('drag-placement-bottom');
      cardEl.classList.remove('drag-placement-top');
    }
  });

  cardEl.addEventListener('dragleave', (e) => {
    if (!cardEl.contains(e.relatedTarget)) {
      cardEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
    }
  });

  cardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isTop = cardEl.classList.contains('drag-placement-top');
    cardEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
    const droppedId = e.dataTransfer.getData('text/plain');
    if (droppedId) {
      const sourceIdx = parseInt(e.dataTransfer.getData('source-index'), 10);
      let targetIdx = isTop ? activeIndex : activeIndex + 1;
      if (!isNaN(sourceIdx) && sourceIdx < targetIdx) {
        targetIdx -= 1;
      }
      reorderActionableElement(droppedId, targetIdx);
    }
  });

  // Header carrying its heading, drag handle, and action controls
  const headerEl = document.createElement('div');
  headerEl.className = 'display-value-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'display-value-title-group';

  // Drag handle with hand appearance
  const dragHandle = document.createElement('span');
  dragHandle.className = 'decorator-drag-handle hand-cursor';
  dragHandle.title = 'Hand drag to reorder layer placement (determines evaluation order)';
  dragHandle.textContent = '⠿';
  titleGroup.appendChild(dragHandle);

  const dot = document.createElement('span');
  dot.className = 'header-dot glow-dot';
  titleGroup.appendChild(dot);

  // Carried Decorator Heading
  const headingSpan = document.createElement('span');
  headingSpan.className = 'display-value-name carried-decorator-heading';
  headingSpan.textContent = item.decoratorName;
  titleGroup.appendChild(headingSpan);

  // Selected Element Name Badge
  const elementBadge = document.createElement('span');
  elementBadge.className = 'active-behavior-badge actionable-element-badge';
  elementBadge.textContent = item.elementName;
  titleGroup.appendChild(elementBadge);

  // If item is Layers with layerNumber, show Evaluation Order badge
  if (item.decoratorId === 'layers' && item.layerNumber) {
    const evalBadge = document.createElement('span');
    evalBadge.className = 'layer-eval-order-badge';
    evalBadge.title = `Evaluation Order: Tier #${item.layerNumber}`;
    evalBadge.textContent = `Eval #${item.layerNumber}`;
    titleGroup.appendChild(evalBadge);
  }

  // When Order of Layout is Blueprint, show reloaded name for Blueprint, or yellow Skipped badge for other decorators
  if (bpIsOrder) {
    if (isThisItemBlueprint) {
      const bpName = reloadBlueprintName() || item.blueprintName || getActiveBlueprint()?.name;
      if (bpName) {
        const bpNameBadge = document.createElement('span');
        bpNameBadge.className = 'blueprint-reloaded-name';
        bpNameBadge.title = `Active Blueprint: ${bpName}`;
        bpNameBadge.textContent = bpName;
        titleGroup.appendChild(bpNameBadge);
      }
    } else {
      const skipBadge = document.createElement('span');
      skipBadge.className = 'badge-skipped-yellow';
      skipBadge.title = 'Skipped because Order of Layout is set to Blueprint';
      skipBadge.textContent = 'Skipped by Blueprint';
      titleGroup.appendChild(skipBadge);
    }
  }

  headerEl.appendChild(titleGroup);

  // Actions group on right: Move Up, Move Down, Remove
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'decorator-row-actions';

  if (activeIndex > 0) {
    const btnUp = document.createElement('button');
    btnUp.className = 'btn-decorator-ctrl';
    btnUp.title = 'Move up in layout progression';
    btnUp.textContent = '▲';
    btnUp.addEventListener('click', (e) => {
      e.stopPropagation();
      moveActionableElement(item.id, -1);
    });
    actionsGroup.appendChild(btnUp);
  }

  if (activeIndex < totalActive - 1) {
    const btnDown = document.createElement('button');
    btnDown.className = 'btn-decorator-ctrl';
    btnDown.title = 'Move down in layout progression';
    btnDown.textContent = '▼';
    btnDown.addEventListener('click', (e) => {
      e.stopPropagation();
      moveActionableElement(item.id, 1);
    });
    actionsGroup.appendChild(btnDown);
  }

  const btnRemove = document.createElement('button');
  btnRemove.className = 'btn-decorator-ctrl btn-remove-decorator';
  btnRemove.title = `Remove "${item.elementName}" from actionable panel`;
  btnRemove.textContent = '✕';
  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    removeActionableElement(item.id);
  });
  actionsGroup.appendChild(btnRemove);

  headerEl.appendChild(actionsGroup);
  cardEl.appendChild(headerEl);

  // If item is Layers with layerNumber, show category dropdown
  if (item.decoratorId === 'layers' && item.layerNumber) {
    const extraRow = document.createElement('div');
    extraRow.className = 'actionable-element-extra';

    const selectEl = document.createElement('select');
    selectEl.className = 'cyber-select-layer';
    selectEl.title = `Select category for Layer ${item.layerNumber}`;

    LAYER_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (item.category && cat.toLowerCase() === item.category.toLowerCase()) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });

    selectEl.addEventListener('click', (e) => e.stopPropagation());
    selectEl.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = selectEl.value;
      item.category = val.toLowerCase();
      const catCap = val.charAt(0).toUpperCase() + val.slice(1);
      item.elementName = `${catCap}-${item.layerNumber}`;
      refreshLayerNumbers();
      saveActionableElements(activeActionableElements);
      if (activeViewerInstance) {
        const layerOrder = getLayerPlacementCategoryOrder();
        applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
      }
      renderDisplayPanel();
    });

    extraRow.appendChild(selectEl);
    cardEl.appendChild(extraRow);
  }

  return cardEl;
}

/**
 * Create a single unified Actionable Card for Layers.
 * Any Layers added exist within that one heading.
 * The order is - appended to the order name (e.g. "LAYERS - Docks-1 - Storage-2").
 * Dragging and releasing any layer position will reorder the Layers.
 */
export function createUnifiedLayersCard(allLayers, activeIndex) {
  const cardEl = document.createElement('div');
  const bpIsOrder = isOrderOfLayoutBlueprint();
  const skippedClass = bpIsOrder ? ' is-skipped-by-blueprint' : '';
  cardEl.className = 'display-value-row is-decorator is-actionable-element is-unified-layers-card' + skippedClass;
  cardEl.id = 'actionable-element-layers-unified';
  cardEl.draggable = true;
  cardEl.title = 'Layers Decorator (Drag header to reorder pipeline, or drag layer items to reorder layers)';

  // Drag-and-drop reordering for the overall Layers card in the pipeline
  cardEl.addEventListener('dragstart', (e) => {
    if (e.target.closest('.unified-layer-item')) return;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', 'layers');
    e.dataTransfer.setData('source-index', String(activeIndex));
    e.dataTransfer.effectAllowed = 'move';
    cardEl.classList.add('is-dragging');
  });

  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('is-dragging');
  });

  cardEl.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('layer-id')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = cardEl.getBoundingClientRect();
    const isTop = (e.clientY - rect.top) < (rect.height / 2);
    if (isTop) {
      cardEl.classList.add('drag-placement-top');
      cardEl.classList.remove('drag-placement-bottom');
    } else {
      cardEl.classList.add('drag-placement-bottom');
      cardEl.classList.remove('drag-placement-top');
    }
  });

  cardEl.addEventListener('dragleave', (e) => {
    if (!cardEl.contains(e.relatedTarget)) {
      cardEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
    }
  });

  cardEl.addEventListener('drop', (e) => {
    if (e.dataTransfer.types.includes('layer-id')) return;
    e.preventDefault();
    e.stopPropagation();
    const isTop = cardEl.classList.contains('drag-placement-top');
    cardEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
    const droppedId = e.dataTransfer.getData('text/plain');
    if (droppedId && droppedId !== 'layers') {
      const sourceIdx = parseInt(e.dataTransfer.getData('source-index'), 10);
      let targetIdx = isTop ? activeIndex : activeIndex + 1;
      if (!isNaN(sourceIdx) && sourceIdx < targetIdx) {
        targetIdx -= 1;
      }
      reorderActionableElement(droppedId, targetIdx);
    }
  });

  // Header carrying the ONE single heading for LAYERS with the order appended to the order name
  const headerEl = document.createElement('div');
  headerEl.className = 'display-value-header unified-layers-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'display-value-title-group';

  // Overall drag handle
  const dragHandle = document.createElement('span');
  dragHandle.className = 'decorator-drag-handle hand-cursor';
  dragHandle.title = 'Hand drag to reorder Layers within pipeline';
  dragHandle.textContent = '⠿';
  titleGroup.appendChild(dragHandle);

  const dot = document.createElement('span');
  dot.className = 'header-dot glow-dot';
  titleGroup.appendChild(dot);

  // One heading: "LAYERS" with "- <order>" appended to the order name
  const headingSpan = document.createElement('span');
  headingSpan.className = 'display-value-name carried-decorator-heading unified-layers-heading';
  
  const headingText = document.createElement('span');
  headingText.className = 'heading-main-title';
  headingText.textContent = 'LAYERS';
  headingSpan.appendChild(headingText);

  // Append order name: e.g. " - Docks-1 - Storage-2 - Production-3"
  if (allLayers.length > 0) {
    const orderText = allLayers.map(l => l.elementName).join(' - ');
    const orderSpan = document.createElement('span');
    orderSpan.className = 'layers-order-appended';
    orderSpan.textContent = ` - ${orderText}`;
    headingSpan.appendChild(orderSpan);
  }

  titleGroup.appendChild(headingSpan);

  // Count badge
  const countBadge = document.createElement('span');
  countBadge.className = 'active-behavior-badge actionable-element-badge';
  countBadge.textContent = `${allLayers.length} Tiers`;
  titleGroup.appendChild(countBadge);

  if (bpIsOrder) {
    const skipBadge = document.createElement('span');
    skipBadge.className = 'badge-skipped-yellow';
    skipBadge.title = 'Skipped because Order of Layout is set to Blueprint';
    skipBadge.textContent = 'Skipped by Blueprint';
    titleGroup.appendChild(skipBadge);
  }

  headerEl.appendChild(titleGroup);

  // Actions group on right: Move Up, Move Down, Clear all layers
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'decorator-row-actions';

  if (activeIndex > 0) {
    const btnUp = document.createElement('button');
    btnUp.className = 'btn-decorator-ctrl';
    btnUp.title = 'Move Layers up in layout progression';
    btnUp.textContent = '▲';
    btnUp.addEventListener('click', (e) => {
      e.stopPropagation();
      moveActionableElement(allLayers[0].id, -1);
    });
    actionsGroup.appendChild(btnUp);
  }

  if (activeIndex < activeActionableElements.length - allLayers.length) {
    const btnDown = document.createElement('button');
    btnDown.className = 'btn-decorator-ctrl';
    btnDown.title = 'Move Layers down in layout progression';
    btnDown.textContent = '▼';
    btnDown.addEventListener('click', (e) => {
      e.stopPropagation();
      moveActionableElement(allLayers[allLayers.length - 1].id, 1);
    });
    actionsGroup.appendChild(btnDown);
  }

  const btnRemoveAll = document.createElement('button');
  btnRemoveAll.className = 'btn-decorator-ctrl btn-remove-decorator';
  btnRemoveAll.title = 'Remove all Layers from actionable panel';
  btnRemoveAll.textContent = '✕';
  btnRemoveAll.addEventListener('click', (e) => {
    e.stopPropagation();
    removeDecoratorFromPipeline('layers');
  });
  actionsGroup.appendChild(btnRemoveAll);

  headerEl.appendChild(actionsGroup);
  cardEl.appendChild(headerEl);

  // Container for all layers within that one heading
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'unified-layers-items-container';

  allLayers.forEach((layer, layerIdx) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'unified-layer-item';
    itemEl.id = `layer-item-${layer.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    itemEl.draggable = true;
    itemEl.title = 'Drag and release to reorder layer position (establishes evaluation order)';

    // Drag-and-drop reordering inside the unified Layers card
    itemEl.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer.setData('layer-id', layer.id);
      e.dataTransfer.setData('layer-index', String(layerIdx));
      e.dataTransfer.effectAllowed = 'move';
      itemEl.classList.add('is-dragging-layer');
    });

    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('is-dragging-layer');
      itemsContainer.querySelectorAll('.drag-placement-top, .drag-placement-bottom').forEach(el => {
        el.classList.remove('drag-placement-top', 'drag-placement-bottom');
      });
    });

    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = itemEl.getBoundingClientRect();
      const isTop = (e.clientY - rect.top) < (rect.height / 2);
      if (isTop) {
        itemEl.classList.add('drag-placement-top');
        itemEl.classList.remove('drag-placement-bottom');
      } else {
        itemEl.classList.add('drag-placement-bottom');
        itemEl.classList.remove('drag-placement-top');
      }
    });

    itemEl.addEventListener('dragleave', (e) => {
      if (!itemEl.contains(e.relatedTarget)) {
        itemEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
      }
    });

    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isTop = itemEl.classList.contains('drag-placement-top');
      itemEl.classList.remove('drag-placement-top', 'drag-placement-bottom');
      const draggedLayerId = e.dataTransfer.getData('layer-id');
      if (draggedLayerId) {
        const sourceIdx = parseInt(e.dataTransfer.getData('layer-index'), 10);
        let targetIdx = isTop ? layerIdx : layerIdx + 1;
        if (!isNaN(sourceIdx) && sourceIdx < targetIdx) {
          targetIdx -= 1;
        }
        reorderLayerPosition(draggedLayerId, targetIdx);
      }
    });

    // Left group: Drag Handle + Order badge (#1, #2) + Layer Name
    const leftGroup = document.createElement('div');
    leftGroup.className = 'unified-layer-left';

    const itemDragHandle = document.createElement('span');
    itemDragHandle.className = 'decorator-drag-handle hand-cursor';
    itemDragHandle.title = 'Hand drag to reorder layer position';
    itemDragHandle.textContent = '⠿';
    leftGroup.appendChild(itemDragHandle);

    const orderBadge = document.createElement('span');
    orderBadge.className = 'layer-eval-order-badge';
    orderBadge.textContent = `#${layer.layerNumber}`;
    orderBadge.title = `Tier #${layer.layerNumber} in Evaluation Order`;
    leftGroup.appendChild(orderBadge);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'unified-layer-name';
    nameSpan.textContent = layer.elementName;
    leftGroup.appendChild(nameSpan);

    itemEl.appendChild(leftGroup);

    // Right group: Category switch dropdown + Remove button
    const rightGroup = document.createElement('div');
    rightGroup.className = 'unified-layer-right';

    const selectEl = document.createElement('select');
    selectEl.className = 'cyber-select-layer cyber-select-layer-mini';
    selectEl.title = `Switch category for Layer ${layer.layerNumber}`;

    LAYER_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (layer.category && cat.toLowerCase() === layer.category.toLowerCase()) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });

    selectEl.addEventListener('click', (e) => e.stopPropagation());
    selectEl.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = selectEl.value;
      const oldCat = (layer.category || '').toLowerCase();
      const newCat = val.toLowerCase();
      if (oldCat === newCat) return;

      // If another active layer already has this category, swap with it to prevent duplicate names
      const duplicateLayer = allLayers.find(l => l !== layer && (l.category || '').toLowerCase() === newCat);
      if (duplicateLayer) {
        duplicateLayer.category = oldCat;
        const dupCatCap = oldCat.charAt(0).toUpperCase() + oldCat.slice(1);
        duplicateLayer.elementName = `${dupCatCap}-${duplicateLayer.layerNumber}`;
      }

      layer.category = newCat;
      const catCap = val.charAt(0).toUpperCase() + val.slice(1);
      layer.elementName = `${catCap}-${layer.layerNumber}`;
      refreshLayerNumbers();
      saveActionableElements(activeActionableElements);
      if (activeViewerInstance) {
        const layerOrder = getLayerPlacementCategoryOrder();
        applyModuleDisplayBehavior('layers', layerOrder.join(' > '), 'layer-reorder', activeViewerInstance, true);
      }
      renderDisplayPanel();
    });
    rightGroup.appendChild(selectEl);

    const btnRemoveLayer = document.createElement('button');
    btnRemoveLayer.className = 'btn-decorator-ctrl btn-remove-decorator';
    btnRemoveLayer.title = `Remove "${layer.elementName}" from Layers`;
    btnRemoveLayer.textContent = '✕';
    btnRemoveLayer.addEventListener('click', (e) => {
      e.stopPropagation();
      removeActionableElement(layer.id);
    });
    rightGroup.appendChild(btnRemoveLayer);

    itemEl.appendChild(rightGroup);
    itemsContainer.appendChild(itemEl);
  });

  cardEl.appendChild(itemsContainer);
  return cardEl;
}

/**
 * Render the entire panel DOM: Decorator Palette + Actionable Decorator Pipeline.
 */
export function renderDisplayPanel() {
  if (typeof document === 'undefined') return;

  // 1. Render the Plot pill in the Layout row (centered on the line, minimized by default)
  renderPlotPillHeader();

  const container = document.getElementById('display-panel-container');
  if (!container) return;

  container.innerHTML = '';

  // 2. Render Decorator Palette / Tray
  const trayEl = document.createElement('div');
  trayEl.className = 'decorator-tray';

  const trayHeader = document.createElement('div');
  trayHeader.className = 'decorator-tray-header';

  const trayTitle = document.createElement('span');
  trayTitle.className = 'decorator-tray-title';
  trayTitle.innerHTML = '<span class="header-dot glow-dot"></span>Decorator Palette';
  trayHeader.appendChild(trayTitle);

  const trayTip = document.createElement('span');
  trayTip.className = 'decorator-tray-tip';
  trayTip.textContent = 'Drag or click to populate layout pipeline';
  trayHeader.appendChild(trayTip);

  trayEl.appendChild(trayHeader);

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'decorator-chips-container';

  displayValues.forEach(val => {
    const isActive = activeActionableElements.some(e => e.decoratorId === val.id);
    const isDropdownOpen = activeDropdownDecoratorId === val.id;
    const chip = document.createElement('div');
    chip.className = `decorator-chip ${isActive ? 'is-active' : ''} ${isDropdownOpen ? 'dropdown-open' : ''}`;
    chip.draggable = true;
    chip.title = isActive
      ? `${val.name} (Active in pipeline • Drag to reorder, or click + to select element)`
      : `${val.name} • Drag into Actionable Panel, or click + to select element`;

    // Dedicated '+' button for opening dropdown of selectable elements
    const btnPlus = document.createElement('button');
    btnPlus.className = 'decorator-chip-plus';
    btnPlus.title = `Click to view ${val.name} elements for selection into Actionable Panel`;
    btnPlus.textContent = isDropdownOpen ? '✕' : '＋';
    btnPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      activeDropdownDecoratorId = (activeDropdownDecoratorId === val.id) ? null : val.id;
      renderDisplayPanel();
    });
    chip.appendChild(btnPlus);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'decorator-chip-label';
    labelSpan.textContent = val.name;
    chip.appendChild(labelSpan);

    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'decorator-chip-badge';
      badge.textContent = 'Active';
      chip.appendChild(badge);
    }

    // Dropdown menu showing the selectable elements of this decorator palette
    if (isDropdownOpen) {
      const menuEl = document.createElement('div');
      menuEl.className = 'decorator-dropdown-menu';

      const menuHeader = document.createElement('div');
      menuHeader.className = 'decorator-dropdown-header';
      menuHeader.textContent = `${val.name} Elements`;
      menuEl.appendChild(menuHeader);

      val.checkboxes.forEach((cb, idx) => {
        let isSelected = false;
        let activeLayerNumber = null;
        if (val.id === 'layers') {
          const parsed = parseLayerCheckbox(cb, idx);
          const found = activeActionableElements.find(e =>
            e.decoratorId === 'layers' &&
            (e.category === (parsed.category || '').toLowerCase() || e.elementId === cb.id)
          );
          if (found) {
            isSelected = true;
            activeLayerNumber = found.layerNumber;
          }
        } else {
          isSelected = activeActionableElements.some(e => e.decoratorId === val.id && e.elementId === cb.id);
        }

        const itemEl = document.createElement('div');
        itemEl.className = `decorator-dropdown-item ${isSelected ? 'is-selected' : ''}`;
        itemEl.title = isSelected
          ? `"${cb.name}" is active in Actionable Panel${activeLayerNumber ? ` (Evaluation Order #${activeLayerNumber})` : ''}`
          : `Add "${cb.name}" into Actionable Panel (establishes evaluation order)`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = cb.name;
        itemEl.appendChild(nameSpan);

        if (isSelected) {
          const checkIcon = document.createElement('span');
          checkIcon.className = 'decorator-dropdown-check';
          checkIcon.textContent = activeLayerNumber ? `✓ (#${activeLayerNumber})` : '✓';
          itemEl.appendChild(checkIcon);
        }

        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          addActionableElement(val.id, idx);
        });

        menuEl.appendChild(itemEl);
      });

      chip.appendChild(menuEl);
    }

    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', val.id);
      e.dataTransfer.effectAllowed = 'copyMove';
      chip.classList.add('is-dragging');
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove('is-dragging');
    });

    chip.addEventListener('click', (e) => {
      if (e.target.closest('.decorator-chip-plus') || e.target.closest('.decorator-dropdown-menu')) {
        return;
      }
      addActionableElement(val.id, 0);
    });

    chipsContainer.appendChild(chip);
  });

  trayEl.appendChild(chipsContainer);
  container.appendChild(trayEl);

  // 3. Render Actionable Decorator Pipeline Section
  const pipelineSection = document.createElement('div');
  pipelineSection.className = 'decorator-pipeline-section';

  const pipelineHeader = document.createElement('div');
  pipelineHeader.className = 'decorator-pipeline-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'decorator-pipeline-title-group';

  const titleText = document.createElement('span');
  titleText.className = 'decorator-pipeline-title';
  titleText.textContent = 'Actionable Decorators';
  titleGroup.appendChild(titleText);

  const countBadge = document.createElement('span');
  countBadge.className = 'decorator-pipeline-badge';
  countBadge.textContent = `${activeActionableElements.length} Elements Active`;
  titleGroup.appendChild(countBadge);

  pipelineHeader.appendChild(titleGroup);

  const pipelineActions = document.createElement('div');
  pipelineActions.className = 'decorator-pipeline-actions';

  if (activeActionableElements.length > 0) {
    const btnClear = document.createElement('button');
    btnClear.className = 'btn-xs-cyber';
    btnClear.title = 'Clear all elements from actionable panel';
    btnClear.textContent = 'Clear';
    btnClear.addEventListener('click', () => clearActionableElements());
    pipelineActions.appendChild(btnClear);
  }

  pipelineHeader.appendChild(pipelineActions);
  pipelineSection.appendChild(pipelineHeader);

  // Dropzone Container
  const dropzoneEl = document.createElement('div');
  dropzoneEl.id = 'actionable-decorator-pipeline';
  dropzoneEl.className = 'decorator-pipeline-dropzone';

  dropzoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropzoneEl.classList.add('drag-over');
  });

  dropzoneEl.addEventListener('dragleave', (e) => {
    if (!dropzoneEl.contains(e.relatedTarget)) {
      dropzoneEl.classList.remove('drag-over');
    }
  });

  dropzoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('drag-over');
    const droppedId = e.dataTransfer.getData('text/plain');
    if (droppedId) {
      if (droppedId.includes(':') || droppedId === 'layers') {
        reorderActionableElement(droppedId, activeActionableElements.length);
      } else {
        addActionableElement(droppedId, 0);
      }
    }
  });

  // Actionable panel starts empty at first!
  if (activeActionableElements.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'decorator-empty-state';
    emptyState.innerHTML = `
      <div class="empty-state-ring">
        <span class="empty-state-icon">＋</span>
      </div>
      <div class="empty-state-title">Actionable Decorator Panel is empty</div>
      <div class="empty-state-desc">Click the ＋ on any decorator above to choose an element into this panel, or drag decorators to define your layout progression.</div>
    `;

    const quickActions = document.createElement('div');
    quickActions.className = 'empty-state-actions';

    const btnOrder = document.createElement('button');
    btnOrder.className = 'btn-xs-cyber';
    btnOrder.textContent = '+ Order of Layout';
    btnOrder.addEventListener('click', () => addActionableElement('order-of-layout', 0));
    quickActions.appendChild(btnOrder);

    const btnLayers = document.createElement('button');
    btnLayers.className = 'btn-xs-cyber';
    btnLayers.textContent = '+ Layers';
    btnLayers.addEventListener('click', () => addActionableElement('layers', 0));
    quickActions.appendChild(btnLayers);

    const btnMode = document.createElement('button');
    btnMode.className = 'btn-xs-cyber';
    btnMode.textContent = '+ Layout Mode';
    btnMode.addEventListener('click', () => addActionableElement('layout-mode', 1));
    quickActions.appendChild(btnMode);

    emptyState.appendChild(quickActions);
    dropzoneEl.appendChild(emptyState);
  } else {
    // Populate active actionable elements:
    // Any Layers added exist within that one heading.
    // Non-layer elements are rendered as their regular element cards.
    let renderedLayersCard = false;
    activeActionableElements.forEach((item, idx) => {
      if (item.decoratorId === 'layers') {
        if (!renderedLayersCard) {
          const allLayers = activeActionableElements.filter(e => e.decoratorId === 'layers');
          dropzoneEl.appendChild(createUnifiedLayersCard(allLayers, idx));
          renderedLayersCard = true;
        }
      } else {
        dropzoneEl.appendChild(createActionableElementCard(item, idx, activeActionableElements.length));
      }
    });
  }

  pipelineSection.appendChild(dropzoneEl);
  container.appendChild(pipelineSection);
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
