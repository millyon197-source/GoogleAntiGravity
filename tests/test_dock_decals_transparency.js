import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Decals Transparency & Effect (fx_decals)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for fx_decals-lod0
const decalUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_decals-lod0.dae',
  'p1paintXpaint_p1_decal_01'
);
assert.strictEqual(decalUrls.diffuse, '/assets1/textures/paint/paint_p1_decal_01_diff.dds', 'Decals should map to paint_p1_decal_01_diff');
assert.strictEqual(decalUrls.normal, '/assets1/textures/paint/paint_p1_decal_01_normal.dds', 'Decals should have normal map');
assert.strictEqual(decalUrls.metalness, '/assets1/textures/paint/paint_p1_decal_01_metal.dds', 'Decals should have metalness map');
assert.strictEqual(decalUrls.emissive, '/assets1/textures/paint/paint_p1_decal_01_glow.dds', 'Decals should have emissive glow map');

console.log('  ✓ [PASS] fx_decals resolves to paint_p1_decal_01 multi-channel textures');

// 2. Mock applyTexturesToMeshGroup on fx_decals mesh
const mockMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'fx_decals';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_decals-lod0.dae'
);

const mat = mockMesh.material;

// Verify it is NOT an opaque black polygon
assert.strictEqual(mat.transparent, true, 'Decals must be transparent');
assert.strictEqual(mat.alphaTest, 0.1, 'Decals must have alphaTest enabled to discard black background');
assert.strictEqual(mat.depthWrite, false, 'Decals depthWrite must be false to overlay cleanly on hull');
assert.strictEqual(mat.polygonOffset, true, 'Decals must use polygonOffset to prevent Z-fighting');
assert.strictEqual(mat.polygonOffsetFactor, -1, 'polygonOffsetFactor should be -1');
assert.strictEqual(mat.polygonOffsetUnits, -1, 'polygonOffsetUnits should be -1');
assert.strictEqual(mat.toneMapped, false, 'Glowing decals should be toneMapped: false for HDR bloom');
assert.strictEqual(mockMesh.castShadow, false, 'Decals must not cast shadow planes onto hull');
assert.strictEqual(mockMesh.receiveShadow, true, 'Decals should receive hull shadows');
assert.strictEqual(mockMesh.visible, true, 'Decals mesh must remain visible');

console.log('  ✓ [PASS] Decals material settings, alphaTest, polygonOffset and shadow bypass verified');
console.log('\n[SUCCESS] All dock decals transparency tests passed cleanly!');
