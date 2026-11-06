import * as THREE from 'three';

/**
 * Faction-specific accent colours inferred from a model URL / material context string.
 * Pure functions: no viewer state.
 */

/**
 * Emissive glow colour for lights, FX and trims.
 * @param {string} [contextStr=''] Model URL and/or material name.
 * @returns {THREE.Color}
 */
export function getRaceGlowColor(contextStr = '') {
  const s = (contextStr || '').toLowerCase();
  if (s.includes('_bor_') || s.includes('/boron/') || s.includes('boron')) {
    return new THREE.Color(0x00FFCC); // Bioluminescent teal/cyan
  }
  if (s.includes('_par_') || s.includes('/paranid/') || s.includes('paranid')) {
    return new THREE.Color(0xCC66FF); // Holy imperial magenta/purple
  }
  if (s.includes('_spl_') || s.includes('/split/') || s.includes('split')) {
    return new THREE.Color(0xFF5522); // Aggressive split red/orange
  }
  if (s.includes('_tel_') || s.includes('/teladi/') || s.includes('teladi')) {
    return new THREE.Color(0x88FF44); // Teladi profit lime green
  }
  if (s.includes('_ter_') || s.includes('/terran/') || s.includes('terran')) {
    return new THREE.Color(0x66DDFF); // Terran arctic blue
  }
  if (s.includes('_arg_') || s.includes('/argon/') || s.includes('argon') || s.includes('_gen_') || s.includes('/generic/')) {
    return new THREE.Color(0x33CCFF); // Argon federation cyan
  }
  if (s.includes('shield')) {
    return new THREE.Color(0x00A6FF); // Electric cyan shield
  }
  return new THREE.Color(0x00A6FF); // Universal sci-fi electric cyan
}

/**
 * Base hull tint applied to textured hull materials.
 * @param {string} [contextStr=''] Model URL and/or material name.
 * @returns {THREE.Color}
 */
export function getRaceHullColor(contextStr = '') {
  const s = (contextStr || '').toLowerCase();
  if (s.includes('_ter_') || s.includes('/terran/') || s.includes('terran')) {
    return new THREE.Color(0xD8E2EC); // Clean Terran high-tech alloy
  }
  if (s.includes('_par_') || s.includes('/paranid/') || s.includes('paranid')) {
    return new THREE.Color(0x8D7B96); // Paranid bronze/purple hull
  }
  if (s.includes('_spl_') || s.includes('/split/') || s.includes('split')) {
    return new THREE.Color(0x736158); // Split rugged dark alloy
  }
  if (s.includes('_tel_') || s.includes('/teladi/') || s.includes('teladi')) {
    return new THREE.Color(0x7A8872); // Teladi industrial greenish alloy
  }
  if (s.includes('_bor_') || s.includes('/boron/') || s.includes('boron')) {
    return new THREE.Color(0x4A7B8E); // Boron oceanic deep blue
  }
  // Argon & Generic Stations: Argon navy steel / industrial slate alloy
  return new THREE.Color(0x7B8B9E);
}
