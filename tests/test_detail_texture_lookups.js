/**
 * Textures for module detail meshes (detail_m, detail_xs, detail_s) when the rule-based resolver
 * leaves them untextured:
 * - binary models (no material names) use the material their DAE names (src/texture-lookups.json);
 * - materials no rule covers use texture files named after them;
 * - the dev server looks for texture files in assets1/ and then in the assets/ extraction.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTextureForModel } from '../packages/adapter-three/src/textures/texture-resolver.js';
import {
  materialBaseName, resolveTexturesWithLookups, resolveBinaryModelTextures, choosePrimaryMaterial, binaryModelKey
} from '../packages/adapter-three/src/textures/binary-model-materials.js';
import { textureCandidatePaths, textureRelativePath } from '../texture-sources.js';
import { buildTextureIndex, texturesByMaterialName } from '../scripts/generate_texture_lookups.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOKUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'texture-lookups.json'), 'utf8'));

console.log('[*] Testing texture lookups for detail meshes...');

// 1. Material names
assert.strictEqual(materialBaseName('genericXgeneric_p1_hulltexture'), 'generic_p1_hulltexture');
assert.strictEqual(materialBaseName('generic.generic_p1_radiator_01'), 'generic_p1_radiator_01');
assert.strictEqual(materialBaseName('p2boron.bor_p2_hulltexture_01'), 'bor_p2_hulltexture_01');
assert.strictEqual(materialBaseName('effectsXlaser'), 'laser');
assert.strictEqual(materialBaseName('DefaultMaterial'), 'defaultmaterial');
console.log('  ✓ material base names');

// 2. Primary material of a merged binary mesh: the hull material, not alpha / lightcone / fx
const url = '/assets1/structures/production/prod_gen_antimattercells_data/detail_m_pipes-lod0.bin';
assert.strictEqual(choosePrimaryMaterial(url, ['genericXgeneric_p1_alphatexture', 'p1effectsXp1_lightcone_soft', 'genericXgeneric_p1_hulltexture']),
  'genericXgeneric_p1_hulltexture');
assert.strictEqual(choosePrimaryMaterial(url, ['nothing_known']), null);
assert.strictEqual(binaryModelKey('/Assets1/X/Detail-lod0.json?v=2'), '/assets1/x/detail-lod0.bin');
console.log('  ✓ primary material choice');

// 3. A binary detail part the rules leave grey gets its DAE material's textures
assert.strictEqual(resolveTextureForModel(url).diffuse, null, 'detail_m_pipes: no texture from the file name');
const pipes = resolveBinaryModelTextures(url, LOOKUPS);
assert.strictEqual(pipes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds', 'detail_m_pipes: hull texture from its DAE material');
// Models the rules already texture are unchanged
const energy = '/assets1/structures/production/prod_gen_energycells_data/part_main-lod0.bin';
assert.deepStrictEqual(resolveBinaryModelTextures(energy, LOOKUPS), resolveTextureForModel(energy), 'rule-textured models unchanged');
assert.deepStrictEqual(resolveBinaryModelTextures(url, null), resolveTextureForModel(url), 'no lookups: as before');
console.log('  ✓ binary models use their DAE material when their file name resolves nothing');

// 4. Materials no rule covers, by texture file name
const radiatorModel = '/assets1/structures/production/prod_gen_x_data/detail_s_radiator-lod0.dae';
const radiator = resolveTexturesWithLookups(radiatorModel, 'generic.generic_p1_radiator_01', LOOKUPS);
assert.strictEqual(radiator.diffuse, '/assets1/textures/generic/generic_p1_radiator_01_diff.dds');
const hull = resolveTexturesWithLookups(url, 'genericXgeneric_p1_hulltexture', LOOKUPS);
assert.deepStrictEqual(hull, resolveTextureForModel(url, 'genericXgeneric_p1_hulltexture'), 'rule results win');
console.log('  ✓ materials without a rule use textures named after them');

// 5. Texture file lookup order: assets1, then assets/textures, then assets/assets/textures; .dds then .gz
{
  assert.strictEqual(textureRelativePath('/assets1/textures/generic/a_diff.dds?x=1'), 'generic/a_diff.dds');
  assert.strictEqual(textureRelativePath('/assets/textures/generic/a_diff.dds'), 'generic/a_diff.dds');
  assert.strictEqual(textureRelativePath('/assets/assets/textures/generic/a_diff.dds'), 'generic/a_diff.dds');
  const c = textureCandidatePaths('/assets1/textures/generic/a_diff.dds', '/root', { includeSteam: false });
  const rel = (p) => path.relative(path.resolve('/root'), p).split(path.sep).join('/');
  assert.deepStrictEqual(c.map(x => [x.source, rel(x.path), x.gzip]), [
    ['assets1', 'assets1/textures/generic/a_diff.dds', false],
    ['assets1', 'assets1/textures/generic/a_diff.gz', true],
    ['assets', 'assets/textures/generic/a_diff.dds', false],
    ['assets', 'assets/textures/generic/a_diff.gz', true],
    ['assets', 'assets/assets/textures/generic/a_diff.dds', false],
    ['assets', 'assets/assets/textures/generic/a_diff.gz', true]
  ]);
  assert.deepStrictEqual(textureCandidatePaths('/assets1/textures/../secret.dds', '/root'), [], 'no escaping the texture folders');

  // A texture only in the assets/ extraction is indexed, and assets1 wins when both have it
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4tex-'));
  const a1 = path.join(tmp, 'assets1', 'textures', 'generic');
  const a0 = path.join(tmp, 'assets', 'assets', 'textures', 'generic');
  fs.mkdirSync(a1, { recursive: true });
  fs.mkdirSync(a0, { recursive: true });
  fs.writeFileSync(path.join(a0, 'generic_p1_only_in_assets_diff.gz'), '');
  fs.writeFileSync(path.join(a0, 'generic_p1_only_in_assets_normal.gz'), '');
  fs.writeFileSync(path.join(a1, 'generic_p1_both_diff.dds'), '');
  fs.writeFileSync(path.join(a0, 'generic_p1_both_diff.gz'), '');
  const index = buildTextureIndex([path.join(tmp, 'assets1', 'textures'), path.join(tmp, 'assets', 'textures'), path.join(tmp, 'assets', 'assets', 'textures')]);
  const only = texturesByMaterialName('genericXgeneric_p1_only_in_assets', index);
  assert.strictEqual(only.diffuse, '/assets1/textures/generic/generic_p1_only_in_assets_diff.dds', 'found under assets/, served through the same URL');
  assert.strictEqual(only.normal, '/assets1/textures/generic/generic_p1_only_in_assets_normal.dds');
  assert.ok(texturesByMaterialName('generic.generic_p1_both', index).diffuse);
  assert.strictEqual(texturesByMaterialName('generic.nothing_here', index), null);
  // The candidate list finds the assets/-only file
  const found = textureCandidatePaths(only.diffuse, tmp, { includeSteam: false }).find(x => fs.existsSync(x.path));
  assert.strictEqual(found.source, 'assets');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('  ✓ texture files looked up in assets1/, then assets/');
}

// 6. Against the extracted assets: every binary detail_m/xs/s part whose DAE has a texturable
// material resolves to a diffuse texture, and every resolved file exists
if (fs.existsSync(path.join(ROOT, 'assets1', 'structures'))) {
  const exists = (texUrl) => textureCandidatePaths(texUrl, ROOT, { includeSteam: false }).some(c => fs.existsSync(c.path));
  let checked = 0;
  const grey = [];
  const missingFiles = new Set();
  const walk = function* (dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) yield* walk(full);
      else if (/^detail_(m|xs|s)(_|-).*-lod0\.bin$/i.test(e.name)) yield full;
    }
  };
  for (const bin of walk(path.join(ROOT, 'assets1', 'structures'))) {
    const binUrl = '/' + path.relative(ROOT, bin).split(path.sep).join('/');
    const dae = bin.replace(/\.bin$/i, '.dae');
    if (!fs.existsSync(dae)) continue;
    const mats = [...fs.readFileSync(dae, 'utf8').matchAll(/<material\s[^>]*?name="([^"]+)"/g)].map(m => m[1]);
    const texturable = mats.some(m => resolveTexturesWithLookups(binUrl, m, LOOKUPS).diffuse);
    const urls = resolveBinaryModelTextures(binUrl, LOOKUPS);
    checked++;
    if (texturable && !urls.diffuse) grey.push(binUrl);
    for (const ch of ['diffuse', 'normal', 'roughness', 'metalness', 'emissive']) if (urls[ch] && !exists(urls[ch])) missingFiles.add(urls[ch]);
  }
  assert.ok(checked > 100, `checked ${checked} binary detail parts`);
  assert.deepStrictEqual(grey, [], 'no texturable binary detail part left untextured');
  assert.deepStrictEqual([...missingFiles], [], 'every resolved texture file exists');
  console.log(`  ✓ ${checked} binary detail parts: all texturable ones textured, every texture file present`);
} else {
  console.log('  - game assets not extracted: asset check skipped');
}

console.log('\n[SUCCESS] Detail mesh texture lookups work');
