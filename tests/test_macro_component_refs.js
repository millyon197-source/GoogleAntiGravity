/**
 * macro-component-refs.json (generated from the game's macro files) lets the asset index find the
 * models of modules built on a differently named component.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDaeAssetIndex, MODULES_COST_DB, MACRO_TO_NAME_DB, SNAP_POINTS_DB } from '../packages/catalog/src/index.js';
import { collectMacroComponentRefs } from '../tools/generate-macro-component-refs.js';
import DAE_HASH_TABLE from '../dae_hash_table.json' with { type: 'json' };

console.log('[*] Testing macro -> component refs in the asset index...');

const committed = JSON.parse(fs.readFileSync('packages/catalog/src/macro-component-refs.json', 'utf8'));

// 1. The committed map matches the game files (skipped without extracted assets)
if (fs.existsSync('assets1/structures')) {
  const { refs } = collectMacroComponentRefs('assets1');
  assert.deepStrictEqual(committed, refs, 'macro-component-refs.json is out of date: run npm run generate:macro-refs');
  console.log(`  ✓ committed map matches the game macro files (${Object.keys(refs).length} entries)`);
}

// 2. The map only adds resolutions; it never changes a module the heuristics already resolve
const withRefs = createDaeAssetIndex(DAE_HASH_TABLE);
const heuristicsOnly = createDaeAssetIndex(DAE_HASH_TABLE, { componentRefs: {} });
const macros = new Set([...Object.keys(MODULES_COST_DB), ...Object.keys(MACRO_TO_NAME_DB), ...Object.keys(SNAP_POINTS_DB),
  ...Object.keys(committed).map(k => k + '_macro')]);
let added = 0;
for (const m of macros) {
  const a = withRefs.resolveModuleAssetEntry(m);
  const b = heuristicsOnly.resolveModuleAssetEntry(m);
  if (b.folderPath) assert.deepStrictEqual(a, b, `${m} resolved differently with the map`);
  else if (a.folderPath) added++;
}
assert.ok(added > 0, 'the map resolves modules the heuristics cannot');
console.log(`  ✓ ${macros.size} macros: no existing resolution changed, ${added} newly resolved`);

// 3. Known modules built on another component now find that component's model
for (const [macro, component] of [
  ['dockarea_tel_m_station_01_macro', 'dockarea_arg_m_station_01'],
  ['prod_tel_swampplant_macro', 'prod_tel_swampplants'],
  ['defence_par_claim_story_01_macro', 'defence_par_claim_01']
]) {
  const r = withRefs.resolveModuleAssetEntry(macro);
  assert.strictEqual(r.baseName, component, `${macro} uses ${component}`);
  assert.ok(r.folderPath && r.defaultFiles.length > 0, `${macro} has model files`);
}
console.log('  ✓ dockarea_tel_m_station_01, prod_tel_swampplant, defence_par_claim_story_01 load their components\' models');

// 4. The generator on a temporary tree
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-macro-refs-'));
try {
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
  write('structures/dock/macros/dockarea_x_m_01_macro.xml', '<macros><macro><component ref="dockarea_y_m_01"/></macro></macros>');
  write('structures/dock/macros/dockarea_y_m_01_macro.xml', '<macros><macro><component ref="dockarea_y_m_01"/></macro></macros>');
  write('structures/prod/macros/Prod_A_Macro.xml', '<macros><macro><component ref="PROD_B"/></macro></macros>');
  write('structures/prod/prod_b_data/ignored_macro.xml', '<macros><macro><component ref="nope"/></macro></macros>');
  const { refs, macroFiles } = collectMacroComponentRefs(tmp);
  assert.strictEqual(macroFiles, 3, '_data folders are not scanned');
  assert.deepStrictEqual(refs, { dockarea_x_m_01: 'dockarea_y_m_01', prod_a: 'prod_b' }, 'only differing refs, lower case, sorted');
  console.log('  ✓ generator records only differently named components');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n[PASS] test_macro_component_refs');
