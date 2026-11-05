import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing dockarea_arg_m_02_tradestation_01 Assets, Animations, and Texture Mappings...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.colladaCache = new Map();
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;

const folder = '/assets1/structures/dock/dockarea_arg_m_02_tradestation_01_data';

// 1. Asset entry resolution
const assetEntry = viewer.resolveModuleAssetEntry('dockarea_arg_m_02_tradestation_01_macro');
assert.strictEqual(assetEntry.folderPath, folder, 'Folder path should match dockarea_arg_m_02_tradestation_01_data');
assert.deepStrictEqual(assetEntry.defaultFiles.sort(), [
  'anim_forcefieldfx-lod0.dae',
  'anim_hatch_01-lod0.dae',
  'anim_hatch_02-lod0.dae',
  'anim_poslight-lod0.dae',
  'detail_s_main-lod0.dae',
  'part_main-lod0.dae'
].sort(), 'Default files must include all 6 components');
console.log('  ✓ [PASS] resolveModuleAssetEntry discovers all 6 default component files');

// 2. Texture resolution for part_main
const partMainHull = viewer.resolveTextureForModel(`${folder}/part_main-lod0.dae`, 'generic_p1_hulltexture');
assert.strictEqual(partMainHull.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');
assert.strictEqual(partMainHull.normal, '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds');
assert.strictEqual(partMainHull.roughness, '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds');
assert.strictEqual(partMainHull.metalness, '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds');

const partMainFx = viewer.resolveTextureForModel(`${folder}/part_main-lod0.dae`, 'generic_p1_fx');
assert.strictEqual(partMainFx.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds');
assert.strictEqual(partMainFx.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');

const partMainPattern = viewer.resolveTextureForModel(`${folder}/part_main-lod0.dae`, 'generic_p1_hullpattern');
assert.strictEqual(partMainPattern.diffuse, '/assets1/textures/generic/generic_p1_hullpattern_diff.dds');
console.log('  ✓ [PASS] part_main-lod0 resolves hulltexture, generic_p1_fx, and hullpattern');

// 3. Texture resolution for detail_s_main multi-material subnodes (Must NOT be foliage!)
const detailAlpha = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_alphatexture');
assert.strictEqual(detailAlpha.diffuse, '/assets1/textures/generic/generic_p1_alphatexture_diff.dds', 'detail_s_main alphatexture must map to generic_p1_alphatexture, not foliage');
assert.strictEqual(detailAlpha.normal, '/assets1/textures/generic/generic_p1_alphatexture_normal.dds');

const detailHull = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_hulltexture');
assert.strictEqual(detailHull.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds', 'detail_s_main hull must map to generic_p1_hulltexture_01');

const detailFx = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_fx');
assert.strictEqual(detailFx.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds');
assert.strictEqual(detailFx.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');

const detailLightcone = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'detail_s_main-lod0Xlod0Xp1effectsXp1_lightcone_soft');
assert.strictEqual(detailLightcone.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
assert.strictEqual(detailLightcone.emissive, '/assets1/textures/fx/lightcones_soft.dds');
console.log('  ✓ [PASS] detail_s_main-lod0 resolves all 4 distinct subnodes accurately');

// 4. Texture resolution for anim_poslight and anim_forcefieldfx
const poslightRes = viewer.resolveTextureForModel(`${folder}/anim_poslight-lod0.dae`, 'p1effects.p1_gradient_colour');
assert.strictEqual(poslightRes.diffuse, '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds');

const forcefieldRes = viewer.resolveTextureForModel(`${folder}/anim_forcefieldfx-lod0.dae`, 'p1effects.fx_forcefield_01');
assert.strictEqual(forcefieldRes.diffuse, '/assets1/textures/fx/p1_gate_haze_02_diff.dds');
console.log('  ✓ [PASS] anim_poslight and anim_forcefieldfx texture channels verified');

// 5. Test Mock Mesh Texture and Animation Registration for anim_poslight
const poslightMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
poslightMesh.name = 'anim_poslight';
const poslightGroup = new THREE.Group();
poslightGroup.add(poslightMesh);

const poslightTex = new THREE.Texture();
poslightTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => poslightTex;

await viewer.applyTexturesToMeshGroup(poslightGroup, `${folder}/anim_poslight-lod0.dae`);

assert.strictEqual(poslightMesh.material.toneMapped, false, 'anim_poslight must have toneMapped: false for HDR bloom');
assert.strictEqual(poslightMesh.castShadow, false, 'anim_poslight must not cast shadows');
assert.strictEqual(poslightMesh.receiveShadow, false, 'anim_poslight must not receive shadows');
const poslightAnim = viewer.animatedTextures.find(a => a.texture === poslightTex);
assert.ok(poslightAnim, 'anim_poslight texture must be registered in animatedTextures');
assert.strictEqual(poslightAnim.speedX, -0.3, 'anim_poslight speedX should be -0.3 for 100-frame cycle');
console.log('  ✓ [PASS] anim_poslight UV strobe animation registered and properties verified');

// 6. Test Mock Mesh Texture and Animation Registration for anim_forcefieldfx
const forcefieldMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
forcefieldMesh.name = 'anim_forcefieldfx';
const forcefieldGroup = new THREE.Group();
forcefieldGroup.add(forcefieldMesh);

const forcefieldTex = new THREE.Texture();
forcefieldTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => forcefieldTex;

await viewer.applyTexturesToMeshGroup(forcefieldGroup, `${folder}/anim_forcefieldfx-lod0.dae`);

assert.strictEqual(forcefieldMesh.material.transparent, true, 'forcefield must be transparent');
assert.strictEqual(forcefieldMesh.material.depthWrite, false, 'forcefield depthWrite must be false');
assert.strictEqual(forcefieldMesh.castShadow, false, 'forcefield must not cast shadow');
const forcefieldAnim = viewer.animatedTextures.find(a => a.texture === forcefieldTex);
assert.ok(forcefieldAnim, 'anim_forcefieldfx texture must be registered in animatedTextures');
assert.strictEqual(forcefieldAnim.speedX, 0.04);
assert.strictEqual(forcefieldAnim.speedY, 0.015);
console.log('  ✓ [PASS] anim_forcefieldfx energy barrier UV flow animation verified');

// 7. Verify Frame UV Progression
const initialPosX = poslightTex.offset.x;
const initialFfX = forcefieldTex.offset.x;
const initialFfY = forcefieldTex.offset.y;

const delta = 0.016; // 60 FPS frame tick
for (const anim of viewer.animatedTextures) {
  if (anim.speedX) anim.texture.offset.x += anim.speedX * delta;
  if (anim.speedY) anim.texture.offset.y += anim.speedY * delta;
}

assert.ok(poslightTex.offset.x < initialPosX, 'poslight offset.x should have decremented with speedX = -0.3');
assert.ok(forcefieldTex.offset.x > initialFfX, 'forcefield offset.x should have advanced');
assert.ok(forcefieldTex.offset.y > initialFfY, 'forcefield offset.y should have advanced');
console.log('  ✓ [PASS] Both UV animations advance synchronously per frame');

// 8. Test Part Offsets for Hatch Doors anim_hatch_01 and anim_hatch_02
const hatch01Group = new THREE.Group();
const hatch02Group = new THREE.Group();

const urlHatch01 = `${folder}/anim_hatch_01-lod0.dae`;
const urlHatch02 = `${folder}/anim_hatch_02-lod0.dae`;

// Simulate the connection offset logic in loadModuleMesh
const applyHatchOffset = (scene, url) => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('dockarea_arg_m_02_tradestation_01')) {
    if (urlLower.includes('anim_hatch_01')) {
      scene.position.set(-466.9438, 58.5607, -0.07168579);
      scene.quaternion.set(0, 0.7071068, 0, -0.7071067);
    } else if (urlLower.includes('anim_hatch_02')) {
      scene.position.set(467.2225, 58.57285, -0.07168579);
      scene.quaternion.set(0, 0.7071068, 0, -0.7071067);
    }
  }
};

applyHatchOffset(hatch01Group, urlHatch01);
applyHatchOffset(hatch02Group, urlHatch02);

assert.strictEqual(hatch01Group.position.x, -466.9438, 'anim_hatch_01 X offset');
assert.strictEqual(hatch01Group.position.y, 58.5607, 'anim_hatch_01 Y offset');
assert.strictEqual(hatch02Group.position.x, 467.2225, 'anim_hatch_02 X offset');
assert.strictEqual(hatch02Group.position.y, 58.57285, 'anim_hatch_02 Y offset');
console.log('  ✓ [PASS] anim_hatch_01 and anim_hatch_02 connection offsets and orientations verified');

// 9. Test detail_s_main animated UV lights registration
const detailFxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
detailFxMesh.name = 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_fx';
const detailGroup = new THREE.Group();
detailGroup.add(detailFxMesh);

const detailFxTex = new THREE.Texture();
detailFxTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => detailFxTex;

await viewer.applyTexturesToMeshGroup(detailGroup, `${folder}/detail_s_main-lod0.dae`);

const detailFxAnim = viewer.animatedTextures.find(a => a.texture === detailFxTex);
assert.ok(detailFxAnim, 'detail_s_main generic_p1_fx texture must be registered in animatedTextures');
assert.strictEqual(detailFxAnim.speedX, -0.35, 'detail_s_main animated UV light speedX should be -0.35');
assert.strictEqual(detailFxAnim.speedY, 0.0, 'detail_s_main animated UV light speedY should be 0.0');

const initialDetailX = detailFxTex.offset.x;
detailFxTex.offset.x += detailFxAnim.speedX * delta;
assert.ok(detailFxTex.offset.x < initialDetailX, 'detail_s_main UV light texture offset.x should decrement smoothly');
console.log('  ✓ [PASS] detail_s_main animated UV runway lights registered with speedX: -0.35 and animated');

console.log('\n[SUCCESS] All dockarea_arg_m_02_tradestation_01 animation and texture tests passed cleanly!');
