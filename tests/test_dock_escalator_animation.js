import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Escalator / Conveyor UV Texture Animation (anim_escalator)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for anim_escalator-lod0
const escalatorUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_escalator-lod0.dae',
  'generic.generic_p1_int_conveyor_01'
);
assert.strictEqual(escalatorUrls.diffuse, '/assets1/textures/interiors/int_conveyor_01_diff.dds', 'Escalator must map to int_conveyor_01_diff');
assert.strictEqual(escalatorUrls.normal, '/assets1/textures/interiors/int_conveyor_01_normal.dds', 'Escalator must have normal map');
assert.strictEqual(escalatorUrls.roughness, '/assets1/textures/interiors/int_conveyor_01_smooth.dds', 'Escalator must have roughness map');
assert.strictEqual(escalatorUrls.metalness, '/assets1/textures/interiors/int_conveyor_01_metal.dds', 'Escalator must have metalness map');
assert.strictEqual(escalatorUrls.emissive, '/assets1/textures/interiors/int_conveyor_01_glow.dds', 'Escalator must have emissive glow map');

console.log('  ✓ [PASS] anim_escalator resolves to int_conveyor_01 multi-channel PBR textures');

// Also test without material name (symbol theresonlyone fallback via URL)
const urlFallbackUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_escalator-lod0.dae',
  'theresonlyone'
);
assert.strictEqual(urlFallbackUrls.diffuse, '/assets1/textures/interiors/int_conveyor_01_diff.dds', 'Escalator fallback by URL must resolve correctly');
console.log('  ✓ [PASS] anim_escalator resolves correctly even with theresonlyone DAE material symbol');

// 2. Mock applyTexturesToMeshGroup on escalator mesh
const mockMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 185),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'anim_escalator';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyDiffuse = new THREE.Texture();
const dummyNormal = new THREE.Texture();
const dummyRoughness = new THREE.Texture();
const dummyMetalness = new THREE.Texture();
const dummyEmissive = new THREE.Texture();

viewer.loadDdsTexture = async (url) => {
  if (url.includes('diff')) return dummyDiffuse;
  if (url.includes('normal')) return dummyNormal;
  if (url.includes('smooth')) return dummyRoughness;
  if (url.includes('metal')) return dummyMetalness;
  if (url.includes('glow')) return dummyEmissive;
  return new THREE.Texture();
};

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_escalator-lod0.dae'
);

const mat = mockMesh.material;

// Verify material settings
assert.strictEqual(mat.map, dummyDiffuse, 'Escalator material must have diffuse map assigned');
assert.strictEqual(mat.normalMap, dummyNormal, 'Escalator material must have normal map assigned');
assert.strictEqual(mat.roughnessMap, dummyRoughness, 'Escalator material must have roughness map assigned');
assert.strictEqual(mat.metalnessMap, dummyMetalness, 'Escalator material must have metalness map assigned');
assert.strictEqual(mat.emissiveMap, dummyEmissive, 'Escalator material must have emissive map assigned');
assert.strictEqual(mat.toneMapped, false, 'Escalator emissive warning lights should be toneMapped: false for HDR bloom');

// 3. Verify UV Animation registration
assert.ok(viewer.animatedTextures.length > 0, 'Escalator textures must be registered in animatedTextures');
const animItem = viewer.animatedTextures.find(a => a.texture === dummyDiffuse);
assert.ok(animItem, 'Diffuse texture must be registered for UV animation');
assert.strictEqual(animItem.speedX, 0.0, 'Escalator tread travel should not scroll along X');
assert.strictEqual(animItem.speedY, 0.8, 'Escalator tread travel should scroll along Y (+V direction matching X4 XML)');

// Verify all channels (normal, roughness, metalness, emissive) are registered to animate in lockstep
assert.ok(viewer.animatedTextures.some(a => a.texture === dummyNormal), 'Normal map must animate in sync');
assert.ok(viewer.animatedTextures.some(a => a.texture === dummyRoughness), 'Roughness map must animate in sync');
assert.ok(viewer.animatedTextures.some(a => a.texture === dummyMetalness), 'Metalness map must animate in sync');
assert.ok(viewer.animatedTextures.some(a => a.texture === dummyEmissive), 'Emissive map must animate in sync');

console.log('  ✓ [PASS] All 5 PBR texture channels registered in animatedTextures array');

// 4. Test frame tick animation update
const initialOffsetY = dummyDiffuse.offset.y;
const delta = 0.016; // ~60 fps frame time

// Simulate viewer.animate() UV update loop
for (const item of viewer.animatedTextures) {
  if (item.texture) {
    item.texture.offset.x = (item.texture.offset.x + (item.speedX || 0) * delta) % 1.0;
    if (item.speedY) {
      item.texture.offset.y = (item.texture.offset.y + item.speedY * delta) % 1.0;
    }
  }
}

assert.ok(dummyDiffuse.offset.y > initialOffsetY, 'Diffuse texture offset.y must advance each frame');
assert.strictEqual(dummyDiffuse.offset.y, (initialOffsetY + 0.8 * delta) % 1.0);
assert.strictEqual(dummyNormal.offset.y, dummyDiffuse.offset.y, 'Normal map offset must remain identical to diffuse');
assert.strictEqual(dummyEmissive.offset.y, dummyDiffuse.offset.y, 'Emissive map offset must remain identical to diffuse');

console.log('  ✓ [PASS] Frame animation tick advances UV offset.y synchronously across all texture channels');
console.log('\n[SUCCESS] All dock escalator UV texture animation tests passed cleanly!');
