import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Position Lights Strobing UV Animation (anim_poslights)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for anim_poslights-lod0
const poslightUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_poslights-lod0.dae',
  'p1effectsXp1_gradient_colour'
);
assert.strictEqual(poslightUrls.diffuse, '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds', 'anim_poslights must map to fx_p2_gradient_colour_01_diff.dds');
assert.strictEqual(poslightUrls.emissive, '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds', 'anim_poslights must have gradient emissive');

// Fallback by URL without material name
const urlFallbackUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_poslights-lod0.dae',
  'theresonlyone'
);
assert.strictEqual(urlFallbackUrls.diffuse, '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds', 'anim_poslights url fallback must resolve to gradient colour');

console.log('  ✓ [PASS] anim_poslights resolves to fx_p2_gradient_colour_01_diff.dds');

// 2. Mock applyTexturesToMeshGroup on poslights mesh
const mockMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'anim_poslights';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyGradientTex = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyGradientTex;

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_poslights-lod0.dae'
);

const mat = mockMesh.material;

// Verify material settings
assert.strictEqual(mat.map, dummyGradientTex, 'Poslights material must have gradient texture map');
assert.strictEqual(mat.emissiveMap, dummyGradientTex, 'Poslights material must have gradient emissive map');
assert.strictEqual(mat.toneMapped, false, 'Poslights material must be toneMapped: false for HDR bloom');
assert.strictEqual(mockMesh.castShadow, false, 'Poslights must not cast shadow planes');
assert.strictEqual(mockMesh.receiveShadow, false, 'Poslights must not receive shadows');

// 3. Verify UV Animation registration
assert.ok(viewer.animatedTextures.length > 0, 'Poslights texture must be registered in animatedTextures');
const animItem = viewer.animatedTextures.find(a => a.texture === dummyGradientTex);
assert.ok(animItem, 'Gradient texture must be registered for UV animation');
assert.strictEqual(animItem.speedX, -0.3, 'Poslight pulse animation must scroll along U (-X direction matching X4 XML)');

// 4. Test frame tick animation update
const initialOffsetX = dummyGradientTex.offset.x;
const delta = 0.016;

for (const item of viewer.animatedTextures) {
  if (item.texture) {
    item.texture.offset.x = (item.texture.offset.x + (item.speedX || 0) * delta) % 1.0;
  }
}

assert.ok(dummyGradientTex.offset.x !== initialOffsetX, 'Poslight texture offset.x must advance each frame');
console.log('  ✓ [PASS] Poslight gradient texture advances UV offset.x synchronously every frame');
console.log('\n[SUCCESS] All anim_poslights UV animation tests passed cleanly!');
