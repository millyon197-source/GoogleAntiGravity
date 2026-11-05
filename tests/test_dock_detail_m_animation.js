import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Runway Guide Lights & Elements Animation (detail_m_main)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for detail_m_main-lod0
const fxUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae',
  'detail_m_main-lod0Xlod0XgenericXgeneric_p1_fx'
);
assert.strictEqual(fxUrls.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds', 'detail_m_main FX must map to generic_p1_fx_diff');
assert.strictEqual(fxUrls.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds', 'detail_m_main FX must have generic_p1_fx_glow emissive');

const alphaUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae',
  'detail_m_main-lod0Xlod0XgenericXgeneric_p1_alphatexture'
);
assert.strictEqual(alphaUrls.diffuse, '/assets1/textures/generic/generic_p1_alphatexture_diff.dds', 'detail_m_main alpha must map to generic_p1_alphatexture_diff');

const hullUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae',
  'detail_m_main-lod0Xlod0XgenericXgeneric_p1_hulltexture_02'
);
assert.strictEqual(hullUrls.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds', 'detail_m_main hull must map to generic_p1_hulltexture_01_diff');

const binFallbackUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.bin'
);
assert.strictEqual(binFallbackUrls.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds', 'detail_m_main binary fallback must map to generic_p1_fx_diff');
assert.strictEqual(binFallbackUrls.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds', 'detail_m_main binary fallback must have emissive');

console.log('  ✓ [PASS] Multi-material resolution for detail_m_main subnodes verified');

// 2. Mock applyTexturesToMeshGroup on detail_m_main group
const mockGroup = new THREE.Group();

const meshHull = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
meshHull.name = 'detail_m_main-lod0Xlod0XgenericXgeneric_p1_hulltexture_02';
mockGroup.add(meshHull);

const meshAlpha = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
meshAlpha.name = 'detail_m_main-lod0Xlod0XgenericXgeneric_p1_alphatexture';
mockGroup.add(meshAlpha);

const meshFx = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
meshFx.name = 'detail_m_main-lod0Xlod0XgenericXgeneric_p1_fx';
mockGroup.add(meshFx);

const dummyFxDiffuse = new THREE.Texture();
const dummyFxEmissive = new THREE.Texture();
const dummyAlphaDiffuse = new THREE.Texture();
const dummyHullDiffuse = new THREE.Texture();

viewer.loadDdsTexture = async (url) => {
  if (url.includes('fx_glow')) return dummyFxEmissive;
  if (url.includes('fx_diff')) return dummyFxDiffuse;
  if (url.includes('alphatexture')) return dummyAlphaDiffuse;
  if (url.includes('hulltexture')) return dummyHullDiffuse;
  return new THREE.Texture();
};

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae'
);

// Verify meshHull material
assert.strictEqual(meshHull.material.map, dummyHullDiffuse, 'Hull submesh must have hull diffuse map');

// Verify meshAlpha material
assert.strictEqual(meshAlpha.material.map, dummyAlphaDiffuse, 'Alpha submesh must have alpha diffuse map');
assert.strictEqual(meshAlpha.material.transparent, true, 'Alpha submesh must be transparent');
assert.strictEqual(meshAlpha.material.alphaTest, 0.35, 'Alpha submesh must have alphaTest: 0.35 for ventilation grates');

// Verify meshFx material
assert.strictEqual(meshFx.material.map, dummyFxDiffuse, 'FX submesh must have runway lights diffuse map');
assert.strictEqual(meshFx.material.emissiveMap, dummyFxEmissive, 'FX submesh must have runway lights emissive map');
assert.strictEqual(meshFx.material.toneMapped, false, 'FX runway lights should be toneMapped: false for HDR bloom');

// 3. Verify UV Animation registration for Runway Guidance Lights
assert.ok(viewer.animatedTextures.length > 0, 'Runway guidance lights must be registered in animatedTextures');
const animItem = viewer.animatedTextures.find(a => a.texture === dummyFxDiffuse);
assert.ok(animItem, 'Runway diffuse texture must be registered for UV animation');
assert.strictEqual(animItem.speedX, -0.35, 'Runway lights must scroll along X (-U direction)');

// 4. Test frame tick animation update
const initialOffsetX = dummyFxDiffuse.offset.x;
const delta = 0.016;

for (const item of viewer.animatedTextures) {
  if (item.texture) {
    item.texture.offset.x = (item.texture.offset.x + (item.speedX || 0) * delta) % 1.0;
  }
}

assert.ok(dummyFxDiffuse.offset.x !== initialOffsetX, 'Runway texture offset.x must advance each frame');
assert.strictEqual(dummyFxEmissive.offset.x, dummyFxDiffuse.offset.x, 'Emissive map offset must match diffuse map offset in lockstep');

console.log('  ✓ [PASS] Runway guidance lights animate synchronously across frames');
console.log('\n[SUCCESS] All detail_m_main texture mapping and animation tests passed cleanly!');
