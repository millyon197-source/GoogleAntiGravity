import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Interior Atmospheric Haze Effect (fx_haze)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for fx_haze-lod0
const hazeUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_haze-lod0.dae',
  'p1effects.p1_lightcone_soft'
);
assert.strictEqual(hazeUrls.diffuse, '/assets1/textures/fx/lightcones_soft.dds', 'Atmospheric haze should map to lightcones_soft.dds');
assert.strictEqual(hazeUrls.emissive, '/assets1/textures/fx/lightcones_soft.dds', 'Atmospheric haze should have lightcones_soft emissive');

console.log('  ✓ [PASS] fx_haze resolves to lightcones_soft.dds');

// 2. Mock applyTexturesToMeshGroup on fx_haze mesh
const mockMesh = new THREE.Mesh(
  new THREE.BoxGeometry(100, 100, 100),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'fx_haze';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_haze-lod0.dae'
);

const mat = mockMesh.material;

// Verify it is NOT an opaque black box
assert.strictEqual(mat.transparent, true, 'Atmospheric haze must be transparent');
assert.strictEqual(mat.depthWrite, false, 'Atmospheric haze depthWrite must be false to avoid occluding dock interior');
assert.strictEqual(mat.blending, THREE.AdditiveBlending, 'Atmospheric haze must use AdditiveBlending for soft volumetric atmosphere');
assert.strictEqual(mat.opacity, 0.35, 'Atmospheric haze should have soft atmospheric opacity (0.35)');
assert.strictEqual(mat.color.getHex(), 0x000000, 'Base diffuse color must be black to prevent opaque black/gray box');
assert.strictEqual(mat.toneMapped, false, 'Atmospheric haze should be toneMapped: false for HDR bloom');
assert.strictEqual(mockMesh.castShadow, false, 'Atmospheric haze must not cast opaque shadow volume over dock interior');
assert.strictEqual(mockMesh.receiveShadow, false, 'Atmospheric haze must not receive shadows');
assert.strictEqual(mockMesh.visible, true, 'Atmospheric haze mesh must remain visible with additive soft volume');

console.log('  ✓ [PASS] Atmospheric haze material settings, additive blending, opacity and shadow bypass verified');
console.log('\n[SUCCESS] All dock atmospheric haze tests passed cleanly!');
