/**
 * src/part-main-offsets.json must match the game: each entry equals the offset of the connection that
 * holds part_main in the module's component file, and every non-zero game offset has an entry.
 * (A hand-merged entry once moved buildmodule_ter_equip_xl's hull 760 m away from its snap point.)
 * Needs the extracted game files in assets1/.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { indexGameFiles, readPartMainOffset } from '../tools/snap-game-data.js';

console.log('[*] Testing part_main offsets against the game component files...');

// Not a station module: a piece of the pirate-station landmark, which positions it through its own
// connection; the stored value is that placement, not the component's part_main offset.
const KNOWN_EXCEPTIONS = new Set(['landmarks_gen_piratestation_01_asteorid_01']);

const offsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
const files = indexGameFiles();
const mismatches = [];
let checked = 0;
for (const [name, stored] of Object.entries(offsets)) {
  if (KNOWN_EXCEPTIONS.has(name)) continue;
  const file = files.components.get(name);
  if (!file) continue;
  const game = readPartMainOffset(file);
  checked++;
  if (!game || game.some((c, i) => Math.abs(c - stored[i]) > 0.01)) mismatches.push(`${name}: stored ${JSON.stringify(stored)}, game ${JSON.stringify(game)}`);
}
assert.deepStrictEqual(mismatches, [], `part_main offsets that differ from the game:\n  ${mismatches.join('\n  ')}`);
assert.ok(checked > 100, 'enough offsets were checked');
console.log(`  ✓ ${checked} stored offsets match their component files`);

const missing = [];
for (const [name, file] of files.components) {
  if (name in offsets || !file.includes('/structures/')) continue;
  const game = readPartMainOffset(file);
  if (game && game.some(c => Math.abs(c) > 0.01)) missing.push(name);
}
assert.deepStrictEqual(missing, [], `non-zero part_main offsets missing from part-main-offsets.json: ${missing.join(', ')}`);
console.log('  ✓ every non-zero part_main offset in the game files has an entry');

console.log('\n[PASS] test_part_main_offsets');
