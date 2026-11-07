/**
 * tools/sync-dlc-components.js: copies missing component XMLs for assets1 _data folders from
 * unpacked DLCs, never overwriting, skipping files whose DLC versions disagree.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { syncComponents, findDataFolders, defaultExtensionsDirs } from '../tools/sync-dlc-components.js';

console.log('[*] Testing DLC component file sync...');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-dlc-sync-'));
const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
const mkdir = (rel) => fs.mkdirSync(path.join(tmp, rel), { recursive: true });
const read = (rel) => fs.readFileSync(path.join(tmp, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(tmp, rel));

try {
  // Extracted assets: four modules lack their component file, one already has it
  mkdir('assets1/structures/production/prod_ter_a_data');            // in DLC terran
  mkdir('assets1/structures/dock/pier_spl_b_data');                  // in DLC split
  mkdir('assets1/structures/habitat/hab_x_c_data');                  // in no DLC
  mkdir('assets1/structures/storage/storage_d_data');                // DLCs disagree
  mkdir('assets1/structures/struct_e_data');                         // present already
  write('assets1/structures/struct_e.xml', 'LOCAL E');
  mkdir('assets1/structures/production/prod_ter_a_data/nested_data'); // nested _data is not descended into

  const ext = path.join(tmp, 'profile/extensions');
  write('profile/extensions/ego_dlc_terran/assets/structures/production/prod_ter_a.xml', 'TER A');
  write('profile/extensions/ego_dlc_split/assets/structures/dock/pier_spl_b.xml', 'SPL B');
  write('profile/extensions/ego_dlc_terran/assets/structures/storage/storage_d.xml', 'D v1');
  write('profile/extensions/ego_dlc_split/assets/structures/storage/storage_d.xml', 'D v2');
  write('profile/extensions/ego_dlc_terran/assets/structures/struct_e.xml', 'DLC E');
  mkdir('profile/extensions/no_assets_mod');

  const assetsRoot = path.join(tmp, 'assets1');
  assert.deepStrictEqual(findDataFolders(assetsRoot), [
    'structures/dock/pier_spl_b_data', 'structures/habitat/hab_x_c_data',
    'structures/production/prod_ter_a_data', 'structures/storage/storage_d_data', 'structures/struct_e_data'
  ]);

  // Dry run: reports, copies nothing
  const dry = syncComponents({ assetsRoot, extensionsDirs: [ext], dryRun: true });
  assert.deepStrictEqual(dry.copied.map(c => c.file), ['structures/dock/pier_spl_b.xml', 'structures/production/prod_ter_a.xml']);
  assert.ok(!exists('assets1/structures/production/prod_ter_a.xml'), 'dry run must not copy');
  console.log('  ✓ dry run reports two copies and writes nothing');

  // Real run
  const r = syncComponents({ assetsRoot, extensionsDirs: [ext], check: true });
  assert.deepStrictEqual(r.copied, [
    { file: 'structures/dock/pier_spl_b.xml', from: 'ego_dlc_split' },
    { file: 'structures/production/prod_ter_a.xml', from: 'ego_dlc_terran' }
  ]);
  assert.strictEqual(read('assets1/structures/production/prod_ter_a.xml'), 'TER A');
  assert.strictEqual(read('assets1/structures/dock/pier_spl_b.xml'), 'SPL B');
  assert.deepStrictEqual(r.notFound, ['structures/habitat/hab_x_c.xml']);
  assert.deepStrictEqual(r.conflicts, [{ file: 'structures/storage/storage_d.xml', sources: ['ego_dlc_split', 'ego_dlc_terran'] }]);
  assert.ok(!exists('assets1/structures/storage/storage_d.xml'), 'conflicting file must not be copied');
  assert.deepStrictEqual(r.present, ['structures/struct_e.xml']);
  assert.strictEqual(read('assets1/structures/struct_e.xml'), 'LOCAL E', 'existing file must not be overwritten');
  assert.deepStrictEqual(r.differs, [{ file: 'structures/struct_e.xml', from: 'ego_dlc_terran' }]);
  console.log('  ✓ copies missing files, skips conflicts, never overwrites, --check reports differences');

  // Second run is a no-op
  const again = syncComponents({ assetsRoot, extensionsDirs: [ext] });
  assert.strictEqual(again.copied.length, 0);
  assert.strictEqual(again.present.length, 3);
  console.log('  ✓ second run copies nothing');

  // Profile discovery: X4_EXTENSIONS_DIR wins; otherwise Documents and OneDrive/Documents profiles
  assert.deepStrictEqual(defaultExtensionsDirs({ X4_EXTENSIONS_DIR: ext }, '/nowhere'), [ext]);
  write('home/OneDrive/Documents/Egosoft/X4/123/extensions/.keep', '');
  write('home/Documents/Egosoft/X4/456/content.xml', ''); // profile without extensions
  assert.deepStrictEqual(defaultExtensionsDirs({}, path.join(tmp, 'home')),
    [path.join(tmp, 'home/OneDrive/Documents/Egosoft/X4/123/extensions')]);
  console.log('  ✓ finds extensions folders in Documents and OneDrive profiles');

  // CLI: dry run through the real entry point
  const cli = spawnSync(process.execPath, ['tools/sync-dlc-components.js', '--dry-run', '--assets', assetsRoot, '--extensions', ext], { encoding: 'utf8' });
  assert.strictEqual(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /Would copy 0, already present 3, not found 1, conflicts 1/);
  const bad = spawnSync(process.execPath, ['tools/sync-dlc-components.js', '--bogus'], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 1);
  console.log('  ✓ command line entry point works and rejects unknown arguments');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n[PASS] test_sync_dlc_components');
