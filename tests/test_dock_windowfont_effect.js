import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Window Font Illuminated Effect (detail_xl_windowfont)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for detail_xl_windowfont-lod0
const wfUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_xl_windowfont-lod0.dae',
  'theresonlyone'
);
assert.strictEqual(wfUrls.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds', 'Windowfont should map to generic_p1_fx_diff');
assert.strictEqual(wfUrls.normal, '/assets1/textures/generic/generic_p1_fx_normal.dds', 'Windowfont should have normal map');
assert.strictEqual(wfUrls.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds', 'Windowfont should have emissive glow map');

console.log('  ✓ [PASS] detail_xl_windowfont resolves to generic_p1_fx multi-channel textures');

// 2. Mock applyTexturesToMeshGroup on detail_xl_windowfont mesh
const mockMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 7),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'detail_xl_windowfont';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_xl_windowfont-lod0.dae'
);

const mat = mockMesh.material;

// Verify it is NOT an opaque black polygon
assert.strictEqual(mat.transparent, true, 'Windowfont must be transparent');
assert.strictEqual(mat.alphaTest, 0.1, 'Windowfont must have alphaTest enabled to discard black background around lettering');
assert.strictEqual(mat.depthWrite, false, 'Windowfont depthWrite must be false to overlay cleanly on window glass');
assert.strictEqual(mat.polygonOffset, true, 'Windowfont must use polygonOffset to prevent Z-fighting on glass');
assert.strictEqual(mat.polygonOffsetFactor, -1, 'polygonOffsetFactor should be -1');
assert.strictEqual(mat.polygonOffsetUnits, -1, 'polygonOffsetUnits should be -1');
assert.strictEqual(mat.toneMapped, false, 'Illuminated windowfont should be toneMapped: false for HDR bloom');
assert.strictEqual(mat.emissiveIntensity, 2.2, 'Windowfont should have active emissive glow intensity');
assert.strictEqual(mockMesh.castShadow, false, 'Windowfont must not cast opaque shadow planes onto glass');
assert.strictEqual(mockMesh.receiveShadow, true, 'Windowfont should receive scene shadows');
assert.strictEqual(mockMesh.visible, true, 'Windowfont mesh must remain visible');

// Verify windowfont UVs are static and not scrolling
if (mat.map) {
  assert.strictEqual(mat.map.offset.x, 0, 'Windowfont diffuse map offset.x must be 0 (static)');
  assert.strictEqual(mat.map.offset.y, 0, 'Windowfont diffuse map offset.y must be 0 (static)');
  assert.strictEqual(viewer.animatedTextures.some(a => a.texture === mat.map), false, 'Windowfont diffuse map must NOT be in animatedTextures');
}
if (mat.emissiveMap) {
  assert.strictEqual(mat.emissiveMap.offset.x, 0, 'Windowfont emissive map offset.x must be 0 (static)');
  assert.strictEqual(mat.emissiveMap.offset.y, 0, 'Windowfont emissive map offset.y must be 0 (static)');
  assert.strictEqual(viewer.animatedTextures.some(a => a.texture === mat.emissiveMap), false, 'Windowfont emissive map must NOT be in animatedTextures');
}

console.log('  ✓ [PASS] Windowfont material settings, alphaTest, polygonOffset, emissive, shadow bypass and static UVs verified');
console.log('\n[SUCCESS] All dock windowfont illuminated effect tests passed cleanly!');
