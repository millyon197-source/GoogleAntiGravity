/**
 * Every SNAP_POINTS_DB module must match its game component file (found through the module's
 * macro file, as X4 does): the same snap names, positions equal to the game values rounded to
 * 2 decimals. Needs the extracted game files in assets1/.
 */
import assert from 'node:assert';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../src/snap-points-db.js';
import { compareSnapTableWithGame } from '../tools/snap-game-data.js';

console.log('[*] Testing that the snap table matches the game component files...');

const macros = Object.keys(SNAP_POINTS_DB);
const report = compareSnapTableWithGame(macros, getModuleSnapPoints);

assert.deepStrictEqual(report.noFile, [], `modules without a game component file: ${report.noFile.join(', ')}`);
assert.strictEqual(report.own + report.referenced, macros.length, 'every module was compared');
assert.deepStrictEqual(report.mismatches, [],
  'modules differing from the game:\n' + report.mismatches.map(m => `  ${m.module}: ${m.problems.join('; ')}`).join('\n'));
console.log(`  ✓ all ${macros.length} modules match (${report.own} own component, ${report.referenced} built on another module's)`);

// The comparison must notice a wrong position, a missing snap and an extra snap
const tampered = (macro) => {
  const snaps = getModuleSnapPoints(macro).map(s => ({ ...s, pos: [...s.pos] }));
  if (macro === 'struct_arg_cross_01_macro') snaps[0].pos[0] += 0.5;
  if (macro === 'prod_gen_refinedmetals_macro') snaps.pop();
  if (macro === 'storage_arg_m_solid_01_macro') snaps.push({ name: 'ConnectionSnap999', pos: [0, 0, 0] });
  return snaps;
};
const bad = compareSnapTableWithGame(['struct_arg_cross_01_macro', 'prod_gen_refinedmetals_macro', 'storage_arg_m_solid_01_macro'], tampered);
assert.deepStrictEqual(bad.mismatches.map(m => m.module), ['struct_arg_cross_01', 'prod_gen_refinedmetals', 'storage_arg_m_solid_01']);
assert.match(bad.mismatches[0].problems[0], /ConnectionSnap001 table/);
assert.match(bad.mismatches[1].problems[0], /missing from table/);
assert.match(bad.mismatches[2].problems[0], /ConnectionSnap999 not in game file/);
console.log('  ✓ detects a moved snap, a missing snap and an extra snap');

console.log('\n[PASS] test_snap_table_matches_game');
