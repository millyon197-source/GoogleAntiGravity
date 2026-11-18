import {
  lookupModuleBounds,
  getInitialModuleSize,
  getInitialModuleDimensions,
  getInitialModuleBounds,
  getModuleCategory,
  getFriendlyName
} from '@x4/catalog';
import { PlotBounds, StationLayoutEngine } from '@x4/domain';
import PIER_LANE_DIRECTIONS from './pier-lane-directions.json' with { type: 'json' };
import PIER_CLAMPS from './pier-clamps.json' with { type: 'json' };

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
 * Default Order of Layout configuration (backward-compatibility reference).
 * The Blueprint functionality is moved outside "Layout" text as a checkbox labeled "Blueprint".
 */
export const DEFAULT_ORDER_OF_LAYOUT = {
  id: 'order-of-layout',
  name: 'Order of Layout',
  checkboxes: [
    { id: 'layout-blueprint', name: 'Blueprint', isDefault: true, checked: true, behaviorKey: 'blueprint' },
    { id: 'order-layers', name: 'Layers Order', isDefault: false, checked: false, behaviorKey: 'order-layers' },
    { id: 'order-size', name: 'Component Size', isDefault: false, checked: false, behaviorKey: 'order-size' },
    { id: 'order-cluster', name: 'Category Clusters', isDefault: false, checked: false, behaviorKey: 'order-cluster' },
    { id: 'order-custom', name: 'Custom Order', isDefault: false, checked: false, behaviorKey: 'order-custom' }
  ]
};

/**
 * Default values configuration.
 * Each value defines how modules are to be displayed/placed,
 * and contains up to 5 checkboxes that can be named by an edit later.
 */
export const DEFAULT_DISPLAY_VALUES = [
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
  let decoratorObj = displayValues.find(v => v.id === decoratorId);
  if (!decoratorObj && decoratorId === 'order-of-layout') {
    decoratorObj = DEFAULT_ORDER_OF_LAYOUT;
  }
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
export function setActiveBlueprint(planId, planName, viewer = null) {
  activeBlueprintId = planId || null;
  activeBlueprintName = planName || null;
  if (viewer) {
    activeViewerInstance = viewer;
  }

  const savedBpConfig = loadBlueprintPlotConfig(planId, planName);
  if (savedBpConfig) {
    setPlotConfig(savedBpConfig, true);
  } else {
    setPlotConfig(DEFAULT_PLOT_CONFIG, true);
  }

  // Upon loading a blueprint, do not use any Layout properties for any placement.
  resetDocksVerticalAppliedToCurrentPlan();
  setBlueprintModeActive(true, viewer);
  setAllPillsToDefault();
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

      // 2. Remove Order of Layout from Decorator Palette (functionality moved outside "Layout" text as Blueprint checkbox)
      parsed = parsed.filter(v => v.id !== 'order-of-layout' && !(v.name && v.name.toLowerCase().includes('order of layout')));

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

// In-memory blueprint mode state (default to true)
let isBlueprintState = true;

/**
 * Returns true if Blueprint mode is currently checked and active.
 * Checked via the "Blueprint" checkbox outside "Layout" text, storage, or in-memory state.
 */
export function isBlueprintModeActive() {
  if (typeof document !== 'undefined') {
    const bpToggle = document.getElementById('toggle-blueprint');
    if (bpToggle) {
      return !!bpToggle.checked;
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const states = JSON.parse(localStorage.getItem('x4_checkbox_states') || '{}');
      if (typeof states['toggle-blueprint'] === 'boolean') {
        return states['toggle-blueprint'];
      }
    } catch (_) {}
  }
  // Check order-of-layout in displayValues or DEFAULT_ORDER_OF_LAYOUT (backward compatibility)
  const orderVal = (typeof displayValues !== 'undefined' && Array.isArray(displayValues))
    ? displayValues.find(v => v.id === 'order-of-layout' || (v.name && v.name.toLowerCase().includes('order of layout')))
    : null;
  const targetOrder = orderVal || DEFAULT_ORDER_OF_LAYOUT;
  if (targetOrder && Array.isArray(targetOrder.checkboxes)) {
    const bpCb = targetOrder.checkboxes.find(cb =>
      cb.id === 'layout-blueprint' ||
      cb.id === 'order-blueprint' ||
      (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
      (cb.name && cb.name.toLowerCase().includes('blueprint')) ||
      cb.isDefault
    );
    if (bpCb) return !!bpCb.checked;
  }
  return isBlueprintState;
}

/**
 * Set the Blueprint mode active state (syncs DOM checkbox, storage, and viewer layout).
 */
export function setBlueprintModeActive(active, viewer = null) {
  if (viewer) {
    activeViewerInstance = viewer;
  }
  const isChecked = !!active;
  isBlueprintState = isChecked;

  if (typeof localStorage !== 'undefined') {
    try {
      const states = JSON.parse(localStorage.getItem('x4_checkbox_states') || '{}');
      states['toggle-blueprint'] = isChecked;
      localStorage.setItem('x4_checkbox_states', JSON.stringify(states));
    } catch (_) {}
  }

  if (typeof document !== 'undefined') {
    const bpToggle = document.getElementById('toggle-blueprint');
    if (bpToggle && bpToggle.checked !== isChecked) {
      bpToggle.checked = isChecked;
    }
  }

  // Also update order-of-layout if present in displayValues or DEFAULT_ORDER_OF_LAYOUT
  const orderVal = (typeof displayValues !== 'undefined' && Array.isArray(displayValues))
    ? displayValues.find(v => v.id === 'order-of-layout')
    : null;
  const targetOrder = orderVal || DEFAULT_ORDER_OF_LAYOUT;
  if (targetOrder && Array.isArray(targetOrder.checkboxes)) {
    const bpCb = targetOrder.checkboxes.find(cb =>
      cb.id === 'layout-blueprint' ||
      cb.id === 'order-blueprint' ||
      (cb.behaviorKey && cb.behaviorKey.toLowerCase().includes('blueprint')) ||
      (cb.name && cb.name.toLowerCase().includes('blueprint')) ||
      cb.isDefault
    );
    if (bpCb) {
      bpCb.checked = isChecked;
      if (isChecked) {
        targetOrder.checkboxes.forEach(cb => {
          if (cb !== bpCb) cb.checked = false;
        });
      }
    }
  }

  const targetViewer = viewer || activeViewerInstance;
  if (isChecked) {
    if (targetViewer && typeof targetViewer.applyLayoutBehavior === 'function') {
      targetViewer.applyLayoutBehavior('blueprint', 'Blueprint');
      if (!targetViewer.planLoading) {
        if (typeof targetViewer.fitCameraToStation === 'function') {
          targetViewer.fitCameraToStation();
        }
        if (typeof targetViewer.renderScene === 'function') {
          targetViewer.renderScene();
        }
      }
    }
  } else {
    if (targetViewer && typeof targetViewer.applyLayoutBehavior === 'function') {
      if (targetViewer.lastLayoutArgs && !targetViewer.lastLayoutArgs.key.includes('blueprint')) {
        targetViewer.applyLayoutBehavior(targetViewer.lastLayoutArgs.key, targetViewer.lastLayoutArgs.name, targetViewer.lastLayoutArgs.activeEntries);
      } else {
        targetViewer.applyLayoutBehavior('clusters', 'Category Clusters');
      }
      if (!targetViewer.planLoading && typeof targetViewer.renderScene === 'function') {
        targetViewer.renderScene();
      }
    }
  }

  if (typeof document !== 'undefined') {
    renderDisplayPanel();
  }
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
  let valueObj = displayValues.find(v => v.id === valueId);
  if (!valueObj && valueId === 'order-of-layout') {
    valueObj = DEFAULT_ORDER_OF_LAYOUT;
  }
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
        setBlueprintModeActive(true, activeViewerInstance);
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
        setBlueprintModeActive(false, activeViewerInstance);
      }

      // If user unchecked this checkbox and none remain checked, fallback to default (Blueprint)
      const anyChecked = checkboxes.some(cb => cb.checked);
      if (!anyChecked) {
        const def = checkboxes.find(cb => cb.isDefault) || checkboxes[0];
        if (def) {
          def.checked = true;
          setAllPillsToDefault(displayValues);
          setBlueprintModeActive(true, activeViewerInstance);
          reloadBlueprintName();
        }
      }
    } else if (valueId === 'layout-mode') {
      if (clickedCb.checked) {
        // Single selection in layout-mode
        checkboxes.forEach((cb, idx) => {
          if (idx !== triggeredIndex) cb.checked = false;
        });
        // Uncheck Blueprint checkbox when an explicit layout mode is selected!
        setBlueprintModeActive(false, activeViewerInstance);
      } else {
        const anyChecked = checkboxes.some(cb => cb.checked);
        if (!anyChecked) {
          // If all layout modes unchecked, fallback to Blueprint
          setBlueprintModeActive(true, activeViewerInstance);
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
 * Sort an array of modules according to the current Layers category order, piers first: Layout
 * placement places the piers before anything else, so the rest fits around them and their zones.
 */
export function sortModulesByLayerCategoryOrder(modules, layerOrder = null) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  return StationLayoutEngine.sortByCategoryOrder(modules, layerOrder || getLayerPlacementCategoryOrder(), moduleCategoryOf, isPierModule);
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
 * When using the gizmo to move a module, insure the moved module doesn't overlap
 * another module BB. If it does and doesn't move out of the overlap, open release
 * of the gizmo, move the moving module outside of the overlap.
 *
 * @param {object} movingModule - The module (Three.js Object3D or plan module) being moved
 * @param {Array<object>} stationaryModules - Other modules in the station
 * @param {object} [plotConfig] - Current plot boundaries / config
 * @param {object} [options] - Options { gap, fromPos, dragAxis, getSize, applyToObject }
 * @returns {{ moved: boolean, resolved: boolean, position: { x: number, y: number, z: number } }}
 */
export function moveMovingModuleOutsideOverlap(movingModule, stationaryModules, plotConfig = null, options = {}) {
  const pConfig = plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
  const opts = {
    ...options,
    getSize: options.getSize || options.getModuleSize || ((m) => {
      if (m.initialSize) return m.initialSize;
      if (m.userData?.initialSize) return m.userData.initialSize;
      const macro = m.userData?.macro || m.macro || m.key || '';
      const arr = getInitialModuleSize(macro);
      return { x: arr[0], y: arr[1], z: arr[2] };
    })
  };
  return StationLayoutEngine.moveMovingModuleOutsideOverlap(movingModule, stationaryModules, pConfig, opts);
}

export const DOCKS_VERTICAL_STORAGE_KEY = 'x4_docks_vertical_orientation';
let currentDocksVerticalOrientation = null;
let isDocksVerticalApplied = false;

/**
 * Check if docks vertical orientation has already been applied to the current plan.
 */
export function isDocksVerticalAppliedToCurrentPlan() {
  return isDocksVerticalApplied;
}

/**
 * Reset vertical orientation application flag when a new blueprint/plan is loaded.
 */
export function resetDocksVerticalAppliedToCurrentPlan() {
  isDocksVerticalApplied = false;
}

/**
 * Mark docks vertical orientation as applied or not for current plan.
 */
export function setDocksVerticalAppliedToCurrentPlan(applied = true) {
  isDocksVerticalApplied = !!applied;
}

/**
 * Get current vertical orientation for dock modules within plot bounding box.
 * @returns {'top'|'center'|'bottom'}
 */
export function getDocksVerticalOrientation() {
  if (currentDocksVerticalOrientation && ['top', 'center', 'bottom'].includes(currentDocksVerticalOrientation)) {
    return currentDocksVerticalOrientation;
  }
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(DOCKS_VERTICAL_STORAGE_KEY);
    if (saved && ['top', 'center', 'bottom'].includes(saved)) {
      currentDocksVerticalOrientation = saved;
      return saved;
    }
  }
  return 'top';
}

/**
 * Set vertical orientation for dock modules within plot bounding box and re-apply layout/orientation.
 * @param {'top'|'center'|'bottom'} val
 * @param {object} [viewer]
 */
export function setDocksVerticalOrientation(val, viewer = null) {
  if (!['top', 'center', 'bottom'].includes(val)) return;
  currentDocksVerticalOrientation = val;
  isDocksVerticalApplied = true;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DOCKS_VERTICAL_STORAGE_KEY, val);
  }
  const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
  if (v) {
    const perimeterSelections = getDocksPerimeterSelections();
    if (perimeterSelections.size > 0) {
      applyDocksPerimeterPlacement(perimeterSelections, v);
    } else {
      applyDocksVerticalOrientation(val, v);
    }
    if (!isBlueprintModeActive() && typeof v.applyAlignmentBehavior === 'function' && v.activeAlignmentBehavior) {
      v.applyAlignmentBehavior(v.activeAlignmentBehavior.key, v.activeAlignmentBehavior.name, v.activeAlignmentBehavior.activeEntries);
    }
  }
}

export const DOCKS_PERIMETER_STORAGE_KEY = 'x4_docks_perimeter_selections';
let currentDocksPerimeterSelections = new Set();

/**
 * Get current active Perimeter multi-selections (Set of 'lanes' | 'stacked' | 'spread').
 * @returns {Set<string>}
 */
export function getDocksPerimeterSelections() {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(DOCKS_PERIMETER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          currentDocksPerimeterSelections = new Set(parsed.filter(x => ['lanes', 'stacked', 'spread'].includes(x)));
          return new Set(currentDocksPerimeterSelections);
        }
      }
    } catch (_) {}
  }
  return new Set(currentDocksPerimeterSelections);
}

/**
 * Set active Perimeter multi-selections and apply to docks placement.
 * @param {Array<string>|Set<string>} selections
 * @param {object} [viewer]
 */
export function setDocksPerimeterSelections(selections, viewer = null) {
  const arr = Array.isArray(selections) ? selections : (selections instanceof Set ? Array.from(selections) : []);
  const valid = arr.filter(x => ['lanes', 'stacked', 'spread'].includes(x));
  currentDocksPerimeterSelections = new Set(valid);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DOCKS_PERIMETER_STORAGE_KEY, JSON.stringify(valid));
  }
  const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
  if (v) {
    applyDocksPerimeterPlacement(currentDocksPerimeterSelections, v);
  }
}

/**
 * Clear all Perimeter multi-selections and reset docks placement.
 * @param {object} [viewer]
 */
export function clearDocksPerimeterSelections(viewer = null) {
  currentDocksPerimeterSelections.clear();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DOCKS_PERIMETER_STORAGE_KEY);
  }
  const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
  if (v) {
    applyDocksPerimeterPlacement(new Set(), v);
  }
}

/**
 * Helper to identify pier modules.
 */
export function isPierModule(moduleOrMacro) {
  if (!moduleOrMacro) return false;
  const macro = (typeof moduleOrMacro === 'string' ? moduleOrMacro : (moduleOrMacro.userData?.macro || moduleOrMacro.macro || '')).toLowerCase();
  return macro.includes('pier');
}

/**
 * Helper to identify geometryinvisible and clearance components of modules.
 */
export function isGeometryInvisibleComponent(child, isPier = false) {
  if (!child) return false;
  if (child.userData && (child.userData.isGeometryInvisible || child.userData.isBBox)) return true;

  let curr = child;
  while (curr) {
    if (curr.userData && (curr.userData.isGeometryInvisible || curr.userData.isBBox)) return true;
    if (curr.userData && curr.userData.partName) {
      const pn = String(curr.userData.partName).toLowerCase();
      if (pn.includes('geometryinvisible') || pn.includes('bounding_box') || pn.includes('bbox')) return true;
    }
    if (curr.name) {
      const cn = String(curr.name).toLowerCase();
      if (cn.includes('geometryinvisible') || cn.includes('geometry_invisible')) return true;
      if (isPier && (cn.includes('bounding_box') || cn.includes('boundingbox') || cn.includes('bbox') || cn.includes('invisible'))) return true;
    }
    curr = curr.parent;
  }

  const namesToCheck = [];
  if (child.name) namesToCheck.push(child.name.toLowerCase());
  if (child.parent && child.parent.name) namesToCheck.push(child.parent.name.toLowerCase());
  if (child.userData) {
    if (child.userData.partName) namesToCheck.push(String(child.userData.partName).toLowerCase());
    if (child.userData.sourceUrl) namesToCheck.push(String(child.userData.sourceUrl).toLowerCase());
  }
  if (child.material) {
    if (Array.isArray(child.material)) {
      child.material.forEach(m => { if (m.name) namesToCheck.push(m.name.toLowerCase()); });
    } else if (child.material.name) {
      namesToCheck.push(child.material.name.toLowerCase());
    }
  }

  const invisibleKeywords = ['geometryinvisible', 'geometry_invisible', 'invisible'];
  if (isPier) {
    invisibleKeywords.push('bounding_box', 'boundingbox', 'bbox', 'collision', 'collision_box', 'collisionbox');
  }

  for (const name of namesToCheck) {
    for (const kw of invisibleKeywords) {
      if (name.includes(kw)) return true;
    }
  }

  return false;
}

/**
 * Computes the world bounding box of all invisible / clearance geometries for a dock or pier.
 */
export function getDockInvisibleWorldBoundingBox(moduleObj, viewer = null) {
  if (!moduleObj) return null;
  const isPier = isPierModule(moduleObj);
  let box = null;
  let hasInvis = false;

  const createBox = () => {
    return {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
      isEmpty() { return this.min.x > this.max.x; },
      intersectsBox(other) {
        return this.max.x >= other.min.x && this.min.x <= other.max.x &&
               this.max.y >= other.min.y && this.min.y <= other.max.y &&
               this.max.z >= other.min.z && this.min.z <= other.max.z;
      },
      union(other) {
        this.min.x = Math.min(this.min.x, other.min.x);
        this.min.y = Math.min(this.min.y, other.min.y);
        this.min.z = Math.min(this.min.z, other.min.z);
        this.max.x = Math.max(this.max.x, other.max.x);
        this.max.y = Math.max(this.max.y, other.max.y);
        this.max.z = Math.max(this.max.z, other.max.z);
      }
    };
  };

  if (typeof moduleObj.traverse === 'function') {
    moduleObj.traverse(child => {
      if (child.isMesh) {
        const checkFn = (viewer && typeof viewer.isGeometryInvisibleComponent === 'function')
          ? viewer.isGeometryInvisibleComponent
          : isGeometryInvisibleComponent;
        if (checkFn(child, true) || (child.userData && (child.userData.isGeometryInvisible || child.userData.isBBox))) {
          if (child.geometry) {
            if (!child.geometry.boundingBox && typeof child.geometry.computeBoundingBox === 'function') {
              child.geometry.computeBoundingBox();
            }
            if (child.geometry.boundingBox) {
              if (typeof child.updateMatrixWorld === 'function') child.updateMatrixWorld(true);
              const geomBox = child.geometry.boundingBox.clone ? child.geometry.boundingBox.clone() : { ...child.geometry.boundingBox };
              if (typeof geomBox.applyMatrix4 === 'function' && child.matrixWorld) {
                geomBox.applyMatrix4(child.matrixWorld);
              } else {
                const px = (child.position?.x ?? 0) + (moduleObj.position?.x ?? 0);
                const py = (child.position?.y ?? 0) + (moduleObj.position?.y ?? 0);
                const pz = (child.position?.z ?? 0) + (moduleObj.position?.z ?? 0);
                geomBox.min = { x: geomBox.min.x + px, y: geomBox.min.y + py, z: geomBox.min.z + pz };
                geomBox.max = { x: geomBox.max.x + px, y: geomBox.max.y + py, z: geomBox.max.z + pz };
              }
              if (!box) box = createBox();
              box.union(geomBox);
              hasInvis = true;
            }
          }
        }
      }
    });
  }

  if (!hasInvis && moduleObj.userData?.invisibleBoundingBox) {
    return moduleObj.userData.invisibleBoundingBox;
  }

  return (hasInvis && box && !box.isEmpty()) ? box : null;
}

/**
 * Insures no docks invisible geometries bounding boxes overlap.
 */
export function ensureNoDocksInvisibleOverlap(dockModules, plotBounds, viewer = null) {
  if (!dockModules || dockModules.length < 2) return;
  const gap = 50;

  for (let iter = 0; iter < 10; iter++) {
    let anyResolved = false;

    for (let i = 0; i < dockModules.length; i++) {
      for (let j = i + 1; j < dockModules.length; j++) {
        const modA = dockModules[i];
        const modB = dockModules[j];
        if (typeof modA.updateMatrixWorld === 'function') modA.updateMatrixWorld(true);
        if (typeof modB.updateMatrixWorld === 'function') modB.updateMatrixWorld(true);

        const boxA = getDockInvisibleWorldBoundingBox(modA, viewer);
        const boxB = getDockInvisibleWorldBoundingBox(modB, viewer);

        if (boxA && boxB && boxA.intersectsBox(boxB)) {
          const overlapX = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
          const overlapZ = Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z);

          // For approach lanes, separate along horizontal axis (X or Z)
          if (overlapX <= overlapZ) {
            const shiftAmountX = overlapX + gap;
            const dirX = (modA.position?.x ?? 0) <= (modB.position?.x ?? 0) ? -1 : 1;
            if (modA.position) modA.position.x += dirX * (shiftAmountX / 2);
            if (modB.position) modB.position.x -= dirX * (shiftAmountX / 2);
          } else {
            const shiftAmountZ = overlapZ + gap;
            const dirZ = (modA.position?.z ?? 0) <= (modB.position?.z ?? 0) ? -1 : 1;
            if (modA.position) modA.position.z += dirZ * (shiftAmountZ / 2);
            if (modB.position) modB.position.z -= dirZ * (shiftAmountZ / 2);
          }

          if (typeof modA.updateMatrixWorld === 'function') modA.updateMatrixWorld(true);
          if (typeof modB.updateMatrixWorld === 'function') modB.updateMatrixWorld(true);
          anyResolved = true;
        }
      }
    }

    if (!anyResolved) break;
  }
}

const LANE_FACTIONS = ['_arg_', '_par_', '_tel_', '_spl_', '_ter_', '_bor_'];

/**
 * Horizontal lane direction of a pier in X4 component space ({x, z}, unit), or null when the pier
 * has none (hubs with bays all around). Data: src/pier-lane-directions.json (generate_pier_lanes.js).
 * @param {string} macro
 */
export function getPierLaneDirection(macro) {
  return lookupPierTable(PIER_LANE_DIRECTIONS, macro);
}

/** A pier's entry in a per-pier table, or the same pier shape's under another faction's name. */
function lookupPierTable(table, macro) {
  const key = String(macro || '').toLowerCase().trim().replace(/_macro$/, '');
  if (!key.startsWith('pier_')) return null;
  if (key in table) return table[key];
  for (const fac of LANE_FACTIONS) {
    if (!key.includes(fac)) continue;
    for (const alt of LANE_FACTIONS) {
      const altKey = key.replace(fac, alt);
      if (alt !== fac && altKey in table) return table[altKey];
    }
  }
  return null;
}

function rotateVectorByQuaternion(v, q) {
  // v' = q v q^-1, expanded
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
  };
}

/**
 * Horizontal scene (three.js) direction a placed pier's lanes run, or null.
 * @param {object} mod pier module group
 */
export function getPierLaneWorldDirection(mod) {
  const lane = getPierLaneDirection(mod?.userData?.macro || mod?.macro);
  if (!lane) return null;
  // X4 component space -> module mesh space mirrors X (same mirror as the component offsets)
  const local = { x: -lane.x, y: 0, z: lane.z };
  const q = mod.quaternion;
  const v = q ? rotateVectorByQuaternion(local, q) : local;
  const len = Math.hypot(v.x, v.z);
  // A pier pitched or rolled onto its side has no horizontal lane to turn
  if (len < 0.2) return null;
  return { x: v.x / len, z: v.z / len };
}

/**
 * Outward normal ({x, z}) of the plot wall nearest a scene position.
 */
export function nearestPlotWallNormal(pos, plotBounds) {
  const walls = [
    { d: plotBounds.maxX - pos.x, n: { x: 1, z: 0 } },
    { d: pos.x - plotBounds.minX, n: { x: -1, z: 0 } },
    { d: plotBounds.maxZ - pos.z, n: { x: 0, z: 1 } },
    { d: pos.z - plotBounds.minZ, n: { x: 0, z: -1 } }
  ];
  return walls.reduce((best, w) => (w.d < best.d - 1e-6 ? w : best)).n;
}

/**
 * Yaw every pier so its docking lanes point out of the plot bounding box, through the plot wall
 * nearest the pier, and record the new rotation in the plan. A pier whose lanes are not level (tilted,
 * or on its side) is levelled first, keeping its heading.
 * @param {Array<object>} modules module groups (non-piers are ignored)
 * @param {object} plotBounds
 * @param {object} [viewer]
 * @param {(mod: object) => ({x: number, z: number}|null)} [wallNormalFor] the wall a module's lanes
 *   must go through when it has been assigned one; otherwise the plot wall nearest it
 * @returns {number} how many piers were turned
 */
export function orientPierLanesOutward(modules, plotBounds, viewer = null, wallNormalFor = null) {
  let turned = 0;
  (modules || []).forEach(mod => {
    if (!mod || mod.visible === false || !isPierModule(mod)) return;
    // Lanes not level (a pier tilted or on its side): level the pier, keeping its heading, so its
    // lanes and exclusion zones run out through a wall rather than through the station
    const lane = getPierLaneDirection(mod?.userData?.macro || mod?.macro);
    let levelled = false;
    if (lane && mod.quaternion && mod.rotation && typeof mod.rotation.set === 'function') {
      const v = rotateVectorByQuaternion({ x: -lane.x, y: 0, z: lane.z }, mod.quaternion);
      if (Math.abs(v.y) > 0.01) {
        const xAxis = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, mod.quaternion);
        const zAxis = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, mod.quaternion);
        const heading = Math.hypot(xAxis.x, xAxis.z) > 0.2 ? Math.atan2(-xAxis.z, xAxis.x) : Math.atan2(zAxis.x, zAxis.z);
        mod.rotation.set(0, heading, 0);
        if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
        levelled = true;
      }
    }
    const dir = getPierLaneWorldDirection(mod);
    if (!dir) {
      if (!levelled) return;
    } else {
      const out = (wallNormalFor && wallNormalFor(mod)) || nearestPlotWallNormal(mod.position || { x: 0, z: 0 }, plotBounds);
      // Rotation about +Y by theta takes the vector at angle atan2(x, z) to angle + theta
      let theta = Math.atan2(out.x, out.z) - Math.atan2(dir.x, dir.z);
      theta = Math.atan2(Math.sin(theta), Math.cos(theta));
      if (Math.abs(theta) < 1e-4 && !levelled) return;

      if (typeof mod.rotateOnWorldAxis === 'function' && mod.up?.constructor) {
        const yAxis = new mod.up.constructor(0, 1, 0);
        mod.rotateOnWorldAxis(yAxis, theta);
      } else if (mod.rotation) {
        mod.rotation.y = (mod.rotation.y || 0) + theta;
      }
    }
    if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
    turned++;

    const index = mod.userData?.index;
    const planMod = viewer?.currentPlan?.modules?.find(m => m.index === index);
    const rot = (planMod && typeof viewer.getModuleCalculatedRotation === 'function')
      ? viewer.getModuleCalculatedRotation(index, { decimals: 3 })
      : null;
    if (planMod && rot) {
      planMod.rotation = { ...(planMod.rotation || {}), yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll };
    }
  });
  return turned;
}

/** World box of a module as rendered (lanes excluded), or its catalog size around its position. */
function moduleWorldBox(mod, viewer) {
  if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
  const b = typeof viewer?.getModuleWorldBoundingBox === 'function' ? viewer.getModuleWorldBoundingBox(mod) : null;
  if (b && !(typeof b.isEmpty === 'function' && b.isEmpty())) {
    return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } };
  }
  const s = (viewer?.getModuleInitialSize ? viewer.getModuleInitialSize(mod) : null) || defaultModuleSize(mod) || { x: 100, y: 100, z: 100 };
  const p = mod.position || { x: 0, y: 0, z: 0 };
  return {
    min: { x: p.x - s.x / 2, y: p.y - s.y / 2, z: p.z - s.z / 2 },
    max: { x: p.x + s.x / 2, y: p.y + s.y / 2, z: p.z + s.z / 2 }
  };
}

function translateModule(mod, dx, dy, dz) {
  if (!mod.position) return;
  if (typeof mod.position.set === 'function') mod.position.set(mod.position.x + dx, mod.position.y + dy, mod.position.z + dz);
  else { mod.position.x += dx; mod.position.y += dy; mod.position.z += dz; }
  if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
}

/**
 * Perimeter placement for pier types the station has more than one of (e.g. four
 * pier_arg_harbor_01; dock areas are never stacked).
 *
 * Types choose walls in order of how many piers they have, the most first. A type with more than
 * two piers takes the narrowest plot wall still free to itself: as many as fit there with their
 * exclusion zones apart (levels up the wall; columns along it, one column for a type whose side
 * prongs' zones run along the wall) are placed the first at the docks Vertical Orientation's level
 * (top, middle or bottom), each next one as far from those placed as the remaining placements and
 * the space left allow (only the pier's own BB limits how near the top and bottom of the plot it
 * goes; its zones may reach past them); the rest go on that wall wherever no pier's box touches
 * another pier's exclusion zones, as far from the others as possible (their zones may overlap each
 * other, never a box); one with no such place is left to the zone clean-up, not kept as stacked.
 *
 * A type with two piers goes to the smallest plot wall that still has room for it, its
 * modules stacked vertically on that wall, each separated from the next by its own BB height plus
 * `gap`; a pier's BB here takes in its prongs' exclusion zones (pierZoneSlotBox), so stacked and
 * side-by-side piers stay out of each other's zones. A type with prongs facing along the wall (whose
 * zones run along it to the corners) takes a whole wall to itself, its columns centred on it.
 * Piers' lanes point out through that wall. Stacks start at the top, bottom or middle of the plot
 * per the docks vertical orientation, only a pier's own BB limiting how near the top or bottom it
 * goes (its zones may reach past); a type taller than the plot continues in further columns
 * along the wall. Types sharing a wall sit side by side, centred along it.
 *
 * Boxes are the modules as rendered (lane and invisible clearance volumes excluded).
 * @param {Array<object>} dockModules
 * @param {object} plotBounds getPlotBoundingBox result
 * @param {object} [viewer]
 * @param {{ orient?: 'top'|'center'|'bottom', gap?: number }} [options]
 * @returns {Set<object>} the modules placed in stacks
 */
export function stackRepeatedDockTypes(dockModules, plotBounds, viewer = null, { orient = 'top', gap = 15 } = {}) {
  const stacked = new Set();
  for (const mod of dockModules || []) if (mod?.userData) delete mod.userData.perimeterStacked;
  const byMacro = new Map();
  for (const mod of dockModules || []) {
    // Only piers stack; dock areas keep the ordinary placement
    if (!mod || mod.visible === false || !isPierModule(mod)) continue;
    const macro = String(mod.userData?.macro || mod.macro || '').toLowerCase();
    if (!macro) continue;
    if (!byMacro.has(macro)) byMacro.set(macro, []);
    byMacro.get(macro).push(mod);
  }
  const groups = [...byMacro.values()].filter(g => g.length > 1);
  if (groups.length === 0) return stacked;

  const pb = plotBounds;
  const centerY = pb.centerY !== undefined ? pb.centerY : (pb.minY + pb.maxY) / 2;
  const plotHeight = pb.maxY - pb.minY;
  // Smallest wall first; a tie keeps this order
  const walls = [
    { normal: { x: 1, z: 0 }, along: 'z', length: pb.maxZ - pb.minZ },
    { normal: { x: -1, z: 0 }, along: 'z', length: pb.maxZ - pb.minZ },
    { normal: { x: 0, z: 1 }, along: 'x', length: pb.maxX - pb.minX },
    { normal: { x: 0, z: -1 }, along: 'x', length: pb.maxX - pb.minX }
  ].map((w, i) => ({ ...w, order: i, used: 0, columns: [] }))
    .sort((a, b) => a.length - b.length || a.order - b.order);

  // Put a module against a wall at its middle, lanes out through it, and measure it there
  const presentToWall = (mod, wall) => {
    if (mod.position) {
      const x = wall.along === 'x' ? pb.centerX : (wall.normal.x > 0 ? pb.maxX : pb.minX);
      const z = wall.along === 'z' ? pb.centerZ : (wall.normal.z > 0 ? pb.maxZ : pb.minZ);
      translateModule(mod, x - mod.position.x, 0, z - mod.position.z);
    }
    orientPierLanesOutward([mod], pb, viewer, () => wall.normal);
    const b = pierZoneSlotBox(mod, viewer);
    // A prong facing along the wall (a T pier's side prongs) has its exclusion zone run along the wall
    // to the plot's corners: that type needs the whole wall to itself
    const alongWall = isPierModule(mod) && pierClampsInScene(mod).some(({ d }) => Math.abs(wall.along === 'x' ? d.x : d.z) > 0.3);
    const own = moduleWorldBox(mod, viewer);
    return { along: wall.along === 'x' ? b.max.x - b.min.x : b.max.z - b.min.z, height: b.max.y - b.min.y, ownHeight: own.max.y - own.min.y, alongWall };
  };
  // How many of a type fit up the wall with zones apart: the end piers' own boxes reach the plot's
  // top and bottom (their zones may reach past), each next pier a zone height + gap further
  const fitUpWall = (sizes) => {
    const height = Math.max(...sizes.map(s => s.height));
    const ownHeight = Math.max(...sizes.map(s => s.ownHeight));
    return Math.max(1, 1 + Math.floor((plotHeight - ownHeight) / (height + gap) + 1e-9));
  };
  const columnsAlong = (sizes, wall) => sizes.some(s => s.alongWall) ? wall.length : Math.max(...sizes.map(s => s.along));

  // A stack is one shape repeated: every module of a type gets the same level rotation (the first
  // one's heading, no pitch or roll), so piers' lanes are horizontal and can face the wall
  for (const group of groups) {
    const q = group[0].quaternion;
    if (!q || !group[0].rotation || typeof group[0].rotation.set !== 'function') continue;
    const xAxis = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, q);
    const heading = Math.hypot(xAxis.x, xAxis.z) > 1e-6 ? Math.atan2(-xAxis.z, xAxis.x) : 0;
    for (const mod of group) {
      mod.rotation.set(0, heading, 0);
      if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
    }
  }

  // The type with the most piers chooses first; among types with as many, the largest footprint, so
  // the big types get the walls they fit on
  const footprint = (g) => { const b = pierZoneSlotBox(g[0], viewer); return Math.max(b.max.x - b.min.x, b.max.z - b.min.z); };
  groups.sort((a, b) => (b.length - a.length) || (footprint(b) - footprint(a)));

  // A type with more than two piers claims the narrowest wall still free: as many as fit with their
  // exclusion zones apart go there, spread as far apart as the wall allows; the rest go where on
  // that wall no pier's box touches another's zones (their zones may overlap each other)
  for (const group of groups.filter(g => g.length > 2)) {
    const wall = walls.find(w => w.used === 0 && !w.claimed);
    if (!wall) break;
    const unplaced = new Set(spreadOnWall(group, wall));
    wall.claimed = true;
    wall.used = wall.length;
    group.forEach(m => { if (!unplaced.has(m)) stacked.add(m); });
    group.spread = true;
  }

  function spreadOnWall(group, wall) {
    const sizes = group.map(m => presentToWall(m, wall));
    const alongWall = sizes.some(s => s.alongWall);
    const slotAlong = Math.max(...sizes.map(s => s.along));
    const slotHeight = Math.max(...sizes.map(s => s.height));
    const lo = wall.along === 'x' ? pb.minX : pb.minZ;
    const hi = lo + wall.length;
    const k = wall.along;
    // Levels up the wall: the first placement where the docks Vertical Orientation puts it (top,
    // middle or bottom of the room); the rest split above and below it so the spacing is as wide as
    // the remaining placements and the space left allow, each zone-height + gap apart at least.
    // Levels are the piers' own box centres: only the module's BB limits how close to the top and
    // bottom of the plot a pier goes (its zones may reach past them), leaving the most room between
    const ownHeight = Math.max(...group.map(m => { const b = moduleWorldBox(m, viewer); return b.max.y - b.min.y; }));
    const yLo = pb.minY + ownHeight / 2, yHi = pb.maxY - ownHeight / 2;
    // (piers taller than the plot: one level, the pier's own box kept inside by moveTo)
    const y0 = orient === 'bottom' ? yLo : orient === 'center' ? centerY : yHi;
    const step = slotHeight + gap;
    const capAbove = yHi < yLo ? 0 : Math.floor((yHi - y0) / step + 1e-9), capBelow = yHi < yLo ? 0 : Math.floor((y0 - yLo) / step + 1e-9);
    const levelsFor = (count) => {
      const k = count - 1;
      let best = null;
      for (let a = Math.max(0, k - capBelow); a <= Math.min(capAbove, k); a++) {
        const b = k - a;
        const sp = Math.min(a ? (yHi - y0) / a : Infinity, b ? (y0 - yLo) / b : Infinity);
        if (!best || sp > best.sp + 1e-6 || (Math.abs(sp - best.sp) <= 1e-6 && Math.abs(a - b) < Math.abs(best.a - best.b))) best = { a, b, sp };
      }
      const above = Array.from({ length: best.a }, (_, i) => y0 + (yHi - y0) * (i + 1) / best.a);
      const below = Array.from({ length: best.b }, (_, i) => y0 - (y0 - yLo) * (i + 1) / best.b);
      // Placement order: the first, then each next the level farthest from those already placed
      const order = [y0];
      const left = [...above, ...below];
      while (left.length) {
        let bi = 0, bd = -1;
        left.forEach((y, i) => { const d = Math.min(...order.map(o => Math.abs(o - y))); if (d > bd + 1e-6) { bd = d; bi = i; } });
        order.push(left.splice(bi, 1)[0]);
      }
      return order;
    };
    // How many fit with zones apart: levels up the wall, and columns along it (one column for a type
    // whose side prongs' zones run along the wall)
    const rowsMax = 1 + capAbove + capBelow;
    const colsMax = alongWall ? 1 : Math.max(1, Math.floor((wall.length + gap) / (slotAlong + gap)));
    const nFit = Math.min(group.length, rowsMax * colsMax);
    const cols = Math.min(colsMax, nFit);
    const rows = Math.ceil(nFit / cols);
    // Columns spread to the ends of the wall: the first and last at its edges, the rest evenly between
    const spread = (n, from, to, single) => n === 1 ? [single] : Array.from({ length: n }, (_, i) => from + (to - from) * i / (n - 1));
    const alongCs = spread(cols, lo + slotAlong / 2, hi - slotAlong / 2, (lo + hi) / 2);
    const yCs = levelsFor(rows);

    // Moves a module so its `box` (slot or own) is centred at alongC along the wall and its own box at
    // height yC, its own face on the wall
    const moveTo = (mod, alongC, yC, boxOf) => {
      const b = boxOf(mod);
      const face = moduleWorldBox(mod, viewer);
      const toWall = k === 'z'
        ? (wall.normal.x > 0 ? pb.maxX - face.max.x : pb.minX - face.min.x)
        : (wall.normal.z > 0 ? pb.maxZ - face.max.z : pb.minZ - face.min.z);
      const dAlong = alongC - (b.min[k] + b.max[k]) / 2;
      const dy = yC - (face.min.y + face.max.y) / 2;
      if (k === 'z') translateModule(mod, toWall, dy, dAlong);
      else translateModule(mod, dAlong, dy, toWall);
      const own = moduleWorldBox(mod, viewer);
      const fixY = own.min.y < pb.minY ? pb.minY - own.min.y : (own.max.y > pb.maxY ? pb.maxY - own.max.y : 0);
      if (fixY) translateModule(mod, 0, fixY, 0);
    };
    const slotOf = (m) => pierZoneSlotBox(m, viewer);
    const ownOf = (m) => moduleWorldBox(m, viewer);

    const placed = [];
    group.slice(0, nFit).forEach((mod, i) => {
      moveTo(mod, alongCs[i % cols], yCs[Math.floor(i / cols)], slotOf);
      placed.push(mod);
    });

    // The rest: wherever on the wall no box touches another pier's exclusion zones (neither this
    // pier's box in a placed pier's zones nor a placed pier's box in this one's), as far from the
    // others as possible. Their zones may overlap each other; boxes and zones never. A pier with no
    // such place on the wall is left to the caller (clearPierProngCorridors) and not kept as stacked.
    const centre = (b) => ({ a: (b.min[k] + b.max[k]) / 2, y: (b.min.y + b.max.y) / 2 });
    const zonesOf = (m) => [pierZoneSlotBox(m, viewer), ...getPierProngCorridors(m, pb, viewer)];
    const hit = (p, q) =>
      Math.min(p.max.x, q.max.x) - Math.max(p.min.x, q.min.x) > -gap + 1e-3 &&
      Math.min(p.max.y, q.max.y) - Math.max(p.min.y, q.min.y) > -gap + 1e-3 &&
      Math.min(p.max.z, q.max.z) - Math.max(p.min.z, q.min.z) > -gap + 1e-3;
    const shift = (bx, dA, dY) => ({
      min: { ...bx.min, [k]: bx.min[k] + dA, y: bx.min.y + dY },
      max: { ...bx.max, [k]: bx.max[k] + dA, y: bx.max.y + dY }
    });
    const minDist = (c) => Math.min(...placed.map(p => { const o = centre(ownOf(p)); return Math.hypot(o.a - c.a, o.y - c.y); }));
    const unplaced = [];
    const STEP = 100;
    for (const mod of group.slice(nFit)) {
      moveTo(mod, alongCs[0], yCs[0], ownOf);
      const own = ownOf(mod);
      const zones = zonesOf(mod);
      const c0 = centre(own);
      const w = own.max[k] - own.min[k], h = own.max.y - own.min.y;
      const placedOwn = placed.map(ownOf);
      const placedZones = placed.flatMap(zonesOf);
      let best = null;
      for (let aC = lo + w / 2; aC <= hi - w / 2 + 1e-6; aC += Math.max(STEP, 1e-3)) {
        for (let yC = pb.minY + h / 2; yC <= pb.maxY - h / 2 + 1e-6; yC += STEP) {
          const dA = aC - c0.a, dY = yC - c0.y;
          const ob = shift(own, dA, dY);
          if (placedZones.some(z => hit(ob, z))) continue;
          if (zones.some(z => placedOwn.some(o => hit(shift(z, dA, dY), o)))) continue;
          const d = minDist({ a: aC, y: yC });
          if (!best || d > best.d) best = { a: aC, y: yC, d };
        }
      }
      if (!best) { unplaced.push(mod); continue; }
      moveTo(mod, best.a, best.y, ownOf);
      placed.push(mod);
    }
    return unplaced;
  }

  for (const group of groups) {
    if (group.spread) continue;
    let chosen = null;
    for (const wall of walls) {
      if (wall.claimed) continue;
      const sizes = group.map(m => presentToWall(m, wall));
      const along = columnsAlong(sizes, wall);
      const perColumn = fitUpWall(sizes);
      const columnCount = Math.ceil(group.length / perColumn);
      const need = columnCount * along + (columnCount - 1) * gap + (wall.used > 0 ? gap : 0);
      if (wall.used + need <= wall.length + 1e-6) {
        chosen = { wall, along, perColumn, need };
        break;
      }
    }
    if (!chosen) {
      // Fits on no wall: the longest one not claimed by a spread type, overflowing it
      // (keepModulesInsidePlot pulls it back in)
      const wall = [...walls].reverse().find(w => !w.claimed) || walls[walls.length - 1];
      const sizes = group.map(m => presentToWall(m, wall));
      const along = columnsAlong(sizes, wall);
      const perColumn = fitUpWall(sizes);
      const columnCount = Math.ceil(group.length / perColumn);
      chosen = { wall, along, perColumn, need: columnCount * along + (columnCount - 1) * gap + (wall.used > 0 ? gap : 0) };
    } else {
      // The last wall tried was not necessarily this one: face the modules to the chosen wall
      group.forEach(m => presentToWall(m, chosen.wall));
    }
    const { wall, along, perColumn } = chosen;
    for (let i = 0; i < group.length; i += perColumn) wall.columns.push({ mods: group.slice(i, i + perColumn), along });
    wall.used += chosen.need;
    group.forEach(m => stacked.add(m));
  }

  // Lay each wall's columns out side by side, centred along the wall, stacked vertically
  for (const wall of walls) {
    if (wall.columns.length === 0) continue;
    const wallMid = wall.along === 'x' ? pb.centerX : pb.centerZ;
    let cursor = wallMid - wall.used / 2;
    for (const column of wall.columns) {
      // Levels are the modules' own box centres, a zone height + gap apart (zones apart); the end
      // modules' own boxes reach the plot's top or bottom, only their BB limiting how near
      const heights = column.mods.map(m => { const b = pierZoneSlotBox(m, viewer); return b.max.y - b.min.y; });
      const ownHalf = column.mods.map(m => { const b = moduleWorldBox(m, viewer); return (b.max.y - b.min.y) / 2; });
      const offsets = [0];
      for (let k = 1; k < column.mods.length; k++) offsets.push(offsets[k - 1] + (heights[k - 1] + heights[k]) / 2 + gap);
      const span = offsets[offsets.length - 1];
      const sign = orient === 'top' ? -1 : 1;
      const first = orient === 'bottom' ? pb.minY + ownHalf[0] : (orient === 'center' ? centerY - span / 2 : pb.maxY - ownHalf[0]);
      column.mods.forEach((mod, k) => {
        const b = pierZoneSlotBox(mod, viewer);
        // The module's own outer face on the wall (its prongs' zones may reach past it, out of the
        // plot, like lanes); its room (b) centred in the column's place along the wall
        const face = moduleWorldBox(mod, viewer);
        let dx = 0, dz = 0;
        if (wall.along === 'z') {
          dx = wall.normal.x > 0 ? pb.maxX - face.max.x : pb.minX - face.min.x;
          dz = cursor + (column.along - (b.max.z - b.min.z)) / 2 - b.min.z;
        } else {
          dz = wall.normal.z > 0 ? pb.maxZ - face.max.z : pb.minZ - face.min.z;
          dx = cursor + (column.along - (b.max.x - b.min.x)) / 2 - b.min.x;
        }
        const dy = first + sign * offsets[k] - (face.min.y + face.max.y) / 2;
        translateModule(mod, dx, dy, dz);
        // A pier's zones taller than the plot: its own box still stays within the plot height
        const own = moduleWorldBox(mod, viewer);
        const fixY = own.min.y < pb.minY ? pb.minY - own.min.y : (own.max.y > pb.maxY ? pb.maxY - own.max.y : 0);
        if (fixY) translateModule(mod, 0, fixY, 0);
      });
      cursor += column.along + gap;
    }
  }

  // Later zone clean-ups (e.g. after a gizmo release) leave the stacked piers where the stacking put
  // them (their zones may overlap each other's zones, never a box)
  for (const mod of stacked) if (mod.userData) mod.userData.perimeterStacked = true;

  // Record the stacked modules' rotations in the plan (positions are synced by the caller)
  if (typeof viewer?.getModuleCalculatedRotation === 'function') {
    for (const mod of stacked) {
      const planMod = viewer.currentPlan?.modules?.find(m => m.index === mod.userData?.index);
      const rot = planMod ? viewer.getModuleCalculatedRotation(mod.userData.index, { decimals: 3 }) : null;
      if (planMod && rot) planMod.rotation = { ...(planMod.rotation || {}), yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll };
    }
  }
  return stacked;
}

/**
 * Moves modules out of the space the stacked docks take: any visible module whose box (as rendered,
 * lanes excluded) overlaps a stacked module's box moves the shortest distance along X, Y or Z that
 * clears every stack, `gap` apart, with its box still inside the plot. A module with no such move
 * (a plot too full to make room) stays where it is.
 * @param {Set<object>} stacked
 * @param {Array<object>} modules
 * @param {object} plotBounds
 * @param {object} [viewer]
 * @param {number} [gap]
 * @returns {number} how many modules were moved
 */
export function clearStackedDocksSpace(stacked, modules, plotBounds, viewer = null, gap = 15) {
  if (!stacked || stacked.size === 0) return 0;
  const pb = plotBounds;
  const stackBoxes = [...stacked].map(m => moduleWorldBox(m, viewer));
  const overlaps = (a, b) =>
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > -gap + 1e-6 &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > -gap + 1e-6 &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > -gap + 1e-6;
  const shifted = (b, d) => ({
    min: { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z },
    max: { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z }
  });
  const inside = (b) => b.min.x >= pb.minX - 1e-6 && b.max.x <= pb.maxX + 1e-6 &&
    b.min.y >= pb.minY - 1e-6 && b.max.y <= pb.maxY + 1e-6 &&
    b.min.z >= pb.minZ - 1e-6 && b.max.z <= pb.maxZ + 1e-6;

  let moved = 0;
  for (const mod of modules || []) {
    if (!mod || mod.visible === false || stacked.has(mod)) continue;
    const box = moduleWorldBox(mod, viewer);
    if (!stackBoxes.some(s => overlaps(box, s))) continue;
    // Candidate moves: just past each overlapping stack box, on each side, along each axis
    const candidates = [];
    for (const s of stackBoxes) {
      if (!overlaps(box, s)) continue;
      for (const axis of ['x', 'y', 'z']) {
        candidates.push({ ...{ x: 0, y: 0, z: 0 }, [axis]: s.max[axis] + gap - box.min[axis] });
        candidates.push({ ...{ x: 0, y: 0, z: 0 }, [axis]: s.min[axis] - gap - box.max[axis] });
      }
    }
    candidates.sort((a, b) => (Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z)) - (Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.z)));
    const move = candidates.find(d => { const nb = shifted(box, d); return inside(nb) && !stackBoxes.some(s => overlaps(nb, s)); });
    if (!move) continue;
    translateModule(mod, move.x, move.y, move.z);
    moved++;
    const planMod = viewer?.currentPlan?.modules?.find(m => m.index === mod.userData?.index);
    if (planMod && planMod.position && mod.position) {
      planMod.position.x = Math.round(mod.position.x);
      planMod.position.y = Math.round(mod.position.y);
      planMod.position.z = Math.round(-mod.position.z);
    }
  }
  return moved;
}

/** Writes a module's scene position to its plan entry (plan z is scene -z). */
function syncPlanPosition(mod, viewer) {
  const planMod = viewer?.currentPlan?.modules?.find(m => m.index === mod.userData?.index);
  if (planMod && planMod.position && mod.position) {
    planMod.position.x = Math.round(mod.position.x);
    planMod.position.y = Math.round(mod.position.y);
    planMod.position.z = Math.round(-mod.position.z);
  }
}

/**
 * Side of the square exclusion zone every pier prong keeps clear, centred on the prong and running out
 * to the plot wall: 4000 m. The same size is used for the prongs of every pier.
 */
export const PIER_PRONG_ZONE_SIZE = 4000;
/** Half the side of a prong's exclusion zone. */
export const PIER_CLAMP_TUNNEL_HALF = PIER_PRONG_ZONE_SIZE / 2;

/** Docking clamps of a pier ({position, direction} in mesh space), or null. Data: src/pier-clamps.json. */
export function getPierClamps(macro) {
  return lookupPierTable(PIER_CLAMPS, macro);
}

/**
 * A pier's docking clamps in scene space, whatever the pier's orientation: `s` where the prong is,
 * `d` the unit direction ships come and go (out of the prong, tilted with the pier), `up` the prong's
 * up and `across` = d × up, a right-handed frame for its square exclusion zone.
 * @returns {Array<{s: object, d: object, up: object, across: object}>}
 */
function pierClampsInScene(pier) {
  const clamps = getPierClamps(pier?.userData?.macro || pier?.macro);
  if (!clamps || !clamps.length) return [];
  if (typeof pier.updateMatrixWorld === 'function') pier.updateMatrixWorld(true);
  let q = pier.quaternion;
  if (typeof pier.getWorldQuaternion === 'function' && q?.clone) q = pier.getWorldQuaternion(q.clone());
  const turn = (v) => (q ? rotateVectorByQuaternion(v, q) : v);
  const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const out = [];
  for (const c of clamps) {
    let s;
    if (typeof pier.localToWorld === 'function' && pier.position?.clone) {
      s = pier.localToWorld(pier.position.clone().set(...c.position));
    } else {
      const r = turn({ x: c.position[0], y: c.position[1], z: c.position[2] });
      const p = pier.position || { x: 0, y: 0, z: 0 };
      s = { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
    }
    const d = unit(turn({ x: c.direction[0], y: c.direction[1] || 0, z: c.direction[2] }));
    // The prong's up: the pier's up, square to d
    const u0 = turn({ x: 0, y: 1, z: 0 });
    const k = u0.x * d.x + u0.y * d.y + u0.z * d.z;
    const up = unit({ x: u0.x - k * d.x, y: u0.y - k * d.y, z: u0.z - k * d.z });
    const across = { x: d.y * up.z - d.z * up.y, y: d.z * up.x - d.x * up.z, z: d.x * up.y - d.y * up.x };
    out.push({ s: { x: s.x, y: s.y, z: s.z }, d, up, across });
  }
  return out;
}

/**
 * The room a module needs where docks are laid out next to and above each other: its own box (as
 * rendered, lanes excluded) and, for a pier, the square exclusion zone's cross-section at each prong
 * (PIER_PRONG_ZONE_SIZE across, centred on it), so no neighbour lands in a prong's zone.
 * @returns {{min: object, max: object}}
 */
export function pierZoneSlotBox(mod, viewer = null) {
  const b = moduleWorldBox(mod, viewer);
  if (!isPierModule(mod)) return b;
  const H = PIER_CLAMP_TUNNEL_HALF;
  for (const { s, up, across } of pierClampsInScene(mod)) {
    for (const i of [-H, H]) for (const j of [-H, H]) {
      for (const k of ['x', 'y', 'z']) {
        const v = s[k] + up[k] * i + across[k] * j;
        b.min[k] = Math.min(b.min[k], v); b.max[k] = Math.max(b.max[k], v);
      }
    }
  }
  return b;
}

/**
 * One exclusion zone per docking clamp (prong) of a pier, in scene space: a square PIER_PRONG_ZONE_SIZE
 * across, centred on the prong, running straight out the way ships come and go (the pier XML's
 * `exclusionzone ship_xl` facing) to the plot wall. A zone not along a scene axis is returned as short
 * axis-aligned pieces covering it. Null when the pier has no clamp data.
 * @returns {Array<{min: object, max: object}>|null}
 */
export function getPierClampTunnels(pier, plotBounds, viewer = null) {
  const shapes = getPierClampTunnelShapes(pier, plotBounds, viewer);
  return shapes ? shapes.flatMap(t => t.pieces) : null;
}

/**
 * The clamp tunnels of a pier (getPierClampTunnels) one per clamp, for any pier orientation, each as
 * drawn: a box `center`, `length` along `direction` (the prong's way out), `height` along `up` and
 * `width` along `across` (d × up), plus the axis-aligned `pieces` the layout checks use. Null
 * without clamp data.
 * @returns {Array<{clamp: object, direction: object, center: object, length: number, width: number, height: number, yaw: number, pieces: Array<{min: object, max: object}>}>|null}
 */
export function getPierClampTunnelShapes(pier, plotBounds, viewer = null) {
  if (!getPierClamps(pier?.userData?.macro || pier?.macro)?.length) return null;
  const pb = plotBounds;
  const H = PIER_CLAMP_TUNNEL_HALF;
  const lo = { x: pb.minX, y: pb.minY, z: pb.minZ }, hi = { x: pb.maxX, y: pb.maxY, z: pb.maxZ };
  const out = [];
  for (const { s, d, up, across } of pierClampsInScene(pier)) {
    // How far the prong's line runs before it leaves the plot (any face, the pier may be tilted); a
    // prong outside the plot, or facing out right at it, keeps one zone length ahead of it
    const inPlot = ['x', 'y', 'z'].every(k => s[k] >= lo[k] - 1e-6 && s[k] <= hi[k] + 1e-6);
    let tMax = Infinity;
    for (const k of ['x', 'y', 'z']) {
      if (Math.abs(d[k]) > 1e-9) tMax = Math.min(tMax, ((d[k] > 0 ? hi[k] : lo[k]) - s[k]) / d[k]);
    }
    const runsToWall = inPlot && tMax > 1 && isFinite(tMax);
    if (!runsToWall) tMax = PIER_PRONG_ZONE_SIZE;
    // Along the scene axes (a level pier turned in 90° steps) the zone is one box; otherwise short
    // pieces (500 m) so their boxes reach little past the zone's sides
    const axial = (v) => ['x', 'y', 'z'].filter(k => Math.abs(v[k]) > 1e-6).length === 1;
    const aligned = axial(d) && axial(up);
    const step = aligned ? tMax : Math.min(500, tMax);
    const pieces = [];
    for (let t0 = 0; t0 < tMax - 1e-6; t0 += step) {
      const t1 = Math.min(t0 + step, tMax);
      const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
      for (const t of [t0, t1]) for (const i of [-H, H]) for (const j of [-H, H]) {
        for (const k of ['x', 'y', 'z']) {
          const v = s[k] + d[k] * t + up[k] * i + across[k] * j;
          min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v);
        }
      }
      // Kept to the plot sideways (as before); a zone of a prong outside the plot stays where it is
      if (runsToWall) for (const k of ['x', 'z']) { min[k] = Math.max(lo[k], min[k]); max[k] = Math.min(hi[k], max[k]); }
      pieces.push({ min, max });
    }
    out.push({
      clamp: { x: s.x, y: s.y, z: s.z }, direction: d, up, across,
      yaw: Math.atan2(-d.z, d.x), pieces,
      center: { x: s.x + d.x * tMax / 2, y: s.y + d.y * tMax / 2, z: s.z + d.z * tMax / 2 },
      length: tMax, width: 2 * H, height: 2 * H
    });
  }
  return out;
}

/**
 * The space a pier's prongs need kept clear, in scene space: the pier's own box (as rendered, lanes
 * excluded) and a tunnel from each of its docking clamps out to the plot wall (getPierClampTunnels).
 * A pier without clamp data falls back to its box carried along its lane direction to the wall, or,
 * for a hub with bays all around, its lane volume (or its own box when it has none).
 * @returns {Array<{min: object, max: object}>}
 */
export function getPierProngCorridors(pier, plotBounds, viewer = null) {
  if (!pier || pier.visible === false || !isPierModule(pier)) return [];
  const tunnels = getPierClampTunnels(pier, plotBounds, viewer);
  if (tunnels) return [moduleWorldBox(pier, viewer), ...tunnels];
  const c = pierLaneCorridor(pier, plotBounds, viewer);
  return c ? [c] : [];
}

function pierLaneCorridor(pier, plotBounds, viewer) {
  const box = moduleWorldBox(pier, viewer);
  const dir = getPierLaneWorldDirection(pier);
  if (!dir) {
    const lane = getDockInvisibleWorldBoundingBox(pier, viewer);
    return lane ? { min: { ...lane.min }, max: { ...lane.max } } : box;
  }
  const axis = Math.abs(dir.x) >= Math.abs(dir.z) ? 'x' : 'z';
  const sign = Math.sign(axis === 'x' ? dir.x : dir.z) || 1;
  const wall = axis === 'x' ? (sign > 0 ? plotBounds.maxX : plotBounds.minX) : (sign > 0 ? plotBounds.maxZ : plotBounds.minZ);
  const c = { min: { ...box.min }, max: { ...box.max } };
  if (sign > 0) c.max[axis] = Math.max(c.max[axis], wall);
  else c.min[axis] = Math.min(c.min[axis], wall);
  return c;
}

/**
 * Keeps every pier's prongs clear out to the plot wall (getPierProngCorridors: its box and a tunnel
 * from each docking clamp) and every pier's BB out of every module: no module or pier, snapped to
 * the pier or not, may be in a pier's exclusion zones. Any other visible module whose box (as
 * rendered, lanes excluded) reaches into any of a pier's corridors moves the shortest distance
 * sideways (X or Z), else up or down, that takes it out, `gap` apart, with its box still inside the
 * plot and not onto another module: in each direction it goes on past whatever is in the way until
 * it finds room; failing that, to the nearest free place on a 1 km grid across the plot. A pier only
 * moves where its own corridors are clear, and moves itself off, or its
 * tunnels away from, a fixed module (e.g. the stacked docks), which never move, or a module in its
 * zones that found no way out. A module with no such move stays where it is. Repeats while moves
 * are made.
 * @param {Array<object>} modules
 * @param {object} plotBounds
 * @param {object} [viewer]
 * @param {{ gap?: number, isFixed?: (mod: object) => boolean }} [options]
 * @returns {number} how many moves were made
 */
export function clearPierProngCorridors(modules, plotBounds, viewer = null, { gap = 15, isFixed = () => false } = {}) {
  const pb = plotBounds;
  const visible = (modules || []).filter(m => m && m.visible !== false);
  const piers = visible.filter(m => isPierModule(m));
  if (piers.length === 0) return 0;
  const eps = 1e-3;
  const intersects = (a, b, margin = 0) =>
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > eps - margin &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > eps - margin &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > eps - margin;
  const shifted = (b, d) => ({
    min: { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z },
    max: { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z }
  });
  const inside = (b) => b.min.x >= pb.minX - 1e-6 && b.max.x <= pb.maxX + 1e-6 &&
    b.min.y >= pb.minY - 1e-6 && b.max.y <= pb.maxY + 1e-6 &&
    b.min.z >= pb.minZ - 1e-6 && b.max.z <= pb.maxZ + 1e-6;

  // Every module's box, kept current as modules move
  const boxes = new Map(visible.map(m => [m, moduleWorldBox(m, viewer)]));

  let moves = 0;
  // Modules in a pier's zones that found no way out: the pier then moves itself, as for fixed ones
  const stuck = new Set();
  // Places for the last-resort move: every FREE_SPOT_STEP across the plot
  const FREE_SPOT_STEP = 1000;
  const along = (lo, hi) => { const n = Math.max(1, Math.floor((hi - lo) / FREE_SPOT_STEP)); return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n); };
  const lines = { x: along(pb.minX, pb.maxX), y: along(pb.minY, pb.maxY), z: along(pb.minZ, pb.maxZ) };
  /** Offset to the nearest grid place (the module's own coordinates count as grid lines too, so it
   * can keep its level) whose box `ok` accepts, or null. */
  const nearestFreeSpot = (box, ok) => {
    const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    const ds = [];
    for (const x of [c.x, ...lines.x]) for (const y of [c.y, ...lines.y]) for (const z of [c.z, ...lines.z]) ds.push({ x: x - c.x, y: y - c.y, z: z - c.z });
    ds.sort((a, b) => (a.x * a.x + a.y * a.y + a.z * a.z) - (b.x * b.x + b.y * b.y + b.z * b.z));
    for (const d of ds) if (ok(shifted(box, d), d)) return d;
    return null;
  };
  for (let pass = 0; pass < 8; pass++) {
    const corridors = new Map(piers.map(p => [p, getPierProngCorridors(p, pb, viewer)]));
    let movedThisPass = 0;
    const stuckBefore = stuck.size;
    for (const mod of visible) {
      if (isFixed(mod)) continue;
      // Where this module may not be: any other pier's box or clamp tunnels (its exclusion zones),
      // also for a module snapped to that pier
      const applies = [];
      for (const [p, list] of corridors) {
        if (p === mod) continue;
        for (const b of list) applies.push({ pier: p, box: b });
      }
      const box = boxes.get(mod);
      const others = visible.filter(o => o !== mod);
      // A pier overlapping, or with a tunnel through, a module that cannot move (fixed) moves itself
      const blockedBy = [];
      if (isPierModule(mod)) {
        const own = corridors.get(mod) || [];
        for (const o of others) {
          if (!isFixed(o) && !stuck.has(o)) continue;
          const ob = boxes.get(o);
          if (intersects(box, ob)) applies.push({ pier: o, box: ob });
          else if (own.some(c => intersects(c, ob))) blockedBy.push({ pier: o, box: ob });
        }
      }
      const blocking = [...applies.filter(c => intersects(box, c.box)), ...blockedBy.map(c => ({ ...c, own: true }))];
      if (blocking.length === 0) continue;
      // A pier's own zones reach past its box: what they hit must be cleared by their cross-section
      // (the box with each prong's zone square), not by the pier's box alone
      const slotBox = isPierModule(mod) ? pierZoneSlotBox(mod, viewer) : box;
      // What a move to `nb` (offset d) would run into: corridors, other modules (fixed ones kept
      // `gap` away) and, for a pier, modules its own moved corridor would then cover
      const obstaclesAt = (nb, d) => {
        const hit = applies.filter(c => intersects(nb, c.box)).map(c => ({ box: c.box }));
        for (const o of others) if (intersects(nb, boxes.get(o), isFixed(o) ? gap : 0)) hit.push({ box: boxes.get(o) });
        if (isPierModule(mod)) {
          translateModule(mod, d.x, d.y, d.z);
          const own = getPierProngCorridors(mod, pb, viewer);
          translateModule(mod, -d.x, -d.y, -d.z);
          for (const o of others) if (own.some(c => intersects(c, boxes.get(o)))) hit.push({ box: boxes.get(o), own: true });
        }
        return hit;
      };
      // In each direction: out of the corridors, then on past whatever is in the way, until a free
      // place or the plot wall
      const sweep = (axis, sign) => {
        const past = (list) => Math.max(...list.map(({ box: o, own }) => {
          const m = own ? slotBox : box;
          return sign > 0 ? o.max[axis] + gap - m.min[axis] : m.max[axis] - (o.min[axis] - gap);
        }));
        let dist = past(blocking);
        for (let step = 0; step < 64; step++) {
          const d = { x: 0, y: 0, z: 0, [axis]: sign * dist };
          const nb = shifted(box, d);
          if (!inside(nb)) return null;
          const hit = obstaclesAt(nb, d);
          if (hit.length === 0) return d;
          const next = past(hit);
          if (!(next > dist + 1e-6)) return null;
          dist = next;
        }
        return null;
      };
      const found = [];
      for (const axis of ['x', 'z', 'y']) for (const sign of [1, -1]) { const d = sweep(axis, sign); if (d) found.push(d); }
      // Sideways first, so modules keep their level (e.g. the docks vertical orientation); up or down
      // only when no sideways move fits; the shortest move of each kind
      found.sort((a, b) => ((a.y !== 0) - (b.y !== 0)) ||
        (Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z)) - (Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.z)));
      let move = found[0];
      // No straight move (a crowded plot): the nearest free place on a grid across the plot
      if (!move) move = nearestFreeSpot(box, (nb, d) => inside(nb) && obstaclesAt(nb, d).length === 0);
      if (!move) { stuck.add(mod); continue; }
      stuck.delete(mod);
      translateModule(mod, move.x, move.y, move.z);
      boxes.set(mod, shifted(box, move));
      syncPlanPosition(mod, viewer);
      movedThisPass++;
      // A moved pier carries its corridor: measure again before the next module
      if (corridors.has(mod)) corridors.set(mod, getPierProngCorridors(mod, pb, viewer));
    }
    moves += movedThisPass;
    // Another pass while moves were made, or while a pier still has to give way to a stuck module
    if (movedThisPass === 0 && stuck.size === stuckBefore) break;
  }
  return moves;
}

/** A dock module: a pier or a dock area (by category or macro). */
export function isDockOrPierModule(mod) {
  if (!mod) return false;
  if (isPierModule(mod)) return true;
  const cat = (moduleCategoryOf(mod) || '').toLowerCase();
  const macro = String(mod.userData?.macro || mod.macro || '').toLowerCase();
  return cat === 'docks' || cat === 'dock' || cat === 'pier' || macro.includes('dock') || macro.includes('pier');
}

/**
 * Whether a dock area faces its wall with its shortest side (its long side pointing out from the wall):
 * the S/M ship maintenance and fabrication bays (any race). Every other dock area lies with its long
 * side along its wall.
 * @param {object} mod
 * @returns {boolean}
 */
export function isShortSideToWallDock(mod) {
  const macro = String(mod?.userData?.macro || mod?.macro || '');
  let name = '';
  try { name = getFriendlyName(macro) || ''; } catch (_) { name = ''; }
  return /(^|\s)S\/M\b/i.test(name) || /^buildmodule_[a-z]+_(equip|ships)_m_dockarea/i.test(macro);
}

/**
 * Whether a dock area takes a plot corner (a 1M dock area: 1M6S standard, basic or luxury); every
 * other dock area (3M6S, 4M.., 8M, S/M ship maintenance or fabrication bays) takes the middle of a
 * wall's length.
 * @param {object} mod
 * @returns {boolean}
 */
export function isCornerDockArea(mod) {
  const macro = String(mod?.userData?.macro || mod?.macro || '');
  let name = '';
  try { name = getFriendlyName(macro) || ''; } catch (_) { name = ''; }
  // "1M6S Basic Dock Area", not "Terran 4M10S Luxury Dock Area" nor "3M6S ..."
  return /(^|[^0-9])1M\d*S/i.test(name);
}

/**
 * Spread: slides each pier along the plot floor so its prongs sit as close to two side walls (a
 * vertical edge of the plot) as they can; the top and bottom do not count, and the pier keeps its
 * level and heading. Along each horizontal axis a pier goes toward the side more of its prongs face
 * (its docking clamp then on that wall); where as many face each way (a T pier's side prongs), toward
 * the nearer wall, so one of them reaches it and the middle prong ends as near a second wall as the
 * pier's own box allows (its middle prong on one wall, its crossbar's end on the other). It goes as
 * far as the wall allows while its room (box, zone squares and tunnels: pierZoneSlotBox and
 * getPierProngCorridors) stays `gap` apart from every other pier's, its box inside the plot;
 * otherwise as far as it can short of that. A pier `canTurn` allows also tries its other three level
 * quarter turns and keeps the heading whose zones come out shortest: its unpaired prongs' tunnels
 * (a T pier's middle prong) first, with `pairs` also the shorter of each opposite pair. With `pairs`
 * false only the unpaired prongs count (a T pier's middle prong onto its wall, its exclusion zone as
 * short as it can be); piers `isFixed` keeps stay.
 * @param {Array<object>} modules
 * @param {object} plotBounds getPlotBoundingBox result
 * @param {object} [viewer]
 * @param {{ gap?: number, pairs?: boolean, isFixed?: (mod: object) => boolean, canTurn?: (mod: object) => boolean }} [options]
 * @returns {number} how many piers moved
 */
export function pushPierProngsToEdges(modules, plotBounds, viewer = null, { gap = 15, pairs = true, isFixed = () => false, canTurn = () => true } = {}) {
  const pb = plotBounds;
  const piers = (modules || []).filter(m => m && m.visible !== false && isPierModule(m));
  if (piers.length === 0) return 0;
  const hit = (a, b) =>
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > -gap + 1e-3 &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > -gap + 1e-3 &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > -gap + 1e-3;
  const roomOf = (m) => [pierZoneSlotBox(m, viewer), ...getPierProngCorridors(m, pb, viewer)];
  const rooms = new Map(piers.map(p => [p, roomOf(p)]));
  const clashes = (p, room) => piers.some(o => o !== p && room.some(r => rooms.get(o).some(q => hit(r, q))));
  const STEP = 100;

  // Slides p toward the edges its prongs face (X and Z only: it keeps its level)
  const slide = (p) => {
    const clamps = pierClampsInScene(p);
    for (const axis of ['x', 'z']) {
      const plus = clamps.filter(c => c.d[axis] > 0.7).length, minus = clamps.filter(c => c.d[axis] < -0.7).length;
      if (!plus && !minus) continue;
      const box = moduleWorldBox(p, viewer);
      const lo = axis === 'x' ? pb.minX : pb.minZ, hi = axis === 'x' ? pb.maxX : pb.maxZ;
      let sign = Math.sign(plus - minus);
      if (!sign) {
        // As many prongs face each way (a T pier's side prongs): toward the nearer wall when `pairs`
        if (!pairs) continue;
        sign = (hi - box.max[axis]) <= (box.min[axis] - lo) ? 1 : -1;
      }
      const full = sign > 0 ? hi - box.max[axis] : lo - box.min[axis];
      if (Math.abs(full) < 1) continue;
      // The farthest slide toward that edge that keeps the zones apart (from the full slide back)
      const n = Math.ceil(Math.abs(full) / STEP);
      for (let i = 0; i < n; i++) {
        const dist = full - sign * i * STEP;
        if (sign * dist <= 0) break;
        translateModule(p, axis === 'x' ? dist : 0, 0, axis === 'z' ? dist : 0);
        if (!clashes(p, roomOf(p))) break;
        translateModule(p, axis === 'x' ? -dist : 0, 0, axis === 'z' ? -dist : 0);
      }
    }
  };
  // How long its zones are: the unpaired prongs' tunnels (a T pier's middle prong) first; with
  // `pairs`, also the shorter of each opposite pair
  const score = (p) => {
    const shapes = getPierClampTunnelShapes(p, pb, viewer) || [];
    const dirs = shapes.map(t => t.direction);
    let unpaired = 0, paired = [];
    shapes.forEach((t, i) => {
      const opp = dirs.findIndex((e, j) => j !== i && t.direction.x * e.x + t.direction.z * e.z < -0.9);
      if (opp < 0) unpaired += t.length; else paired.push([Math.min(i, opp), t.length]);
    });
    let pairSum = 0;
    if (pairs) { const by = new Map(); for (const [k, l] of paired) by.set(k, Math.min(by.get(k) ?? Infinity, l)); for (const l of by.values()) pairSum += l; }
    return unpaired + pairSum;
  };

  // How many tunnels the score counts
  const countedTunnels = (p) => {
    const dirs = (getPierClampTunnelShapes(p, pb, viewer) || []).map(t => t.direction);
    const unpaired = dirs.filter((d, i) => !dirs.some((e, j) => j !== i && d.x * e.x + d.z * e.z < -0.9)).length;
    return Math.max(1, unpaired + (pairs ? (dirs.length - unpaired) / 2 : 0));
  };

  let moved = 0;
  for (const p of piers) {
    if (isFixed(p)) continue;
    if (!pierClampsInScene(p).length) continue;
    const pos0 = p.position?.clone?.(), q0 = p.quaternion?.clone?.();
    const restore = () => { p.position.copy(pos0); p.quaternion.copy(q0); if (typeof p.updateMatrixWorld === 'function') p.updateMatrixWorld(true); };
    // Only a pier with a lane turns (not a hub with bays all around)
    const turnable = canTurn(p) && pos0 && q0 && typeof p.position.copy === 'function' && !!getPierLaneWorldDirection(p);
    // Its own heading, then (when it may turn) the other three quarter turns: the heading and place
    // whose zones come out shortest, the zones apart from every other pier's
    let best = null;
    for (let t = 0; t < (turnable ? 4 : 1); t++) {
      if (t > 0) { restore(); for (let k = 0; k < t; k++) quarterTurnPier(p, viewer); }
      slide(p);
      if (clashes(p, roomOf(p))) continue;
      const sc = score(p);
      if (!best || sc < best.score - 1) best = { t, score: sc, pos: p.position?.clone?.(), q: p.quaternion?.clone?.() };
      // Its own heading already gets them short (each under 100 m): no turn
      if (t === 0 && best && best.score < 100 * countedTunnels(p)) break;
    }
    if (turnable) {
      if (best) { p.position.copy(best.pos); p.quaternion.copy(best.q); if (typeof p.updateMatrixWorld === 'function') p.updateMatrixWorld(true); }
      else restore();
    } else if (!best) {
      // (not turnable: no saved state; a slide only happens when it is clear)
    }
    const changed = pos0 ? p.position.distanceTo(pos0) > 1e-6 || (q0 && p.quaternion.angleTo(q0) > 1e-6) : true;
    if (changed) {
      rooms.set(p, roomOf(p));
      syncPlanPosition(p, viewer);
      if (best?.t && typeof viewer?.getModuleCalculatedRotation === 'function') {
        const planMod = viewer.currentPlan?.modules?.find(m => m.index === p.userData?.index);
        const rot = planMod ? viewer.getModuleCalculatedRotation(p.userData.index, { decimals: 3 }) : null;
        if (planMod && rot) planMod.rotation = { ...(planMod.rotation || {}), yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll };
      }
      moved++;
    }
  }
  return moved;
}

/** Turns a pier a quarter turn about the vertical through its box centre (it stays level). */
function quarterTurnPier(p, viewer) {
  const before = moduleWorldBox(p, viewer);
  if (typeof p.rotateOnWorldAxis === 'function' && typeof p.position?.constructor === 'function') {
    p.rotateOnWorldAxis(new p.position.constructor(0, 1, 0), Math.PI / 2);
  } else if (p.rotation) p.rotation.y = (p.rotation.y || 0) + Math.PI / 2;
  if (typeof p.updateMatrixWorld === 'function') p.updateMatrixWorld(true);
  const after = moduleWorldBox(p, viewer);
  translateModule(p,
    (before.min.x + before.max.x - after.min.x - after.max.x) / 2,
    (before.min.y + before.max.y - after.min.y - after.max.y) / 2,
    (before.min.z + before.max.z - after.min.z - after.max.z) / 2);
}

/**
 * Moves piers so their exclusion zones are apart: no pier's room (its box, each prong's zone square
 * and its tunnels out to the plot wall: pierZoneSlotBox and getPierProngCorridors) overlaps another
 * pier's, `gap` apart. Then no pier's box is in another's zones, and no two piers' docking tunnels
 * share space. Piers `isFixed` keeps stay and are settled first, then the others largest first; a pier
 * overlapping one settled before it moves the least distance that clears all of them, sideways (X or
 * Z) before up or down so it keeps its level, its box inside the plot. When no straight move clears
 * at its own heading, it also tries the other three quarter turns about the vertical (it stays level;
 * every tunnel still runs out through a plot wall); failing that, the nearest free place on a 2 km
 * grid, at its own heading first. A pier with no free place stays (the zone clean-up handles it).
 * @param {Array<object>} modules
 * @param {object} plotBounds getPlotBoundingBox result
 * @param {object} [viewer]
 * @param {{ gap?: number, isFixed?: (mod: object) => boolean }} [options]
 * @returns {number} how many piers moved
 */
export function separatePierZones(modules, plotBounds, viewer = null, { gap = 15, isFixed = () => false } = {}) {
  const pb = plotBounds;
  const piers = (modules || []).filter(m => m && m.visible !== false && isPierModule(m));
  if (piers.length < 2) return 0;
  const hit = (a, b) =>
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > -gap + 1e-3 &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > -gap + 1e-3 &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > -gap + 1e-3;
  const roomOf = (m) => [pierZoneSlotBox(m, viewer), ...getPierProngCorridors(m, pb, viewer)];
  const inside = (b) => b.min.x >= pb.minX - 1e-6 && b.max.x <= pb.maxX + 1e-6 &&
    b.min.y >= pb.minY - 1e-6 && b.max.y <= pb.maxY + 1e-6 &&
    b.min.z >= pb.minZ - 1e-6 && b.max.z <= pb.maxZ + 1e-6;
  const size = (m) => { const b = moduleWorldBox(m, viewer); return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z); };
  const order = [...piers.filter(m => isFixed(m)), ...piers.filter(m => !isFixed(m)).sort((a, b) => size(b) - size(a))];
  const settled = [];
  let moved = 0;
  for (const p of order) {
    const clashes = (room) => settled.some(o => room.some(r => o.room.some(q => hit(r, q))));
    let room = roomOf(p);
    if (isFixed(p) || !clashes(room)) { settled.push({ p, room }); continue; }
    // Is the pier clear when moved by d? (its tunnels re-measured out to the wall)
    const clearAt = (d) => {
      translateModule(p, d.x, d.y, d.z);
      const ok = inside(moduleWorldBox(p, viewer)) && !clashes(roomOf(p));
      translateModule(p, -d.x, -d.y, -d.z);
      return ok;
    };
    const STEP = 250;
    // The least move at the pier's current heading: sideways (X or Z) before up or down
    const sweepMoves = () => {
      const found = [];
      const b = moduleWorldBox(p, viewer);
      for (const axis of ['x', 'z', 'y']) {
        const span = axis === 'x' ? pb.maxX - pb.minX : axis === 'y' ? pb.maxY - pb.minY : pb.maxZ - pb.minZ;
        for (const sign of [1, -1]) {
          for (let dist = 0; dist <= span; dist += STEP) {
            const d = { x: 0, y: 0, z: 0, [axis]: sign * dist };
            if (!inside({ min: { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z }, max: { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z } })) break;
            if (clearAt(d)) { found.push(d); break; }
          }
        }
      }
      found.sort((u, v) => ((u.y !== 0) - (v.y !== 0)) ||
        (Math.abs(u.x) + Math.abs(u.y) + Math.abs(u.z)) - (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)));
      return found[0] || null;
    };
    // The nearest free place on a 2 km grid across the plot, at the current heading
    const gridMove = () => {
      const b = moduleWorldBox(p, viewer);
      const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 };
      const lines = (lo, hi) => { const n = Math.max(1, Math.floor((hi - lo) / 2000)); return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n); };
      const ds = [];
      for (const x of [c.x, ...lines(pb.minX, pb.maxX)]) for (const y of [c.y, ...lines(pb.minY, pb.maxY)]) for (const z of [c.z, ...lines(pb.minZ, pb.maxZ)]) ds.push({ x: x - c.x, y: y - c.y, z: z - c.z });
      ds.sort((u, v) => (u.x * u.x + u.y * u.y + u.z * u.z) - (v.x * v.x + v.y * v.y + v.z * v.z));
      return ds.find(d => clearAt(d)) || null;
    };
    // Turn the pier a quarter turn about the vertical through its box centre (it stays level, its
    // prongs still horizontal, so every tunnel still runs out through a plot wall)
    const quarterTurn = () => {
      const before = moduleWorldBox(p, viewer);
      if (typeof p.rotateOnWorldAxis === 'function' && typeof p.position?.constructor === 'function') {
        p.rotateOnWorldAxis(new p.position.constructor(0, 1, 0), Math.PI / 2);
      } else if (p.rotation) p.rotation.y = (p.rotation.y || 0) + Math.PI / 2;
      if (typeof p.updateMatrixWorld === 'function') p.updateMatrixWorld(true);
      const after = moduleWorldBox(p, viewer);
      translateModule(p,
        (before.min.x + before.max.x - after.min.x - after.max.x) / 2,
        (before.min.y + before.max.y - after.min.y - after.max.y) / 2,
        (before.min.z + before.max.z - after.min.z - after.max.z) / 2);
    };
    // Its own heading first; then the other three quarter turns; the grid only when no turn has a
    // straight move
    let move = null, turns = 0;
    for (let t = 0; t < 4 && !move; t++) {
      if (t > 0) quarterTurn();
      move = sweepMoves();
      if (move) turns = t;
    }
    if (!move) {
      quarterTurn(); // back to its own heading (four quarter turns)
      for (let t = 0; t < 4 && !move; t++) {
        if (t > 0) quarterTurn();
        move = gridMove();
        if (move) turns = t;
      }
      if (!move) quarterTurn(); // no place: back to its own heading
    }
    if (move) {
      translateModule(p, move.x, move.y, move.z);
      syncPlanPosition(p, viewer);
      if (turns && typeof viewer?.getModuleCalculatedRotation === 'function') {
        const planMod = viewer.currentPlan?.modules?.find(m => m.index === p.userData?.index);
        const rot = planMod ? viewer.getModuleCalculatedRotation(p.userData.index, { decimals: 3 }) : null;
        if (planMod && rot) planMod.rotation = { ...(planMod.rotation || {}), yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll };
      }
      moved++;
      room = roomOf(p);
    }
    settled.push({ p, room });
  }
  return moved;
}

/**
 * Placement in two steps, docks first. 1) The docks (piers and dock areas) are settled among
 * themselves: piers' zones apart (separatePierZones), each pier onto the wall its unpaired prongs
 * face (a T pier's middle prong: pushPierProngsToEdges), no dock left in a pier's exclusion zones (clearPierProngCorridors over the docks
 * alone), then the dock areas are placed one at a time against an outside plot wall, their boxes
 * never in a pier's exclusion zones, at the level the docks Vertical Orientation and Perimeter
 * placement gave them, each turned so its longest side runs along its wall (an S/M bay its shortest
 * side facing the wall), none over or under
 * another dock (footprints apart): 1M dock areas first, into the plot's corners, then the others (3M,
 * 8M, S/M maintenance, ...) to the middle of a wall's length (isCornerDockArea), among places as good
 * the farthest from the zones; with `spread`, each on a wall of its own where it can, as close as it
 * can between the piers. They stay off the piers and each other,
 * so no dock overlaps another (a dock area with no wall place left is placed like a module).
 * 2) Then the remaining modules are placed one at a time, in the Layers category order, each
 * checked for overlap against everything already placed: every dock's box (`gap` apart), every
 * pier's exclusion zones (its box and its prongs' tunnels to the plot wall) and the modules placed
 * before it. A module that overlaps nothing keeps its place; otherwise it goes the shortest distance
 * sideways (X or Z), else up or down, past whatever is in the way, with its box inside the plot;
 * failing that, to the nearest free place on a 1 km grid across the plot. A module with no free
 * place stays where it is (the caller's clean-up handles it). Modules `isFixed` keeps never move.
 * @param {Array<object>} modules
 * @param {object} plotBounds getPlotBoundingBox result
 * @param {object} [viewer]
 * @param {{ gap?: number, isFixed?: (mod: object) => boolean, spread?: boolean }} [options]
 * @returns {number} how many dock areas and other modules were moved (step 2 and the dock areas)
 */
export function placeModulesAroundDocks(modules, plotBounds, viewer = null, { gap = 15, isFixed = () => false, spread = false } = {}) {
  const pb = plotBounds;
  const visible = (modules || []).filter(m => m && m.visible !== false);
  const docks = visible.filter(m => isDockOrPierModule(m));
  if (docks.length === 0) return 0;

  // 1. The docks first: piers' zones apart (no pier's box or zones in another's), then piers out
  // of each other's boxes and zones, dock areas out of the zones
  separatePierZones(docks, pb, viewer, { gap, isFixed });
  // Every pier onto the wall its unpaired prongs face (a T pier's middle prong): those exclusion
  // zones as short as they can be, the zones still apart
  pushPierProngsToEdges(docks, pb, viewer, { gap, pairs: false, isFixed });
  clearPierProngCorridors(docks, pb, viewer, { gap, isFixed });

  const eps = 1e-3;
  const intersects = (a, b, margin = 0) =>
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > eps - margin &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > eps - margin &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > eps - margin;
  const shifted = (b, d) => ({
    min: { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z },
    max: { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z }
  });
  const inside = (b) => b.min.x >= pb.minX - 1e-6 && b.max.x <= pb.maxX + 1e-6 &&
    b.min.y >= pb.minY - 1e-6 && b.max.y <= pb.maxY + 1e-6 &&
    b.min.z >= pb.minZ - 1e-6 && b.max.z <= pb.maxZ + 1e-6;

  // Everything placed so far: the piers' boxes (kept `gap` away) and zones (no margin: they already
  // are clearance), then each dock area and module as it is placed
  const placed = [];
  for (const d of docks.filter(m => isPierModule(m))) {
    placed.push({ box: moduleWorldBox(d, viewer), margin: gap });
    for (const c of getPierProngCorridors(d, pb, viewer)) placed.push({ box: c, margin: 0 });
  }
  const hitsAt = (nb) => placed.filter(p => intersects(nb, p.box, p.margin));

  const FREE_SPOT_STEP = 1000;
  const along = (lo, hi) => { const n = Math.max(1, Math.floor((hi - lo) / FREE_SPOT_STEP)); return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n); };
  const lines = { x: along(pb.minX, pb.maxX), y: along(pb.minY, pb.maxY), z: along(pb.minZ, pb.maxZ) };

  // Then the dock areas, one at a time, off the piers and each other (kept `gap` apart); 2. then the
  // remaining modules, one at a time in the Layers order
  const dockAreas = docks.filter(m => !isPierModule(m));
  const rest = sortModulesByLayerCategoryOrder(visible.filter(m => !isDockOrPierModule(m)));
  let moved = 0;

  // Dock areas go to an outside wall, their boxes out of every pier zone, keeping the level the docks
  // Vertical Orientation and Perimeter placement gave them, turned so their longest side runs along
  // that wall (an S/M bay instead faces the wall with its shortest side: isShortSideToWallDock), and never over or under another dock (no two docks' footprints overlap, whatever their
  // heights). 1M dock areas (1M6S) are placed first. Without Spread, 1M dock areas take the plot's
  // corners (their box on two walls) and the others (3M6S, 8M, S/M ship maintenance or fabrication
  // bays, ...) the middle of a wall's length; among places as good, the farthest from the zones (and
  // the piers). With `spread`, each goes to a wall no other dock area is on where it can, as close as
  // it can between the piers (nearest to the two nearest piers). Then the least move. Only when no wall
  // place at its level is free does one change level, as little as it can. One at a time, `gap` apart.
  const zoneBoxes = placed.map(p => p.box);
  const boxGap = (a, b) => Math.hypot(
    Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
    Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y),
    Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z));
  const WALL_STEP = 250;
  const steps = (lo, hi) => {
    if (hi <= lo) return [(lo + hi) / 2];
    const n = Math.max(1, Math.ceil((hi - lo) / WALL_STEP));
    return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n);
  };
  // Every dock's footprint (piers' boxes, then each dock area as it is placed): none over another
  const pierBoxes = docks.filter(m => isPierModule(m)).map(m => moduleWorldBox(m, viewer));
  const footprints = [...pierBoxes];
  const overFootprint = (nb) => footprints.some(f =>
    Math.min(nb.max.x, f.max.x) - Math.max(nb.min.x, f.min.x) > -gap + 1e-3 &&
    Math.min(nb.max.z, f.max.z) - Math.max(nb.min.z, f.min.z) > -gap + 1e-3);
  const wallUses = new Map();
  const wallPlaced = new Set();
  const byClass = [...dockAreas.filter(m => isCornerDockArea(m)), ...dockAreas.filter(m => !isCornerDockArea(m))];
  for (const mod of byClass) {
    if (isFixed(mod)) continue;
    const corner = isCornerDockArea(mod);
    const box = moduleWorldBox(mod, viewer);
    const w = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
    const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    const longAlongX = w.x >= w.z;
    const turnable = typeof mod.rotateOnWorldAxis === 'function' && typeof mod.position?.constructor === 'function';
    const shortToWall = isShortSideToWallDock(mod);
    const level = Math.min(Math.max(c.y, pb.minY + w.y / 2), pb.maxY - w.y / 2);
    let best = null;
    const same = (u, v) => Math.abs(u - v) <= 1;
    // A place: its centre, the wall, its size there (long side along the wall), its centre along the
    // wall between lo and hi
    const consider = (cx, cy, cz, wall, size, along, lo, hi) => {
      const nb = { min: { x: cx - size.x / 2, y: cy - size.y / 2, z: cz - size.z / 2 }, max: { x: cx + size.x / 2, y: cy + size.y / 2, z: cz + size.z / 2 } };
      if (!inside(nb) || hitsAt(nb).length || overFootprint(nb)) return;
      const off = Math.abs(cy - level);
      const travel = Math.hypot(cx - c.x, cz - c.z);
      let k1, k2;
      if (spread) {
        // A wall of its own first; then as close as it can between the piers
        k1 = wallUses.get(wall) || 0;
        const ds = pierBoxes.map(pbx => boxGap(nb, pbx)).sort((u, v) => u - v);
        k2 = ds.length ? ds[0] + (ds.length > 1 ? ds[1] : 0) : 0;
      } else {
        // Its place on the wall: a corner (either end) for 1M, else the middle; then far from the zones
        k1 = corner ? Math.min(along - lo, hi - along) : Math.abs(along - (lo + hi) / 2);
        k2 = -(zoneBoxes.length ? Math.min(...zoneBoxes.map(z => boxGap(nb, z))) : 0);
      }
      const better = !best || off < best.off - 1 || (same(off, best.off) && (k1 < best.k1 - (spread ? 0.5 : 1) || (Math.abs(k1 - best.k1) <= (spread ? 0.5 : 1) &&
        (k2 < best.k2 - 1 || (same(k2, best.k2) && travel < best.travel - 1e-6)))));
      if (better) best = { cx, cy, cz, nb, wall, size, off, k1, k2, travel };
    };
    const scan = (ys) => {
      // Long side along the wall: along Z on the ±X walls, along X on the ±Z walls
      // Long side along the wall, except an S/M bay: its short side faces the wall (long side out from
      // it). A module that cannot be turned keeps the size it has.
      const lo = Math.min(w.x, w.z), hi = Math.max(w.x, w.z);
      const sx = !turnable ? w : shortToWall ? { x: hi, y: w.y, z: lo } : { x: lo, y: w.y, z: hi };   // on ±X walls
      const sz = !turnable ? w : shortToWall ? { x: lo, y: w.y, z: hi } : { x: hi, y: w.y, z: lo };   // on ±Z walls
      const zLo = pb.minZ + sx.z / 2, zHi = pb.maxZ - sx.z / 2, xLo = pb.minX + sz.x / 2, xHi = pb.maxX - sz.x / 2;
      for (const y of ys) {
        for (const z of [c.z, (zLo + zHi) / 2, ...steps(zLo, zHi)]) {
          consider(pb.maxX - sx.x / 2, y, z, '+x', sx, z, zLo, zHi);
          consider(pb.minX + sx.x / 2, y, z, '-x', sx, z, zLo, zHi);
        }
        for (const x of [c.x, (xLo + xHi) / 2, ...steps(xLo, xHi)]) {
          consider(x, y, pb.maxZ - sz.z / 2, '+z', sz, x, xLo, xHi);
          consider(x, y, pb.minZ + sz.z / 2, '-z', sz, x, xLo, xHi);
        }
      }
    };
    scan([level]);
    if (!best) scan(steps(pb.minY + w.y / 2, pb.maxY - w.y / 2));
    if (!best) continue; // no wall place left: placed below like any module
    // Turn it a quarter when its long side would not run along the wall
    const onZWall = best.wall === '+z' || best.wall === '-z';
    const wantLongAlongX = turnable ? (shortToWall ? !onZWall : onZWall) : longAlongX;
    if (Math.abs(w.x - w.z) > 1 && wantLongAlongX !== longAlongX) quarterTurnPier(mod, viewer);
    const now = moduleWorldBox(mod, viewer);
    translateModule(mod, best.cx - (now.min.x + now.max.x) / 2, best.cy - (now.min.y + now.max.y) / 2, best.cz - (now.min.z + now.max.z) / 2);
    const placedBox = moduleWorldBox(mod, viewer);
    if (Math.hypot(best.cx - c.x, best.cy - c.y, best.cz - c.z) > 1e-6 || wantLongAlongX !== longAlongX) {
      syncPlanPosition(mod, viewer);
      if (wantLongAlongX !== longAlongX && Math.abs(w.x - w.z) > 1 && typeof viewer?.getModuleCalculatedRotation === 'function') {
        const planMod = viewer.currentPlan?.modules?.find(m => m.index === mod.userData?.index);
        const rot = planMod ? viewer.getModuleCalculatedRotation(mod.userData.index, { decimals: 3 }) : null;
        if (planMod && rot) planMod.rotation = { ...(planMod.rotation || {}), yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll };
      }
      moved++;
    }
    placed.push({ box: placedBox, margin: gap });
    footprints.push(placedBox);
    wallUses.set(best.wall, (wallUses.get(best.wall) || 0) + 1);
    wallPlaced.add(mod);
  }

  for (const mod of [...dockAreas.filter(m => !wallPlaced.has(m)), ...rest]) {
    const isDock = dockAreas.includes(mod);
    const box = moduleWorldBox(mod, viewer);
    const blocking = isFixed(mod) ? [] : hitsAt(box);
    if (blocking.length) {
      // In each direction: past what is in the way, on past whatever is next, until a free place or
      // the plot wall
      const sweep = (axis, sign) => {
        const past = (list) => Math.max(...list.map(({ box: o, margin }) =>
          sign > 0 ? o.max[axis] + margin - box.min[axis] : box.max[axis] - (o.min[axis] - margin)));
        let dist = past(blocking);
        for (let step = 0; step < 64; step++) {
          const d = { x: 0, y: 0, z: 0, [axis]: sign * dist };
          const nb = shifted(box, d);
          if (!inside(nb)) return null;
          const hit = hitsAt(nb);
          if (hit.length === 0) return d;
          const next = past(hit);
          if (!(next > dist + 1e-6)) return null;
          dist = next;
        }
        return null;
      };
      const found = [];
      for (const axis of ['x', 'z', 'y']) for (const sign of [1, -1]) { const d = sweep(axis, sign); if (d) found.push(d); }
      // Sideways first so modules keep their level; the shortest move of each kind
      found.sort((a, b) => ((a.y !== 0) - (b.y !== 0)) ||
        (Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z)) - (Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.z)));
      let move = found[0] || null;
      if (!move) {
        // A crowded plot: the nearest free place on the grid (own coordinates count as grid lines)
        const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
        const ds = [];
        for (const x of [c.x, ...lines.x]) for (const y of [c.y, ...lines.y]) for (const z of [c.z, ...lines.z]) ds.push({ x: x - c.x, y: y - c.y, z: z - c.z });
        ds.sort((a, b) => (a.x * a.x + a.y * a.y + a.z * a.z) - (b.x * b.x + b.y * b.y + b.z * b.z));
        move = ds.find(d => { const nb = shifted(box, d); return inside(nb) && hitsAt(nb).length === 0; }) || null;
      }
      if (move) {
        translateModule(mod, move.x, move.y, move.z);
        syncPlanPosition(mod, viewer);
        moved++;
        placed.push({ box: shifted(box, move), margin: isDock ? gap : 0 });
        continue;
      }
    }
    placed.push({ box, margin: isDock ? gap : 0 });
  }
  return moved;
}

/**
 * Moves every visible module the least distance that brings its own bounding box inside the plot BB
 * (a box larger than the plot along an axis is centred on it instead), then writes the positions to
 * the plan. The box is the module as rendered (viewer.getModuleWorldBoundingBox): its rotation and
 * its actual geometry around the origin count, while lane and other invisible clearance volumes
 * (geometryinvisible, bounding_box) and effects do not. Without a rendered box the module's catalog
 * size centred on its position is used.
 * @param {Array<object>} modules
 * @param {object} plotBounds getPlotBoundingBox result
 * @param {object} [viewer]
 * @returns {number} how many modules were moved
 */
export function keepModulesInsidePlot(modules, plotBounds, viewer = null) {
  let moved = 0;
  const eps = 0.01;
  // Shift that brings [lo, hi] inside [min, max]; centres it when it cannot fit
  const shiftInto = (lo, hi, min, max) => {
    if (hi - lo > max - min) return (min + max) / 2 - (lo + hi) / 2;
    if (hi > max) return max - hi;
    if (lo < min) return min - lo;
    return 0;
  };

  (modules || []).forEach(mod => {
    if (!mod || mod.visible === false) return;
    if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
    const worldBox = typeof viewer?.getModuleWorldBoundingBox === 'function' ? viewer.getModuleWorldBoundingBox(mod) : null;
    if (worldBox && !(typeof worldBox.isEmpty === 'function' && worldBox.isEmpty())) {
      const shiftX = shiftInto(worldBox.min.x, worldBox.max.x, plotBounds.minX, plotBounds.maxX);
      const shiftY = shiftInto(worldBox.min.y, worldBox.max.y, plotBounds.minY, plotBounds.maxY);
      const shiftZ = shiftInto(worldBox.min.z, worldBox.max.z, plotBounds.minZ, plotBounds.maxZ);
      if (Math.abs(shiftX) > eps || Math.abs(shiftY) > eps || Math.abs(shiftZ) > eps) {
        if (typeof mod.position?.set === 'function') {
          mod.position.set(mod.position.x + shiftX, mod.position.y + shiftY, mod.position.z + shiftZ);
        } else if (mod.position) {
          mod.position.x = (mod.position.x || 0) + shiftX;
          mod.position.y = (mod.position.y || 0) + shiftY;
          mod.position.z = (mod.position.z || 0) + shiftZ;
        }
        if (typeof mod.updateMatrixWorld === 'function') mod.updateMatrixWorld(true);
        moved++;
      }
    } else if (mod.position) {
      const s = (viewer?.getModuleInitialSize ? viewer.getModuleInitialSize(mod) : null) || defaultModuleSize(mod) || { x: 100, y: 100, z: 100 };
      const before = { x: mod.position.x, y: mod.position.y, z: mod.position.z };
      clampModulePositionToPlot(mod.position, s, plotBounds);
      if (before.x !== mod.position.x || before.y !== mod.position.y || before.z !== mod.position.z) moved++;
    }

    const planMod = viewer?.currentPlan?.modules?.find(m => m.index === mod.userData?.index);
    if (planMod && planMod.position && mod.position) {
      planMod.position.x = Math.round(mod.position.x);
      planMod.position.y = Math.round(mod.position.y);
      planMod.position.z = Math.round(-mod.position.z);
    }
  });
  return moved;
}

/**
 * Apply docks perimeter placement (clear, lanes, stacked, spread).
 * @param {Array<string>|Set<string>} [selections]
 * @param {object} [viewer]
 */
export function applyDocksPerimeterPlacement(selections = null, viewer = null) {
  const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
  if (!v || !v.modulesGroup || !v.modulesGroup.children || v.modulesGroup.children.length === 0) return;

  const selSet = selections instanceof Set
    ? selections
    : (Array.isArray(selections) ? new Set(selections) : getDocksPerimeterSelections());

  // Clear removes all multi-selected checks and reverts to base vertical orientation
  if (selSet.has('clear') || selSet.size === 0) {
    applyDocksVerticalOrientation(getDocksVerticalOrientation(), v);
    return;
  }

  isDocksVerticalApplied = true;

  const dockModules = [];
  v.modulesGroup.children.forEach(mod => {
    if (!mod || mod.visible === false) return;
    const cat = (moduleCategoryOf(mod) || '').toLowerCase();
    const macro = (mod.userData?.macro || mod.macro || '').toLowerCase();
    const isDockOrPier = cat === 'docks' || cat === 'dock' || cat === 'pier' || macro.includes('dock') || macro.includes('pier');
    if (isDockOrPier) {
      dockModules.push(mod);
    }
  });

  if (dockModules.length === 0) return;

  const plotBounds = getPlotBoundingBox(v.currentPlotConfig || getCurrentPlotConfig());
  const isXLongest = plotBounds.widthX >= plotBounds.depthZ;
  const orient = getDocksVerticalOrientation();
  const centerY = plotBounds.centerY !== undefined ? plotBounds.centerY : (plotBounds.maxY + plotBounds.minY) / 2;
  const gap = 15;

  const getModSize = (m) => (v.getModuleInitialSize ? v.getModuleInitialSize(m) : null) || defaultModuleSize(m) || { x: 100, y: 100, z: 100 };

  // stacked places the largest docks along the longest dimension displaced vertically by the docks' BB
  if (selSet.has('stacked')) {
    dockModules.sort((a, b) => {
      const sa = getModSize(a);
      const sb = getModSize(b);
      const volA = (sa.x || 100) * (sa.y || 100) * (sa.z || 100);
      const volB = (sb.x || 100) * (sb.y || 100) * (sb.z || 100);
      return volB - volA;
    });
  }

  // Base vertical orientation: a dock keeps its X/Z and goes to the docks level
  const placeAtDocksLevel = (mod) => {
    const s = getModSize(mod);
    const halfY = (s.y || 100) / 2;
    let newY;
    if (orient === 'top') newY = plotBounds.maxY - halfY;
    else if (orient === 'center') newY = centerY;
    else if (orient === 'bottom') newY = plotBounds.minY + halfY;
    if (newY !== undefined) {
      const pos = { x: mod.position?.x ?? 0, y: newY, z: mod.position?.z ?? 0 };
      clampModulePositionToPlot(pos, s, plotBounds);
      if (typeof mod.position?.set === 'function') mod.position.set(pos.x, pos.y, pos.z);
      else if (mod.position) mod.position.y = pos.y;
    }
  };

  if (selSet.has('spread')) {
    // spread has the docks spread out evenly as possible to a side each with multiples beyond the four walls stacking vertically
    // Wall indices: 0: +Z, 1: +X, 2: -Z, 3: -X
    // If stacked is also selected, longest dimension walls come first
    const wallOrder = (selSet.has('stacked') && isXLongest)
      ? [0, 2, 1, 3] // +Z and -Z run along X
      : (selSet.has('stacked') ? [1, 3, 0, 2] : [0, 1, 2, 3]);

    const wallDocks = [[], [], [], []];

    dockModules.forEach((mod, i) => {
      const wallIdx = wallOrder[i % 4];
      const tier = Math.floor(i / 4);
      const s = getModSize(mod);
      const halfX = (s.x || 100) / 2;
      const halfY = (s.y || 100) / 2;
      const halfZ = (s.z || 100) / 2;

      let x = plotBounds.centerX;
      let z = plotBounds.centerZ;

      if (wallIdx === 0) {
        // +Z wall
        z = plotBounds.maxZ - halfZ;
      } else if (wallIdx === 1) {
        // +X wall
        x = plotBounds.maxX - halfX;
      } else if (wallIdx === 2) {
        // -Z wall
        z = plotBounds.minZ + halfZ;
      } else if (wallIdx === 3) {
        // -X wall
        x = plotBounds.minX + halfX;
      }

      let y;
      if (tier === 0) {
        if (orient === 'bottom') y = plotBounds.minY + halfY;
        else if (orient === 'top') y = plotBounds.maxY - halfY;
        else y = centerY;
      } else {
        const prevMod = wallDocks[wallIdx][tier - 1];
        const prevS = getModSize(prevMod);
        const prevHalfY = (prevS.y || 100) / 2;
        if (orient === 'bottom') {
          y = prevMod.position.y + prevHalfY + halfY + gap;
        } else if (orient === 'top') {
          y = prevMod.position.y - (prevHalfY + halfY + gap);
        } else {
          y = prevMod.position.y + prevHalfY + halfY + gap;
        }
      }

      const pos = { x, y, z };
      clampModulePositionToPlot(pos, s, plotBounds);
      if (typeof mod.position?.set === 'function') {
        mod.position.set(pos.x, pos.y, pos.z);
      } else if (mod.position) {
        mod.position.x = pos.x;
        mod.position.y = pos.y;
        mod.position.z = pos.z;
      }
      wallDocks[wallIdx].push(mod);
    });
  } else if (selSet.has('stacked')) {
    // stacked places the largest piers along the longest dimension displaced vertically by the piers' BB;
    // dock areas are not stacked: they keep their place at the docks level
    const stackPiers = dockModules.filter(m => isPierModule(m));
    dockModules.filter(m => !isPierModule(m)).forEach(placeAtDocksLevel);
    const N = stackPiers.length;
    let prevY = null;
    let prevHalfY = 0;

    stackPiers.forEach((mod, i) => {
      const s = getModSize(mod);
      const halfX = (s.x || 100) / 2;
      const halfY = (s.y || 100) / 2;
      const halfZ = (s.z || 100) / 2;

      let x = plotBounds.centerX;
      let z = plotBounds.centerZ;

      if (isXLongest) {
        // Along the X dimension
        z = plotBounds.maxZ - halfZ;
        const t = N === 1 ? 0.5 : (i + 0.5) / N;
        x = plotBounds.minX + halfX + t * (plotBounds.widthX - s.x);
      } else {
        // Along the Z dimension
        x = plotBounds.maxX - halfX;
        const t = N === 1 ? 0.5 : (i + 0.5) / N;
        z = plotBounds.minZ + halfZ + t * (plotBounds.depthZ - s.z);
      }

      let y;
      if (i === 0) {
        if (orient === 'bottom') y = plotBounds.minY + halfY;
        else if (orient === 'top') y = plotBounds.maxY - halfY;
        else y = centerY;
      } else {
        if (orient === 'bottom') {
          y = prevY + prevHalfY + halfY + gap;
        } else if (orient === 'top') {
          y = prevY - (prevHalfY + halfY + gap);
        } else {
          y = prevY + prevHalfY + halfY + gap;
        }
      }

      const pos = { x, y, z };
      clampModulePositionToPlot(pos, s, plotBounds);
      if (typeof mod.position?.set === 'function') {
        mod.position.set(pos.x, pos.y, pos.z);
      } else if (mod.position) {
        mod.position.x = pos.x;
        mod.position.y = pos.y;
        mod.position.z = pos.z;
      }

      prevY = pos.y;
      prevHalfY = halfY;
    });
  } else {
    // Neither spread nor stacked: apply base vertical orientation
    dockModules.forEach(placeAtDocksLevel);
  }

  // Piers' docking lanes always point out of the plot
  orientPierLanesOutward(dockModules, plotBounds, v);

  // Dock types the station has several of: stacked vertically on the smallest wall that fits them
  const stacked = stackRepeatedDockTypes(dockModules, plotBounds, v, { orient, gap });

  // Insure no physical bounding box overlap; the stacks stay as placed and other modules give way
  ensureNoBoundingBoxOverlaps(v.modulesGroup.children, plotBounds, {
    gap: 15,
    getModuleSize: (m) => getModSize(m),
    applyToObjects: true,
    isFixed: (m) => stacked.has(m)
  });

  // lanes insure no docks invisible geometries BB overlap
  if (selSet.has('lanes')) {
    ensureNoDocksInvisibleOverlap(dockModules.filter(m => !stacked.has(m)), plotBounds, v);
  }

  // Keep each module's own BB (lanes excluded) inside the plot and sync plan coordinates
  keepModulesInsidePlot(v.modulesGroup.children, plotBounds, v);
  // Nothing else may sit in the stacks' space
  clearStackedDocksSpace(stacked, v.modulesGroup.children, plotBounds, v, gap);
  // Spread: every pier's prongs as close to the plot's edges as they can be
  if (selSet.has('spread')) pushPierProngsToEdges(dockModules, plotBounds, v, { gap, canTurn: (m) => !stacked.has(m) });
  // Docks settled first; then the other modules placed around them, out of the pier zones
  placeModulesAroundDocks(v.modulesGroup.children, plotBounds, v, { gap, isFixed: (m) => stacked.has(m), spread: selSet.has('spread') });
  // Nothing may block a pier's prongs out to the plot wall
  clearPierProngCorridors(v.modulesGroup.children, plotBounds, v, { gap, isFixed: (m) => stacked.has(m) });

  if (typeof v.updatePlotBoxViolations === 'function') v.updatePlotBoxViolations();
  if (typeof v.renderScene === 'function') v.renderScene();
  else if (typeof v.render === 'function') v.render();
}

/**
 * Creates the Perimeter multi-selection dropdown group DOM element.
 * Options: clear, lanes, stacked, spread
 */
export function createPerimeterMultiSelectGroup(idPrefix, viewer = null) {
  const container = document.createElement('div');
  container.className = 'layer-perimeter-dropdown-group';

  const label = document.createElement('label');
  label.className = 'layer-perimeter-label';
  label.textContent = 'Perimeter';
  label.htmlFor = `${idPrefix}-perimeter-toggle`;
  container.appendChild(label);

  const multiselect = document.createElement('div');
  multiselect.className = 'cyber-multiselect';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = `${idPrefix}-perimeter-toggle`;
  toggleBtn.className = 'cyber-multiselect-toggle';
  toggleBtn.setAttribute('aria-label', 'Perimeter');
  toggleBtn.title = 'Perimeter placement options: clear, lanes, stacked, spread';

  const menu = document.createElement('div');
  menu.className = 'cyber-multiselect-menu hidden';

  const options = ['clear', 'lanes', 'stacked', 'spread'];
  const activeSelections = getDocksPerimeterSelections();

  function updateToggleText() {
    const selArr = Array.from(activeSelections);
    if (selArr.length === 0) {
      toggleBtn.textContent = 'Select... ▾';
    } else {
      toggleBtn.textContent = selArr.join(', ') + ' ▾';
    }
  }

  updateToggleText();

  const checkboxes = {};

  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'cyber-multiselect-item' + (opt === 'clear' ? ' cyber-multiselect-clear' : '');
    if (item.dataset) {
      item.dataset.value = opt;
    }
    if (typeof item.setAttribute === 'function') {
      item.setAttribute('data-value', opt);
    }

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `${idPrefix}-perimeter-${opt}`;
    cb.value = opt;
    cb.checked = activeSelections.has(opt);
    checkboxes[opt] = cb;

    const optLabel = document.createElement('label');
    optLabel.htmlFor = cb.id;
    optLabel.textContent = opt;

    item.appendChild(cb);
    item.appendChild(optLabel);

    const handleOptionToggle = (e) => {
      if (e) e.stopPropagation();
      const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
      if (opt === 'clear') {
        // Clear removes all multi-selected checks
        cb.checked = false;
        options.forEach(k => {
          if (checkboxes[k]) checkboxes[k].checked = false;
        });
        activeSelections.clear();
        currentDocksPerimeterSelections.clear();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(DOCKS_PERIMETER_STORAGE_KEY);
        }
        updateToggleText();
        applyDocksPerimeterPlacement(activeSelections, v);
      } else {
        if (cb.checked) {
          activeSelections.add(opt);
          currentDocksPerimeterSelections.add(opt);
        } else {
          activeSelections.delete(opt);
          currentDocksPerimeterSelections.delete(opt);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(DOCKS_PERIMETER_STORAGE_KEY, JSON.stringify(Array.from(activeSelections)));
        }
        updateToggleText();
        applyDocksPerimeterPlacement(activeSelections, v);
      }
    };

    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', handleOptionToggle);
    item.addEventListener('click', (e) => {
      if (e) e.stopPropagation();
      if (e.target !== cb) {
        cb.checked = !cb.checked;
        handleOptionToggle(e);
      }
    });

    menu.appendChild(item);
  });

  toggleBtn.addEventListener('click', (e) => {
    if (e) e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('click', (e) => {
      if (typeof multiselect.contains === 'function' && !multiselect.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  }

  multiselect.appendChild(toggleBtn);
  multiselect.appendChild(menu);
  container.appendChild(multiselect);

  return container;
}

/**
 * Position dock modules to top, center, or bottom of plot bounding box.
 * @param {'top'|'center'|'bottom'} [orientation]
 * @param {object} [viewer]
 */
export function applyDocksVerticalOrientation(orientation = null, viewer = null) {
  const v = viewer || activeViewerInstance || (typeof window !== 'undefined' ? window.viewer : null);
  const orient = orientation || getDocksVerticalOrientation();
  isDocksVerticalApplied = true;
  if (!v || !v.modulesGroup || !v.modulesGroup.children || v.modulesGroup.children.length === 0) return;
  // No Perimeter stack is kept: the docks are placed by the Vertical level alone
  for (const m of v.modulesGroup.children) if (m?.userData) delete m.userData.perimeterStacked;
  const plotBounds = getPlotBoundingBox(v.currentPlotConfig || getCurrentPlotConfig());
  const centerY = plotBounds.centerY !== undefined ? plotBounds.centerY : (plotBounds.maxY + plotBounds.minY) / 2;

  let anyMoved = false;
  v.modulesGroup.children.forEach(mod => {
    const cat = (moduleCategoryOf(mod) || '').toLowerCase();
    const macro = (mod.userData?.macro || mod.macro || '').toLowerCase();
    const isDockOrPier = cat === 'docks' || cat === 'dock' || cat === 'pier' || macro.includes('dock') || macro.includes('pier');
    if (isDockOrPier) {
      const s = (v.getModuleInitialSize ? v.getModuleInitialSize(mod) : null) || defaultModuleSize(mod) || { x: 100, y: 100, z: 100 };
      const halfY = (s.y || 100) / 2;
      let newY;
      if (orient === 'top') {
        newY = plotBounds.maxY - halfY;
      } else if (orient === 'center') {
        newY = centerY;
      } else if (orient === 'bottom') {
        newY = plotBounds.minY + halfY;
      }
      if (newY !== undefined) {
        const curX = mod.position?.x ?? 0;
        const curZ = mod.position?.z ?? 0;
        const pos = { x: curX, y: newY, z: curZ };
        clampModulePositionToPlot(pos, s, plotBounds);
        if (typeof mod.position?.set === 'function') {
          mod.position.set(pos.x, pos.y, pos.z);
        } else if (mod.position) {
          mod.position.y = pos.y;
        }
        anyMoved = true;
      }
    }
  });

  // Piers' docking lanes always point out of the plot, whichever orientation the docks take
  if (orientPierLanesOutward(v.modulesGroup.children, plotBounds, v) > 0) anyMoved = true;

  if (anyMoved) {
    ensureNoBoundingBoxOverlaps(v.modulesGroup.children, plotBounds, {
      gap: 15,
      getModuleSize: (m) => (v.getModuleInitialSize ? v.getModuleInitialSize(m) : null) || defaultModuleSize(m),
      applyToObjects: true
    });

    // Insure any Layout Orientations don't have any module BB extend outside the plot BB
    keepModulesInsidePlot(v.modulesGroup.children, plotBounds, v);
    // Docks settled first; then the other modules placed around them, out of the pier zones
    placeModulesAroundDocks(v.modulesGroup.children, plotBounds, v);
    // Nothing may block a pier's prongs out to the plot wall
    clearPierProngCorridors(v.modulesGroup.children, plotBounds, v);

    if (typeof v.updatePlotBoxViolations === 'function') {
      v.updatePlotBoxViolations();
    }
    if (typeof v.renderScene === 'function') {
      v.renderScene();
    } else if (typeof v.render === 'function') {
      v.render();
    }
  }
}

/**
 * Check if "Layers - Docks-1" is currently present in the active Actionable Decorators.
 * @returns {boolean}
 */
export function isDocks1Present() {
  if (typeof activeActionableElements === 'undefined' || !Array.isArray(activeActionableElements)) {
    return false;
  }
  return activeActionableElements.some(e =>
    e.decoratorId === 'layers' &&
    ((e.elementName && /docks-1/i.test(e.elementName)) ||
     ((e.category || '').toLowerCase() === 'docks' && Number(e.layerNumber) === 1) ||
     (e.id && /layers[:\-_]docks[-_]?1/i.test(e.id)))
  );
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

  const docksOrientation = options.docksVerticalOrientation !== undefined
    ? options.docksVerticalOrientation
    : (isDocks1Present() ? getDocksVerticalOrientation() : null);

  return StationLayoutEngine.calculateLayeredPlacement(modules, {
    plotBounds: plotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG,
    categoryOrder: layerOrder || getLayerPlacementCategoryOrder(),
    getCategory: moduleCategoryOf,
    getModuleSize: options.getModuleSize || defaultModuleSize,
    // Piers are placed before any other module
    placeFirst: isPierModule,
    alignmentAnchor,
    defaultAlignmentKeys,
    gap: options.gap,
    docksVerticalOrientation: docksOrientation,
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
    // Piers are placed before any other module
    placeFirst: isPierModule,
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

    const isDocks1 = (item.elementName && /docks-1/i.test(item.elementName)) ||
                     ((item.category || '').toLowerCase() === 'docks' && Number(item.layerNumber) === 1) ||
                     (item.id && /layers[:\-_]docks[-_]?1/i.test(item.id));

    if (isDocks1) {
      const orientationText = document.createElement('span');
      orientationText.className = 'layer-orientation-text';
      orientationText.textContent = 'Orientation:';
      extraRow.appendChild(orientationText);

      const vertGroup = document.createElement('div');
      vertGroup.className = 'layer-vertical-dropdown-group';

      const vertLabel = document.createElement('label');
      vertLabel.className = 'layer-vertical-label';
      vertLabel.htmlFor = 'actionable-docks-vertical-select';
      vertLabel.textContent = 'Vertical';
      vertGroup.appendChild(vertLabel);

      const vertSelect = document.createElement('select');
      vertSelect.id = 'actionable-docks-vertical-select';
      vertSelect.className = 'cyber-select-orientation cyber-select-vertical';
      vertSelect.title = 'Vertical orientation for Dock modules within plot bounding box';
      if (typeof vertSelect.setAttribute === 'function') {
        vertSelect.setAttribute('aria-label', 'Vertical');
      }

      const vertOptions = ['top', 'center', 'bottom'];
      const currentOrientation = getDocksVerticalOrientation();
      vertOptions.forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = optVal;
        if (optVal === currentOrientation) {
          opt.selected = true;
        }
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          setDocksVerticalOrientation(optVal, activeViewerInstance);
        });
        vertSelect.appendChild(opt);
      });

      const applyOrientationSelection = (e) => {
        if (e) e.stopPropagation();
        const chosen = vertSelect.value;
        if (chosen && ['top', 'center', 'bottom'].includes(chosen)) {
          setDocksVerticalOrientation(chosen, activeViewerInstance);
        }
      };

      vertSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isDocksVerticalAppliedToCurrentPlan()) {
          applyOrientationSelection(e);
        }
      });
      vertSelect.addEventListener('change', applyOrientationSelection);
      vertSelect.addEventListener('input', applyOrientationSelection);
      vertGroup.appendChild(vertSelect);
      extraRow.appendChild(vertGroup);

      const perimeterGroup = createPerimeterMultiSelectGroup('actionable-docks', activeViewerInstance);
      extraRow.appendChild(perimeterGroup);
    }

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

    const isDocks1 = (layer.elementName && /docks-1/i.test(layer.elementName)) ||
                     ((layer.category || '').toLowerCase() === 'docks' && Number(layer.layerNumber) === 1) ||
                     (layer.id && /layers[:\-_]docks[-_]?1/i.test(layer.id));

    if (isDocks1) {
      const orientationText = document.createElement('span');
      orientationText.className = 'layer-orientation-text';
      orientationText.textContent = 'Orientation:';
      leftGroup.appendChild(orientationText);

      // Slide Vertical drop-down just outside the Orientation label
      const vertGroup = document.createElement('div');
      vertGroup.className = 'layer-vertical-dropdown-group';

      const vertLabel = document.createElement('label');
      vertLabel.className = 'layer-vertical-label';
      vertLabel.htmlFor = 'docks-vertical-select';
      vertLabel.textContent = 'Vertical';
      vertGroup.appendChild(vertLabel);

      const vertSelect = document.createElement('select');
      vertSelect.id = 'docks-vertical-select';
      vertSelect.className = 'cyber-select-orientation cyber-select-vertical';
      vertSelect.title = 'Vertical orientation for Dock modules within plot bounding box';
      if (typeof vertSelect.setAttribute === 'function') {
        vertSelect.setAttribute('aria-label', 'Vertical');
      }

      const vertOptions = ['top', 'center', 'bottom'];
      const currentOrientation = getDocksVerticalOrientation();
      vertOptions.forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = optVal;
        if (optVal === currentOrientation) {
          opt.selected = true;
        }
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          setDocksVerticalOrientation(optVal, activeViewerInstance);
        });
        vertSelect.appendChild(opt);
      });

      const applyOrientationSelection = (e) => {
        if (e) e.stopPropagation();
        const chosen = vertSelect.value;
        if (chosen && ['top', 'center', 'bottom'].includes(chosen)) {
          setDocksVerticalOrientation(chosen, activeViewerInstance);
        }
      };

      vertSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isDocksVerticalAppliedToCurrentPlan()) {
          applyOrientationSelection(e);
        }
      });
      vertSelect.addEventListener('change', applyOrientationSelection);
      vertSelect.addEventListener('input', applyOrientationSelection);
      vertGroup.appendChild(vertSelect);

      leftGroup.appendChild(vertGroup);
    }

    itemEl.appendChild(leftGroup);

    // Right group: Perimeter multi-selection + Category switch dropdown + Remove button
    const rightGroup = document.createElement('div');
    rightGroup.className = 'unified-layer-right';

    if (isDocks1) {
      const perimeterGroup = createPerimeterMultiSelectGroup('docks', activeViewerInstance);
      rightGroup.appendChild(perimeterGroup);
    }

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

    const btnSpacing = document.createElement('button');
    btnSpacing.className = 'btn-xs-cyber';
    btnSpacing.textContent = '+ Spacing & Offset';
    btnSpacing.addEventListener('click', () => addActionableElement('spacing-offset', 0));
    quickActions.appendChild(btnSpacing);

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

  // Wire up Blueprint toggle outside Layout text
  const blueprintToggle = document.getElementById('toggle-blueprint');
  if (blueprintToggle && !blueprintToggle._displayPanelListenerAttached) {
    blueprintToggle._displayPanelListenerAttached = true;
    blueprintToggle.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    blueprintToggle.addEventListener('change', (e) => {
      setBlueprintModeActive(e.target.checked, viewer);
    });
  }

  // Always start any load with the Plot pill minimized
  isPlotMinimized = true;

  if (btnToggle && panelCard) {
    btnToggle.addEventListener('click', (e) => {
      if (e.target && (e.target.closest('#toggle-blueprint') || e.target.closest('.layout-blueprint-toggle'))) {
        return;
      }
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
