import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing App Lighting Support for fx_glow-lod0 and Lightcones...');

// 1. Race glow colors test
const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;

const boronColor = viewer.getRaceGlowColor('buildmodule_bor_equip_l');
assert.strictEqual(boronColor.getHexString(), '00ffcc', 'Boron should have cyan/teal glow');

const paranidColor = viewer.getRaceGlowColor('buildmodule_par_dock');
assert.strictEqual(paranidColor.getHexString(), 'cc66ff', 'Paranid should have imperial purple glow');

const splitColor = viewer.getRaceGlowColor('buildmodule_spl_ships');
assert.strictEqual(splitColor.getHexString(), 'ff5522', 'Split should have orange/red glow');

const teladiColor = viewer.getRaceGlowColor('buildmodule_tel_dock');
assert.strictEqual(teladiColor.getHexString(), '88ff44', 'Teladi should have lime green glow');

const terranColor = viewer.getRaceGlowColor('buildmodule_ter_station');
assert.strictEqual(terranColor.getHexString(), '66ddff', 'Terran should have arctic blue glow');

const argonColor = viewer.getRaceGlowColor('buildmodule_arg_equip_l');
assert.strictEqual(argonColor.getHexString(), '33ccff', 'Argon should have federation cyan glow');

console.log('  ✓ [PASS] Race glow colors match faction aesthetics');

// 2. Texture resolution test for fx_glow-lod0 and fx_lightcones
const argonGlowUrls = viewer.resolveTextureForModel('structures/dock/fx_glow-lod0.dae');
assert.strictEqual(argonGlowUrls.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
assert.strictEqual(argonGlowUrls.emissive, '/assets1/textures/fx/lightcones_soft.dds');

const boronLightconeUrls = viewer.resolveTextureForModel('structures/buildmodule_bor/fx_lightcones-lod0.dae', 'p2fx.fx_p2_lightcones_01');
assert.strictEqual(boronLightconeUrls.diffuse, '/assets1/textures/fx/fx_p2_lightcones_01_diff.dds');
assert.strictEqual(boronLightconeUrls.emissive, '/assets1/textures/fx/fx_p2_lightcones_01_diff.dds');

console.log('  ✓ [PASS] fx_glow and lightcones resolve to correct volumetric textures');

// 3. Mock applyTexturesToMeshGroup behavior on fx_glow mesh
const mockMesh = new THREE.Mesh(
  new THREE.BoxGeometry(100, 100, 100),
  new THREE.MeshBasicMaterial()
);
mockMesh.name = 'fx_glow';
mockMesh.castShadow = true;
mockMesh.receiveShadow = true;

const mockGroup = new THREE.Group();
mockGroup.add(mockMesh);

// Mock loadDdsTexture returning dummy Texture
const dummyTexture = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTexture;

await viewer.applyTexturesToMeshGroup(mockGroup, '/assets1/structures/buildmodule/buildmodule_arg_equip_l_data/fx_glow-lod0.dae');

const mat = mockMesh.material;
assert.strictEqual(mat.blending, THREE.AdditiveBlending, 'fx_glow mesh must use AdditiveBlending');
assert.strictEqual(mat.depthWrite, false, 'fx_glow mesh must disable depthWrite');
assert.strictEqual(mat.transparent, true, 'fx_glow mesh must be transparent');
assert.strictEqual(mat.toneMapped, false, 'fx_glow mesh must be toneMapped: false for HDR bloom');
assert.strictEqual(mat.color.getHex(), 0x000000, 'fx_glow mesh color should be black to prevent ambient/diffuse wash');
assert.strictEqual(mockMesh.castShadow, false, 'fx_glow mesh must not cast opaque shadows');
assert.strictEqual(mockMesh.receiveShadow, false, 'fx_glow mesh must not receive shadows');
assert.strictEqual(mockMesh.visible, false, 'fx_glow mesh must be invisible to renders');
assert.strictEqual(mat.visible, false, 'fx_glow material must be invisible to renders');

// Check PointLight attachment
const pointLight = mockGroup.getObjectByName('fx_point_light') || mockMesh.getObjectByName('fx_point_light');
assert.ok(pointLight, 'fx_glow component should have localized PointLight attached');
assert.strictEqual(pointLight.visible, true, 'PointLight must remain visible to illuminate adjacent geometry');
assert.strictEqual(pointLight.color.getHexString(), '33ccff', 'Argon PointLight should match Argon cyan color');
assert.ok(pointLight.intensity > 1.0, `PointLight intensity should be active (got ${pointLight.intensity})`);

console.log('  ✓ [PASS] fx_glow invisible to renders and localized PointLight attached');

// 4. Test setEmissiveIntensity dynamically adjusts both AdditiveBlending material and PointLight
viewer.modulesGroup = new THREE.Group();
viewer.modulesGroup.add(mockGroup);
viewer.renderScene = () => {}; // mock renderScene

viewer.setEmissiveIntensity(4.4); // double intensity
assert.strictEqual(viewer.glowingEmissiveIntensity, 4.4);
assert.strictEqual(mat.emissiveIntensity, 4.4 * 1.5, 'Additive blending material should scale by 1.5x');
assert.strictEqual(pointLight.intensity, (4.4 / 2.2) * 1.8, 'PointLight intensity should scale proportionally');

viewer.setEmissiveIntensity(0.0); // turn off
assert.strictEqual(mat.emissiveIntensity, 0);
assert.strictEqual(pointLight.intensity, 0);

console.log('  ✓ [PASS] Dynamic emissive and point light scaling verified');
console.log('\n[SUCCESS] All app lighting tests for fx_glow and lightcones passed cleanly!');
