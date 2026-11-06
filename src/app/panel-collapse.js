/**
 * Collapse/expand state of the Structure Analysis panels, persisted in localStorage.
 * Extracted from main.js.
 */
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

export function setPanelCollapsed(panelId, isCollapsed) {
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

export function setupStructureAnalysisCollapseHandlers() {
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
