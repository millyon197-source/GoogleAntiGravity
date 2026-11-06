/**
 * Display metadata (name, description, colour class) for station resource types.
 * Extracted from main.js.
 */
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

export function getResourceMetadata(key) {
  if (RESOURCE_METADATA[key]) return RESOURCE_METADATA[key];
  const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  return { name, desc: 'Station construction component', colorClass: 'text-cyan' };
}
