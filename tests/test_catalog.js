/**
 * Verifies the @x4/catalog workspace package public API, the modules moved
 * into @x4/adapter-three, and that legacy src/ shim paths re-export the
 * same bindings.
 */
import assert from 'assert';
import * as catalog from '@x4/catalog';
import * as adapterThree from '@x4/adapter-three';
import * as legacyModules from '../src/modules.js';
import * as legacyCostDb from '../src/modules-cost-db.js';
import * as legacyBounds from '../src/module-bounds-hashtable.js';
import * as legacySnap from '../src/snap-points-db.js';
import * as legacyRotation from '../src/rotation-math.js';

const expected = [
  'MODULES_COST_DB', 'NAME_TO_MACRO_DB', 'MACRO_TO_NAME_DB',
  'CATEGORY_COLORS', 'CATEGORY_NAMES', 'getModuleCategory', 'isPierHarbor',
  'getPierDockDirection', 'getFriendlyName', 'estimateModuleCosts',
  'createProceduralModule', 'translateNameToMacro',
  'HASH_TABLE_SIZE', 'murmur3_32', 'MODULE_BOUNDS_TABLE', 'lookupModuleBounds',
  'getInitialModuleSize', 'getInitialModuleDimensions', 'getInitialModuleBounds',
  'MODULE_BOUNDS_REGISTRY',
  'CUSTOM_SNAP_POINTS_TABLE', 'getCustomSnapPointsTable', 'setCustomSnapPointEntry',
  'removeCustomSnapPointEntry', 'hasCustomSnapPointsForMacro', 'syncCustomSnapPoints',
  'SNAP_POINTS_DB', 'getModuleSnapPoints'
];
for (const name of expected) {
  assert.ok(name in catalog, `@x4/catalog missing export ${name}`);
}
console.log(`  ✓ @x4/catalog exposes ${expected.length} expected bindings`);

for (const shim of [legacyModules, legacyCostDb, legacyBounds, legacySnap]) {
  for (const name of expected) assert.strictEqual(shim[name], catalog[name], `shim binding ${name} differs`);
}
console.log('  ✓ legacy src/ catalog shims re-export identical bindings');

const someMacro = Object.keys(catalog.MODULES_COST_DB)[0];
assert.strictEqual(typeof catalog.getModuleCategory(someMacro), 'string');
assert.strictEqual(typeof catalog.getFriendlyName(someMacro), 'string');
assert.strictEqual(catalog.getInitialModuleSize('__no_such_macro__', [1, 2, 3]).length, 3);
console.log('  ✓ catalog lookups work through package entry point');

// custom-snap-points.json now lives inside the package; Node fallback must find it
const table = await catalog.syncCustomSnapPoints();
assert.ok(table && typeof table === 'object', 'syncCustomSnapPoints returns a table');
assert.ok(Object.keys(table).length > 0, 'custom-snap-points.json loaded from package directory');
console.log(`  ✓ syncCustomSnapPoints loads ${Object.keys(table).length} custom entries from package`);

// Rotation math + mesh loading moved to @x4/adapter-three
for (const name of ['computeModuleGroupRotation', 'computeX4RotationFromModuleGroup']) {
  assert.strictEqual(typeof adapterThree[name], 'function', `adapter-three missing ${name}`);
  assert.strictEqual(legacyRotation[name], adapterThree[name], `rotation shim differs for ${name}`);
}
assert.strictEqual(typeof adapterThree.MeshLoader, 'function');
assert.strictEqual(typeof adapterThree.ThreeCoordinator, 'function');

const seen = [];
globalThis.Worker = class { constructor(u) { seen.push(u); } postMessage() {} terminate() {} };
new adapterThree.MeshLoader();
assert.ok(seen[0] instanceof URL, 'default worker path is a module-relative URL');
assert.ok(seen[0].href.endsWith('/packages/adapter-three/src/mesh/mesh-worker.js'), `unexpected worker URL ${seen[0]}`);
new adapterThree.MeshLoader('./custom-worker.js');
assert.strictEqual(seen[1], './custom-worker.js', 'explicit worker path override is honoured');
console.log('  ✓ adapter-three exposes rotation math, MeshLoader (co-located worker), ThreeCoordinator');

console.log('\n[PASS] test_catalog');
