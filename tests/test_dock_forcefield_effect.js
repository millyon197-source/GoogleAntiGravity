import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Dock Forcefield Energy Effect (anim_forcefieldfx01)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];

// 1. Texture resolution test for anim_forcefieldfx01
const ffUrls = viewer.resolveTextureForModel(
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_forcefieldfx01-lod0.dae',
  'p1effectsXfx_forcefield_01'
);
assert.strictEqual(ffUrls.diffuse, '/assets1/textures/fx/p1_gate_haze_02_diff.dds', 'Forcefield should map to p1_gate_haze_02_diff');
assert.strictEqual(ffUrls.emissive, '/assets1/textures/fx/p1_gate_haze_02_diff.dds', 'Forcefield should have gate haze emissive');

console.log('  ✓ [PASS] anim_forcefieldfx01 resolves to p1_gate_haze_02_diff.dds');

// 2. Mock applyTexturesToMeshGroup on forcefield mesh
const mockMesh = new THREE.Mesh(
  new THREE.SphereGeometry(100, 32, 16),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'anim_forcefieldfx01';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

await viewer.applyTexturesToMeshGroup(
  mockGroup,
  '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_forcefieldfx01-lod0.dae'
);

const mat = mockMesh.material;

// Verify it is NOT an opaque black hood
assert.strictEqual(mat.transparent, true, 'Forcefield must be transparent');
assert.strictEqual(mat.depthWrite, false, 'Forcefield depthWrite must be false to reveal interior docks');
assert.strictEqual(mat.blending, THREE.AdditiveBlending, 'Forcefield must use AdditiveBlending for glowing energy effect');
assert.strictEqual(mat.opacity, 0.65, 'Forcefield should have semi-transparent energy opacity');
assert.strictEqual(mat.color.getHex(), 0x000000, 'Base diffuse color must be black to prevent opaque gray/black hood');
assert.strictEqual(mat.toneMapped, false, 'Forcefield should be toneMapped: false for HDR bloom');
assert.strictEqual(mockMesh.castShadow, false, 'Forcefield must not cast opaque shadow hood over docks');
assert.strictEqual(mockMesh.receiveShadow, false, 'Forcefield must not receive shadows');
assert.strictEqual(mockMesh.visible, true, 'Forcefield mesh must remain visible with its energy shader');

// Check UV animation registered
assert.ok(viewer.animatedTextures.length > 0, 'Forcefield texture must be registered for UV animation scrolling');
assert.strictEqual(viewer.animatedTextures[0].texture, dummyTexture);
assert.strictEqual(viewer.animatedTextures[0].speedX, 0.04);

// Check PointLight
const pointLight = mockMesh.getObjectByName('fx_point_light');
assert.ok(pointLight, 'Forcefield should have localized point light illuminating interior dock');
assert.strictEqual(pointLight.color.getHexString(), '33ccff', 'Argon dock forcefield light should be Argon cyan');

console.log('  ✓ [PASS] Forcefield material settings, additive blending, UV animation and dock illumination verified');
console.log('\n[SUCCESS] All dock forcefield effect tests passed cleanly!');
