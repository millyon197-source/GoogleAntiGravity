/**
 * Verifies resolveTextureForModel as a standalone pure function in
 * @x4/adapter-three, and that StationViewer delegates to it unchanged.
 */
import assert from 'assert';
import fs from 'fs';
import { resolveTextureForModel } from '@x4/adapter-three';
import { StationViewer } from '../src/viewer.js';

const CHANNELS = ['diffuse', 'normal', 'roughness', 'metalness', 'emissive'];

// 1. Shape: always returns all five channels, string or null
const empty = resolveTextureForModel('', '');
assert.deepStrictEqual(empty, { diffuse: null, normal: null, roughness: null, metalness: null, emissive: null });
assert.deepStrictEqual(resolveTextureForModel(), empty, 'no-arg call returns empty channels');
console.log('  ✓ empty input yields all-null channels');

// 2. Every known model path resolves to a well-formed result, deterministically
const table = JSON.parse(fs.readFileSync('dae_hash_table.json', 'utf8'));
const urls = new Set();
JSON.stringify(table, (k, v) => { if (typeof v === 'string' && /\.(dae|bin)$/i.test(v)) urls.add(v); return v; });
assert.ok(urls.size > 100, `expected many model urls in dae_hash_table.json, got ${urls.size}`);
let resolvedDiffuse = 0;
for (const url of urls) {
  const r = resolveTextureForModel(url);
  assert.deepStrictEqual(Object.keys(r).sort(), [...CHANNELS].sort(), `channel keys for ${url}`);
  for (const ch of CHANNELS) assert.ok(r[ch] === null || typeof r[ch] === 'string', `${ch} type for ${url}`);
  assert.deepStrictEqual(resolveTextureForModel(url), r, `deterministic for ${url}`);
  if (r.diffuse) resolvedDiffuse++;
}
assert.ok(resolvedDiffuse > 0, 'at least some models resolve a diffuse texture');
console.log(`  ✓ ${urls.size} model urls resolve to well-formed, deterministic results (${resolvedDiffuse} with diffuse)`);

// 3. Path normalisation: backslashes and case do not change the result
const sample = '/assets1/structures/production/prod_gen_refinedmetals_data/anim_lavariver-lod0.dae';
assert.ok(resolveTextureForModel(sample, 'p1effectsXp1_gradient_lava_01').diffuse, 'sample resolves a diffuse texture');
const BACKSLASH = String.fromCharCode(92);
assert.deepStrictEqual(resolveTextureForModel(sample.split('/').join(BACKSLASH)), resolveTextureForModel(sample), 'backslash paths normalised');
assert.deepStrictEqual(resolveTextureForModel(sample.toUpperCase()), resolveTextureForModel(sample), 'case-insensitive');
console.log('  ✓ backslash and case variations normalise to the same result');

// 4. StationViewer.resolveTextureForModel is a thin delegate
const viewerLike = Object.create(StationViewer.prototype);
const probe = ['structures/dock/fx_glow-lod0.dae', 'structures/buildmodule_bor/fx_lightcones-lod0.dae'];
for (const url of probe) {
  for (const mat of ['', 'p2fx.fx_p2_lightcones_01']) {
    assert.deepStrictEqual(viewerLike.resolveTextureForModel(url, mat), resolveTextureForModel(url, mat), `delegate parity ${url} ${mat}`);
  }
}
console.log('  ✓ StationViewer.resolveTextureForModel delegates to the package function');

console.log('\n[PASS] test_texture_resolver');
