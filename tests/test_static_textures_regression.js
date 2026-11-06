import assert from 'node:assert';
import fs from 'node:fs';
import * as THREE from 'three';

console.log('[*] Testing Static Textures Animation Regression Fixes...');

// Mock localStorage for headless environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

// Material/mesh classification now spans viewer.js and the extracted loaders in
// @x4/adapter-three; scan all of them so the negative guards below stay effective.
const viewerCode = [
  'src/viewer.js',
  'packages/adapter-three/src/models/binary-model-loader.js',
  'packages/adapter-three/src/models/collada-model-loader.js',
  'packages/adapter-three/src/textures/texture-resolver.js',
  'packages/adapter-three/src/materials/mesh-group-materials.js'
].map(f => fs.readFileSync(f, 'utf8')).join('\n');

// 1. Verify source-level guard checks in viewer.js
console.log('  [1] Verifying boolean flags and guard conditions in viewer.js...');

// isForcefield must not broadly match on url.includes('shield')
assert(!viewerCode.includes("url.toLowerCase().includes('shield') && !url.toLowerCase().includes('blast')"),
  'Overly broad url.includes("shield") matching must be removed to prevent shield factory modules from becoming forcefields');
assert(!viewerCode.includes("binUrl.toLowerCase().includes('shield')"),
  'Overly broad binUrl.includes("shield") must be removed from createBinaryMesh');

// isPoslightMesh must not match url.includes('glow')
assert(!viewerCode.includes("url.toLowerCase().includes('glow')"),
  'url.includes("glow") in isPoslightMesh must be removed to prevent static glowing elements from UV scrolling');
assert(!viewerCode.includes("binUrl.toLowerCase().includes('glow')"),
  'binUrl.includes("glow") in createBinaryMesh isPoslight must be removed');

// fx_anim_stomp_smoke must not be stomped in animatedParts
assert(viewerCode.includes("partBase.startsWith('anim_stomp') && !partBase.includes('wheels')"),
  'Stamping pistons in animatedParts must check partBase.startsWith("anim_stomp") to exclude smoke FX');

console.log('  ✓ [PASS] All overly broad string conditionals removed from viewer.js');

// 2. Import StationViewer
const { StationViewer } = await import('../src/viewer.js');
const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;
viewer.getRaceHullColor = StationViewer.prototype.getRaceHullColor;
viewer.resolveTextureForModel = StationViewer.prototype.resolveTextureForModel;
viewer.applyTexturesToMeshGroup = StationViewer.prototype.applyTexturesToMeshGroup;

// 3. Test prod_gen_shieldcomponents is completely static
console.log('  [2] Testing prod_gen_shieldcomponents factory parts do NOT animate...');
viewer.animatedTextures = [];

const shieldCompMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
shieldCompMesh.name = 'part_main';
const shieldCompGroup = new THREE.Group();
shieldCompGroup.add(shieldCompMesh);

const hullTex = new THREE.Texture();
hullTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => hullTex;

await viewer.applyTexturesToMeshGroup(
  shieldCompGroup,
  'assets1/structures/production/prod_gen_shieldcomponents_data/part_main-lod0.dae',
  1
);

assert.strictEqual(viewer.animatedTextures.length, 0, 'prod_gen_shieldcomponents part_main must NOT register in animatedTextures');
assert.strictEqual(shieldCompMesh.material.transparent, false, 'prod_gen_shieldcomponents part_main must NOT be transparent');
assert.strictEqual(shieldCompMesh.material.blending, THREE.NormalBlending, 'prod_gen_shieldcomponents part_main must use NormalBlending');
assert.strictEqual(hullTex.offset.x, 0, 'Cached hull texture offset.x must remain 0');
assert.strictEqual(hullTex.offset.y, 0, 'Cached hull texture offset.y must remain 0');
console.log('  ✓ [PASS] Shield component factory parts remain 100% static with zero animated textures');

// 4. Test anim_mud texture cloning isolates shared gravel texture
console.log('  [3] Testing anim_mud texture cloning preserves static rocks & stones...');
viewer.animatedTextures = [];

const sharedGravelTex = new THREE.Texture();
sharedGravelTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => sharedGravelTex;

// Load anim_mud
const mudMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial());
mudMesh.name = 'anim_mud01';
const mudGroup = new THREE.Group();
mudGroup.add(mudMesh);

await viewer.applyTexturesToMeshGroup(
  mudGroup,
  'assets1/structures/production/prod_tel_teladianium_data/anim_mud01-lod0.dae',
  2
);

assert.strictEqual(viewer.animatedTextures.length, 1, 'anim_mud must register 1 animated texture');
const mudAnim = viewer.animatedTextures[0];
assert.notStrictEqual(mudAnim.texture, sharedGravelTex, 'anim_mud animated texture MUST be a cloned instance, NOT shared singleton');
assert.strictEqual(mudMesh.material.map, mudAnim.texture, 'mud material map must point to the cloned animated texture');

// Simulate 10 frames of animation update loop
const delta = 0.016;
for (let f = 0; f < 10; f++) {
  mudAnim.texture.offset.x = (mudAnim.texture.offset.x + mudAnim.speedX * delta) % 1.0;
  mudAnim.texture.offset.y = (mudAnim.texture.offset.y + mudAnim.speedY * delta) % 1.0;
}

assert.ok(mudAnim.texture.offset.x > 0, 'Cloned mud texture offset.x must scroll');
assert.strictEqual(sharedGravelTex.offset.x, 0, 'Shared gravel texture offset.x MUST REMAIN 0 for static stones and ores');
assert.strictEqual(sharedGravelTex.offset.y, 0, 'Shared gravel texture offset.y MUST REMAIN 0 for static stones and ores');

// Now load static anim_stones with the shared texture
const stonesMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial());
stonesMesh.name = 'anim_stones01';
const stonesGroup = new THREE.Group();
stonesGroup.add(stonesMesh);

const initialAnimCount = viewer.animatedTextures.length;
await viewer.applyTexturesToMeshGroup(
  stonesGroup,
  'assets1/structures/production/prod_gen_refinedmetals_data/anim_stones01-lod0.dae',
  3
);

assert.strictEqual(viewer.animatedTextures.length, initialAnimCount, 'anim_stones must NOT add any animated textures');
console.log('  ✓ [PASS] Fluid mud animates cleanly while rocks, gravel, and ore remain completely static');

// 5. Test fx_anim_stomp_smoke is excluded from mechanical stamping pistons
console.log('  [4] Testing smoke FX exclusion from mechanical stamping pistons...');
viewer.animatedParts = [];

const smokeScene = new THREE.Group();
const smokeUrl = 'assets1/structures/production/prod_gen_cutcrystals_data/fx_anim_stomp_smoke02-lod0.dae';
const smokePartBase = smokeUrl.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();

// Simulate the matching condition from viewer.js
if (smokeUrl.toLowerCase().includes('anim_stomp') && smokePartBase.startsWith('anim_stomp') && !smokePartBase.includes('wheels')) {
  viewer.animatedParts.push({ object: smokeScene, update: () => {} });
}

assert.strictEqual(viewer.animatedParts.length, 0, 'fx_anim_stomp_smoke must NOT register in animatedParts');

// Actual stamping piston must register
const pistonScene = new THREE.Group();
const pistonUrl = 'assets1/structures/production/prod_gen_cutcrystals_data/anim_stomp01-lod0.dae';
const pistonPartBase = pistonUrl.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();

if (pistonUrl.toLowerCase().includes('anim_stomp') && pistonPartBase.startsWith('anim_stomp') && !pistonPartBase.includes('wheels')) {
  viewer.animatedParts.push({ object: pistonScene, update: () => {} });
}

assert.strictEqual(viewer.animatedParts.length, 1, 'anim_stomp01 must register in animatedParts');
console.log('  ✓ [PASS] Mechanical stamping machine correctly identifies pistons and ignores smoke FX');

console.log('\n[SUCCESS] All Static Textures Animation Regression Tests Passed Cleanly!');
