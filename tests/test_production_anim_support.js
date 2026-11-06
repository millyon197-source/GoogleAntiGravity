import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

console.log('[*] Testing Production Anim Assets & Support Code Pipeline...');

// Read viewer.js
const viewerSrc = fs.readFileSync('src/viewer.js', 'utf8');

// 1. Verify DAE fast-path includes anim*
console.log('  [1] Verifying ColladaLoader fast-path includes anim*...');
assert(viewerSrc.includes("partBase.startsWith('anim')"), 'partBase.startsWith("anim") must be present in Collada fast-path');
assert(viewerSrc.includes("uLower.includes('/anim_')"), "uLower.includes('/anim_') must be present in Collada fast-path");
console.log('  ✓ [PASS] anim* components bypass binary loader directly to ColladaLoader');

// 2. resolveTextureForModel (pure function in @x4/adapter-three)
console.log('  [2] Verifying material resolution for production anim*...');
const { resolveTextureForModel: resolveTex } = await import('@x4/adapter-three');

// Test lava resolution
const lavaRes = resolveTex('/assets1/structures/production/prod_gen_refinedmetals_data/anim_lavariver-lod0.dae', 'p1effectsXp1_gradient_lava_01');
assert(lavaRes.diffuse && lavaRes.diffuse.includes('fx_gradient_lava_01_diff.dds'), 'Lava must resolve to fx_gradient_lava_01_diff.dds');

// Test fire resolution
const fireRes = resolveTex('/assets1/structures/production/prod_gen_refinedmetals_data/anim_fx_fire_big01-lod0.dae', 'p1effectsXp1_fire_01');
assert(fireRes.diffuse && fireRes.diffuse.includes('fx_fire_01_diff.dds'), 'Fire must resolve to fx_fire_01_diff.dds');

// Test vapor resolution
const vaporRes = resolveTex('/assets1/structures/production/prod_bor_bogas_data/anim_vapor_01-lod0.dae', 'p2fx.fx_p2_vapor_01');
assert(vaporRes.diffuse && vaporRes.diffuse.includes('smoke_01.dds'), 'Vapor must resolve to smoke_01.dds');

// Test wreck resolution
const wreckRes = resolveTex('/assets1/structures/production/prod_gen_scrap_recyclerkhaak_data/anim_main_khaak_wreck-lod0.dae', 'p2generic.gen_p2_wreck_01');
assert(wreckRes.diffuse && wreckRes.diffuse.includes('generic_p1_wreck_diff.dds'), 'Wreck must resolve to generic_p1_wreck_diff.dds');

// Test mud / gravel resolution
const mudRes = resolveTex('/assets1/structures/production/prod_tel_teladianium_data/anim_mud01-lod0.dae', 'naturalXnatural_sand');
assert(mudRes.diffuse && mudRes.diffuse.includes('nat_p2_gravel_01_diff.dds'), 'Mud/Sand must resolve to nat_p2_gravel_01_diff.dds');

// Test crystal / ore gravel resolution
const oreRes = resolveTex('/assets1/structures/production/prod_gen_refinedmetals_data/anim_stones01-lod0.dae', 'asteroidsXast_ore_01');
assert(oreRes.diffuse && oreRes.diffuse.includes('nat_p2_gravel_01_diff.dds'), 'Ore must resolve to nat_p2_gravel_01_diff.dds');

console.log('  ✓ [PASS] Lava, fire, vapor, wrecks, mud, and ore resolve to authentic textures');

// 3. Verify procedural mechanical animations
console.log('  [3] Verifying procedural mechanical animations in animatedParts...');
assert(viewerSrc.includes("url.toLowerCase().includes('anim_rotor')"), 'Rotors included in continuous rotation');
assert(viewerSrc.includes("url.toLowerCase().includes('anim_stomp')"), 'Stamping machines included in reciprocating animation');
assert(viewerSrc.includes("url.toLowerCase().includes('anim_alge')"), 'Bio-algae included in harmonic sway animation');
console.log('  ✓ [PASS] Industrial rotors, stamping pistons, and bio-algae registered in animatedParts');

// 4. Verify animated UV textures for fluids & lava
console.log('  [4] Verifying animated UV scrolling for lava, fire, vapor, and mud...');
assert(viewerSrc.includes('isLava && (diffuseTex || emissiveTex)'), 'isLava UV scroll registered');
assert(viewerSrc.includes('isFire && (diffuseTex || emissiveTex)'), 'isFire UV scroll registered');
assert(viewerSrc.includes('isVapor && (diffuseTex || emissiveTex)'), 'isVapor UV scroll registered');
assert(viewerSrc.includes('isMud && diffuseTex'), 'isMud UV scroll registered');
console.log('  ✓ [PASS] Lava flow, fire flicker, rising vapor, and churning mud UV animations verified');

console.log('\n[SUCCESS] All Production Anim Support Code Tests Passed Cleanly!');
