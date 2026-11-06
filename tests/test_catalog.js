/**
 * Verifies the @x4/catalog workspace package public API, the modules moved
 * into @x4/adapter-three, and that legacy src/ shim paths re-export the
 * same bindings.
 */
import assert from 'assert';
import fs from 'fs';
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

// Custom snap-point overrides (custom-snap-points.json) were removed; snaps come only from SNAP_POINTS_DB
for (const name of ['CUSTOM_SNAP_POINTS_TABLE', 'getCustomSnapPointsTable', 'setCustomSnapPointEntry',
  'removeCustomSnapPointEntry', 'hasCustomSnapPointsForMacro', 'syncCustomSnapPoints']) {
  assert.ok(!(name in catalog), `@x4/catalog should no longer export ${name}`);
}
console.log('  ✓ custom snap-point override API is gone');

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

// DAE asset index: injected table, murmur3 bucketing, faction -> gen/arg fallback
{
  const BUCKETS = 7;
  const table = {};
  const put = (key, folder, files) => {
    const b = catalog.murmur3_32(key) % BUCKETS;
    (table[b] ||= []).push({ key, folder_path: folder, files });
  };
  put('prod_gen_widgets', '/a/prod_gen_widgets_data', ['part_main-lod0.dae', 'fx_glow-lod0.dae']);
  put('buildmodule_arg_equip_l', '/a/bm_arg_equip_l_data', ['part_main-lod0.dae']);
  const idx = catalog.createDaeAssetIndex(table, { bucketCount: BUCKETS });

  assert.deepStrictEqual(idx.lookupDaeUrls('prod_gen_widgets'),
    ['/a/prod_gen_widgets_data/part_main-lod0.dae', '/a/prod_gen_widgets_data/fx_glow-lod0.dae']);
  assert.deepStrictEqual(idx.lookupDaeUrls('missing'), []);
  assert.deepStrictEqual(idx.resolveModuleAssetEntry('prod_gen_widgets_macro'),
    { baseName: 'prod_gen_widgets', folderPath: '/a/prod_gen_widgets_data', defaultFiles: ['part_main-lod0.dae', 'fx_glow-lod0.dae'] });
  assert.strictEqual(idx.resolveModuleAssetEntry('prod_tel_widgets_macro').baseName, 'prod_gen_widgets', 'faction falls back to gen');
  assert.strictEqual(idx.resolveModuleAssetEntry('buildmodule_gen_equip_l_macro').baseName, 'buildmodule_arg_equip_l', 'gen equip maps to arg');
  assert.deepStrictEqual(idx.resolveModuleAssetEntry('nothing_macro'), { baseName: 'nothing', folderPath: null, defaultFiles: [] });

  const real = catalog.createDaeAssetIndex(JSON.parse(fs.readFileSync('dae_hash_table.json', 'utf8')));
  assert.ok(real.resolveModuleAssetEntry('struct_arg_cross_01_macro').defaultFiles.length > 0, 'real table resolves a known module');
  console.log('  ✓ createDaeAssetIndex: lookup, gen/arg fallbacks, real dae_hash_table');
}

console.log('\n[PASS] test_catalog');
