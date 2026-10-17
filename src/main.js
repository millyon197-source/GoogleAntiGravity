import { parseConstructionPlan } from './parser.js';
import { StationViewer } from './viewer.js';
import { SAMPLES } from './samples.js';
import { 
  getModuleCategory, 
  getFriendlyName, 
  estimateModuleCosts, 
  CATEGORY_COLORS, 
  CATEGORY_NAMES 
} from './modules.js';
import { generatePlanXML, downloadXMLFile, showCreateBlueprintModal, setFefbModuleIndex, getFefbModuleIndex } from './blueprint-exporter.js';
import { initModuleDisplayPanel, setActiveBlueprint, setPlotConfig } from './module-display-panel.js';
import { getInitialModuleDimensions } from './module-bounds-hashtable.js';
import { compositionRoot } from './composition-root.js';

const RESOURCE_METADATA = {
  hullParts: { name: 'Hull Parts', desc: 'Primary structural material', colorClass: 'text-cyan' },
  claytronics: { name: 'Claytronics', desc: 'Nanite systems and wiring', colorClass: 'text-purple' },
  computronicSubstrate: { name: 'Computronic Substrate', desc: 'Terran computing lattices', colorClass: 'text-cyan' },
  siliconCarbide: { name: 'Silicon Carbide', desc: 'Terran high-tensile shielding', colorClass: 'text-purple' },
  metallicMicrolattice: { name: 'Metallic Microlattice', desc: 'Terran structural framework', colorClass: 'text-amber' },
  shieldComponents: { name: 'Shield Components', desc: 'Shield generator assembly', colorClass: 'text-cyan' },
  turretComponents: { name: 'Turret Components', desc: 'Defensive weapons components', colorClass: 'text-amber' },
  advancedElectronics: { name: 'Advanced Electronics', desc: 'Targeting and sensor computers', colorClass: 'text-purple' },
  water: { name: 'Water', desc: 'Life support fluid (Boron tech)', colorClass: 'text-cyan' },
  energyCells: { name: 'Energy Cells', desc: 'Reactor and assembly power', colorClass: 'text-amber' },
  fieldCoils: { name: 'Field Coils', desc: 'Magnetic field generation coils', colorClass: 'text-cyan' },
  quantumTubes: { name: 'Quantum Tubes', desc: 'Sub-atomic conduit channels', colorClass: 'text-purple' },
  microchips: { name: 'Microchips', desc: 'Integrated logic processors', colorClass: 'text-amber' },
  graphene: { name: 'Graphene', desc: 'Ultra-thin carbon lattice', colorClass: 'text-cyan' },
  siliconWafers: { name: 'Silicon Wafers', desc: 'Refined silicon substrate', colorClass: 'text-purple' },
  smartChips: { name: 'Smart Chips', desc: 'Autonomous sub-routines', colorClass: 'text-amber' },
  advancedComposites: { name: 'Advanced Composites', desc: 'Reinforced hull plating', colorClass: 'text-cyan' }
};

function getResourceMetadata(key) {
  if (RESOURCE_METADATA[key]) return RESOURCE_METADATA[key];
  const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  return { name, desc: 'Station construction component', colorClass: 'text-cyan' };
}


let viewer = null;
let currentPlan = null;
let currentLoadedSampleKey = null;
let selectedIndex = null;
let activeCategoryFilter = 'all';
let activeMacroFilter = null;
const excludedMacros = new Set();

// Component Visibility macro cycling state
let cycleMacro = null;
let cycleCounter = 0;
let cycleCount = 0;
let cycleModules = [];

// Build Sequence Animator state
let animInterval = null;
let isAnimating = false;
let animProgress = 100; // Percentage 0 - 100
let animSpeed = 1000;  // ms per step

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

function clearPersistentHighlights() {
  // Clear persistent highlights in Component Visibility
  document.querySelectorAll('.visibility-row.selected-persistent, .visibility-cat-header.selected-persistent')
    .forEach(el => el.classList.remove('selected-persistent'));

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

function selectModule(index, focusCamera = false) {
  // Deselect previous
  if (selectedIndex !== null) {
    const prevRow = document.getElementById(`mod-row-${selectedIndex}`);
    if (prevRow) prevRow.classList.remove('selected');
  }

  // Clear previous persistent panel highlights
  clearPersistentHighlights();

  selectedIndex = index;
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
    clearPersistentHighlights();
    viewer.deselect();
  }
}

/**
 * Animator timeline functions
 */
function resetAnimator() {
  stopAnimation();
  animProgress = 100;
  updateAnimatorUI();
  viewer.setBuildProgress(animProgress);
}

function updateAnimatorUI() {
  const slider = document.getElementById('anim-progress-slider');
  const badge = document.getElementById('anim-progress-badge');
  const countSpan = document.getElementById('anim-visible-count');
  
  if (slider) slider.value = animProgress;
  if (badge) badge.textContent = `${animProgress}%`;
  
  if (currentPlan && countSpan) {
    const visibleModules = currentPlan.modules.filter(mod => !excludedMacros.has(mod.macro));
    const total = visibleModules.length;
    const current = Math.ceil((animProgress / 100) * total);
    countSpan.textContent = `${current} / ${total}`;
  }
}

function toggleAnimation() {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
}

function startAnimation() {
  if (!currentPlan || currentPlan.modules.length === 0) return;
  
  isAnimating = true;
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.innerHTML = '<span class="pause-icon">⏸</span> Pause';

  // If progress is at 100%, reset to 0 to start over
  if (animProgress >= 100) {
    animProgress = 0;
    updateAnimatorUI();
    viewer.setBuildProgress(animProgress);
  }

  const stepSize = Math.max(1, Math.floor(100 / currentPlan.modules.length));

  animInterval = setInterval(() => {
    animProgress += stepSize;
    if (animProgress >= 100) {
      animProgress = 100;
      stopAnimation();
    }
    updateAnimatorUI();
    viewer.setBuildProgress(animProgress);
  }, animSpeed);
}

function stopAnimation() {
  isAnimating = false;
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.innerHTML = '<span class="play-icon">▶</span> Play Sequence';
  
  if (animInterval) {
    clearInterval(animInterval);
    animInterval = null;
  }
}

function stepAnimation(direction) {
  stopAnimation();
  if (!currentPlan) return;
  
  const step = Math.max(1, Math.floor(100 / currentPlan.modules.length));
  
  if (direction === 'forward') {
    animProgress = Math.min(100, animProgress + step);
  } else {
    animProgress = Math.max(0, animProgress - step);
  }

  updateAnimatorUI();
  viewer.setBuildProgress(animProgress);
}

/**
 * Export current station plan as an X4 construction plan blueprint .XML
 */
export function exportCurrentPlanAsBlueprint() {
  if (!currentPlan || !currentPlan.modules || currentPlan.modules.length === 0) {
    showNotification('No station plan loaded or current plan is empty.', 'error');
    return;
  }

  // Gather active/updated module positions and rotations from viewer.modulesGroup or currentPlan.modules
  let activeModules = [];
  if (viewer && viewer.modulesGroup && viewer.modulesGroup.children.length > 0) {
    activeModules = viewer.modulesGroup.children.map((child, idx) => {
      const origMod = (currentPlan.modules && currentPlan.modules.find(m => m.index === child.userData.index)) || {};
      const pos = child.position;
      const rotEuler = child.rotation;
      
      const yaw = Math.round(rotEuler.y * 180 / Math.PI);
      const pitch = Math.round(rotEuler.x * 180 / Math.PI);
      const roll = Math.round(rotEuler.z * 180 / Math.PI);

      return {
        index: child.userData.index !== undefined ? child.userData.index : (idx + 1),
        macro: child.userData.macro || origMod.macro || '',
        connection: child.userData.connection || origMod.connection || '',
        position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
        rotation: { yaw, pitch, roll }
      };
    });
  } else {
    activeModules = currentPlan.modules;
  }

  const defaultName = currentPlan.name || 'Custom Station Plan';
  const totalModules = activeModules.length;

  showCreateBlueprintModal({
    defaultName,
    totalModules,
    onSave: (chosenName) => {
      const fefbIdx = currentPlan?.fefbModuleIndex ?? viewer?.fefbModuleIndex ?? getFefbModuleIndex();
      const xmlContent = generatePlanXML(chosenName, currentPlan, { modules: activeModules, fefbModuleIndex: fefbIdx });
      const safeFileName = chosenName.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Custom Station Plan';

      downloadXMLFile(xmlContent, `${safeFileName}.xml`);

      currentPlan.name = chosenName;
      updatePlanMetadata(currentPlan);
      showNotification(`Blueprint "${safeFileName}.xml" saved successfully!`, 'success');
    }
  });
}
if (typeof window !== 'undefined') {
  window.exportCurrentPlanAsBlueprint = exportCurrentPlanAsBlueprint;
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

  const rotateToggle = document.getElementById('toggle-autorotate');
  if (rotateToggle) {
    const savedRotate = getSavedCheckboxState('toggle-autorotate', false);
    rotateToggle.checked = savedRotate;
    viewer.toggleAutoRotate(savedRotate);
    rotateToggle.addEventListener('change', (e) => {
      saveCheckboxState('toggle-autorotate', e.target.checked);
      viewer.toggleAutoRotate(e.target.checked);
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
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.addEventListener('click', toggleAnimation);

  const prevBtn = document.getElementById('btn-anim-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => stepAnimation('backward'));

  const nextBtn = document.getElementById('btn-anim-next');
  if (nextBtn) nextBtn.addEventListener('click', () => stepAnimation('forward'));

  const resetBtn = document.getElementById('btn-anim-reset');
  if (resetBtn) resetBtn.addEventListener('click', resetAnimator);

  const speedSelect = document.getElementById('anim-speed-select');
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      animSpeed = parseInt(e.target.value, 10);
      if (isAnimating) {
        // Restart interval with new speed
        stopAnimation();
        startAnimation();
      }
    });
  }

  const slider = document.getElementById('anim-progress-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      stopAnimation();
      animProgress = parseInt(e.target.value, 10);
      updateAnimatorUI();
      viewer.setBuildProgress(animProgress);
    });
  }

  // Minimize / Maximize toggle for Build Sequence Animator
  const animatorHub = document.getElementById('animator-hub');
  const animToggleBtn = document.getElementById('btn-anim-toggle');
  if (animatorHub && animToggleBtn) {
    const toggleMinimize = (e) => {
      e.stopPropagation();
      const isMinimized = animatorHub.classList.toggle('minimized');
      animToggleBtn.textContent = isMinimized ? '➕' : '➖';
      animToggleBtn.title = isMinimized ? 'Maximize Simulation' : 'Minimize Simulation';
    };
    animToggleBtn.addEventListener('click', toggleMinimize);

    const animHeader = animatorHub.querySelector('.animator-header');
    if (animHeader) {
      animHeader.addEventListener('click', () => {
        if (animatorHub.classList.contains('minimized')) {
          animatorHub.classList.remove('minimized');
          animToggleBtn.textContent = '➖';
          animToggleBtn.title = 'Minimize Simulation';
        }
      });
    }
  }

  // 6. Close details card button
  const closeDetailsBtn = document.getElementById('btn-close-details');
  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
      selectModule(null);
    });
  }

  // 7. Clickable stats boxes
  const statBoxes = document.querySelectorAll('.category-select-btn');
  statBoxes.forEach(box => {
    box.addEventListener('click', () => {
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
    const savedColorized = getSavedCheckboxState('colorized-checkbox', true);
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
  stopAnimation();
  animProgress = 100;
  
  const slider = document.getElementById('anim-progress-slider');
  const badge = document.getElementById('anim-progress-badge');
  const countSpan = document.getElementById('anim-visible-count');
  
  if (slider) slider.value = 100;
  if (badge) badge.textContent = '100%';
  if (countSpan) countSpan.textContent = '0 / 0';

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
    showNotification('Undo list is exhausted. No more moves to undo.', 'info');
    updateUndoButtonUI();
    return;
  }

  const lastMove = historyManager.undo();
  if (!lastMove || !viewer) return;

  const friendlyName = lastMove.friendlyName || getFriendlyName(lastMove.macro || '');

  if (lastMove.type === 'group_move' && Array.isArray(lastMove.moves)) {
    lastMove.moves.forEach(m => {
      viewer.setModulePosition(m.moduleIndex, m.from);
      const coordCell = document.getElementById(`mod-coords-${m.moduleIndex}`);
      if (coordCell) {
        coordCell.textContent = `${m.from.x}, ${m.from.y}, ${m.from.z}`;
      }
    });

    if (viewer.multiSelectPivot && viewer.selectedModules && viewer.selectedModules.length > 0) {
      viewer.multiSelectPivot.position.set(0, 0, 0);
      let count = 0;
      viewer.selectedModules.forEach(mod => {
        viewer.multiSelectPivot.position.add(mod.position);
        count++;
        mod.userData.multiDragStartPos = mod.position.clone();
      });
      if (count > 0) {
        viewer.multiSelectPivot.position.divideScalar(count);
      }
      if (viewer.multiSelectPivot.userData) {
        viewer.multiSelectPivot.userData.dragStartPos = viewer.multiSelectPivot.position.clone();
      }
      viewer.pivotDragStart = viewer.multiSelectPivot.position.clone();
      if (viewer.multiSelectionHelpers) {
        viewer.multiSelectionHelpers.forEach(h => h.update());
      }
    }

    updateStationStats();
    recalculateMeasurements();
    viewer.restoreFullPlanGrid();

    const remaining = undoList.length;
    const prefix = lastMove.operation === 'diamond_center' ? 'Undid centering' : 'Undid multi-module move';
    showNotification(`${prefix}: ${lastMove.moves.length} modules reverted to previous positions${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'move' && lastMove.from) {
    viewer.setModulePosition(lastMove.moduleIndex, lastMove.from);

    const coordCell = document.getElementById(`mod-coords-${lastMove.moduleIndex}`);
    if (coordCell) {
      coordCell.textContent = `${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z}`;
    }

    const detPos = document.getElementById('det-pos');
    if (detPos && selectedIndex === lastMove.moduleIndex) {
      detPos.textContent = `X: ${lastMove.from.x}m | Y: ${lastMove.from.y}m | Z: ${lastMove.from.z}m`;
    }

    selectModule(lastMove.moduleIndex, false);
    updateStationStats();
    recalculateMeasurements();

    const remaining = undoList.length;
    const prefix = lastMove.operation === 'diamond_center' ? 'Undid centering' : 'Undid move';
    showNotification(`${prefix}: Module #${lastMove.moduleIndex} (${friendlyName}) reverted to (${lastMove.from.x}, ${lastMove.from.y}, ${lastMove.from.z})${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'rotate' && lastMove.fromRot) {
    viewer.setModuleRotation(lastMove.moduleIndex, lastMove.fromRot);

    const detRot = document.getElementById('det-rot');
    if (detRot && selectedIndex === lastMove.moduleIndex) {
      detRot.textContent = `Yaw: ${lastMove.fromRot.yaw}° | Pitch: ${lastMove.fromRot.pitch}° | Roll: ${lastMove.fromRot.roll}°`;
    }
    const inputPitch = document.getElementById('det-input-pitch');
    const inputRoll = document.getElementById('det-input-roll');
    const inputYaw = document.getElementById('det-input-yaw');
    if (selectedIndex === lastMove.moduleIndex) {
      if (inputPitch) inputPitch.value = lastMove.fromRot.pitch;
      if (inputRoll) inputRoll.value = lastMove.fromRot.roll;
      if (inputYaw) inputYaw.value = lastMove.fromRot.yaw;
    }

    selectModule(lastMove.moduleIndex, false);
    updateStationStats();
    recalculateMeasurements();

    const remaining = undoList.length;
    showNotification(`Undid rotation: Module #${lastMove.moduleIndex} (${friendlyName}) reverted to Yaw: ${lastMove.fromRot.yaw}°, Pitch: ${lastMove.fromRot.pitch}°, Roll: ${lastMove.fromRot.roll}°${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'plot_resize' && lastMove.fromConfig) {
    setPlotConfig(lastMove.fromConfig, true);
    viewer.restoreFullPlanGrid();
    viewer.updatePlotBoxViolations();
    const cfg = lastMove.fromConfig;
    const totX = cfg.x.plus + cfg.x.minus;
    const totY = cfg.y.plus + cfg.y.minus;
    const totZ = cfg.z.plus + cfg.z.minus;
    viewer.showFloatingPlotSize(totX, totY, totZ);
    if (viewer.floatingHudTimeout) clearTimeout(viewer.floatingHudTimeout);
    viewer.floatingHudTimeout = setTimeout(() => viewer.hideFloatingPlotSize(), 1500);

    updateStationStats();
    recalculateMeasurements();

    const remaining = undoList.length;
    showNotification(`Undid plot resize: Reverted Plot Bounding Box to ${totX}x${totY}x${totZ} km${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');

  } else if (lastMove.type === 'set_fefb') {
    const prevFefb = lastMove.previousFefb;
    if (viewer) viewer.fefbModuleIndex = prevFefb;
    if (currentPlan) currentPlan.fefbModuleIndex = prevFefb;
    setFefbModuleIndex(prevFefb);

    const remaining = undoList.length;
    showNotification(`Undid setting FEFB: Reverted FEFB to ${prevFefb !== null && prevFefb !== undefined ? `Module #${prevFefb}` : 'none'}${remaining > 0 ? ` [${remaining} move${remaining > 1 ? 's' : ''} remaining in undo list]` : ' [Undo list exhausted]'}`, 'info');
  }

  updateUndoButtonUI();
}

// ==============================================================================
// SAMPLES Management (Add Sample, Replace Sample, Delete Sample)
// ==============================================================================
const STORAGE_CUSTOM_SAMPLES_KEY = 'x4_custom_samples';
const STORAGE_DELETED_SAMPLES_KEY = 'x4_deleted_samples';
const STORAGE_SAMPLES_ORDER_KEY = 'x4_samples_order';
const STORAGE_CURRENT_SAMPLE_KEY = 'x4_current_sample';
const STORAGE_CHECKBOX_STATES_KEY = 'x4_checkbox_states';
const STORAGE_EXCLUDED_MACROS_KEY = 'x4_excluded_macros';

function saveCheckboxState(id, isChecked) {
  try {
    const states = JSON.parse(localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
    states[id] = isChecked;
    localStorage.setItem(STORAGE_CHECKBOX_STATES_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn('Could not save checkbox state:', e);
  }
}

function getSavedCheckboxState(id, defaultVal) {
  try {
    const states = JSON.parse(localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
    if (typeof states[id] === 'boolean') {
      return states[id];
    }
  } catch (e) {
    console.warn('Could not read checkbox state:', e);
  }
  return defaultVal;
}

function saveExcludedMacros() {
  try {
    localStorage.setItem(STORAGE_EXCLUDED_MACROS_KEY, JSON.stringify(Array.from(excludedMacros)));
  } catch (e) {
    console.warn('Could not save excluded macros:', e);
  }
}

function loadSavedExcludedMacros() {
  excludedMacros.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_EXCLUDED_MACROS_KEY) || '[]');
    if (Array.isArray(saved)) {
      saved.forEach(m => excludedMacros.add(m));
    }
  } catch (e) {
    console.warn('Could not load excluded macros:', e);
  }
}

// ==============================================================================
// Structure Analysis Panels Collapse/Expand State Management
// ==============================================================================
const STORAGE_COLLAPSED_PANELS_KEY = 'x4_structure_analysis_collapsed_panels';

function getSavedCollapsedPanels() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_COLLAPSED_PANELS_KEY) || '[]');
  } catch (e) {
    console.warn('Could not load collapsed panels:', e);
    return [];
  }
}

function saveCollapsedPanels(panelsArray) {
  try {
    localStorage.setItem(STORAGE_COLLAPSED_PANELS_KEY, JSON.stringify(panelsArray));
  } catch (e) {
    console.warn('Could not save collapsed panels:', e);
  }
}

function setPanelCollapsed(panelId, isCollapsed) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const btn = panel.querySelector(`.stat-collapse-btn[data-panel="${panelId}"]`) ||
              panel.querySelector('.stat-collapse-btn');

  if (isCollapsed) {
    panel.classList.add('is-collapsed');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } else {
    panel.classList.remove('is-collapsed');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  const collapsedPanels = new Set(getSavedCollapsedPanels());
  if (isCollapsed) {
    collapsedPanels.add(panelId);
  } else {
    collapsedPanels.delete(panelId);
  }
  saveCollapsedPanels(Array.from(collapsedPanels));
}

function togglePanelCollapse(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const isCurrentlyCollapsed = panel.classList.contains('is-collapsed');
  setPanelCollapsed(panelId, !isCurrentlyCollapsed);
}

function setupStructureAnalysisCollapseHandlers() {
  const savedCollapsed = new Set(getSavedCollapsedPanels());

  const collapseButtons = document.querySelectorAll('.stats-card .stat-collapse-btn, #card-structure-analysis .stat-collapse-btn');
  collapseButtons.forEach(btn => {
    const panelId = btn.getAttribute('data-panel');
    const panel = panelId ? document.getElementById(panelId) : btn.closest('.stat-box, .envelope-panel, .panel-card');

    if (panel) {
      if (savedCollapsed.has(panel.id)) {
        panel.classList.add('is-collapsed');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        panel.classList.remove('is-collapsed');
        btn.setAttribute('aria-expanded', 'true');
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        togglePanelCollapse(panel.id);
      });
    }
  });
}

let currentSampleAction = null;
let stagedBlueprintXml = null;
let stagedBlueprintName = '';
let stagedBlueprintModules = 0;
let stagedMultiPlans = [];

// Custom dropdown and right-drag reordering state
let isSampleDropdownOpen = false;
let sampleDragState = {
  isRightDragging: false,
  hasMovedEnough: false,
  draggedKey: null,
  dragItemEl: null,
  startX: 0,
  startY: 0,
  targetDropIndex: -1,
  dropPosition: null, // 'before' | 'after'
  suppressContextMenu: false,
  isRightBtn: false
};

function getDefaultSampleKey() {
  try {
    const saved = localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY);
    if (saved && SAMPLES[saved]) {
      return saved;
    }
  } catch (e) {
    console.warn('Could not read default sample key from storage:', e);
  }
  const ordered = getOrderedSampleKeys();
  if (ordered.length > 0 && SAMPLES[ordered[0]]) {
    return ordered[0];
  }
  return SAMPLES['refineryComplex'] ? 'refineryComplex' : Object.keys(SAMPLES)[0];
}

function setDefaultSampleKey(key) {
  try {
    if (key && SAMPLES[key]) {
      localStorage.setItem(STORAGE_CURRENT_SAMPLE_KEY, key);
    }
  } catch (e) {
    console.warn('Could not save default sample key to storage:', e);
  }
}

function getSamplePlanName(key) {
  const xml = SAMPLES[key];
  if (!xml) return key;
  try {
    const match = xml.match(/<plan\s+[^>]*name="([^"]+)"/i);
    if (match && match[1]) return match[1];
  } catch (_) {}
  return key;
}

function getSampleModuleCount(key) {
  const xml = SAMPLES[key];
  if (!xml) return 0;
  try {
    const matches = xml.match(/<entry\s+/g);
    return matches ? matches.length : 0;
  } catch (_) {
    return 0;
  }
}

function getOrderedSampleKeys() {
  const currentKeys = Object.keys(SAMPLES);
  try {
    const savedOrder = JSON.parse(localStorage.getItem(STORAGE_SAMPLES_ORDER_KEY) || '[]');
    if (Array.isArray(savedOrder) && savedOrder.length > 0) {
      const result = [];
      savedOrder.forEach(key => {
        if (currentKeys.includes(key) && !result.includes(key)) {
          result.push(key);
        }
      });
      currentKeys.forEach(key => {
        if (!result.includes(key)) {
          result.push(key);
        }
      });
      return result;
    }
  } catch (e) {
    console.warn('Could not load samples order:', e);
  }
  return currentKeys;
}

function saveSamplesOrder(orderArray) {
  try {
    localStorage.setItem(STORAGE_SAMPLES_ORDER_KEY, JSON.stringify(orderArray));
  } catch (e) {
    console.warn('Could not save samples order:', e);
  }
}

function initSamplesStorage() {
  try {
    const deleted = JSON.parse(localStorage.getItem(STORAGE_DELETED_SAMPLES_KEY) || '[]');
    deleted.forEach(key => {
      delete SAMPLES[key];
    });

    const custom = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_SAMPLES_KEY) || '{}');
    for (const key in custom) {
      if (custom[key] && custom[key].xml) {
        SAMPLES[key] = custom[key].xml;
      }
    }
  } catch (e) {
    console.warn('Could not load custom samples from storage:', e);
  }
  populateSampleSelector();
}

function populateSampleSelector() {
  const selector = document.getElementById('sample-selector');
  const orderedKeys = getOrderedSampleKeys();
  const defaultKey = getDefaultSampleKey();

  if (selector) {
    selector.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Samples';
    selector.appendChild(defaultOpt);

    orderedKeys.forEach(key => {
      const name = getSamplePlanName(key);
      const option = document.createElement('option');
      option.value = key;
      option.textContent = name;
      selector.appendChild(option);
    });

    if (currentLoadedSampleKey && SAMPLES[currentLoadedSampleKey]) {
      selector.value = currentLoadedSampleKey;
    } else if (currentLoadedSampleKey === null) {
      selector.value = '';
    } else if (defaultKey && SAMPLES[defaultKey]) {
      selector.value = defaultKey;
    } else if (orderedKeys.length > 0) {
      selector.selectedIndex = 0;
    }
  }

  renderCustomSampleDropdown();
}

function toggleSampleDropdown(force) {
  const menu = document.getElementById('sample-dropdown-menu');
  const dropdown = document.getElementById('sample-custom-dropdown');
  const trigger = document.getElementById('sample-dropdown-trigger');
  if (!menu || !dropdown) return;

  const shouldOpen = typeof force === 'boolean' ? force : !isSampleDropdownOpen;
  isSampleDropdownOpen = shouldOpen;

  if (shouldOpen) {
    menu.style.display = 'flex';
    dropdown.classList.add('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    renderCustomSampleDropdown();
  } else {
    menu.style.display = 'none';
    dropdown.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    cleanupSampleDragUI();
  }
}

function closeSampleDropdown() {
  if (isSampleDropdownOpen) {
    toggleSampleDropdown(false);
  }
}

function updateCustomSampleDropdownSelection(sampleKey) {
  currentLoadedSampleKey = (sampleKey && SAMPLES[sampleKey]) ? sampleKey : null;
  const labelEl = document.getElementById('sample-dropdown-current-label');
  if (labelEl) {
    if (currentLoadedSampleKey && SAMPLES[currentLoadedSampleKey]) {
      labelEl.textContent = getSamplePlanName(currentLoadedSampleKey);
    } else {
      labelEl.textContent = 'Samples';
    }
  }
  const defaultKey = getDefaultSampleKey();
  const items = document.querySelectorAll('#sample-dropdown-list .sample-dropdown-item');
  items.forEach(item => {
    const isSelected = Boolean(currentLoadedSampleKey && item.dataset.key === currentLoadedSampleKey);
    item.classList.toggle('active', isSelected);
    const checkEl = item.querySelector('.sample-item-check');
    if (checkEl) {
      const isDefault = (item.dataset.key === defaultKey);
      checkEl.style.display = isDefault ? 'inline-block' : 'none';
      checkEl.title = isDefault ? 'Checked as default sample loaded on reload' : '';
    }
    const defaultBadge = item.querySelector('.sample-item-default-badge');
    if (defaultBadge) {
      const isDefault = (item.dataset.key === defaultKey);
      defaultBadge.style.display = isDefault ? 'inline-block' : 'none';
    }
  });
}

function renderCustomSampleDropdown() {
  const listContainer = document.getElementById('sample-dropdown-list');
  const labelEl = document.getElementById('sample-dropdown-current-label');
  const selector = document.getElementById('sample-selector');
  if (!listContainer) return;

  const orderedKeys = getOrderedSampleKeys();
  const defaultKey = getDefaultSampleKey();
  const currentKey = currentLoadedSampleKey;

  if (labelEl) {
    if (currentKey && SAMPLES[currentKey]) {
      labelEl.textContent = getSamplePlanName(currentKey);
    } else {
      labelEl.textContent = 'Samples';
    }
  }

  listContainer.innerHTML = '';

  orderedKeys.forEach(key => {
    const name = getSamplePlanName(key);
    const moduleCount = getSampleModuleCount(key);
    const isSelected = Boolean(currentKey && key === currentKey);
    const isDefault = (key === defaultKey);

    const item = document.createElement('div');
    item.className = `sample-dropdown-item${isSelected ? ' active' : ''}`;
    item.dataset.key = key;
    item.title = `${isDefault ? '✓ Current default sample (loaded on reload) • ' : ''}Left-click to load as default • Right-drag to reorder\n${name} (${moduleCount} modules)`;

    item.innerHTML = `
      <span class="sample-drag-handle" title="Right-mouse drag to reorder">⠿</span>
      <span class="sample-item-name">${name}</span>
      <span class="sample-item-badge">${moduleCount}m</span>
      <span class="sample-item-default-badge" style="${isDefault ? 'display:inline-block;' : 'display:none;'}">DEFAULT</span>
      <span class="sample-item-check" title="${isDefault ? 'Checked as default sample loaded on reload' : ''}" style="${isDefault ? 'display:inline-block;' : 'display:none;'}">✓</span>
    `;

    // Left click selects and loads
    item.addEventListener('click', (e) => {
      if (sampleDragState.isRightDragging || sampleDragState.hasMovedEnough || sampleDragState.suppressContextMenu) {
        return;
      }
      loadSample(key);
      closeSampleDropdown();
    });

    // Pointerdown / Mousedown for right-drag reordering (also supports left drag on handle)
    item.addEventListener('pointerdown', (e) => {
      const isRightBtn = (e.button === 2);
      const isHandleLeft = (e.button === 0 && e.target.closest('.sample-drag-handle'));

      if (isRightBtn || isHandleLeft) {
        initSampleDrag(e, item, key, isRightBtn);
      }
    });

    listContainer.appendChild(item);
  });
}

function initSampleDrag(e, item, key, isRightBtn) {
  sampleDragState.isRightDragging = false;
  sampleDragState.hasMovedEnough = false;
  sampleDragState.draggedKey = key;
  sampleDragState.dragItemEl = item;
  sampleDragState.startX = e.clientX;
  sampleDragState.startY = e.clientY;
  sampleDragState.targetDropIndex = -1;
  sampleDragState.dropPosition = null;
  sampleDragState.isRightBtn = isRightBtn;

  window.addEventListener('pointermove', handleSampleDragMove, { passive: false });
  window.addEventListener('pointerup', handleSampleDragEnd);
  window.addEventListener('pointercancel', handleSampleDragEnd);
}

function handleSampleDragMove(e) {
  if (!sampleDragState.dragItemEl) return;

  const dx = e.clientX - sampleDragState.startX;
  const dy = e.clientY - sampleDragState.startY;
  const dist = Math.hypot(dx, dy);

  if (!sampleDragState.hasMovedEnough) {
    if (dist > 5) {
      sampleDragState.hasMovedEnough = true;
      sampleDragState.isRightDragging = true;
      document.body.classList.add('sample-dragging-active');
      sampleDragState.dragItemEl.classList.add('is-being-dragged');

      let ghost = document.getElementById('sample-drag-ghost');
      if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'sample-drag-ghost';
        ghost.className = 'sample-drag-ghost';
        document.body.appendChild(ghost);
      }
      ghost.innerHTML = `
        <span class="ghost-handle">⠿</span>
        <span class="ghost-name">${getSamplePlanName(sampleDragState.draggedKey)}</span>
        <span class="ghost-badge">${getSampleModuleCount(sampleDragState.draggedKey)}m</span>
      `;
      ghost.style.display = 'flex';
    } else {
      return;
    }
  }

  e.preventDefault();

  const ghost = document.getElementById('sample-drag-ghost');
  if (ghost) {
    ghost.style.left = (e.clientX + 14) + 'px';
    ghost.style.top = (e.clientY + 14) + 'px';
  }

  const listContainer = document.getElementById('sample-dropdown-list');
  if (!listContainer) return;

  const items = Array.from(listContainer.querySelectorAll('.sample-dropdown-item:not(#sample-drop-indicator)'));
  if (items.length === 0) return;

  let targetItem = null;
  let targetIndex = -1;
  let isBefore = false;

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      targetItem = items[i];
      targetIndex = i;
      const midY = rect.top + rect.height / 2;
      isBefore = e.clientY < midY;
      break;
    }
  }

  if (!targetItem) {
    const firstRect = items[0].getBoundingClientRect();
    const lastRect = items[items.length - 1].getBoundingClientRect();
    if (e.clientY < firstRect.top) {
      targetItem = items[0];
      targetIndex = 0;
      isBefore = true;
    } else if (e.clientY > lastRect.bottom) {
      targetItem = items[items.length - 1];
      targetIndex = items.length - 1;
      isBefore = false;
    }
  }

  let indicator = document.getElementById('sample-drop-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'sample-drop-indicator';
    indicator.className = 'sample-drop-indicator';
  }

  if (targetItem) {
    if (isBefore) {
      listContainer.insertBefore(indicator, targetItem);
      sampleDragState.targetDropIndex = targetIndex;
      sampleDragState.dropPosition = 'before';
    } else {
      listContainer.insertBefore(indicator, targetItem.nextSibling);
      sampleDragState.targetDropIndex = targetIndex + 1;
      sampleDragState.dropPosition = 'after';
    }
  }
}

function handleSampleDragEnd(e) {
  window.removeEventListener('pointermove', handleSampleDragMove);
  window.removeEventListener('pointerup', handleSampleDragEnd);
  window.removeEventListener('pointercancel', handleSampleDragEnd);

  const wasDragging = sampleDragState.isRightDragging && sampleDragState.hasMovedEnough;
  const draggedKey = sampleDragState.draggedKey;
  let targetIndex = sampleDragState.targetDropIndex;

  if (wasDragging) {
    sampleDragState.suppressContextMenu = true;
    setTimeout(() => {
      sampleDragState.suppressContextMenu = false;
    }, 200);

    const orderedKeys = getOrderedSampleKeys();
    const fromIndex = orderedKeys.indexOf(draggedKey);

    if (fromIndex !== -1 && targetIndex !== -1) {
      if (fromIndex < targetIndex) {
        targetIndex--;
      }
      if (fromIndex !== targetIndex && targetIndex >= 0 && targetIndex < orderedKeys.length) {
        const newOrder = [...orderedKeys];
        const [movedKey] = newOrder.splice(fromIndex, 1);
        newOrder.splice(targetIndex, 0, movedKey);

        saveSamplesOrder(newOrder);
        populateSampleSelector();

        const planName = getSamplePlanName(movedKey);
        showNotification(`Re-ordered SAMPLES: "${planName}" moved to position #${targetIndex + 1}.`, 'success');
      }
    }
  }

  cleanupSampleDragUI();
}

function cleanupSampleDragUI() {
  const ghost = document.getElementById('sample-drag-ghost');
  if (ghost) ghost.style.display = 'none';

  const indicator = document.getElementById('sample-drop-indicator');
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }

  if (sampleDragState.dragItemEl) {
    sampleDragState.dragItemEl.classList.remove('is-being-dragged');
  }

  document.body.classList.remove('sample-dragging-active');
  sampleDragState.dragItemEl = null;
  sampleDragState.draggedKey = null;
  sampleDragState.isRightDragging = false;
  sampleDragState.hasMovedEnough = false;
  sampleDragState.targetDropIndex = -1;
}

function setupSampleCustomDropdownEvents() {
  const trigger = document.getElementById('sample-dropdown-trigger');
  const menu = document.getElementById('sample-dropdown-menu');
  const wrapper = document.getElementById('sample-select-wrapper');

  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSampleDropdown();
    });

    trigger.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSampleActionModal();
    });
  }

  if (menu) {
    menu.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sampleDragState.suppressContextMenu) {
        return;
      }
      openSampleActionModal();
    });
  }

  const btnManage = document.getElementById('btn-dropdown-manage-samples');
  if (btnManage) {
    btnManage.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSampleDropdown();
      openSampleActionModal();
    });
  }

  document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target)) {
      closeSampleDropdown();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSampleDropdownOpen) {
      closeSampleDropdown();
    }
  });
}

function openSampleActionModal() {
  const modal = document.getElementById('sample-action-modal');
  if (!modal) return;

  currentSampleAction = null;
  resetBlueprintLoaderUI();

  const sampleActionSelect = document.getElementById('sample_action');
  if (sampleActionSelect) sampleActionSelect.value = '';

  document.querySelectorAll('.btn-sample-action-pill').forEach(btn => btn.classList.remove('active'));

  const contentArea = document.getElementById('sample-action-body-content');
  if (contentArea) contentArea.style.display = 'none';

  modal.classList.add('active');
  if (sampleActionSelect) sampleActionSelect.focus();
}

function closeSampleActionModal() {
  const modal = document.getElementById('sample-action-modal');
  if (modal) modal.classList.remove('active');
}

function resetBlueprintLoaderUI() {
  stagedBlueprintXml = null;
  stagedBlueprintName = '';
  stagedBlueprintModules = 0;
  stagedMultiPlans = [];

  const infoCard = document.getElementById('sample-action-loaded-info');
  if (infoCard) infoCard.style.display = 'none';

  const multiPlanWrap = document.getElementById('sample-action-multi-plan-wrap');
  if (multiPlanWrap) multiPlanWrap.style.display = 'none';

  const pasteBox = document.getElementById('sample-action-paste-box');
  if (pasteBox) pasteBox.style.display = 'none';

  const pasteText = document.getElementById('sample-action-paste-text');
  if (pasteText) pasteText.value = '';

  const fileInput = document.getElementById('sample-action-file-input');
  if (fileInput) fileInput.value = '';

  const submitBtn = document.getElementById('btn-sample-action-submit');
  if (submitBtn) submitBtn.disabled = true;
}

function handleSampleActionSelected(action) {
  currentSampleAction = action;

  const sampleActionSelect = document.getElementById('sample_action');
  if (sampleActionSelect && sampleActionSelect.value !== action) {
    sampleActionSelect.value = action;
  }

  document.querySelectorAll('.btn-sample-action-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.action === action);
  });

  const contentArea = document.getElementById('sample-action-body-content');
  if (contentArea) contentArea.style.display = 'block';

  const currentSamplesBlock = document.getElementById('sample-action-current-samples-block');
  const loaderBlock = document.getElementById('sample-action-loader-block');
  const submitBtn = document.getElementById('btn-sample-action-submit');

  resetBlueprintLoaderUI();

  const sampleKeys = getOrderedSampleKeys();

  if (action === 'Delete Sample') {
    loaderBlock.style.display = 'none';
    submitBtn.textContent = '🗑️ Delete Sample';
    submitBtn.className = 'btn btn-danger';
    submitBtn.disabled = sampleKeys.length <= 1;

    currentSamplesBlock.innerHTML = `
      <div class="form-group">
        <label for="sample-action-target" class="form-label" style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Choose Sample to Delete:</label>
        <select id="sample-action-target" class="sample-target-select">
          ${sampleKeys.map(k => `<option value="${k}">${getSamplePlanName(k)} (${getSampleModuleCount(k)} modules)</option>`).join('')}
        </select>
        ${sampleKeys.length <= 1 ? '<p style="color:#ff5252; font-size:0.75rem; margin-top:6px;">⚠️ Cannot delete the only remaining sample.</p>' : ''}
      </div>
    `;
  } else if (action === 'Replace Sample') {
    loaderBlock.style.display = 'block';
    submitBtn.textContent = '🔄 Replace Sample';
    submitBtn.className = 'btn btn-primary';
    submitBtn.disabled = true;

    currentSamplesBlock.innerHTML = `
      <div class="form-group">
        <label for="sample-action-target" class="form-label" style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Choose Target Sample to Replace:</label>
        <select id="sample-action-target" class="sample-target-select">
          ${sampleKeys.map(k => `<option value="${k}">${getSamplePlanName(k)} (${getSampleModuleCount(k)} modules)</option>`).join('')}
        </select>
      </div>
    `;
  } else if (action === 'Add Sample') {
    loaderBlock.style.display = 'block';
    submitBtn.textContent = '➕ Add Sample';
    submitBtn.className = 'btn btn-success';
    submitBtn.disabled = true;

    currentSamplesBlock.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Current SAMPLES (${sampleKeys.length} available):</label>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${sampleKeys.map(k => `
            <div class="sample-chip">
              <span>${getSamplePlanName(k)}</span>
              <span class="sample-chip-count">${getSampleModuleCount(k)}m</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

function parseAndStageBlueprintXml(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      showNotification('XML Parsing error: Invalid blueprint XML format.', 'error');
      return;
    }

    const plans = xmlDoc.getElementsByTagName('plan');
    if (plans.length === 0) {
      showNotification('No <plan> element found in the provided XML.', 'error');
      return;
    }

    if (plans.length === 1) {
      const planNode = plans[0];
      const planName = planNode.getAttribute('name') || 'Custom Blueprint';
      const entries = planNode.getElementsByTagName('entry');

      stagedBlueprintXml = xmlText.includes('<plans>') ? xmlText : `<?xml version="1.0" encoding="UTF-8"?>\n<plans>\n  ${new XMLSerializer().serializeToString(planNode)}\n</plans>`;
      stagedBlueprintName = planName;
      stagedBlueprintModules = entries.length;

      displayStagedBlueprintPreview(planName, entries.length);
    } else {
      stagedMultiPlans = [];
      const multiSelect = document.getElementById('sample-action-multi-plan-select');
      if (multiSelect) multiSelect.innerHTML = '';

      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        const pName = p.getAttribute('name') || `Plan #${i + 1}`;
        const pEntries = p.getElementsByTagName('entry');
        const pXml = `<?xml version="1.0" encoding="UTF-8"?>\n<plans>\n  ${new XMLSerializer().serializeToString(p)}\n</plans>`;

        stagedMultiPlans.push({
          name: pName,
          modules: pEntries.length,
          xml: pXml
        });

        if (multiSelect) {
          const opt = document.createElement('option');
          opt.value = i.toString();
          opt.textContent = `${pName} (${pEntries.length} modules)`;
          multiSelect.appendChild(opt);
        }
      }

      const multiWrap = document.getElementById('sample-action-multi-plan-wrap');
      if (multiWrap) multiWrap.style.display = 'block';

      const first = stagedMultiPlans[0];
      stagedBlueprintXml = first.xml;
      stagedBlueprintName = first.name;
      stagedBlueprintModules = first.modules;
      displayStagedBlueprintPreview(first.name, first.modules);
    }
  } catch (err) {
    showNotification('Error processing blueprint: ' + err.message, 'error');
  }
}

function displayStagedBlueprintPreview(name, moduleCount) {
  const infoCard = document.getElementById('sample-action-loaded-info');
  const previewName = document.getElementById('sample-action-preview-name');
  const previewModules = document.getElementById('sample-action-preview-modules');
  const nameInput = document.getElementById('sample-action-plan-name-input');
  const submitBtn = document.getElementById('btn-sample-action-submit');

  if (previewName) previewName.textContent = name;
  if (previewModules) previewModules.textContent = `${moduleCount} modules`;
  if (nameInput) nameInput.value = name;
  if (infoCard) infoCard.style.display = 'block';
  if (submitBtn) submitBtn.disabled = false;
}

function executeSampleAction() {
  if (!currentSampleAction) return;

  const sampleKeys = Object.keys(SAMPLES);

  if (currentSampleAction === 'Delete Sample') {
    if (sampleKeys.length <= 1) {
      showNotification('Cannot delete the only remaining sample.', 'warning');
      return;
    }

    const targetKey = document.getElementById('sample-action-target')?.value;
    if (!targetKey || !SAMPLES[targetKey]) return;

    const targetName = getSamplePlanName(targetKey);
    delete SAMPLES[targetKey];

    try {
      const deleted = JSON.parse(localStorage.getItem(STORAGE_DELETED_SAMPLES_KEY) || '[]');
      if (!deleted.includes(targetKey)) {
        deleted.push(targetKey);
        localStorage.setItem(STORAGE_DELETED_SAMPLES_KEY, JSON.stringify(deleted));
      }

      const custom = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_SAMPLES_KEY) || '{}');
      if (custom[targetKey]) {
        delete custom[targetKey];
        localStorage.setItem(STORAGE_CUSTOM_SAMPLES_KEY, JSON.stringify(custom));
      }

      const savedOrder = JSON.parse(localStorage.getItem(STORAGE_SAMPLES_ORDER_KEY) || '[]');
      const filteredOrder = savedOrder.filter(k => k !== targetKey);
      localStorage.setItem(STORAGE_SAMPLES_ORDER_KEY, JSON.stringify(filteredOrder));

      if (localStorage.getItem(STORAGE_CURRENT_SAMPLE_KEY) === targetKey) {
        localStorage.removeItem(STORAGE_CURRENT_SAMPLE_KEY);
      }
    } catch (_) {}

    populateSampleSelector();

    const sampleSelector = document.getElementById('sample-selector');
    const remainingKeys = getOrderedSampleKeys();
    const nextKey = remainingKeys[0];
    if (nextKey) {
      if (sampleSelector) sampleSelector.value = nextKey;
      loadSample(nextKey);
    }

    closeSampleActionModal();
    showNotification(`Sample "${targetName}" deleted successfully.`, 'success');

  } else if (currentSampleAction === 'Replace Sample') {
    const targetKey = document.getElementById('sample-action-target')?.value;
    if (!targetKey || !SAMPLES[targetKey]) {
      showNotification('Please select a target sample to replace.', 'warning');
      return;
    }

    if (!stagedBlueprintXml) {
      showNotification('Please load a blueprint from construction plans first.', 'warning');
      return;
    }

    const customNameInput = document.getElementById('sample-action-plan-name-input')?.value.trim();
    const finalName = customNameInput || stagedBlueprintName || 'Replaced Sample';

    let finalXml = stagedBlueprintXml;
    if (customNameInput) {
      finalXml = finalXml.replace(/(<plan\s+[^>]*name=")[^"]*(")/i, `$1${customNameInput}$2`);
    }

    SAMPLES[targetKey] = finalXml;

    try {
      const custom = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_SAMPLES_KEY) || '{}');
      custom[targetKey] = { name: finalName, xml: finalXml };
      localStorage.setItem(STORAGE_CUSTOM_SAMPLES_KEY, JSON.stringify(custom));

      const deleted = JSON.parse(localStorage.getItem(STORAGE_DELETED_SAMPLES_KEY) || '[]');
      const filtered = deleted.filter(k => k !== targetKey);
      localStorage.setItem(STORAGE_DELETED_SAMPLES_KEY, JSON.stringify(filtered));
    } catch (_) {}

    populateSampleSelector();

    const sampleSelector = document.getElementById('sample-selector');
    if (sampleSelector) sampleSelector.value = targetKey;
    loadSample(targetKey);

    closeSampleActionModal();
    showNotification(`Sample "${finalName}" replaced successfully!`, 'success');

  } else if (currentSampleAction === 'Add Sample') {
    if (!stagedBlueprintXml) {
      showNotification('Please load a blueprint from construction plans first.', 'warning');
      return;
    }

    const customNameInput = document.getElementById('sample-action-plan-name-input')?.value.trim();
    const finalName = customNameInput || stagedBlueprintName || 'New Sample';

    let finalXml = stagedBlueprintXml;
    if (customNameInput) {
      finalXml = finalXml.replace(/(<plan\s+[^>]*name=")[^"]*(")/i, `$1${customNameInput}$2`);
    }

    let newKey = 'custom_' + finalName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
    let counter = 1;
    while (SAMPLES[newKey]) {
      newKey = `custom_${finalName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}_${counter++}`;
    }

    SAMPLES[newKey] = finalXml;

    try {
      const custom = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_SAMPLES_KEY) || '{}');
      custom[newKey] = { name: finalName, xml: finalXml };
      localStorage.setItem(STORAGE_CUSTOM_SAMPLES_KEY, JSON.stringify(custom));

      const deleted = JSON.parse(localStorage.getItem(STORAGE_DELETED_SAMPLES_KEY) || '[]');
      const filtered = deleted.filter(k => k !== newKey);
      localStorage.setItem(STORAGE_DELETED_SAMPLES_KEY, JSON.stringify(filtered));

      const currentOrder = getOrderedSampleKeys();
      if (!currentOrder.includes(newKey)) {
        currentOrder.push(newKey);
        saveSamplesOrder(currentOrder);
      }
    } catch (_) {}

    populateSampleSelector();

    const sampleSelector = document.getElementById('sample-selector');
    if (sampleSelector) sampleSelector.value = newKey;
    loadSample(newKey);

    closeSampleActionModal();
    showNotification(`Sample "${finalName}" added to SAMPLES successfully!`, 'success');
  }
}

function setupSampleActionModalEvents() {
  const sampleSelector = document.getElementById('sample-selector');
  const selectWrapper = sampleSelector?.closest('.select-wrapper');
  [sampleSelector, selectWrapper].forEach(el => {
    if (el) {
      el.addEventListener('contextmenu', (e) => {
        if (sampleDragState && sampleDragState.suppressContextMenu) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        openSampleActionModal();
      });
    }
  });

  const sampleActionSelect = document.getElementById('sample_action');
  if (sampleActionSelect) {
    sampleActionSelect.addEventListener('change', (e) => {
      handleSampleActionSelected(e.target.value);
    });
  }

  document.querySelectorAll('.btn-sample-action-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const act = e.currentTarget.dataset.action;
      if (act) handleSampleActionSelected(act);
    });
  });

  const btnBrowse = document.getElementById('btn-sample-action-browse');
  const fileInput = document.getElementById('sample-action-file-input');
  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        parseAndStageBlueprintXml(evt.target.result);
      };
      reader.readAsText(file);
    });
  }

  const btnPasteToggle = document.getElementById('btn-sample-action-paste-toggle');
  const pasteBox = document.getElementById('sample-action-paste-box');
  if (btnPasteToggle && pasteBox) {
    btnPasteToggle.addEventListener('click', () => {
      pasteBox.style.display = pasteBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  const btnPasteProcess = document.getElementById('btn-sample-action-paste-process');
  const pasteText = document.getElementById('sample-action-paste-text');
  if (btnPasteProcess && pasteText) {
    btnPasteProcess.addEventListener('click', () => {
      const code = pasteText.value.trim();
      if (!code) {
        showNotification('Please paste XML code snippet first.', 'warning');
        return;
      }
      parseAndStageBlueprintXml(code);
    });
  }

  const multiSelect = document.getElementById('sample-action-multi-plan-select');
  if (multiSelect) {
    multiSelect.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (stagedMultiPlans[idx]) {
        const item = stagedMultiPlans[idx];
        stagedBlueprintXml = item.xml;
        stagedBlueprintName = item.name;
        stagedBlueprintModules = item.modules;
        displayStagedBlueprintPreview(item.name, item.modules);
      }
    });
  }

  const submitBtn = document.getElementById('btn-sample-action-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', executeSampleAction);
  }

  const btnClose = document.getElementById('btn-close-sample-action');
  const btnCancel = document.getElementById('btn-sample-action-cancel');
  [btnClose, btnCancel].forEach(btn => {
    if (btn) btn.addEventListener('click', closeSampleActionModal);
  });

  const actionModal = document.getElementById('sample-action-modal');
  if (actionModal) {
    actionModal.addEventListener('click', (e) => {
      if (e.target === actionModal) closeSampleActionModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && actionModal?.classList.contains('active')) {
      closeSampleActionModal();
    }
  });
}

/**
 * Event listeners for Center Modules in Plot BB Modal Dialog
 */
function setupCenterModulesModalEvents() {
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
      if (viewer) {
        viewer.executePendingCenterAction();
        viewer.restoreFullPlanGrid();
        updateStationStats();
        recalculateMeasurements();
        showNotification('Selected modules centered within Plot Bounding Box', 'success');
      }
      closeCenterModal();
    });
  }

  if (btnFefb) {
    btnFefb.addEventListener('click', () => {
      const targetMod = viewer?.pendingSingleModule || (viewer?.selectedModules?.length === 1 ? viewer.selectedModules[0] : null) || (viewer?.selectedModuleIndex !== null ? viewer.modulesGroup?.children?.find(m => m.userData?.index === viewer.selectedModuleIndex) : null);
      if (targetMod) {
        const modIndex = targetMod.userData?.index !== undefined ? targetMod.userData.index : 1;
        const macroName = targetMod.userData?.friendlyName || targetMod.userData?.macro || `Module #${modIndex}`;
        const prevFefb = viewer?.fefbModuleIndex !== undefined ? viewer.fefbModuleIndex : (currentPlan?.fefbModuleIndex !== undefined ? currentPlan.fefbModuleIndex : getFefbModuleIndex());
        if (viewer) viewer.fefbModuleIndex = modIndex;
        if (currentPlan) currentPlan.fefbModuleIndex = modIndex;
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
        showNotification(`Module #${modIndex} (${macroName}) set as First Element for branching (FEFB)`, 'success');
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
