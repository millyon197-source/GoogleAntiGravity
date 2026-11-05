import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

console.log('[*] Testing Production FX Assets & Support Code Pipeline...');

// Read viewer.js
const viewerSrc = fs.readFileSync('src/viewer.js', 'utf8');

// 1. Verify DAE fast-path includes fx*
console.log('  [1] Verifying ColladaLoader fast-path includes fx*...');
assert(viewerSrc.includes("partBase.startsWith('fx')"), 'partBase.startsWith("fx") must be present in Collada fast-path');
assert(viewerSrc.includes("uLower.includes('/fx_')"), "uLower.includes('/fx_') must be present in Collada fast-path");
console.log('  ✓ [PASS] fx* components bypass binary loader directly to ColladaLoader');

// 2. Extract resolveTextureForModel
console.log('  [2] Verifying material resolution for production FX...');
const lines = viewerSrc.split('\n');
const startIdx = lines.findIndex(l => l.includes('resolveTextureForModel(modelUrl, materialName'));
let depth = 0;
let endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('{')) depth += (l.match(/\{/g) || []).length;
  if (l.includes('}')) depth -= (l.match(/\}/g) || []).length;
  if (depth === 0 && i > startIdx) {
    endIdx = i;
    break;
  }
}
const fnBody = lines.slice(startIdx + 1, endIdx).join('\n');
const resolveTex = new Function('modelUrl', 'materialName = ""', fnBody);

// Test smoke resolution
const crystalSmoke = resolveTex('/assets1/structures/production/prod_gen_cutcrystals_data/fx_anim_crystal_smoke01-lod0.dae', 'effectsXcrystal_smoke');
assert(crystalSmoke.diffuse && crystalSmoke.diffuse.includes('smoke_01.dds'), 'Crystal smoke must resolve to smoke texture');

const missileGas = resolveTex('/assets1/structures/production/prod_gen_missilecomponents_data/fx_anim_textureanim_smoke-lod0.dae', 'p1effectsXp1_fx_gas');
assert(missileGas.diffuse && missileGas.diffuse.includes('smoke_01.dds'), 'Missile gas smoke must resolve to smoke texture');

const spaceweedFume = resolveTex('/assets1/structures/production/prod_tel_spaceweed_data/fx_anim_smoke-lod0.dae', 'effectsXfume');
assert(spaceweedFume.diffuse && spaceweedFume.diffuse.includes('smoke_01.dds'), 'Spaceweed fumes must resolve to smoke texture');

// Test decal priority resolution
const scrapGenDecal = resolveTex('/assets1/structures/production/prod_gen_scrap_recycler_data/fx_decals-lod0.dae', 'p2generic.gen_p2_decal_01');
assert(scrapGenDecal.diffuse && scrapGenDecal.diffuse.includes('gen_p2_decal_01_diff.dds'), 'P2 Generic decal must resolve to gen_p2_decal_01_diff.dds');

const scrapArgDecal = resolveTex('/assets1/structures/production/prod_gen_scrap_recycler_data/fx_decals-lod0.dae', 'p2argon.arg_p2_decal_01');
assert(scrapArgDecal.diffuse && scrapArgDecal.diffuse.includes('arg_p2_decal_01_diff.dds'), 'P2 Argon decal must resolve to arg_p2_decal_01_diff.dds');

// Test decoflares resolution
const nostropFlare = resolveTex('/assets1/structures/production/prod_tel_nostropoil_data/fx_decoflares-lod0.dae', 'effectsXdecoflares');
assert(nostropFlare.diffuse && nostropFlare.diffuse.includes('lightcones_soft.dds'), 'Decoflares must resolve to lightcones_soft.dds');
console.log('  ✓ [PASS] Smoke, gas, fumes, decals, and flares resolve to authored textures');

// 3. Verify animated smoke UV scrolling in applyTexturesToMeshGroup
console.log('  [3] Verifying animated UV scrolling for smoke in applyTexturesToMeshGroup...');
assert(viewerSrc.includes('isSmoke && (diffuseTex || emissiveTex)'), 'applyTexturesToMeshGroup must support isSmoke animated textures');
console.log('  ✓ [PASS] Smoke UV animation registered in viewer pipeline');

// 4. Verify shadow exclusion and depthWrite settings
console.log('  [4] Verifying shadow exclusion for smoke & transparent FX...');
assert(viewerSrc.includes('isForcefield || isHaze || isLightCone || isBubbles || isPoslight || isSmoke'), 'Smoke meshes excluded from shadow casting and receiving');
console.log('  ✓ [PASS] Smoke and transparent FX shadow exclusions verified');

console.log('\n[SUCCESS] All Production FX Support Code Tests Passed Cleanly!');
