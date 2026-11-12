import { parseConstructionPlan } from './parser.js';
import { StationViewer } from './viewer.js';
import { SAMPLES } from './samples.js';
import {
  getModuleCategory,
  getFriendlyName,
  estimateModuleCosts,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  getInitialModuleDimensions
} from '@x4/catalog';
import { setFefbModuleIndex } from './blueprint-exporter.js';
import { initModuleDisplayPanel, setActiveBlueprint, setBlueprintModeActive } from './module-display-panel.js';
import { compositionRoot } from './composition-root.js';
import { collapseUndoHistory, initUndoHistory, performUndo, recordMove, undoList, updateUndoButtonUI } from './app/undo-history.js';
import { excludedMacros, getSavedCheckboxState, loadSavedExcludedMacros, saveCheckboxState, saveExcludedMacros } from './app/ui-preferences.js';
import { exportCurrentPlanAsBlueprint, initBlueprintExport } from './app/blueprint-export.js';
import { getDefaultSampleKey, initSampleLibrary, initSamplesStorage, setDefaultSampleKey, setupSampleActionModalEvents, setupSampleCustomDropdownEvents, updateCustomSampleDropdownSelection } from './app/sample-library.js';
import { getResourceMetadata } from './app/resource-metadata.js';
import { setPanelCollapsed, setupStructureAnalysisCollapseHandlers } from './app/panel-collapse.js';
import { initCenterModulesModal, setupCenterModulesModalEvents } from './app/center-modules-modal.js';
import { clearBuildAnimator, initBuildAnimator, resetAnimator, setupBuildAnimatorControls } from './app/build-animator.js';
import { warnIfGameAssetsMissing } from './app/game-assets-check.js';
export { exportCurrentPlanAsBlueprint } from './app/blueprint-export.js';
export { historyManager, undoList, collapseUndoHistory, recordMove, updateUndoButtonUI, performUndo } from './app/undo-history.js';


let viewer = null;
let currentPlan = null;
let currentLoadedSampleKey = null;
let selectedIndex = null;
let activeCategoryFilter = 'all';
let activeMacroFilter = null;

// Component Visibility macro cycling state
let cycleMacro = null;
let cycleCounter = 0;
let cycleCount = 0;
let cycleModules = [];

// Connect extracted app modules to this controller's state and actions
initUndoHistory({
  getViewer: () => viewer,
  getCurrentPlan: () => currentPlan,
  getSelectedIndex: () => selectedIndex,
  updateStationStats,
  recalculateMeasurements,
  selectModule,
  showNotification
});
initSampleLibrary({
  getCurrentSampleKey: () => currentLoadedSampleKey,
  setCurrentSampleKey: (value) => { currentLoadedSampleKey = value; },
  loadSample,
  showNotification
});
initBlueprintExport({
  getViewer: () => viewer,
  getCurrentPlan: () => currentPlan,
  loadPlanFromXml,
  updatePlanMetadata,
  selectModule,
  showNotification
});
initCenterModulesModal({
  getViewer: () => viewer,
  getCurrentPlan: () => currentPlan,
  updateStationStats,
  recalculateMeasurements,
  showNotification
});
initBuildAnimator({ getViewer: () => viewer, getCurrentPlan: () => currentPlan });

// Expose blueprint/plan actions on window (kept from before the split; handy from the dev console)
if (typeof window !== 'undefined') {
  window.exportCurrentPlanAsBlueprint = exportCurrentPlanAsBlueprint;
  window.loadPlanFromXml = loadPlanFromXml;
  window.selectModule = selectModule;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. Initialize viewer
  viewer = new StationViewer(container, (index) => {
    if (index === null) {
      // Do nothing: continue the component displayed and its orientation without stepping to next component
    } else {
      selectModule(index, false); // Clicked in 3D, select in UI list but don't focus camera (to avoid disorienting user)
    }
  });
  compositionRoot.setViewer(viewer);
  window.viewer = viewer;

  // The X4 game assets are not distributed with the app; explain if they are missing, and draw
  // placeholders without trying to download models in that case
  const assetCheck = warnIfGameAssetsMissing();
  viewer.setGameAssetsAvailability(assetCheck.then((result) => result.available));
  assetCheck.catch((err) => console.warn('[!] Game asset check failed:', err));

  // Handle real-time continuous movement from 3D axis translation arrows
  viewer.onModuleMoved = (index, pos, isFinal) => {
    const detPos = document.getElementById('det-pos');
    if (detPos) {
      detPos.textContent = `X: ${pos.x}m | Y: ${pos.y}m | Z: ${pos.z}m`;
    }

    const coordCell = document.getElementById(`mod-coords-${index}`);
    if (coordCell) {
      coordCell.textContent = `${pos.x}, ${pos.y}, ${pos.z}`;
    }

    if (isFinal) {
      updateStationStats();
    }
  };

  // Handle real-time continuous rotation from 3D rotation rings (Yaw, Pitch, Roll)
  viewer.onModuleRotated = (index, rot, isFinal) => {
    if (!rot) return;

    const detRot = document.getElementById('det-rot');
    if (detRot) {
      detRot.textContent = `Yaw: ${rot.yaw}° | Pitch: ${rot.pitch}° | Roll: ${rot.roll}°`;
    }

    const inputPitch = document.getElementById('det-input-pitch');
    const inputRoll = document.getElementById('det-input-roll');
    const inputYaw = document.getElementById('det-input-yaw');
    if (inputPitch && document.activeElement !== inputPitch) inputPitch.value = rot.pitch;
    if (inputRoll && document.activeElement !== inputRoll) inputRoll.value = rot.roll;
    if (inputYaw && document.activeElement !== inputYaw) inputYaw.value = rot.yaw;

    if (isFinal) {
      updateStationStats();
      recalculateMeasurements();
    }
  };

  // Set up move committed listener for Undo tracking
  viewer.onMoveCommitted = (move) => {
    recordMove(move);
  };
  viewer.onUndoHistoryCollapse = () => {
    collapseUndoHistory();
  };
  updateUndoButtonUI();

  // Multi-modules selection callback from 3D viewport marquee selection
  viewer.onMultiModulesSelected = (indices) => {
    document.querySelectorAll('.module-list-row.selected').forEach(row => row.classList.remove('selected'));
    if (indices && indices.length > 0) {
      indices.forEach(idx => {
        const row = document.getElementById(`mod-row-${idx}`);
        if (row) row.classList.add('selected');
      });
      const card = document.getElementById('details-card');
      const placeholder = document.getElementById('details-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      if (card) card.classList.remove('hidden');

      const detTitle = document.getElementById('det-title');
      if (detTitle) detTitle.textContent = `${indices.length} Modules Selected`;

      const catTag = document.getElementById('det-category');
      if (catTag) {
        catTag.textContent = 'GROUP SELECTION';
        catTag.style.backgroundColor = 'rgba(0, 245, 255, 0.2)';
        catTag.style.borderColor = 'var(--neon-cyan)';
        catTag.style.color = 'var(--neon-cyan)';
      }
    }
  };

  // 2. Initialize sample plans storage & selector
  initSamplesStorage();

  // 3. Initialize Module Display & Placement Behaviors Panel (5-checkbox examination system)
  initModuleDisplayPanel(viewer);

  // 4. Set up event listeners
  setupEventListeners();

  // 4. Load default sample plan (restores the currently checked sample across reloads)
  const defaultKey = getDefaultSampleKey();
  if (defaultKey) {
    loadSample(defaultKey);
  }
}

function hideInitialAppLoader() {
  const loader = document.getElementById('initial-app-loader');
  if (loader && !loader.classList.contains('fade-out')) {
    loader.classList.add('fade-out');
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 600);
  }
}

function findMatchingSampleKey(planData, xmlText) {
  if (!planData || !SAMPLES) return null;
  const planId = (planData.id || '').trim();
  const planName = (planData.name || '').trim();

  for (const key of Object.keys(SAMPLES)) {
    const sampleXml = SAMPLES[key];
    if (!sampleXml) continue;

    if (xmlText && sampleXml.trim() === xmlText.trim()) {
      return key;
    }

    try {
      const idMatch = sampleXml.match(/<plan\s+[^>]*id="([^"]+)"/i);
      const nameMatch = sampleXml.match(/<plan\s+[^>]*name="([^"]+)"/i);
      const sId = idMatch ? idMatch[1].trim() : '';
      const sName = nameMatch ? nameMatch[1].trim() : '';

      if (planId && sId && planId === sId) {
        return key;
      }
      if (planName && sName && planName === sName) {
        return key;
      }
    } catch (_) {}
  }
  return null;
}

function loadSample(sampleKey) {
  const xml = SAMPLES[sampleKey];
  if (xml) {
    try {
      currentLoadedSampleKey = sampleKey;
      loadPlanFromXml(xml, sampleKey);
      const selector = document.getElementById('sample-selector');
      if (selector) selector.value = sampleKey;
      setDefaultSampleKey(sampleKey);
      updateCustomSampleDropdownSelection(sampleKey);
    } catch (e) {
      hideInitialAppLoader();
      showNotification('Error loading sample: ' + e.message, 'error');
    }
  } else {
    hideInitialAppLoader();
  }
}

async function loadPlanFromXml(xmlText, sourceSampleKey = null) {
  // Clear all panels silently before loading different model
  clearAllPanels(true);

  // Show loading status in the station plan profile panel
  document.getElementById('plan-name').textContent = 'Loading...';
  document.getElementById('plan-desc').textContent = 'Loading station models and assets...';
  const planIdEl = document.getElementById('plan-id');
  if (planIdEl) {
    planIdEl.textContent = 'Loading...';
    planIdEl.title = 'Loading...';
  }

  const planData = parseConstructionPlan(xmlText);
  currentPlan = planData;
  setActiveBlueprint(planData.id, planData.name);
  setFefbModuleIndex(null);
  if (viewer) {
    viewer.fefbModuleIndex = null;
    viewer.fefbModule = null;
    viewer.pendingSingleModule = null;
  }
  selectedIndex = null;
  activeCategoryFilter = 'all';
  activeMacroFilter = null;
  loadSavedExcludedMacros();
  updateActiveFilterUI();

  try {
    // Load into 3D viewer (await async mesh loading)
    await viewer.loadStationPlan(planData);

    // Apply any restored excluded macros to hide them in 3D
    if (excludedMacros.size > 0) {
      excludedMacros.forEach(macro => {
        viewer.setMacroVisibility(macro, false);
      });
    }

    // Update UI Panels
    updatePlanMetadata(planData);
    calculateAndRenderStats(planData);
    renderVisibilityControls(planData);
    renderModuleList(planData.modules);
    resetAnimator();
    viewer.highlightModulesByFilter('all', null);

    // Recalculate model measurements based on loaded Three.js meshes
    recalculateMeasurements();

    // Check if the loaded plan is in the Samples list
    const matchedSampleKey = sourceSampleKey || findMatchingSampleKey(planData, xmlText);
    if (matchedSampleKey && SAMPLES[matchedSampleKey]) {
      currentLoadedSampleKey = matchedSampleKey;
      const selector = document.getElementById('sample-selector');
      if (selector) selector.value = matchedSampleKey;
      updateCustomSampleDropdownSelection(matchedSampleKey);
    } else {
      currentLoadedSampleKey = null;
      const selector = document.getElementById('sample-selector');
      if (selector) selector.value = '';
      updateCustomSampleDropdownSelection(null);
    }

    showNotification(`Successfully loaded plan "${planData.name}" with ${planData.modules.length} modules!`, 'success');
  } catch (err) {
    console.error('Error loading station plan:', err);
    showNotification('Error loading plan: ' + err.message, 'error');
  } finally {
    hideInitialAppLoader();
  }
}

function updatePlanMetadata(plan) {
  document.getElementById('plan-name').textContent = plan.name;
  document.getElementById('plan-desc').textContent = plan.description;
  const fullId = plan.id || '';
  const planIdEl = document.getElementById('plan-id');
  planIdEl.textContent = fullId.length > 8 ? '...' + fullId.slice(-8) : fullId;
  planIdEl.title = fullId;
}

function updateStationStats() {
  if (currentPlan) {
    calculateAndRenderStats(currentPlan);
  }
}

function calculateAndRenderStats(plan) {
  const modules = plan.modules;
  const totalCount = modules.length;

  // Category counts and macro lists
  const categoryData = {
    docks: { count: 0, macros: {} },
    production: { count: 0, macros: {} },
    storage: { count: 0, macros: {} },
    habitation: { count: 0, macros: {} },
    defense: { count: 0, macros: {} },
    structure: { count: 0, macros: {} }
  };

  // Resource totals initialized dynamically
  const totalResources = {};

  modules.forEach(mod => {
    const cat = getModuleCategory(mod.macro);
    if (categoryData[cat]) {
      categoryData[cat].count++;
      categoryData[cat].macros[mod.macro] = (categoryData[cat].macros[mod.macro] || 0) + 1;
    }

    if (!excludedMacros.has(mod.macro)) {
      const costs = estimateModuleCosts(mod.macro);
      for (const key in costs) {
        if (costs[key] > 0) {
          totalResources[key] = (totalResources[key] || 0) + costs[key];
        }
      }
    }
  });

  // Update DOM counts
  document.getElementById('stat-total-modules').textContent = totalCount;
  document.getElementById('stat-docks').textContent = categoryData.docks.count;
  document.getElementById('stat-production').textContent = categoryData.production.count;
  document.getElementById('stat-storage').textContent = categoryData.storage.count;
  document.getElementById('stat-habitation').textContent = categoryData.habitation.count;
  document.getElementById('stat-defense').textContent = categoryData.defense.count;
  document.getElementById('stat-structure').textContent = categoryData.structure.count;

  // Render macro lists inside stat boxes
  const categories = ['docks', 'production', 'storage', 'habitation', 'defense', 'structure'];
  
  categories.forEach(cat => {
    const macrosContainer = document.getElementById(`stat-macros-${cat}`);
    if (macrosContainer) {
      macrosContainer.innerHTML = '';
      const macroCounts = categoryData[cat].macros;
      
      for (const macro in macroCounts) {
        const count = macroCounts[macro];
        const item = document.createElement('div');
        item.className = 'stat-macro-item';
        item.setAttribute('data-macro', macro);
        if (activeMacroFilter === macro) {
          item.classList.add('active-macro-filter');
        }
        
        // Clean display name slightly for brevity in stats box
        const shortName = macro.replace('_macro', '').replace('struct_', '').replace('dock_', '').replace('prod_', '').replace('storage_', '').replace('hab_', '').replace('defense_', '');
        
        item.innerHTML = `
          <span title="${macro}">${shortName}</span>
          <span class="macro-count">${count}</span>
        `;
        
        item.addEventListener('click', (e) => {
          e.stopPropagation(); // Avoid triggering parent stat box click
          
          // Clear any previous Component Visibility highlight
          clearComponentVisibilityHighlights();
          clearPersistentHighlights();

          // Colorized checkbox should be unchecked for analysis
          const colorizedCb = document.getElementById('colorized-checkbox');
          if (colorizedCb && colorizedCb.checked) {
            colorizedCb.checked = false;
            saveCheckboxState('colorized-checkbox', false);
            if (viewer && typeof viewer.setColorized === 'function') {
              viewer.setColorized(false);
            }
          }
          
          if (activeMacroFilter === macro) {
            activeMacroFilter = null;
          } else {
            activeMacroFilter = macro;
            activeCategoryFilter = cat; // Insure category matches
          }
          
          updateActiveFilterUI();
          calculateAndRenderStats(currentPlan);
          renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
          viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
          
          if (activeMacroFilter) {
            scrollAndHighlightVisibilityComponent(activeCategoryFilter, activeMacroFilter);
          }
        });
        
        macrosContainer.appendChild(item);
      }
    }
  });

  // For the 'all' stats box, we can list all macros in the plan
  const macrosAllContainer = document.getElementById('stat-macros-all');
  if (macrosAllContainer) {
    macrosAllContainer.innerHTML = '';
    
    // Group all macros
    const allMacros = {};
    modules.forEach(mod => {
      allMacros[mod.macro] = (allMacros[mod.macro] || 0) + 1;
    });

    for (const macro in allMacros) {
      const count = allMacros[macro];
      const item = document.createElement('div');
      item.className = 'stat-macro-item';
      item.setAttribute('data-macro', macro);
      if (activeMacroFilter === macro) {
        item.classList.add('active-macro-filter');
      }
      
      const shortName = macro.replace('_macro', '').replace('struct_', '').replace('dock_', '').replace('prod_', '').replace('storage_', '').replace('hab_', '').replace('defense_', '');
      
      item.innerHTML = `
        <span title="${macro}">${shortName}</span>
        <span class="macro-count">${count}</span>
      `;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Clear any previous Component Visibility highlight
        clearComponentVisibilityHighlights();
        clearPersistentHighlights();
        
        if (activeMacroFilter === macro) {
          activeMacroFilter = null;
        } else {
          activeMacroFilter = macro;
          activeCategoryFilter = 'all'; // Set category to all since we clicked in total modules box
        }
        
        updateActiveFilterUI();
        calculateAndRenderStats(currentPlan);
        renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
        viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
        
        if (activeMacroFilter) {
          const cat = getModuleCategory(macro);
          scrollAndHighlightVisibilityComponent(cat, activeMacroFilter);
        }
      });
      
      macrosAllContainer.appendChild(item);
    }
  }

  // Update resources dynamically
  const container = document.getElementById('resources-list-container');
  if (container) {
    container.innerHTML = '';
    let hasAnyCosts = false;

    for (const key in totalResources) {
      const amount = totalResources[key];
      if (amount > 0) {
        hasAnyCosts = true;
        const meta = getResourceMetadata(key);
        
        const card = document.createElement('div');
        const colorClass = meta.colorClass;
        const themeColor = colorClass.split('-')[1] || 'cyan';
        card.className = `resource-component-card border-${themeColor}`;
        card.innerHTML = `
          <span class="res-name">${meta.name}</span>
          <span class="res-val ${colorClass}">${amount.toLocaleString()}</span>
          <span class="res-desc">${meta.desc}</span>
        `;
        container.appendChild(card);
      }
    }

    if (!hasAnyCosts) {
      container.innerHTML = `<div class="placeholder-content" style="height: auto; padding: 10px;"><p>No construction resources estimated for this plan.</p></div>`;
    }
  }

  // Recalculate model measurements
  recalculateMeasurements();
}

function recalculateMeasurements() {
  const sizeX = document.getElementById('stat-size-x');
  const sizeY = document.getElementById('stat-size-y');
  const sizeZ = document.getElementById('stat-size-z');
  if (!sizeX || !sizeY || !sizeZ) return;

  const measurements = (viewer && typeof viewer.getStationMeasurements === 'function') ? viewer.getStationMeasurements() : null;
  if (measurements) {
    sizeX.textContent = Math.round(measurements.x) + 'm';
    sizeY.textContent = Math.round(measurements.y) + 'm';
    sizeZ.textContent = Math.round(measurements.z) + 'm';
  } else if (currentPlan && currentPlan.modules && currentPlan.modules.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    currentPlan.modules.forEach(m => {
      const size = getInitialModuleDimensions(m.macro);
      minX = Math.min(minX, m.position.x - size.x / 2);
      maxX = Math.max(maxX, m.position.x + size.x / 2);
      minY = Math.min(minY, m.position.y - size.y / 2);
      maxY = Math.max(maxY, m.position.y + size.y / 2);
      minZ = Math.min(minZ, m.position.z - size.z / 2);
      maxZ = Math.max(maxZ, m.position.z + size.z / 2);
    });

    const w = Math.round(maxX - minX);
    const h = Math.round(maxY - minY);
    const d = Math.round(maxZ - minZ);

    sizeX.textContent = w + 'm';
    sizeY.textContent = h + 'm';
    sizeZ.textContent = d + 'm';
  } else {
    sizeX.textContent = '0m';
    sizeY.textContent = '0m';
    sizeZ.textContent = '0m';
  }
}

function renderModuleList(modules, filterText = '') {
  const tbody = document.getElementById('module-list-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const search = filterText.toLowerCase();

  modules.forEach(mod => {
    const friendlyName = getFriendlyName(mod.macro);
    const category = getModuleCategory(mod.macro);
    
    // Category Filter
    if (activeCategoryFilter !== 'all' && category !== activeCategoryFilter) {
      return;
    }

    // Macro Filter
    if (activeMacroFilter && mod.macro !== activeMacroFilter) {
      return;
    }

    // Filter by index, raw macro, or friendly name
    if (search && 
        !mod.index.toString().includes(search) && 
        !mod.macro.toLowerCase().includes(search) && 
        !friendlyName.toLowerCase().includes(search)) {
      return;
    }

    const tr = document.createElement('tr');
    tr.id = `mod-row-${mod.index}`;
    tr.className = 'module-list-row';
    if (selectedIndex === mod.index) {
      tr.classList.add('selected');
    }
    if (excludedMacros.has(mod.macro)) {
      tr.classList.add('excluded-row');
    }

    tr.innerHTML = `
      <td class="col-name">
        <div class="name-friendly">${friendlyName}</div>
        <div class="name-macro">${mod.macro}</div>
      </td>
      <td class="col-category">
        <span class="category-tag" style="background-color: ${CATEGORY_COLORS[category]}15; border-color: ${CATEGORY_COLORS[category]}; color: ${CATEGORY_COLORS[category]}">
          ${CATEGORY_NAMES[category].split(' ')[0]}
        </span>
      </td>
      <td class="col-coords" id="mod-coords-${mod.index}">${Math.round(mod.position.x)}, ${Math.round(mod.position.y)}, ${Math.round(mod.position.z)}</td>
    `;

    tr.addEventListener('click', () => {
      selectModule(mod.index, false); // Do not resize or zoom
    });

    tbody.appendChild(tr);
  });
}

function renderVisibilityControls(plan) {
  const container = document.getElementById('visibility-controls-container');
  if (!container) return;

  container.innerHTML = '';

  const showAllBtn = document.getElementById('btn-visibility-show-all');
  if (showAllBtn) {
    if (excludedMacros.size === 0) {
      showAllBtn.textContent = 'Hide All';
      showAllBtn.setAttribute('title', 'Hide all components');
    } else {
      showAllBtn.textContent = 'Show All';
      showAllBtn.setAttribute('title', 'Show all components');
    }
  }

  const modules = plan.modules;
  
  // Group modules by category and count unique macros
  const categoryMacros = {
    docks: {},
    production: {},
    storage: {},
    habitation: {},
    defense: {},
    structure: {}
  };

  modules.forEach(mod => {
    const cat = getModuleCategory(mod.macro);
    if (categoryMacros[cat]) {
      categoryMacros[cat][mod.macro] = (categoryMacros[cat][mod.macro] || 0) + 1;
    }
  });

  const categories = ['docks', 'production', 'storage', 'habitation', 'defense', 'structure'];

  categories.forEach(cat => {
    const macros = categoryMacros[cat];
    const macroKeys = Object.keys(macros);
    if (macroKeys.length === 0) return;

    // Check if all macros in this category are excluded
    const allExcluded = macroKeys.every(m => excludedMacros.has(m));
    const toggleLabel = allExcluded ? 'Show All' : 'Hide All';

    // Render Category Header
    const catHeader = document.createElement('div');
    catHeader.className = 'visibility-cat-header';
    catHeader.setAttribute('data-category', cat);
    catHeader.innerHTML = `
      <span class="visibility-cat-title" style="color: ${CATEGORY_COLORS[cat]}" title="Click to zoom/center on all visible ${CATEGORY_NAMES[cat]} components">${CATEGORY_NAMES[cat]}</span>
      <button class="visibility-cat-toggle-btn" title="${toggleLabel} category components">${toggleLabel}</button>
    `;
    container.appendChild(catHeader);

    // Bind Category Title click to fit camera (only if category has visible components)
    const catTitle = catHeader.querySelector('.visibility-cat-title');
    catTitle.addEventListener('click', () => {
      const allExcludedNow = macroKeys.every(m => excludedMacros.has(m));
      if (allExcludedNow) return;
      viewer.fitCameraToSelection(cat);
      selectClosestCategoryModuleToCenter(cat);
    });

    // Bind Category Toggle click
    const toggleBtn = catHeader.querySelector('.visibility-cat-toggle-btn');
    toggleBtn.addEventListener('click', () => {
      macroKeys.forEach(macro => {
        if (allExcluded) {
          excludedMacros.delete(macro);
          viewer.setMacroVisibility(macro, true);
        } else {
          excludedMacros.add(macro);
          viewer.setMacroVisibility(macro, false);
        }
      });
      saveExcludedMacros();

      // Refresh UI state
      renderVisibilityControls(currentPlan);
      calculateAndRenderStats(currentPlan);
      renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
      viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
      scrollAndHighlightLeftCategory(cat);

      // Auto-focus category ONLY if shown from an all-hidden state, never when hiding/unchecking
      if (allExcluded) {
        viewer.fitCameraToSelection(cat);
        selectClosestCategoryModuleToCenter(cat);
      }
    });

    // Render Macro Checklist
    macroKeys.forEach(macro => {
      const count = macros[macro];
      const friendlyName = getFriendlyName(macro);
      const isExcluded = excludedMacros.has(macro);

      const row = document.createElement('div');
      row.className = `visibility-row${isExcluded ? ' is-unchecked' : ''}`;
      row.setAttribute('data-category', cat);
      row.setAttribute('data-macro', macro);
      
      const checkboxId = `vis-chk-${macro.replace(/[^a-zA-Z0-9]/g, '_')}`;

      row.innerHTML = `
        <div class="visibility-item-left">
          <label class="visibility-checkbox-label" for="${checkboxId}" title="Toggle visibility of ${friendlyName}">
            <input type="checkbox" id="${checkboxId}" ${!isExcluded ? 'checked' : ''}>
          </label>
          <span class="macro-text-btn${isExcluded ? ' is-excluded' : ''}" title="${isExcluded ? `${friendlyName} is hidden (unchecked)` : `Click to zoom/center on ${friendlyName}`}">${friendlyName}</span>
        </div>
        <span class="macro-count-badge" title="Click to cycle inspect ${friendlyName}">${count}</span>
      `;

      // Click handler on macro-count-badge to cycle inspect matching components
      const badge = row.querySelector('.macro-count-badge');
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (!currentPlan) return;
        // Do not cycle inspect or re-orient if this entry is unchecked
        if (excludedMacros.has(macro)) return;

        if (cycleMacro !== macro) {
          cycleMacro = macro;
          cycleModules = currentPlan.modules.filter(m => m.macro === macro);
          cycleCount = cycleModules.length;
          cycleCounter = cycleCount;
        } else {
          cycleCounter--;
        }

        if (cycleCounter < 0) {
          cycleCounter = cycleCount - 1;
        }

        const displayIndex = cycleCounter % cycleCount;
        const targetModule = cycleModules[displayIndex];
        if (targetModule) {
          selectModule(targetModule.index, true);
        }
      });

      // Click handler specifically on macro text button to center/zoom ONLY if visible and explicitly clicked
      const textBtn = row.querySelector('.macro-text-btn');
      if (textBtn) {
        textBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Any unchecked entry must NOT cause a re-orientation of main display
          if (excludedMacros.has(macro)) {
            return;
          }
          viewer.fitCameraToSelection(cat, macro);
          scrollAndHighlightLeftMacro(macro);
          selectClosestModuleToCenter(macro);
        });
      }

      // Checkbox change handler: toggles visibility WITHOUT re-orienting main display
      const input = row.querySelector('input');
      input.addEventListener('change', (e) => {
        const isVisible = e.target.checked;
        if (isVisible) {
          excludedMacros.delete(macro);
        } else {
          excludedMacros.add(macro);
          // If currently selected module is of this type, clear the selection details
          if (selectedIndex !== null) {
            const selectedMod = currentPlan.modules.find(m => m.index === selectedIndex);
            if (selectedMod && selectedMod.macro === macro) {
              selectModule(null);
            }
          }
        }
        saveExcludedMacros();

        // Update 3D viewport meshes without any camera re-orientation
        viewer.setMacroVisibility(macro, isVisible);

        // Refresh stats and module list without touching camera
        renderVisibilityControls(currentPlan);
        calculateAndRenderStats(currentPlan);
        renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
        viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
        scrollAndHighlightLeftCategory(cat);

        // NOTE: Any unchecked entry must NOT cause a re-orientation of main display!
      });

      container.appendChild(row);
    });
  });

  const searchInput = document.getElementById('module-search');
  if (searchInput && searchInput.value) {
    filterVisibilityControls(searchInput.value);
  }
}

function filterVisibilityControls(searchVal) {
  const container = document.getElementById('visibility-controls-container');
  if (!container) return;

  const query = searchVal.trim().toLowerCase();

  const headers = container.querySelectorAll('.visibility-cat-header');
  headers.forEach(header => {
    const cat = header.getAttribute('data-category');
    const rows = container.querySelectorAll(`.visibility-row[data-category="${cat}"]`);
    let visibleCount = 0;

    rows.forEach(row => {
      const textBtn = row.querySelector('.macro-text-btn');
      if (textBtn) {
        const name = textBtn.textContent.toLowerCase();
        if (name.includes(query)) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      }
    });

    if (visibleCount > 0 || query === '') {
      header.style.display = '';
    } else {
      header.style.display = 'none';
    }
  });
}

function selectClosestModuleToCenter(macro) {
  if (!currentPlan) return;
  const visibleMembers = currentPlan.modules.filter(m => m.macro === macro && !excludedMacros.has(m.macro));
  if (visibleMembers.length === 0) return;

  let sumX = 0, sumY = 0, sumZ = 0;
  visibleMembers.forEach(m => {
    sumX += m.position.x;
    sumY += m.position.y;
    sumZ += m.position.z;
  });
  const centerX = sumX / visibleMembers.length;
  const centerY = sumY / visibleMembers.length;
  const centerZ = sumZ / visibleMembers.length;

  let closestMember = null;
  let minDist = Infinity;
  visibleMembers.forEach(m => {
    const dx = m.position.x - centerX;
    const dy = m.position.y - centerY;
    const dz = m.position.z - centerZ;
    const distSq = dx*dx + dy*dy + dz*dz;
    if (distSq < minDist) {
      minDist = distSq;
      closestMember = m;
    }
  });

  if (closestMember) {
    selectModule(closestMember.index, false);
  }
}

function selectClosestCategoryModuleToCenter(category) {
  if (!currentPlan) return;
  const visibleMembers = currentPlan.modules.filter(m => {
    const cat = getModuleCategory(m.macro);
    return cat === category && !excludedMacros.has(m.macro);
  });
  if (visibleMembers.length === 0) return;

  let sumX = 0, sumY = 0, sumZ = 0;
  visibleMembers.forEach(m => {
    sumX += m.position.x;
    sumY += m.position.y;
    sumZ += m.position.z;
  });
  const centerX = sumX / visibleMembers.length;
  const centerY = sumY / visibleMembers.length;
  const centerZ = sumZ / visibleMembers.length;

  let closestMember = null;
  let minDist = Infinity;
  visibleMembers.forEach(m => {
    const dx = m.position.x - centerX;
    const dy = m.position.y - centerY;
    const dz = m.position.z - centerZ;
    const distSq = dx*dx + dy*dy + dz*dz;
    if (distSq < minDist) {
      minDist = distSq;
      closestMember = m;
    }
  });

  if (closestMember) {
    selectModule(closestMember.index, false);
  }
}

function clearComponentVisibilityHighlights() {
  const container = document.getElementById('visibility-controls-container') || document;
  container.querySelectorAll('.selected-persistent, .reveal-highlight-cv, .highlighted-cat, .reveal-highlight')
    .forEach(el => el.classList.remove('selected-persistent', 'reveal-highlight-cv', 'highlighted-cat', 'reveal-highlight'));
}

function clearPersistentHighlights() {
  // Clear persistent highlights in Component Visibility
  clearComponentVisibilityHighlights();

  // Clear persistent highlights in Structure Analysis
  document.querySelectorAll('.stat-box.selected-persistent, .stat-macro-item.selected-persistent')
    .forEach(el => el.classList.remove('selected-persistent'));
}

function scrollAndHighlightLeftCategory(category) {
  const statsCard = document.getElementById('card-structure-analysis');
  if (statsCard && statsCard.classList.contains('is-collapsed')) {
    setPanelCollapsed('card-structure-analysis', false);
  }
  const statBox = document.getElementById(`stat-box-${category}`);
  if (statBox) {
    if (statBox.classList.contains('is-collapsed')) {
      setPanelCollapsed(`stat-box-${category}`, false);
    }
    statBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    statBox.classList.add('reveal-highlight');
    setTimeout(() => {
      statBox.classList.remove('reveal-highlight');
    }, 1500);
  }
}

function scrollAndHighlightLeftMacro(macro) {
  const cat = getModuleCategory(macro);
  const statsCard = document.getElementById('card-structure-analysis');
  if (statsCard && statsCard.classList.contains('is-collapsed')) {
    setPanelCollapsed('card-structure-analysis', false);
  }

  const parentCard = document.getElementById(`stat-box-${cat}`);
  if (parentCard) {
    if (parentCard.classList.contains('is-collapsed')) {
      setPanelCollapsed(`stat-box-${cat}`, false);
    }
    parentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    parentCard.classList.add('selected-persistent');
  }

  // Centering macro item in sub-container
  const subContainer = document.getElementById(`stat-macros-${cat}`);
  const macroItem = subContainer?.querySelector(`.stat-macro-item[data-macro="${macro}"]`);
  if (macroItem) {
    macroItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    macroItem.classList.add('selected-persistent');
  }
}

function scrollAndHighlightVisibilityComponent(category, macro = null) {
  const container = document.getElementById('visibility-controls-container');
  if (!container) return;

  // Clear previous Component Visibility highlights first
  clearComponentVisibilityHighlights();

  const target = macro 
    ? container.querySelector(`.visibility-row[data-macro="${macro}"]`)
    : container.querySelector(`.visibility-cat-header[data-category="${category}"]`);

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('selected-persistent');
  }
}

function progressToNextComponent() {
  if (!currentPlan || !currentPlan.modules || currentPlan.modules.length === 0) return;

  const container = document.getElementById('visibility-controls-container');
  if (!container) return;

  const allRows = Array.from(container.querySelectorAll('.visibility-row'));
  const visibleRows = allRows.filter(row => row.style.display !== 'none');
  if (visibleRows.length === 0) return;

  let nextMacro = null;

  if (selectedIndex !== null) {
    const prevMod = currentPlan.modules.find(m => m.index === selectedIndex);
    if (prevMod) {
      const currentMacro = prevMod.macro;
      const currentIndex = visibleRows.findIndex(row => row.getAttribute('data-macro') === currentMacro);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % visibleRows.length;
        nextMacro = visibleRows[nextIndex].getAttribute('data-macro');
      }
    }
  }

  if (!nextMacro) {
    nextMacro = visibleRows[0].getAttribute('data-macro');
  }

  const nextModule = currentPlan.modules.find(m => m.macro === nextMacro);
  if (nextModule) {
    selectModule(nextModule.index, false); // Do not resize or zoom
  }
}

/**
 * Escape CSS attribute selectors safely
 */
function escapeCssAttr(str) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return String(str).replace(/["\\]/g, '\\$&');
}

/**
 * Renders the "Module Components" dropdown for the selected module: one checkbox per
 * component (.dae) file in the module's asset folder. Toggling a checkbox re-renders
 * that module with the chosen components.
 * If Module Components is expanded, reveals the expansion as a floating pill overlaying Module Navigator.
 * @param {number} index
 */
let componentsRenderToken = 0;
async function renderModuleComponentsDropdown(index) {
  const section = document.getElementById('det-components-section');
  const list = document.getElementById('det-components-list');
  const countEl = document.getElementById('det-components-count');
  const folderEl = document.getElementById('det-components-folder');
  const dropdown = document.getElementById('det-components-dropdown');

  const floatingPill = document.getElementById('module-components-floating-pill');
  const floatingList = document.getElementById('floating-components-list');
  const floatingCountEl = document.getElementById('floating-components-count');
  const floatingFolderEl = document.getElementById('floating-components-folder');
  const navPillBtn = document.getElementById('btn-nav-components-pill');
  const navCountEl = document.getElementById('nav-components-count');

  if (!floatingPill || !floatingList || !viewer || typeof viewer.getModuleComponentOptions !== 'function') return;

  const token = ++componentsRenderToken;
  const { folderPath, components } = await viewer.getModuleComponentOptions(index);
  // Ignore stale results if the selection changed while fetching
  if (token !== componentsRenderToken || selectedIndex !== index) return;

  if (list) list.innerHTML = '';
  if (floatingList) floatingList.innerHTML = '';

  if (!folderPath || components.length === 0) {
    if (section) section.classList.add('hidden');
    if (floatingPill) floatingPill.classList.add('hidden');
    if (navPillBtn) navPillBtn.classList.add('hidden');
    if (dropdown) dropdown.open = false;
    return;
  }
  if (section) section.classList.remove('hidden');
  if (navPillBtn) navPillBtn.classList.remove('hidden');

  const folderName = folderPath.substring(folderPath.lastIndexOf('/') + 1);
  if (folderEl) folderEl.textContent = folderName;
  if (floatingFolderEl) floatingFolderEl.textContent = folderName;

  // Animation halt and defaults subdue controls
  const chkStopAnim = document.getElementById('chk-stop-anim');
  const chkDetStopAnim = document.getElementById('chk-det-stop-anim');
  const chkSubdueDefaults = document.getElementById('chk-subdue-defaults');
  const chkDetSubdueDefaults = document.getElementById('chk-det-subdue-defaults');

  const isHalted = typeof viewer.isModuleAnimationHalted === 'function' ? viewer.isModuleAnimationHalted(index) : false;
  if (chkStopAnim) chkStopAnim.checked = isHalted;
  if (chkDetStopAnim) chkDetStopAnim.checked = isHalted;

  const handleStopAnimChange = (checked) => {
    if (typeof viewer.setModuleAnimationHalted === 'function') {
      viewer.setModuleAnimationHalted(index, checked);
    }
    if (chkStopAnim) chkStopAnim.checked = checked;
    if (chkDetStopAnim) chkDetStopAnim.checked = checked;
  };

  if (chkStopAnim) chkStopAnim.onchange = (e) => handleStopAnimChange(e.target.checked);
  if (chkDetStopAnim) chkDetStopAnim.onchange = (e) => handleStopAnimChange(e.target.checked);

  const updateSubdueDefaultsState = () => {
    const targetList = floatingList || list;
    if (!targetList) return;
    const defaultBoxes = targetList.querySelectorAll('input[type="checkbox"][data-is-default="true"]');
    const allDefaultsUnchecked = defaultBoxes.length > 0 && Array.from(defaultBoxes).every(cb => !cb.checked);
    if (chkSubdueDefaults) chkSubdueDefaults.checked = allDefaultsUnchecked;
    if (chkDetSubdueDefaults) chkDetSubdueDefaults.checked = allDefaultsUnchecked;
  };

  const handleSubdueDefaultsChange = async (subdue) => {
    if (floatingList) {
      const defaultBoxesFloating = floatingList.querySelectorAll('input[type="checkbox"][data-is-default="true"]');
      defaultBoxesFloating.forEach(cb => { cb.checked = !subdue; });
    }
    if (list) {
      const defaultBoxesList = list.querySelectorAll('input[type="checkbox"][data-is-default="true"]');
      defaultBoxesList.forEach(cb => { cb.checked = !subdue; });
    }
    updateCount();
    if (chkSubdueDefaults) chkSubdueDefaults.checked = subdue;
    if (chkDetSubdueDefaults) chkDetSubdueDefaults.checked = subdue;

    const targetList = floatingList || list;
    const files = targetList ? Array.from(targetList.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.dataset.file) : [];
    const allBoxes = document.querySelectorAll('#det-components-list input[type="checkbox"], #floating-components-list input[type="checkbox"]');
    allBoxes.forEach(el => { el.disabled = true; });
    try {
      await viewer.setModuleComponentFiles(index, files);
    } finally {
      allBoxes.forEach(el => { el.disabled = false; });
    }
  };

  if (chkSubdueDefaults) chkSubdueDefaults.onchange = (e) => handleSubdueDefaultsChange(e.target.checked);
  if (chkDetSubdueDefaults) chkDetSubdueDefaults.onchange = (e) => handleSubdueDefaultsChange(e.target.checked);

  // Billboard State controls
  const billboardGroup = document.getElementById('toolbar-billboard-group');
  const detBillboardGroup = document.getElementById('toolbar-det-billboard-group');
  const selBillboardState = document.getElementById('sel-billboard-state');
  const selDetBillboardState = document.getElementById('sel-det-billboard-state');

  const hasBillboards = typeof viewer.hasModuleBillboards === 'function' ? viewer.hasModuleBillboards(index) : false;
  if (hasBillboards) {
    if (billboardGroup) billboardGroup.classList.remove('hidden');
    if (detBillboardGroup) detBillboardGroup.classList.remove('hidden');
    const curState = typeof viewer.getBillboardState === 'function' ? viewer.getBillboardState(index) : 'auto';
    if (selBillboardState) selBillboardState.value = curState;
    if (selDetBillboardState) selDetBillboardState.value = curState;
  } else {
    if (billboardGroup) billboardGroup.classList.add('hidden');
    if (detBillboardGroup) detBillboardGroup.classList.add('hidden');
  }

  const handleBillboardStateChange = (state) => {
    if (typeof viewer.setBillboardState === 'function') {
      viewer.setBillboardState(state, index);
    }
    if (selBillboardState) selBillboardState.value = state;
    if (selDetBillboardState) selDetBillboardState.value = state;
  };

  if (selBillboardState) selBillboardState.onchange = (e) => handleBillboardStateChange(e.target.value);
  if (selDetBillboardState) selDetBillboardState.onchange = (e) => handleBillboardStateChange(e.target.value);

  const updateCount = () => {
    const targetList = floatingList || list;
    const checked = targetList ? targetList.querySelectorAll('input[type="checkbox"]:checked').length : 0;
    const str = `${checked}/${components.length}`;
    if (countEl) countEl.textContent = str;
    if (floatingCountEl) floatingCountEl.textContent = str;
    if (navCountEl) navCountEl.textContent = str;
  };

  const createComponentRow = (comp, isFloating) => {
    const row = document.createElement('label');
    row.className = 'det-component-row';
    row.title = comp.file;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = comp.checked;
    cb.dataset.file = comp.file;
    if (comp.isDefault) {
      cb.dataset.isDefault = 'true';
    }

    const name = document.createElement('span');
    name.className = 'det-component-name';
    name.textContent = comp.file.replace(/\.dae$/i, '');

    row.appendChild(cb);
    row.appendChild(name);
    if (comp.isDefault) {
      const tag = document.createElement('span');
      tag.className = 'det-component-default';
      tag.textContent = 'default';
      row.appendChild(tag);
    }

    cb.addEventListener('change', async () => {
      // Synchronize checkbox state to the twin list
      const targetContainer = isFloating ? list : floatingList;
      if (targetContainer) {
        const twinCb = targetContainer.querySelector(`input[data-file="${escapeCssAttr(comp.file)}"]`);
        if (twinCb) twinCb.checked = cb.checked;
      }

      const targetList = floatingList || list;
      const files = targetList ? Array.from(targetList.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.dataset.file) : [];
      updateCount();
      updateSubdueDefaultsState();
      const allBoxes = document.querySelectorAll('#det-components-list input[type="checkbox"], #floating-components-list input[type="checkbox"]');
      allBoxes.forEach(el => { el.disabled = true; });
      try {
        await viewer.setModuleComponentFiles(index, files);
      } finally {
        allBoxes.forEach(el => { el.disabled = false; });
      }
    });

    return row;
  };

  for (const comp of components) {
    if (list) list.appendChild(createComponentRow(comp, false));
    if (floatingList) {
      floatingList.appendChild(createComponentRow(comp, true));
    }
  }
  updateCount();
  updateSubdueDefaultsState();

  // If Module Components is expanded, reveal expansion as a floating pill hiding all other pills in right hand column
  const searchCard = document.querySelector('.search-card');
  const rightSidebar = document.getElementById('right-sidebar');
  const isExpanded = (dropdown && dropdown.open) || (floatingPill && !floatingPill.classList.contains('hidden'));
  if (isExpanded) {
    if (floatingPill) floatingPill.classList.remove('hidden');
    if (searchCard) searchCard.classList.add('has-floating-pill');
    if (rightSidebar) rightSidebar.classList.add('components-expanded');
  } else {
    if (floatingPill) floatingPill.classList.add('hidden');
    if (searchCard) searchCard.classList.remove('has-floating-pill');
    if (rightSidebar) rightSidebar.classList.remove('components-expanded');
  }
}

function selectModule(index, focusCamera = false) {
  // Deselect previous
  if (selectedIndex !== null) {
    const prevRow = document.getElementById(`mod-row-${selectedIndex}`);
    if (prevRow) prevRow.classList.remove('selected');
  }

  // Clear previous persistent panel highlights
  clearPersistentHighlights();

  selectedIndex = index;
    // The panel stays open across module selection: hand the animations to the module it now shows
    if (viewer && typeof viewer.setModuleComponentsToggled === 'function') {
      viewer.setModuleComponentsToggled(index, true);
    }
  const activeRow = document.getElementById(`mod-row-${index}`);
  if (activeRow) {
    activeRow.classList.add('selected');
    // Scroll element into view centered in the sidebar container
    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Update Details Card
  const moduleData = currentPlan ? currentPlan.modules.find(m => m.index === index) : null;
  const card = document.getElementById('details-card');
  const placeholder = document.getElementById('details-placeholder');

  if (moduleData) {
    placeholder.classList.add('hidden');
    card.classList.remove('hidden');

    // Colorized checkbox should be unchecked for analysis
    const colorizedCb = document.getElementById('colorized-checkbox');
    if (colorizedCb && colorizedCb.checked) {
      colorizedCb.checked = false;
      saveCheckboxState('colorized-checkbox', false);
      if (viewer && typeof viewer.setColorized === 'function') {
        viewer.setColorized(false);
      }
    }

    const cat = getModuleCategory(moduleData.macro);
    const friendlyName = getFriendlyName(moduleData.macro);
    const color = CATEGORY_COLORS[cat];
    const costs = estimateModuleCosts(moduleData.macro);

    document.getElementById('det-title').textContent = friendlyName;

    const catTag = document.getElementById('det-category');
    if (catTag) {
      catTag.textContent = CATEGORY_NAMES[cat];
      catTag.style.backgroundColor = color + '20';
      catTag.style.borderColor = color;
      catTag.style.color = color;
    }

    const detPos = document.getElementById('det-pos');
    if (detPos) {
      detPos.textContent = `X: ${Math.round(moduleData.position.x)}m | Y: ${Math.round(moduleData.position.y)}m | Z: ${Math.round(moduleData.position.z)}m`;
    }

    const calcRot = viewer.getModuleCalculatedRotation(index) || {
      yaw: Math.round(moduleData.rotation.yaw),
      pitch: Math.round(moduleData.rotation.pitch),
      roll: Math.round(moduleData.rotation.roll)
    };
    document.getElementById('det-rot').textContent = `Yaw: ${calcRot.yaw}° | Pitch: ${calcRot.pitch}° | Roll: ${calcRot.roll}°`;

    const inputPitch = document.getElementById('det-input-pitch');
    const inputRoll = document.getElementById('det-input-roll');
    const inputYaw = document.getElementById('det-input-yaw');
    if (inputPitch) inputPitch.value = calcRot.pitch;
    if (inputRoll) inputRoll.value = calcRot.roll;
    if (inputYaw) inputYaw.value = calcRot.yaw;

    // Fetch and display bounding dimensions
    const detDim = document.getElementById('det-dim');
    if (detDim) {
      const dimensions = viewer.getModuleDimensions(index);
      if (dimensions) {
        detDim.textContent = `Width: ${Math.round(dimensions.x)}m | Height: ${Math.round(dimensions.y)}m | Depth: ${Math.round(dimensions.z)}m`;
      } else {
        detDim.textContent = 'Width: 0m | Height: 0m | Depth: 0m';
      }
    }

    // Sync Effects Pill Sliders (Bloom Strength & HDR Emissive Intensity)
    const slBloom = document.getElementById('slider-bloom-strength');
    const valBloom = document.getElementById('val-bloom-strength');
    if (slBloom && valBloom && viewer.getBloomStrength) {
      const bVal = viewer.getBloomStrength();
      slBloom.value = bVal;
      valBloom.textContent = Number(bVal).toFixed(2);
    }
    const slEmissive = document.getElementById('slider-emissive-intensity');
    const valEmissive = document.getElementById('val-emissive-intensity');
    if (slEmissive && valEmissive && viewer.getEmissiveIntensity) {
      const eVal = viewer.getEmissiveIntensity();
      slEmissive.value = eVal;
      valEmissive.textContent = Number(eVal).toFixed(2);
    }

    // Populate the module's asset component dropdown (checkbox per .dae in its asset folder)
    renderModuleComponentsDropdown(index);

    // Dynamically render individual module resources
    const detContainer = document.getElementById('det-resources-container');
    if (detContainer) {
      detContainer.innerHTML = '';
      
      for (const key in costs) {
        const amount = costs[key] || 0;
        if (amount > 0) {
          const meta = getResourceMetadata(key);
          
          const costItem = document.createElement('div');
          costItem.className = 'cost-item';
          costItem.innerHTML = `
            <span class="lbl">${meta.name}:</span>
            <span class="val ${meta.colorClass}">${amount.toLocaleString()}</span>
          `;
          detContainer.appendChild(costItem);
        }
      }
    }

    // Check if module is already visible within the main display
    const isVisibleInMainDisplay = viewer && typeof viewer.isModuleVisibleInViewport === 'function'
      ? viewer.isModuleVisibleInViewport(index)
      : false;

    // If a component is visible within the main display when clicked, do not force a re-render/camera move upon moving/rotating
    const shouldFocusCamera = focusCamera && !isVisibleInMainDisplay;

    // Highlight inside 3D viewer
    viewer.selectModuleByIndex(index, shouldFocusCamera);
    if (shouldFocusCamera) {
      viewer.focusCameraOnModule(index, true);
    }

    // Scroll and apply persistent highlights to Structure Analysis & Component Visibility panels
    scrollAndHighlightVisibilityComponent(cat, moduleData.macro);
    scrollAndHighlightLeftMacro(moduleData.macro);
  } else {
    placeholder.classList.remove('hidden');
    card.classList.add('hidden');
    const compPill = document.getElementById('module-components-floating-pill');
    if (compPill) compPill.classList.add('hidden');
    const navPillBtn = document.getElementById('btn-nav-components-pill');
    if (navPillBtn) navPillBtn.classList.add('hidden');
    const compDropdown = document.getElementById('det-components-dropdown');
    if (compDropdown) compDropdown.open = false;
    const chkStopAnim = document.getElementById('chk-stop-anim');
    if (chkStopAnim) chkStopAnim.checked = false;
    const chkDetStopAnim = document.getElementById('chk-det-stop-anim');
    if (chkDetStopAnim) chkDetStopAnim.checked = false;
    const chkSubdueDefaults = document.getElementById('chk-subdue-defaults');
    if (chkSubdueDefaults) chkSubdueDefaults.checked = false;
    const chkDetSubdueDefaults = document.getElementById('chk-det-subdue-defaults');
    if (chkDetSubdueDefaults) chkDetSubdueDefaults.checked = false;
    const billboardGroup = document.getElementById('toolbar-billboard-group');
    if (billboardGroup) billboardGroup.classList.add('hidden');
    const detBillboardGroup = document.getElementById('toolbar-det-billboard-group');
    if (detBillboardGroup) detBillboardGroup.classList.add('hidden');
    const searchCard = document.querySelector('.search-card');
    if (searchCard) searchCard.classList.remove('has-floating-pill');
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) rightSidebar.classList.remove('components-expanded');
    if (viewer && typeof viewer.setModuleComponentsToggled === 'function') {
      viewer.setModuleComponentsToggled(null, false);
    }
    clearPersistentHighlights();
    viewer.deselect();
  }
}

/**
 * Event Binding Definitions
 */
function setupEventListeners() {
  // Click outside to restore display if cycling macros
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.macro-count-badge')) {
      if (cycleMacro !== null) {
        cycleMacro = null;
        cycleModules = [];
        cycleCount = 0;
        cycleCounter = 0;
        selectModule(null); // Restore current display (deselect)
      }
    }
  });

  // 1. Plan source selectors
  const sampleSelector = document.getElementById('sample-selector');
  if (sampleSelector) {
    sampleSelector.addEventListener('change', (e) => {
      if (e.target.value) {
        loadSample(e.target.value);
      }
    });
  }

  // Right-click sample action management
  setupSampleActionModalEvents();

  // Center modules to Plot BB modal events
  setupCenterModulesModalEvents();

  // Custom cyber dropdown & right-drag re-ordering events
  setupSampleCustomDropdownEvents();

  // XML File Upload
  const fileUpload = document.getElementById('file-upload');
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          loadPlanFromXml(evt.target.result);
        } catch (err) {
          showNotification(err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // Raw XML Paste Modal Handler
  const openPasteBtn = document.getElementById('btn-open-paste');
  const pasteModal = document.getElementById('paste-modal');
  const closePasteBtn = document.getElementById('btn-close-paste');
  const submitPasteBtn = document.getElementById('btn-submit-paste');
  const xmlTextArea = document.getElementById('xml-paste-text');

  if (openPasteBtn && pasteModal) {
    openPasteBtn.addEventListener('click', () => {
      pasteModal.classList.add('active');
      if (viewer && !viewer.isGizmoDragging()) {
        viewer.detachGizmo();
      }
      if (xmlTextArea) xmlTextArea.focus();
    });
  }

  if (xmlTextArea) {
    xmlTextArea.addEventListener('focus', () => {
      if (viewer && !viewer.isGizmoDragging()) {
        viewer.detachGizmo();
      }
    });
  }

  if (closePasteBtn && pasteModal) {
    closePasteBtn.addEventListener('click', () => {
      pasteModal.classList.remove('active');
    });
  }

  if (submitPasteBtn && pasteModal && xmlTextArea) {
    submitPasteBtn.addEventListener('click', () => {
      const xmlText = xmlTextArea.value.trim();
      if (!xmlText) {
        showNotification('Please enter XML construction plan text.', 'warning');
        return;
      }
      try {
        loadPlanFromXml(xmlText);
        pasteModal.classList.remove('active');
        xmlTextArea.value = '';
      } catch (err) {
        showNotification('XML Parse Error: ' + err.message, 'error');
      }
    });
  }

  // 1b. Save Blueprint .XML Button Handlers
  const btnSaveBlueprint = document.getElementById('btn-save-blueprint');
  if (btnSaveBlueprint) {
    btnSaveBlueprint.addEventListener('click', () => {
      exportCurrentPlanAsBlueprint();
    });
  }

  const btnCardSaveBlueprint = document.getElementById('btn-card-save-blueprint');
  if (btnCardSaveBlueprint) {
    btnCardSaveBlueprint.addEventListener('click', () => {
      exportCurrentPlanAsBlueprint();
    });
  }

  // Drag & drop file upload
  const dropZone = document.getElementById('app-container');
  if (dropZone) {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.xml') || file.type === 'text/xml') {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              loadPlanFromXml(evt.target.result);
            } catch (err) {
              showNotification(err.message, 'error');
            }
          };
          reader.readAsText(file);
        } else {
          showNotification('Unsupported file type. Please upload a .xml station plan.', 'error');
        }
      }
    });
  }

  // 2. Camera presets
  document.getElementById('view-iso').addEventListener('click', () => viewer.setViewAngle('iso'));
  document.getElementById('view-top').addEventListener('click', () => viewer.setViewAngle('top'));
  document.getElementById('view-front').addEventListener('click', () => viewer.setViewAngle('front'));
  document.getElementById('view-side').addEventListener('click', () => viewer.setViewAngle('side'));
  document.getElementById('view-fit').addEventListener('click', () => viewer.fitCameraToStation());

  // 3. Viewer options
  const gridSizeSelector = document.getElementById('grid-size-selector');
  if (gridSizeSelector) {
    gridSizeSelector.addEventListener('change', (e) => {
      const val = e.target.value;
      viewer.setMajorGridSize(val);
      showNotification(val === '0' ? 'Plot Grid disabled' : `Plot Grid set to ${val}m major grid`, 'info');
    });
  }

  const wireframeToggle = document.getElementById('toggle-wireframe');
  if (wireframeToggle) {
    const savedWireframe = getSavedCheckboxState('toggle-wireframe', false);
    wireframeToggle.checked = savedWireframe;
    viewer.toggleWireframe(savedWireframe);
    wireframeToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-wireframe', e.target.checked);
      viewer.toggleWireframe(e.target.checked);
    });
  }

  const orientationToggle = document.getElementById('toggle-orientation');
  if (orientationToggle) {
    const savedOrientation = getSavedCheckboxState('toggle-orientation', false);
    orientationToggle.checked = savedOrientation;
    viewer.toggleOrientation(savedOrientation);
    orientationToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-orientation', e.target.checked);
      viewer.toggleOrientation(e.target.checked);
    });
  }

  const dimensionsToggle = document.getElementById('toggle-dimensions');
  if (dimensionsToggle) {
    const savedDimensions = getSavedCheckboxState('toggle-dimensions', true);
    dimensionsToggle.checked = savedDimensions;
    viewer.toggleDimensions(savedDimensions);
    dimensionsToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-dimensions', e.target.checked);
      viewer.toggleDimensions(e.target.checked);
    });
  }

  const snapsToggle = document.getElementById('toggle-snaps');
  if (snapsToggle) {
    const savedSnaps = getSavedCheckboxState('toggle-snaps', true);
    snapsToggle.checked = savedSnaps;
    viewer.toggleSnapPoints(savedSnaps);
    snapsToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-snaps', e.target.checked);
      viewer.toggleSnapPoints(e.target.checked);
    });
  }

  const bloomToggle = document.getElementById('toggle-bloom');
  if (bloomToggle) {
    const savedBloom = getSavedCheckboxState('toggle-bloom', true);
    bloomToggle.checked = savedBloom;
    viewer.setBloomEnabled(savedBloom);
    bloomToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-bloom', e.target.checked);
      viewer.setBloomEnabled(e.target.checked);
      viewer.renderScene();
    });
  }

  const blueprintToggle = document.getElementById('toggle-blueprint');
  if (blueprintToggle) {
    const savedBlueprint = getSavedCheckboxState('toggle-blueprint', true);
    blueprintToggle.checked = savedBlueprint;
    setBlueprintModeActive(savedBlueprint, viewer);
    blueprintToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-blueprint', e.target.checked);
      setBlueprintModeActive(e.target.checked, viewer);
      showNotification(`Blueprint Layout: ${e.target.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
    });
  }

  // Selected Module Details: Effects Pill Sliders (Bloom Strength & HDR Emissive Intensity)
  const sliderBloomStrength = document.getElementById('slider-bloom-strength');
  const valBloomStrength = document.getElementById('val-bloom-strength');
  const sliderEmissiveIntensity = document.getElementById('slider-emissive-intensity');
  const valEmissiveIntensity = document.getElementById('val-emissive-intensity');

  // Load saved preferences if available
  let savedBloomStrength = parseFloat(localStorage.getItem('x4_bloom_strength'));
  if (isNaN(savedBloomStrength) || savedBloomStrength === 1.25) {
    savedBloomStrength = 0.35;
  }
  const savedEmissiveIntensity = parseFloat(localStorage.getItem('x4_emissive_intensity')) || 2.2;

  if (sliderBloomStrength && valBloomStrength) {
    sliderBloomStrength.value = savedBloomStrength;
    valBloomStrength.textContent = Number(savedBloomStrength).toFixed(2);
    viewer.setBloomParams({ strength: savedBloomStrength });

    sliderBloomStrength.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valBloomStrength.textContent = val.toFixed(2);
      viewer.setBloomParams({ strength: val });
      localStorage.setItem('x4_bloom_strength', val);
      viewer.renderScene();
    });
  }

  if (sliderEmissiveIntensity && valEmissiveIntensity) {
    sliderEmissiveIntensity.value = savedEmissiveIntensity;
    valEmissiveIntensity.textContent = Number(savedEmissiveIntensity).toFixed(2);
    viewer.setEmissiveIntensity(savedEmissiveIntensity);

    sliderEmissiveIntensity.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valEmissiveIntensity.textContent = val.toFixed(2);
      viewer.setEmissiveIntensity(val, selectedIndex);
      localStorage.setItem('x4_emissive_intensity', val);
      viewer.renderScene();
    });
  }

  const gizmoModeSelector = document.getElementById('gizmo-mode-selector');
  if (gizmoModeSelector) {
    gizmoModeSelector.addEventListener('change', (e) => {
      viewer.setGizmoMode(e.target.value);
      showNotification(`Gizmo Mode set to: ${e.target.value.toUpperCase()}`, 'info');
    });
  }

  // Direct numeric entry for Pitch, Roll, and Yaw angles in Selected Module Details
  const handleDirectRotationChange = (isFinal = false) => {
    if (selectedIndex === null || !viewer) return;
    const pEl = document.getElementById('det-input-pitch');
    const rEl = document.getElementById('det-input-roll');
    const yEl = document.getElementById('det-input-yaw');
    if (!pEl || !rEl || !yEl) return;

    let pVal = parseFloat(pEl.value);
    let rVal = parseFloat(rEl.value);
    let yVal = parseFloat(yEl.value);

    if (isNaN(pVal)) pVal = 0;
    if (isNaN(rVal)) rVal = 0;
    if (isNaN(yVal)) yVal = 0;

    const appliedRot = viewer.setModuleRotation(selectedIndex, { pitch: pVal, roll: rVal, yaw: yVal });
    if (appliedRot) {
      const detRot = document.getElementById('det-rot');
      if (detRot) {
        detRot.textContent = `Yaw: ${appliedRot.yaw}° | Pitch: ${appliedRot.pitch}° | Roll: ${appliedRot.roll}°`;
      }
      if (isFinal) {
        if (pEl.value !== String(appliedRot.pitch)) pEl.value = appliedRot.pitch;
        if (rEl.value !== String(appliedRot.roll)) rEl.value = appliedRot.roll;
        if (yEl.value !== String(appliedRot.yaw)) yEl.value = appliedRot.yaw;
      }
    }

    if (isFinal) {
      updateStationStats();
      recalculateMeasurements();

      if (inputStartRot && appliedRot) {
        if (inputStartRot.yaw !== appliedRot.yaw || inputStartRot.pitch !== appliedRot.pitch || inputStartRot.roll !== appliedRot.roll) {
          const mod = currentPlan?.modules?.find(m => m.index === selectedIndex);
          recordMove({
            type: 'rotate',
            moduleIndex: selectedIndex,
            macro: mod?.macro || '',
            fromRot: { ...inputStartRot },
            toRot: { ...appliedRot }
          });
        }
        inputStartRot = null;
      }
    }
  };

  let inputStartRot = null;
  ['det-input-pitch', 'det-input-roll', 'det-input-yaw'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', () => {
        if (selectedIndex !== null && viewer) {
          inputStartRot = viewer.getModuleCalculatedRotation(selectedIndex);
        }
      });
      el.addEventListener('input', () => handleDirectRotationChange(false));
      el.addEventListener('change', () => handleDirectRotationChange(true));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleDirectRotationChange(true);
          el.blur();
        }
      });
    }
  });

  // Undo button click & right-click clear handlers (Upper Left of Main Viewport)
  const btnUndo = document.getElementById('btn-undo');
  const undoHub = document.getElementById('undo-hub');

  const handleClearUndoList = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (undoList.length > 0) {
      collapseUndoHistory();
      showNotification('Undo list cleared.', 'info');
    }
  };

  if (btnUndo) {
    btnUndo.addEventListener('click', (e) => {
      if (e.button === 0) {
        performUndo();
      }
    });
    btnUndo.addEventListener('contextmenu', handleClearUndoList);
    btnUndo.addEventListener('auxclick', (e) => {
      if (e.button === 2) handleClearUndoList(e);
    });
  }

  if (undoHub) {
    undoHub.addEventListener('contextmenu', handleClearUndoList);
    undoHub.addEventListener('auxclick', (e) => {
      if (e.button === 2) handleClearUndoList(e);
    });
  }

  // Global hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      viewer.detachGizmo();
      selectModule(null);
      return;
    }

    // Global Undo hotkey Ctrl+Z / Cmd+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      performUndo();
      return;
    }

    // Avoid triggering when user is typing in inputs or textareas
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    if (e.key === 'd' || e.key === 'D') {
      const dimToggle = document.getElementById('toggle-dimensions');
      if (dimToggle) {
        dimToggle.checked = !dimToggle.checked;
        saveCheckboxState('toggle-dimensions', dimToggle.checked);
        viewer.toggleDimensions(dimToggle.checked);
      }
    } else if (e.key === 's' || e.key === 'S') {
      const snapToggle = document.getElementById('toggle-snaps');
      if (snapToggle) {
        snapToggle.checked = !snapToggle.checked;
        saveCheckboxState('toggle-snaps', snapToggle.checked);
        viewer.toggleSnapPoints(snapToggle.checked);
      }
    } else if (e.key === 'b' || e.key === 'B') {
      const bloomToggle = document.getElementById('toggle-bloom');
      if (bloomToggle) {
        bloomToggle.checked = !bloomToggle.checked;
        saveCheckboxState('toggle-bloom', bloomToggle.checked);
        viewer.setBloomEnabled(bloomToggle.checked);
        viewer.renderScene();
        showNotification(`FX Bloom Glow: ${bloomToggle.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
      }
    } else if (e.key === 'p' || e.key === 'P') {
      const blueprintToggle = document.getElementById('toggle-blueprint');
      if (blueprintToggle) {
        blueprintToggle.checked = !blueprintToggle.checked;
        saveCheckboxState('toggle-blueprint', blueprintToggle.checked);
        setBlueprintModeActive(blueprintToggle.checked, viewer);
        showNotification(`Blueprint Layout: ${blueprintToggle.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
      }
    } else if (e.key === 'r' || e.key === 'R') {
      const modeSel = document.getElementById('gizmo-mode-selector');
      const newMode = viewer.gizmoMode === 'rotate' ? 'combined' : 'rotate';
      viewer.setGizmoMode(newMode);
      if (modeSel) modeSel.value = newMode;
      showNotification(`Gizmo Mode: ${newMode === 'combined' ? 'ALL (Move+Rotate)' : 'ROTATE (Yaw, Pitch, Roll)'}`, 'info');
    } else if (e.key === 't' || e.key === 'T') {
      const modeSel = document.getElementById('gizmo-mode-selector');
      const newMode = viewer.gizmoMode === 'translate' ? 'combined' : 'translate';
      viewer.setGizmoMode(newMode);
      if (modeSel) modeSel.value = newMode;
      showNotification(`Gizmo Mode: ${newMode === 'combined' ? 'ALL (Move+Rotate)' : 'MOVE (X, Y, Z)'}`, 'info');
    } else if (e.key === 'g' || e.key === 'G') {
      const modeSel = document.getElementById('gizmo-mode-selector');
      viewer.setGizmoMode('combined');
      if (modeSel) modeSel.value = 'combined';
      showNotification('Gizmo Mode: ALL (Move + Rotate)', 'info');
    }
  });

  // Focus Loss Handlers: Any loss of focus removes the 3D translation gizmo
  window.addEventListener('blur', () => {
    if (viewer && !viewer.isGizmoDragging()) {
      viewer.detachGizmo();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && viewer && !viewer.isGizmoDragging()) {
      viewer.detachGizmo();
    }
  });

  window.addEventListener('pointerdown', (e) => {
    if (!viewer || viewer.isGizmoDragging()) return;

    // Check if the click is on or within the 3D canvas element
    const canvasEl = viewer.renderer?.domElement;
    if (canvasEl && (canvasEl === e.target || canvasEl.contains(e.target))) {
      return;
    }

    // Allow intentional module selection interactions from UI elements
    const isModuleSelector = e.target.closest(
      '.visibility-row, .col-name, tr[id^="mod-row-"], .macro-text-btn, .macro-count-badge, .visibility-cat-header, .category-select-btn, #details-card'
    );
    if (isModuleSelector) {
      return;
    }

    // Any other click outside the canvas constitutes a loss of focus -> remove 3D gizmo
    viewer.detachGizmo();
  });

  // 4. Sidebar module list search
  const searchInput = document.getElementById('module-search');
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      if (viewer && !viewer.isGizmoDragging()) {
        viewer.detachGizmo();
      }
    });
    searchInput.addEventListener('input', (e) => {
      if (currentPlan) {
        renderModuleList(currentPlan.modules, e.target.value);
        filterVisibilityControls(e.target.value);
      }
    });
  }

  // 5. Build sequence animator controls
  setupBuildAnimatorControls();

  // 6. Close details card button
  const closeDetailsBtn = document.getElementById('btn-close-details');
  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
      selectModule(null);
    });
  }

  // 6b. Module Components Dropdown & Floating Pill Overlay over Module Navigator and all other pills
  const compDropdown = document.getElementById('det-components-dropdown');
  const compFloatingPill = document.getElementById('module-components-floating-pill');
  const compNavPillBtn = document.getElementById('btn-nav-components-pill');
  const btnMinimizeCompPill = document.getElementById('btn-minimize-components-pill');

  function syncModuleComponentsFloatingPill() {
    if (!compFloatingPill) return;
    const section = document.getElementById('det-components-section');
    const isSectionAvailable = (compNavPillBtn && !compNavPillBtn.classList.contains('hidden')) || (section && !section.classList.contains('hidden'));
    const searchCard = document.querySelector('.search-card');
    const rightSidebar = document.getElementById('right-sidebar');
    const isOpen = (compDropdown && compDropdown.open) || !compFloatingPill.classList.contains('hidden');

    if (isOpen && isSectionAvailable) {
      compFloatingPill.classList.remove('hidden');
      if (searchCard) {
        searchCard.classList.add('has-floating-pill');
        if (typeof searchCard.scrollIntoView === 'function') {
          searchCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if (rightSidebar) rightSidebar.classList.add('components-expanded');
      if (viewer && typeof viewer.setModuleComponentsToggled === 'function' && selectedIndex !== null && selectedIndex !== undefined) {
        viewer.setModuleComponentsToggled(selectedIndex, true);
      }
    } else {
      compFloatingPill.classList.add('hidden');
      if (searchCard) {
        searchCard.classList.remove('has-floating-pill');
      }
      if (rightSidebar) rightSidebar.classList.remove('components-expanded');
      if (viewer && typeof viewer.setModuleComponentsToggled === 'function') {
        viewer.setModuleComponentsToggled(null, false);
      }
    }
  }

  if (compDropdown) {
    compDropdown.addEventListener('toggle', syncModuleComponentsFloatingPill);
  }

  if (btnMinimizeCompPill) {
    btnMinimizeCompPill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (compDropdown) compDropdown.open = false;
      compFloatingPill.classList.add('hidden');
      syncModuleComponentsFloatingPill();
    });
  }

  if (compNavPillBtn) {
    compNavPillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (compDropdown) {
        compDropdown.open = !compDropdown.open;
      } else {
        compFloatingPill.classList.toggle('hidden');
      }
      syncModuleComponentsFloatingPill();
    });
  }

  // Clicking outside the floating pill minimizes it
  document.addEventListener('pointerdown', (e) => {
    if (!compFloatingPill || compFloatingPill.classList.contains('hidden')) return;
    const section = document.getElementById('det-components-section');
    if (
      compFloatingPill.contains(e.target) ||
      (compNavPillBtn && compNavPillBtn.contains(e.target)) ||
      (compDropdown && compDropdown.contains(e.target)) ||
      (section && section.contains(e.target)) ||
      (e.target && (e.target.tagName === 'OPTION' || e.target.tagName === 'SELECT'))
    ) {
      return;
    }
    if (compDropdown) compDropdown.open = false;
    compFloatingPill.classList.add('hidden');
    syncModuleComponentsFloatingPill();
  });

  // 7. Clickable stats boxes
  const statBoxes = document.querySelectorAll('.category-select-btn');
  statBoxes.forEach(box => {
    box.addEventListener('click', () => {
      // Clear any previous Component Visibility highlight
      clearComponentVisibilityHighlights();
      clearPersistentHighlights();
      
      const category = box.getAttribute('data-category');
      
      if (activeCategoryFilter === category && !activeMacroFilter) {
        activeCategoryFilter = 'all';
      } else {
        activeCategoryFilter = category;
        activeMacroFilter = null; // Clear macro filter when changing category
      }
      
      updateActiveFilterUI();
      calculateAndRenderStats(currentPlan);
      renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
      viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
      
      if (activeCategoryFilter !== 'all') {
        scrollAndHighlightVisibilityComponent(activeCategoryFilter);
      }
    });
  });

  // Clear previous Component Visibility highlights on any left-click inside Structure Analysis
  const structAnalysisCard = document.getElementById('card-structure-analysis');
  if (structAnalysisCard) {
    structAnalysisCard.addEventListener('click', (e) => {
      if (e.button === 0) {
        clearComponentVisibilityHighlights();
        // Colorized checkbox should be unchecked for analysis
        const colorizedCb = document.getElementById('colorized-checkbox');
        if (colorizedCb && colorizedCb.checked) {
          colorizedCb.checked = false;
          saveCheckboxState('colorized-checkbox', false);
          if (viewer && typeof viewer.setColorized === 'function') {
            viewer.setColorized(false);
          }
        }
      }
    }, true);
  }

  // 8. Global visibility "Show All" / "Hide All" toggle button
  const showAllVisBtn = document.getElementById('btn-visibility-show-all');
  if (showAllVisBtn) {
    showAllVisBtn.addEventListener('click', () => {
      if (!currentPlan) return;
      
      const allShown = excludedMacros.size === 0;
      
      if (allShown) {
        // Hide All: add all macros in the plan to excluded
        currentPlan.modules.forEach(mod => {
          excludedMacros.add(mod.macro);
          viewer.setMacroVisibility(mod.macro, false);
        });
      } else {
        // Show All: clear excluded set
        excludedMacros.clear();
        currentPlan.modules.forEach(mod => {
          viewer.setMacroVisibility(mod.macro, true);
        });
      }
      saveExcludedMacros();
      
      // Re-render checklist
      renderVisibilityControls(currentPlan);
      
      // Refresh stats and module list
      calculateAndRenderStats(currentPlan);
      renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
      viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
    });
  }

  // 9. Clear Panels Checkbox
  const clearCheckbox = document.getElementById('clear-panels-checkbox');
  if (clearCheckbox) {
    clearCheckbox.addEventListener('change', () => {
      if (clearCheckbox.checked) {
        clearAllPanels();
        saveExcludedMacros();
        setTimeout(() => {
          clearCheckbox.checked = false;
        }, 2000);
      }
    });
  }

  // 10. Colorized Checkbox
  const colorizedCheckbox = document.getElementById('colorized-checkbox');
  if (colorizedCheckbox) {
    const savedColorized = getSavedCheckboxState('colorized-checkbox', false);
    colorizedCheckbox.checked = savedColorized;
    viewer.setColorized(savedColorized);
    colorizedCheckbox.addEventListener('change', (e) => {
      saveCheckboxState('colorized-checkbox', e.target.checked);
      viewer.setColorized(e.target.checked);
      showNotification(e.target.checked ? 'Colorized category mode enabled' : 'Colorized mode disabled', 'info');
    });
  }

  // 11. Structure Analysis Expand/Collapse Handlers
  setupStructureAnalysisCollapseHandlers();
}

function updateActiveFilterUI() {
  const statBoxes = document.querySelectorAll('.category-select-btn');
  statBoxes.forEach(box => {
    const cat = box.getAttribute('data-category');
    if (cat === activeCategoryFilter) {
      box.classList.add('active-filter');
    } else {
      box.classList.remove('active-filter');
    }
  });
}

/**
 * Sleek overlay notification helper
 */
function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `
    <span class="notif-indicator"></span>
    <span class="notif-text">${message}</span>
  `;

  container.appendChild(notif);

  // Trigger animation reveal
  setTimeout(() => {
    notif.classList.add('visible');
  }, 10);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    notif.classList.remove('visible');
    setTimeout(() => {
      notif.remove();
    }, 300);
  }, 4500);
}

/**
 * Clear all station data, list panels, and Three.js 3D viewport meshes.
 */
function clearAllPanels(silent = false) {
  const emptyPlan = {
    name: '-',
    description: 'Upload or select a station plan to begin visual analysis.',
    id: '-',
    modules: [],
    connections: []
  };

  currentPlan = null;
  selectedIndex = null;
  activeCategoryFilter = 'all';
  activeMacroFilter = null;
  excludedMacros.clear();
  updateActiveFilterUI();

  // Load into 3D viewer (this will clear all meshes)
  viewer.clear();
  viewer.clearFilterHighlights();

  // Reset UI Panels
  updatePlanMetadata(emptyPlan);
  calculateAndRenderStats(emptyPlan);
  renderVisibilityControls(emptyPlan);
  renderModuleList(emptyPlan.modules);
  
  // Clear search input
  const searchInput = document.getElementById('module-search');
  if (searchInput) searchInput.value = '';

  // Clear selected detail view and restore placeholder
  const detailsCard = document.getElementById('details-card');
  const detailsPlaceholder = document.getElementById('details-placeholder');
  if (detailsCard) detailsCard.classList.add('hidden');
  if (detailsPlaceholder) detailsPlaceholder.classList.remove('hidden');

  // Reset size badges to 0
  const sizeX = document.getElementById('stat-size-x');
  const sizeY = document.getElementById('stat-size-y');
  const sizeZ = document.getElementById('stat-size-z');
  if (sizeX) sizeX.textContent = '0m';
  if (sizeY) sizeY.textContent = '0m';
  if (sizeZ) sizeZ.textContent = '0m';

  // Reset animator
  clearBuildAnimator();

  if (!silent) {
    currentLoadedSampleKey = null;
    const selector = document.getElementById('sample-selector');
    if (selector) selector.value = '';
    updateCustomSampleDropdownSelection(null);
    showNotification('All panels and viewport cleared.', 'info');
  }

  // Reset undo list
  undoList.length = 0;
  updateUndoButtonUI();
}


