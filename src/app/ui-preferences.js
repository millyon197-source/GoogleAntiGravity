/**
 * localStorage-backed UI preferences: checkbox states, excluded macros and sample storage keys.
 * Extracted from main.js.
 */
/** Macros hidden via Component Visibility (shared, mutated in place). */
export const excludedMacros = new Set();

// ==============================================================================
// SAMPLES Management (Add Sample, Replace Sample, Delete Sample)
// ==============================================================================
export const STORAGE_CUSTOM_SAMPLES_KEY = 'x4_custom_samples';
export const STORAGE_DELETED_SAMPLES_KEY = 'x4_deleted_samples';
export const STORAGE_SAMPLES_ORDER_KEY = 'x4_samples_order';
export const STORAGE_CURRENT_SAMPLE_KEY = 'x4_current_sample';
const STORAGE_CHECKBOX_STATES_KEY = 'x4_checkbox_states';
const STORAGE_EXCLUDED_MACROS_KEY = 'x4_excluded_macros';

export function saveCheckboxState(id, isChecked) {
  try {
    const states = JSON.parse(localStorage.getItem(STORAGE_CHECKBOX_STATES_KEY) || '{}');
    states[id] = isChecked;
    localStorage.setItem(STORAGE_CHECKBOX_STATES_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn('Could not save checkbox state:', e);
  }
}

export function getSavedCheckboxState(id, defaultVal) {
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

export function saveExcludedMacros() {
  try {
    localStorage.setItem(STORAGE_EXCLUDED_MACROS_KEY, JSON.stringify(Array.from(excludedMacros)));
  } catch (e) {
    console.warn('Could not save excluded macros:', e);
  }
}

export function loadSavedExcludedMacros() {
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
