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
  energyCells: { name: 'Energy Cells', desc: 'Reactor and assembly power', colorClass: 'text-amber' }
};


let viewer = null;
let currentPlan = null;
let selectedIndex = null;
let activeCategoryFilter = 'all';
let activeMacroFilter = null;
const excludedMacros = new Set();

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
    selectModule(index, false); // Clicked in 3D, select in UI list but don't focus camera (to avoid disorienting user)
  });

  // 2. Set up event listeners
  setupEventListeners();

  // 3. Load default sample plan
  loadSample('refineryComplex');
}

function loadSample(sampleKey) {
  const xml = SAMPLES[sampleKey];
  if (xml) {
    try {
      loadPlanFromXml(xml);
      const selector = document.getElementById('sample-selector');
      if (selector) selector.value = sampleKey;
    } catch (e) {
      showNotification('Error loading sample: ' + e.message, 'error');
    }
  }
}

async function loadPlanFromXml(xmlText) {
  const planData = parseConstructionPlan(xmlText);
  currentPlan = planData;
  selectedIndex = null;
  activeCategoryFilter = 'all';
  activeMacroFilter = null;
  excludedMacros.clear();
  updateActiveFilterUI();

  // Load into 3D viewer (await async mesh loading)
  await viewer.loadStationPlan(planData);

  // Update UI Panels
  updatePlanMetadata(planData);
  calculateAndRenderStats(planData);
  renderVisibilityControls(planData);
  renderModuleList(planData.modules);
  resetAnimator();
  viewer.highlightModulesByFilter('all', null);

  showNotification(`Successfully loaded plan "${planData.name}" with ${planData.modules.length} modules!`, 'success');
}

function updatePlanMetadata(plan) {
  document.getElementById('plan-name').textContent = plan.name;
  document.getElementById('plan-desc').textContent = plan.description;
  document.getElementById('plan-id').textContent = plan.id;
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

  // Resource totals initialized to 0
  const totalResources = {
    hullParts: 0,
    claytronics: 0,
    computronicSubstrate: 0,
    siliconCarbide: 0,
    metallicMicrolattice: 0,
    shieldComponents: 0,
    turretComponents: 0,
    advancedElectronics: 0,
    water: 0,
    energyCells: 0
  };

  modules.forEach(mod => {
    const cat = getModuleCategory(mod.macro);
    if (categoryData[cat]) {
      categoryData[cat].count++;
      categoryData[cat].macros[mod.macro] = (categoryData[cat].macros[mod.macro] || 0) + 1;
    }

    if (!excludedMacros.has(mod.macro)) {
      const costs = estimateModuleCosts(mod.macro);
      for (const key in totalResources) {
        if (costs[key] !== undefined) {
          totalResources[key] += costs[key];
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
          renderVisibilityControls(currentPlan, activeCategoryFilter);
          renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
          viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
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
        renderVisibilityControls(currentPlan, activeCategoryFilter);
        renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
        viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
      });
      
      macrosAllContainer.appendChild(item);
    }
  }

  // Update resources dynamically (hiding ones that are 0 to keep view clean)
  const container = document.getElementById('resources-list-container');
  if (container) {
    container.innerHTML = '';
    
    const orderedKeys = [
      'hullParts', 'claytronics', 'computronicSubstrate', 
      'siliconCarbide', 'metallicMicrolattice', 'shieldComponents', 
      'turretComponents', 'advancedElectronics', 'water', 'energyCells'
    ];

    let hasAnyCosts = false;

    orderedKeys.forEach(key => {
      const amount = totalResources[key];
      if (amount > 0) {
        hasAnyCosts = true;
        const meta = RESOURCE_METADATA[key];
        
        const row = document.createElement('div');
        row.className = 'resource-row';
        row.innerHTML = `
          <div class="res-info">
            <span class="res-name">${meta.name}</span>
            <span class="res-desc">${meta.desc}</span>
          </div>
          <span class="res-val ${meta.colorClass}">${amount.toLocaleString()}</span>
        `;
        container.appendChild(row);
      }
    });

    if (!hasAnyCosts) {
      container.innerHTML = `<div class="placeholder-content" style="height: auto; padding: 10px;"><p>No construction resources estimated for this plan.</p></div>`;
    }
  }

  // Bounding size estimate
  const sizeX = document.getElementById('stat-size-x');
  const sizeY = document.getElementById('stat-size-y');
  const sizeZ = document.getElementById('stat-size-z');

  if (modules.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    modules.forEach(m => {
      minX = Math.min(minX, m.position.x);
      maxX = Math.max(maxX, m.position.x);
      minY = Math.min(minY, m.position.y);
      maxY = Math.max(maxY, m.position.y);
      minZ = Math.min(minZ, m.position.z);
      maxZ = Math.max(maxZ, m.position.z);
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
      <td class="col-index"><span class="index-badge">${mod.index}</span></td>
      <td class="col-name">
        <div class="name-friendly">${friendlyName}</div>
        <div class="name-macro">${mod.macro}</div>
      </td>
      <td class="col-category">
        <span class="category-tag" style="background-color: ${CATEGORY_COLORS[category]}15; border-color: ${CATEGORY_COLORS[category]}; color: ${CATEGORY_COLORS[category]}">
          ${CATEGORY_NAMES[category].split(' ')[0]}
        </span>
      </td>
      <td class="col-coords">${Math.round(mod.position.x)}, ${Math.round(mod.position.y)}, ${Math.round(mod.position.z)}</td>
    `;

    tr.addEventListener('click', () => {
      selectModule(mod.index, true); // True means center camera in 3D
    });

    tbody.appendChild(tr);
  });
}

function renderVisibilityControls(plan, highlightedCategory = null) {
  const container = document.getElementById('visibility-controls-container');
  if (!container) return;

  container.innerHTML = '';

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

  let categories = ['docks', 'production', 'storage', 'habitation', 'defense', 'structure'];
  if (highlightedCategory && highlightedCategory !== 'all' && categories.includes(highlightedCategory)) {
    categories = [highlightedCategory, ...categories.filter(c => c !== highlightedCategory)];
  }

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
    if (cat === highlightedCategory) {
      catHeader.classList.add('highlighted-cat');
    }
    catHeader.innerHTML = `
      <span class="visibility-cat-title" style="color: ${CATEGORY_COLORS[cat]}">${CATEGORY_NAMES[cat]}</span>
      <button class="visibility-cat-toggle-btn" title="${toggleLabel} category components">${toggleLabel}</button>
    `;
    container.appendChild(catHeader);

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

      // Refresh UI state
      renderVisibilityControls(currentPlan, highlightedCategory);
      calculateAndRenderStats(currentPlan);
      renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
      viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
      scrollAndHighlightLeftCategory(cat);
    });

    // Render Macro Checklist
    macroKeys.forEach(macro => {
      const count = macros[macro];
      const friendlyName = getFriendlyName(macro);
      const isExcluded = excludedMacros.has(macro);

      const row = document.createElement('div');
      row.className = 'visibility-row';
      if (cat === highlightedCategory) {
        row.style.borderLeft = '2px solid rgba(0, 245, 255, 0.25)';
        row.style.paddingLeft = '6px';
      }
      
      const checkboxId = `vis-chk-${macro.replace(/[^a-zA-Z0-9]/g, '_')}`;

      row.innerHTML = `
        <label for="${checkboxId}">
          <input type="checkbox" id="${checkboxId}" ${!isExcluded ? 'checked' : ''}>
          <span>${friendlyName}</span>
        </label>
        <span class="macro-count-badge">${count}</span>
      `;

      const input = row.querySelector('input');
      input.addEventListener('change', (e) => {
        const isVisible = e.target.checked;
        if (isVisible) {
          excludedMacros.delete(macro);
        } else {
          excludedMacros.add(macro);
        }

        // Update 3D viewport portal meshes
        viewer.setMacroVisibility(macro, isVisible);

        // Refresh stats and module list
        renderVisibilityControls(currentPlan, highlightedCategory); // Re-render to update the header toggle label
        calculateAndRenderStats(currentPlan);
        renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
        viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
        scrollAndHighlightLeftCategory(cat);
      });

      container.appendChild(row);
    });
  });

  // Automatically scroll back to top to display highlighted item
  container.scrollTop = 0;
}

function scrollAndHighlightLeftCategory(category) {
  const statBox = document.getElementById(`stat-box-${category}`);
  const scrollContainer = document.querySelector('.stats-card .card-body');
  
  if (statBox && scrollContainer) {
    // Smooth scroll stat box to the top of scroll container
    statBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Add glowing outline pulse highlight
    statBox.classList.add('reveal-highlight');
    
    // Remove highlight class after animation finishes
    setTimeout(() => {
      statBox.classList.remove('reveal-highlight');
    }, 1500);
  }
}

function selectModule(index, focusCamera = true) {
  // Deselect previous
  if (selectedIndex !== null) {
    const prevRow = document.getElementById(`mod-row-${selectedIndex}`);
    if (prevRow) prevRow.classList.remove('selected');
  }

  selectedIndex = index;
  const activeRow = document.getElementById(`mod-row-${index}`);
  if (activeRow) {
    activeRow.classList.add('selected');
    // Scroll element into view smoothly in the sidebar container
    activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Update Details Card
  const moduleData = currentPlan.modules.find(m => m.index === index);
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
    document.getElementById('det-macro').textContent = moduleData.macro;
    
    const catTag = document.getElementById('det-category');
    catTag.textContent = CATEGORY_NAMES[cat];
    catTag.style.backgroundColor = color + '20';
    catTag.style.borderColor = color;
    catTag.style.color = color;

    document.getElementById('det-pos').textContent = `X: ${Math.round(moduleData.position.x)}m | Y: ${Math.round(moduleData.position.y)}m | Z: ${Math.round(moduleData.position.z)}m`;
    document.getElementById('det-rot').textContent = `Yaw: ${moduleData.rotation.yaw}° | Pitch: ${moduleData.rotation.pitch}° | Roll: ${moduleData.rotation.roll}°`;
    document.getElementById('det-conn').textContent = moduleData.connection || 'None (Base Node)';

    // Dynamically render individual module resources
    const detContainer = document.getElementById('det-resources-container');
    if (detContainer) {
      detContainer.innerHTML = '';
      
      const orderedKeys = [
        'hullParts', 'claytronics', 'computronicSubstrate', 
        'siliconCarbide', 'metallicMicrolattice', 'shieldComponents', 
        'turretComponents', 'advancedElectronics', 'water', 'energyCells'
      ];

      orderedKeys.forEach(key => {
        const amount = costs[key] || 0;
        if (amount > 0) {
          const meta = RESOURCE_METADATA[key];
          
          const costItem = document.createElement('div');
          costItem.className = 'cost-item';
          costItem.innerHTML = `
            <span class="lbl">${meta.name}:</span>
            <span class="val ${meta.colorClass}">${amount}</span>
          `;
          detContainer.appendChild(costItem);
        }
      });
    }

    // Highlight inside 3D viewer
    viewer.selectModuleByIndex(index);

    if (focusCamera) {
      viewer.focusCameraOnModule(index);
    }
  } else {
    placeholder.classList.remove('hidden');
    card.classList.add('hidden');
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
    const total = currentPlan.modules.length;
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
 * Event Binding Definitions
 */
function setupEventListeners() {
  // 1. Plan source selectors
  const sampleSelector = document.getElementById('sample-selector');
  if (sampleSelector) {
    sampleSelector.addEventListener('change', (e) => {
      loadSample(e.target.value);
    });
  }

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
      if (xmlTextArea) xmlTextArea.focus();
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
  const gridToggle = document.getElementById('toggle-grid');
  gridToggle.addEventListener('change', (e) => {
    viewer.toggleGrid(e.target.checked);
  });

  const wireframeToggle = document.getElementById('toggle-wireframe');
  wireframeToggle.addEventListener('change', (e) => {
    viewer.toggleWireframe(e.target.checked);
  });

  const rotateToggle = document.getElementById('toggle-autorotate');
  rotateToggle.addEventListener('change', (e) => {
    viewer.toggleAutoRotate(e.target.checked);
  });

  // 4. Sidebar module list search
  const searchInput = document.getElementById('module-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (currentPlan) {
        renderModuleList(currentPlan.modules, e.target.value);
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
      renderVisibilityControls(currentPlan, activeCategoryFilter);
      renderModuleList(currentPlan.modules, document.getElementById('module-search').value);
      viewer.highlightModulesByFilter(activeCategoryFilter, activeMacroFilter);
    });
  });

  // 8. Global visibility "Show All" button
  const showAllVisBtn = document.getElementById('btn-visibility-show-all');
  if (showAllVisBtn) {
    showAllVisBtn.addEventListener('click', () => {
      if (!currentPlan) return;
      
      // Clear excluded set
      excludedMacros.clear();
      
      // Re-include all meshes in 3D viewer
      currentPlan.modules.forEach(mod => {
        viewer.setMacroVisibility(mod.macro, true);
      });
      
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
        setTimeout(() => {
          clearCheckbox.checked = false;
        }, 2000);
      }
    });
  }
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
function clearAllPanels() {
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

  showNotification('All panels and viewport cleared.', 'info');
}
