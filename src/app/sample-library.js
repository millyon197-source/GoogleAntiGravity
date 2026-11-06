/**
 * Sample plan library: storage, ordered custom dropdown with right-drag reordering, and the add/replace/delete sample modal.
 * Extracted from main.js.
 */
import { SAMPLES } from '../samples.js';
import { STORAGE_CURRENT_SAMPLE_KEY, STORAGE_CUSTOM_SAMPLES_KEY, STORAGE_DELETED_SAMPLES_KEY, STORAGE_SAMPLES_ORDER_KEY } from './ui-preferences.js';

/**
 * Controller state and actions supplied by main.js via initSampleLibrary().
 * - getCurrentSampleKey() / setCurrentSampleKey(value): main.js `currentLoadedSampleKey`
 * - loadSample(...)
 * - showNotification(...)
 */
let deps = null;

/** Connects this module to the app controller (called once by main.js). */
export function initSampleLibrary(controller) {
  deps = controller;
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

export function getDefaultSampleKey() {
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

export function setDefaultSampleKey(key) {
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

export function initSamplesStorage() {
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

    if (deps.getCurrentSampleKey() && SAMPLES[deps.getCurrentSampleKey()]) {
      selector.value = deps.getCurrentSampleKey();
    } else if (deps.getCurrentSampleKey() === null) {
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

export function updateCustomSampleDropdownSelection(sampleKey) {
  deps.setCurrentSampleKey((sampleKey && SAMPLES[sampleKey]) ? sampleKey : null);
  const labelEl = document.getElementById('sample-dropdown-current-label');
  if (labelEl) {
    if (deps.getCurrentSampleKey() && SAMPLES[deps.getCurrentSampleKey()]) {
      labelEl.textContent = getSamplePlanName(deps.getCurrentSampleKey());
    } else {
      labelEl.textContent = 'Samples';
    }
  }
  const defaultKey = getDefaultSampleKey();
  const items = document.querySelectorAll('#sample-dropdown-list .sample-dropdown-item');
  items.forEach(item => {
    const isSelected = Boolean(deps.getCurrentSampleKey() && item.dataset.key === deps.getCurrentSampleKey());
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
  const currentKey = deps.getCurrentSampleKey();

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
      deps.loadSample(key);
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
        deps.showNotification(`Re-ordered SAMPLES: "${planName}" moved to position #${targetIndex + 1}.`, 'success');
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

export function setupSampleCustomDropdownEvents() {
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
      deps.showNotification('XML Parsing error: Invalid blueprint XML format.', 'error');
      return;
    }

    const plans = xmlDoc.getElementsByTagName('plan');
    if (plans.length === 0) {
      deps.showNotification('No <plan> element found in the provided XML.', 'error');
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
    deps.showNotification('Error processing blueprint: ' + err.message, 'error');
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
      deps.showNotification('Cannot delete the only remaining sample.', 'warning');
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
      deps.loadSample(nextKey);
    }

    closeSampleActionModal();
    deps.showNotification(`Sample "${targetName}" deleted successfully.`, 'success');

  } else if (currentSampleAction === 'Replace Sample') {
    const targetKey = document.getElementById('sample-action-target')?.value;
    if (!targetKey || !SAMPLES[targetKey]) {
      deps.showNotification('Please select a target sample to replace.', 'warning');
      return;
    }

    if (!stagedBlueprintXml) {
      deps.showNotification('Please load a blueprint from construction plans first.', 'warning');
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
    deps.loadSample(targetKey);

    closeSampleActionModal();
    deps.showNotification(`Sample "${finalName}" replaced successfully!`, 'success');

  } else if (currentSampleAction === 'Add Sample') {
    if (!stagedBlueprintXml) {
      deps.showNotification('Please load a blueprint from construction plans first.', 'warning');
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
    deps.loadSample(newKey);

    closeSampleActionModal();
    deps.showNotification(`Sample "${finalName}" added to SAMPLES successfully!`, 'success');
  }
}

export function setupSampleActionModalEvents() {
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
        deps.showNotification('Please paste XML code snippet first.', 'warning');
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
