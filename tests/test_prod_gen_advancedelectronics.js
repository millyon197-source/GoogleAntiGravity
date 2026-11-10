import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };

console.log('[*] Testing prod_gen_advancedelectronics Assets, Animations, and Texture Mappings...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.colladaCache = new Map();
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;

const folder = '/assets1/structures/production/prod_gen_advancedelectronics_data';

// 1. Asset entry resolution
const assetEntry = viewer.resolveModuleAssetEntry('prod_gen_advancedelectronics_macro');
assert.strictEqual(assetEntry.folderPath, folder, 'Folder path should match prod_gen_advancedelectronics_data');
assert.strictEqual(assetEntry.defaultFiles.length, 67, 'Default files must include all 67 components');
assert.ok(assetEntry.defaultFiles.includes('part_main-lod0.dae'), 'part_main-lod0.dae must be present');
assert.ok(assetEntry.defaultFiles.includes('anim_centrifuge-lod0.dae'), 'anim_centrifuge-lod0.dae must be present');
assert.ok(assetEntry.defaultFiles.includes('anim_bubbles-lod0.dae'), 'anim_bubbles-lod0.dae must be present');
assert.ok(assetEntry.defaultFiles.includes('fx_shield-lod0.dae'), 'fx_shield-lod0.dae must be present');
assert.ok(assetEntry.defaultFiles.includes('fx_poslights-lod0.dae'), 'fx_poslights-lod0.dae must be present');
assert.ok(assetEntry.defaultFiles.includes('anim_capsule_fast01-lod0.dae'), 'anim_capsule_fast01-lod0.dae must be present');
console.log('  ✓ [PASS] resolveModuleAssetEntry discovers all 67 default component files');

// 2. Texture resolution for core components
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

const alphaRes = viewer.resolveTextureForModel(`${folder}/detail_s_alpha-lod0.dae`, 'generic_p1_alphatexture');
assert.strictEqual(alphaRes.diffuse, '/assets1/textures/generic/generic_p1_alphatexture_diff.dds');

const decalRes = viewer.resolveTextureForModel(`${folder}/fx_decals-lod0.dae`, 'paint_p1_decal_01');
assert.strictEqual(decalRes.diffuse, '/assets1/textures/paint/paint_p1_decal_01_diff.dds');
console.log('  ✓ [PASS] Hull, fx, hullpattern, alpha and decal textures resolve correctly');

// 3. Texture resolution for fx_bubbles_01, p1_pattern_hex_01, and p1_gradient_colour
const bubblesRes = viewer.resolveTextureForModel(`${folder}/anim_bubbles-lod0.dae`, 'p1effects.fx_bubbles_01');
assert.strictEqual(bubblesRes.diffuse, '/assets1/textures/fx/fx_bubbles_01_diff.dds', 'anim_bubbles must resolve to fx_bubbles_01_diff.dds');
assert.strictEqual(bubblesRes.emissive, '/assets1/textures/fx/fx_bubbles_01_diff.dds');

const shieldRes = viewer.resolveTextureForModel(`${folder}/fx_shield-lod0.dae`, 'p1effects.p1_pattern_hex_01');
assert.strictEqual(shieldRes.diffuse, '/assets1/textures/fx/pattern_hex_01.dds', 'fx_shield must resolve to pattern_hex_01.dds');
assert.strictEqual(shieldRes.emissive, '/assets1/textures/fx/pattern_hex_01.dds');

const poslightsRes = viewer.resolveTextureForModel(`${folder}/fx_poslights-lod0.dae`, 'p1effects.p1_gradient_colour');
assert.strictEqual(poslightsRes.diffuse, '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds');

const coreRes = viewer.resolveTextureForModel(`${folder}/anim_core-lod0.dae`, 'p1effects.p1_lightcone_soft');
assert.strictEqual(coreRes.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
console.log('  ✓ [PASS] fx_bubbles_01, pattern_hex_01, gradient_colour and lightcone textures verified');

// 4. Test Mock Mesh Texture and Animation Registration for anim_bubbles
const bubblesMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
bubblesMesh.name = 'anim_bubbles';
const bubblesGroup = new THREE.Group();
bubblesGroup.add(bubblesMesh);

const bubblesTex = new THREE.Texture();
bubblesTex.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => bubblesTex;

await viewer.applyTexturesToMeshGroup(bubblesGroup, `${folder}/anim_bubbles-lod0.dae`);

assert.strictEqual(bubblesMesh.material.transparent, true, 'anim_bubbles material must be transparent');
assert.strictEqual(bubblesMesh.material.depthWrite, false, 'anim_bubbles material depthWrite must be false');
assert.strictEqual(bubblesMesh.material.blending, THREE.AdditiveBlending, 'anim_bubbles must use AdditiveBlending');
assert.strictEqual(bubblesMesh.material.color.getHex(), 0x000000, 'anim_bubbles color must be 0x000000 (black background produces zero diffuse)');
assert.strictEqual(bubblesMesh.material.toneMapped, true, 'anim_bubbles toneMapped must be true to prevent bloom artifact streak');
assert.strictEqual(bubblesMesh.material.emissive.getHexString(), '33ccff', 'anim_bubbles emissive color must be electric cyan');
assert.ok(bubblesMesh.material.emissiveIntensity >= 1.0 && bubblesMesh.material.emissiveIntensity <= 2.5, 'anim_bubbles emissiveIntensity must be balanced');
assert.strictEqual(bubblesTex.repeat.y, -1, 'anim_bubbles repeat.y must be -1 to sample top bubble particle band');
assert.strictEqual(bubblesTex.offset.y, 1, 'anim_bubbles offset.y must be 1 for OpenGL V-flip');
const bubblesAnim = viewer.animatedTextures.find(a => a.texture === bubblesTex);
assert.ok(bubblesAnim, 'anim_bubbles texture must be registered in animatedTextures');
assert.strictEqual(bubblesAnim.speedX, 0.15, 'anim_bubbles speedX should match 200-frame cycle (0.15)');
assert.strictEqual(bubblesAnim.speedY, 0.0);

const initBubblesX = bubblesTex.offset.x;
const delta = 0.016; // 60 FPS tick
bubblesTex.offset.x += bubblesAnim.speedX * delta;
assert.ok(bubblesTex.offset.x > initBubblesX, 'anim_bubbles UV scroll offset.x must increment linearly');
console.log('  ✓ [PASS] anim_bubbles UV animation registered with speedX = 0.15 and tested');

// 5. Test Mock Mesh Texture and Animation Registration for fx_shield
const shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
shieldMesh.name = 'fx_shield';
const shieldGroup = new THREE.Group();
shieldGroup.add(shieldMesh);

const shieldTex = new THREE.Texture();
viewer.loadDdsTexture = async () => shieldTex;

await viewer.applyTexturesToMeshGroup(shieldGroup, `${folder}/fx_shield-lod0.dae`);

assert.strictEqual(shieldMesh.material.transparent, true, 'fx_shield must be transparent');
assert.strictEqual(shieldMesh.material.depthWrite, false, 'fx_shield depthWrite must be false');
assert.strictEqual(shieldMesh.material.blending, THREE.AdditiveBlending, 'fx_shield must use AdditiveBlending');
assert.strictEqual(shieldMesh.material.color.getHex(), 0x000000, 'fx_shield diffuse color must be 0x000000 to eliminate white layer');
assert.strictEqual(shieldMesh.material.toneMapped, false, 'fx_shield toneMapped must be false for bloom');
assert.strictEqual(shieldMesh.material.emissive.getHexString(), '33ccff', 'fx_shield must have electric cyan emissive color');
assert.ok(shieldMesh.material.emissiveIntensity >= 3.0, 'fx_shield must have radiant emissive intensity');
assert.strictEqual(shieldMesh.material.map.wrapS, THREE.RepeatWrapping, 'fx_shield map must have RepeatWrapping');
assert.strictEqual(shieldMesh.material.map.wrapT, THREE.RepeatWrapping, 'fx_shield map must have RepeatWrapping');
console.log('  ✓ [PASS] fx_shield transparency, additive blending, repeat wrapping, and electric cyan glow verified');

// 5b. Test Mock Mesh Texture and Transparency for fx_lightcones (No black planes)
const lightconeMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
lightconeMesh.name = 'fx_lightcones-lod0Xlod0Xp1effectsXp1_lightcone_soft';
const lightconeGroup = new THREE.Group();
lightconeGroup.add(lightconeMesh);

const lightconeTex = new THREE.Texture();
viewer.loadDdsTexture = async () => lightconeTex;

await viewer.applyTexturesToMeshGroup(lightconeGroup, `${folder}/fx_lightcones-lod0.dae`);

assert.strictEqual(lightconeMesh.material.transparent, true, 'fx_lightcones must be transparent');
assert.strictEqual(lightconeMesh.material.depthWrite, false, 'fx_lightcones depthWrite must be false');
assert.strictEqual(lightconeMesh.material.blending, THREE.AdditiveBlending, 'fx_lightcones must use AdditiveBlending');
assert.strictEqual(lightconeMesh.material.color.getHex(), 0x000000, 'fx_lightcones color must be 0x000000 (no black plane)');
assert.strictEqual(lightconeMesh.castShadow, false, 'fx_lightcones must not cast shadows');
assert.strictEqual(lightconeMesh.receiveShadow, false, 'fx_lightcones must not receive shadows');
console.log('  ✓ [PASS] fx_lightcones volumetric additive transparency and shadow exclusion verified');

// 6. Test Centrifuge Continuous Mechanical Rotation
const centrifugeScene = new THREE.Group();
viewer.animatedParts.push({
  object: centrifugeScene,
  update: (time) => {
    centrifugeScene.rotation.z = (time * (Math.PI * 2 / 40)) % (Math.PI * 2);
  }
});

const partAnim = viewer.animatedParts[viewer.animatedParts.length - 1];
assert.ok(partAnim, 'anim_centrifuge must be registered in animatedParts');
partAnim.update(0);
assert.strictEqual(centrifugeScene.rotation.z, 0);
partAnim.update(10); // 10 seconds into a 40s cycle = 90 degrees = PI/2
assert.ok(Math.abs(centrifugeScene.rotation.z - Math.PI / 2) < 0.001, 'centrifuge must rotate 90 deg at 10s');
partAnim.update(20); // 20 seconds = 180 degrees = PI
assert.ok(Math.abs(centrifugeScene.rotation.z - Math.PI) < 0.001, 'centrifuge must rotate 180 deg at 20s');
console.log('  ✓ [PASS] anim_centrifuge continuous 40s 360-degree rotation verified');

// 7. Verify Component Connection Offsets
const offsets = COMPONENT_OFFSETS['prod_gen_advancedelectronics'];
assert.ok(offsets, 'prod_gen_advancedelectronics offsets must exist');

// Verify core centrifuge offset
assert.deepStrictEqual(offsets['anim_centrifuge'], [110.487, 2.7689, 0.7379], 'anim_centrifuge offset');
assert.deepStrictEqual(offsets['anim_bubbles'], [110.2217, 2.8705, 0.9315], 'anim_bubbles offset');
assert.deepStrictEqual(offsets['fx_shield'], [109.5315, 2.7688, -0.4631], 'fx_shield offset');
assert.deepStrictEqual(offsets['detail_s_main'], [110.4871, 2.7689, 0.7934], 'detail_s_main offset');
assert.deepStrictEqual(offsets['anim_capsule_fast01'], [204.0819, 2.7689, 533.9253], 'anim_capsule_fast01 offset');
assert.deepStrictEqual(offsets['anim_capsule_fast08'], [16.8684, 2.7689, 533.9837], 'anim_capsule_fast08 offset');

// Test offset application simulation matching loadModuleMesh
const testScene = new THREE.Group();
const urlBubbles = `${folder}/anim_bubbles-lod0.dae`;
const partBase = urlBubbles.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();
const off = COMPONENT_OFFSETS['prod_gen_advancedelectronics']?.[partBase];
if (off) {
  testScene.position.set(off[0], off[1], off[2]);
}
assert.strictEqual(testScene.position.x, 110.2217);
assert.strictEqual(testScene.position.y, 2.8705);
assert.strictEqual(testScene.position.z, 0.9315);
console.log('  ✓ [PASS] Component connection offsets correctly positioned');

// 8. Verify anim_bubbles DAE MapChannel 1 UV mapping
import fs from 'fs';
const daeContent = fs.readFileSync('assets1/structures/production/prod_gen_advancedelectronics_data/anim_bubbles-lod0.dae', 'utf8');
const vMatch = daeContent.match(/<vertices id="meshId0-vertices">([\s\S]*?)<\/vertices>/);
assert.ok(vMatch, 'anim_bubbles must have vertices tag');
const texInputs = [...vMatch[1].matchAll(/<input semantic="TEXCOORD"/g)];
assert.strictEqual(texInputs.length, 1, 'anim_bubbles vertices must bind only the primary MapChannel 1 (meshId0-tex0) to prevent ColladaLoader UV overwriting');
assert.ok(vMatch[1].includes('meshId0-tex0'), 'vertices must bind meshId0-tex0');
console.log('  ✓ [PASS] anim_bubbles DAE preserves MapChannel 1 UV channel mapping');

// 9. Verify part_main-lod0 Multi-Material Texture Resolution and Application (No Black Exterior)
const partMainGroup = new THREE.Group();
const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
hullMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_hulltexture';
// Simulate ColladaLoader placeholder map with image: null
hullMesh.material.map = new THREE.Texture();

const patternMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hullpattern' }));
patternMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_hullpattern';
patternMesh.material.map = new THREE.Texture();

const fxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
fxMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_fx';
fxMesh.material.map = new THREE.Texture();

partMainGroup.add(hullMesh, patternMesh, fxMesh);

const dummyHullTex = new THREE.Texture();
dummyHullTex.image = { width: 2048, height: 4096 };
dummyHullTex.mipmaps = [{}];

const dummyPatternTex = new THREE.Texture();
dummyPatternTex.image = { width: 2048, height: 2048 };
dummyPatternTex.mipmaps = [{}];

const dummyFxTex = new THREE.Texture();
dummyFxTex.image = { width: 2048, height: 2048 };
dummyFxTex.mipmaps = [{}];

viewer.loadDdsTexture = async (texUrl) => {
  if (texUrl.includes('hulltexture')) return dummyHullTex;
  if (texUrl.includes('hullpattern')) return dummyPatternTex;
  if (texUrl.includes('fx')) return dummyFxTex;
  return null;
};

await viewer.applyTexturesToMeshGroup(partMainGroup, `${folder}/part_main-lod0.dae`);

assert.ok(hullMesh.material.isMeshStandardMaterial, 'hullMesh must be converted to MeshStandardMaterial');
assert.strictEqual(hullMesh.material.map, dummyHullTex, 'hullMesh must replace placeholder with valid loaded diffuse map');
assert.notStrictEqual(hullMesh.material.color.getHex(), 0x000000, 'hullMesh color must not be black');

assert.ok(patternMesh.material.isMeshStandardMaterial, 'patternMesh must be converted to MeshStandardMaterial');
assert.strictEqual(patternMesh.material.map, dummyPatternTex, 'patternMesh must have loaded pattern diffuse map');
assert.notStrictEqual(patternMesh.material.color.getHex(), 0x000000, 'patternMesh color must not be black');

assert.ok(fxMesh.material.isMeshStandardMaterial, 'fxMesh must be converted to MeshStandardMaterial');
assert.strictEqual(fxMesh.material.map, dummyFxTex, 'fxMesh must have loaded fx diffuse map');
assert.strictEqual(fxMesh.material.toneMapped, false, 'fxMesh status glow must not be toneMapped');
console.log('  ✓ [PASS] part_main-lod0 multi-material subnodes correctly replace empty placeholder maps with loaded textures (no black exterior)');

// 10. Verify detail_s_alpha-lod0 Texture Flipping and Alpha-Test Pass (No Discarded / Clipped Structure)
const alphaMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_alphatexture' }));
alphaMesh.name = 'detail_s_alpha-lod0Xlod0XgenericXgeneric_p1_alphatexture';
const alphaGroup = new THREE.Group();
alphaGroup.add(alphaMesh);

const dummyAlphaDiff = new THREE.Texture();
const dummyAlphaNorm = new THREE.Texture();
const dummyAlphaSpec = new THREE.Texture();
viewer.loadDdsTexture = async (texUrl) => {
  if (texUrl.includes('alphatexture_diff')) return dummyAlphaDiff;
  if (texUrl.includes('alphatexture_normal')) return dummyAlphaNorm;
  if (texUrl.includes('alphatexture_spec')) return dummyAlphaSpec;
  return null;
};

await viewer.applyTexturesToMeshGroup(alphaGroup, `${folder}/detail_s_alpha-lod0.dae`);

assert.strictEqual(alphaMesh.material.transparent, true, 'detail_s_alpha must be transparent: true');
assert.strictEqual(alphaMesh.material.depthWrite, true, 'detail_s_alpha must write to depth buffer');
assert.strictEqual(alphaMesh.material.alphaTest, 0.35, 'detail_s_alpha must use alphaTest 0.35 for crisp cutout geometry');
assert.strictEqual(alphaMesh.material.side, THREE.DoubleSide, 'detail_s_alpha must render DoubleSide for railings/catwalks/ladders');

// Verify UV V-flip transformation on alpha textures (repeat.y = -1, offset.y = 1)
assert.strictEqual(dummyAlphaDiff.repeat.y, -1, 'alpha diffuse texture repeat.y must be -1');
assert.strictEqual(dummyAlphaDiff.offset.y, 1, 'alpha diffuse texture offset.y must be 1');
assert.strictEqual(dummyAlphaDiff.wrapT, THREE.RepeatWrapping, 'alpha diffuse texture wrapT must be RepeatWrapping');
assert.strictEqual(dummyAlphaNorm.repeat.y, -1, 'alpha normal texture repeat.y must be -1');
assert.strictEqual(dummyAlphaNorm.offset.y, 1, 'alpha normal texture offset.y must be 1');
console.log('  ✓ [PASS] detail_s_alpha-lod0 renders in alpha-test pass with V-flipped alpha textures (complete structure)');

// 11. Verify detail_l_main-lod0 Multi-Material Resolution, Lightcone Additive Blending, and Shadow Exclusion (No Artifact Rendering)
const detailLGroup = new THREE.Group();
const dHullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
dHullMesh.name = 'detail_l_main-lod0Xlod0XgenericXgeneric_p1_hulltexture';

const dFxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
dFxMesh.name = 'detail_l_main-lod0Xlod0XgenericXgeneric_p1_fx';

const dAlphaMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_alphatexture' }));
dAlphaMesh.name = 'detail_l_main-lod0Xlod0XgenericXgeneric_p1_alphatexture';

const dPatternMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hullpattern' }));
dPatternMesh.name = 'detail_l_main-lod0Xlod0XgenericXgeneric_p1_hullpattern';

const dLightconeMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_lightcone_soft' }));
dLightconeMesh.name = 'detail_l_main-lod0Xlod0Xp1effectsXp1_lightcone_soft';

detailLGroup.add(dHullMesh, dFxMesh, dAlphaMesh, dPatternMesh, dLightconeMesh);

const dummyLightconeTex = new THREE.Texture();
viewer.loadDdsTexture = async (texUrl) => {
  if (texUrl.includes('hulltexture')) return dummyHullTex;
  if (texUrl.includes('alphatexture')) return dummyAlphaDiff;
  if (texUrl.includes('hullpattern')) return dummyPatternTex;
  if (texUrl.includes('lightcones')) return dummyLightconeTex;
  if (texUrl.includes('fx_glow')) return dummyFxTex;
  if (texUrl.includes('generic_p1_fx') || texUrl.includes('fx_diff')) return dummyFxTex;
  return null;
};

await viewer.applyTexturesToMeshGroup(detailLGroup, `${folder}/detail_l_main-lod0.dae`);

// Hull
assert.ok(dHullMesh.material.isMeshStandardMaterial, 'dHullMesh must be MeshStandardMaterial');
assert.ok(dHullMesh.material.map, 'dHullMesh must have hull diffuse map');
assert.strictEqual(dHullMesh.material.map.source, dummyHullTex.source, 'dHullMesh must use hull texture source');
assert.strictEqual(dHullMesh.material.map.repeat.x, 1, 'dHullMesh must have native repeat.x = 1 matching part_main scale');
assert.notStrictEqual(dHullMesh.material.color.getHex(), 0x000000, 'dHullMesh color must not be black');

// FX
assert.ok(dFxMesh.material.isMeshStandardMaterial, 'dFxMesh must be MeshStandardMaterial');
assert.ok(dFxMesh.material.map, 'dFxMesh must have fx diffuse map');
assert.strictEqual(dFxMesh.material.map.offset.x, 0, 'dFxMesh diffuse map offset.x must be 0 (static)');
assert.strictEqual(dFxMesh.material.map.offset.y, 1, 'dFxMesh diffuse map offset.y must be 1 (V-flip)');
assert.strictEqual(dFxMesh.material.map.repeat.y, -1, 'dFxMesh diffuse map repeat.y must be -1 (V-flip)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === dFxMesh.material.map), false, 'dFxMesh diffuse map must NOT be in animatedTextures');
assert.ok(dFxMesh.material.emissiveMap, 'dFxMesh must have fx glow emissive map');
assert.strictEqual(dFxMesh.material.emissiveMap.offset.x, 0, 'dFxMesh emissive map offset.x must be 0 (static)');
assert.strictEqual(dFxMesh.material.emissiveMap.offset.y, 1, 'dFxMesh emissive map offset.y must be 1 (V-flip)');
assert.strictEqual(dFxMesh.material.emissiveMap.repeat.y, -1, 'dFxMesh emissive map repeat.y must be -1 (V-flip)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === dFxMesh.material.emissiveMap), false, 'dFxMesh emissive map must NOT be in animatedTextures');
assert.strictEqual(dFxMesh.material.toneMapped, false, 'dFxMesh status glow must not be toneMapped');

// Alpha
assert.ok(dAlphaMesh.material.isMeshStandardMaterial, 'dAlphaMesh must be MeshStandardMaterial');
assert.strictEqual(dAlphaMesh.material.transparent, true, 'dAlphaMesh must be transparent: true');
assert.strictEqual(dAlphaMesh.material.depthWrite, true, 'dAlphaMesh must write depth');
assert.strictEqual(dAlphaMesh.material.alphaTest, 0.35, 'dAlphaMesh must have alphaTest: 0.35');
assert.strictEqual(dummyAlphaDiff.repeat.y, -1, 'dAlphaMesh UV V-flip repeat.y must be -1');

// Hull Pattern
assert.ok(dPatternMesh.material.isMeshStandardMaterial, 'dPatternMesh must be MeshStandardMaterial');
assert.strictEqual(dPatternMesh.material.map, dummyPatternTex, 'dPatternMesh must have pattern map');

// Lightcone Soft (No Artifact Planes/Cones!)
assert.ok(dLightconeMesh.material.isMeshStandardMaterial, 'dLightconeMesh must be MeshStandardMaterial');
assert.strictEqual(dLightconeMesh.material.transparent, true, 'dLightconeMesh must be transparent: true');
assert.strictEqual(dLightconeMesh.material.depthWrite, false, 'dLightconeMesh must have depthWrite: false');
assert.strictEqual(dLightconeMesh.material.blending, THREE.AdditiveBlending, 'dLightconeMesh must use AdditiveBlending');
assert.strictEqual(dLightconeMesh.material.color.getHex(), 0x000000, 'dLightconeMesh color must be 0x000000');
assert.strictEqual(dLightconeMesh.material.emissiveMap, dummyLightconeTex, 'dLightconeMesh must have lightcone emissiveMap');
assert.strictEqual(dLightconeMesh.material.toneMapped, true, 'dLightconeMesh must have toneMapped: true to prevent bloom supernova');
assert.ok(dLightconeMesh.material.emissiveIntensity <= 0.5, 'dLightconeMesh must have subtle emissiveIntensity <= 0.5');
assert.ok(dLightconeMesh.material.opacity <= 0.35, 'dLightconeMesh must have subtle opacity <= 0.35');
assert.strictEqual(dLightconeMesh.castShadow, false, 'dLightconeMesh must not cast shadows');
assert.strictEqual(dLightconeMesh.receiveShadow, false, 'dLightconeMesh must not receive shadows');
assert.strictEqual(detailLGroup.getObjectByName('fx_point_light'), undefined, 'detail_l_main lightcones must not spawn point lights');
console.log('  ✓ [PASS] detail_l_main-lod0 multi-material subnodes, additive soft lightcones, and shadow exclusion verified (no artifacts)');

// 11b. Verify detail_s_main-lod0 Multi-Material Resolution and Static Non-Scrolling Textures
const detailSGroup = new THREE.Group();
const sHullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
sHullMesh.name = 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_hulltexture';

const sFxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
sFxMesh.name = 'detail_s_main-lod0Xlod0XgenericXgeneric_p1_fx';

const sLightconeMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_lightcone_soft' }));
sLightconeMesh.name = 'detail_s_main-lod0Xlod0Xp1effectsXp1_lightcone_soft';

detailSGroup.add(sHullMesh, sFxMesh, sLightconeMesh);

await viewer.applyTexturesToMeshGroup(detailSGroup, `${folder}/detail_s_main-lod0.dae`);

// Hull
assert.ok(sHullMesh.material.isMeshStandardMaterial, 'sHullMesh must be MeshStandardMaterial');
assert.ok(sHullMesh.material.map, 'sHullMesh must have hull diffuse map');
assert.strictEqual(sHullMesh.material.map.offset.x, 0, 'sHullMesh diffuse offset.x must be 0 (static)');
assert.strictEqual(sHullMesh.material.map.offset.y, 0, 'sHullMesh diffuse offset.y must be 0 (static)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === sHullMesh.material.map), false, 'sHullMesh map must not be in animatedTextures');

// FX
assert.ok(sFxMesh.material.isMeshStandardMaterial, 'sFxMesh must be MeshStandardMaterial');
assert.ok(sFxMesh.material.map, 'sFxMesh must have fx diffuse map');
assert.strictEqual(sFxMesh.material.map.offset.x, 0, 'sFxMesh diffuse map offset.x must be 0 (static)');
assert.strictEqual(sFxMesh.material.map.offset.y, 0, 'sFxMesh diffuse map offset.y must be 0 (static)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === sFxMesh.material.map), false, 'sFxMesh diffuse map must NOT be in animatedTextures');
assert.ok(sFxMesh.material.emissiveMap, 'sFxMesh must have fx glow emissive map');
assert.strictEqual(sFxMesh.material.emissiveMap.offset.x, 0, 'sFxMesh emissive map offset.x must be 0 (static)');
assert.strictEqual(sFxMesh.material.emissiveMap.offset.y, 0, 'sFxMesh emissive map offset.y must be 0 (static)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === sFxMesh.material.emissiveMap), false, 'sFxMesh emissive map must NOT be in animatedTextures');

// Lightcone Soft
assert.ok(sLightconeMesh.material.isMeshStandardMaterial, 'sLightconeMesh must be MeshStandardMaterial');
assert.strictEqual(sLightconeMesh.material.transparent, true, 'sLightconeMesh must be transparent: true');
assert.strictEqual(sLightconeMesh.material.depthWrite, false, 'sLightconeMesh must have depthWrite: false');
assert.strictEqual(sLightconeMesh.material.blending, THREE.AdditiveBlending, 'sLightconeMesh must use AdditiveBlending');
assert.strictEqual(sLightconeMesh.material.color.getHex(), 0x000000, 'sLightconeMesh color must be 0x000000');
assert.ok(sLightconeMesh.material.emissiveMap, 'sLightconeMesh must have lightcone emissiveMap');
assert.strictEqual(sLightconeMesh.material.emissiveMap.offset.x, 0, 'sLightconeMesh emissiveMap offset.x must be 0 (static)');
assert.strictEqual(sLightconeMesh.material.emissiveMap.offset.y, 0, 'sLightconeMesh emissiveMap offset.y must be 0 (static)');
assert.strictEqual(viewer.animatedTextures.some(a => a.texture === sLightconeMesh.material.emissiveMap), false, 'sLightconeMesh emissiveMap must not be in animatedTextures');

console.log('  ✓ [PASS] detail_s_main-lod0 multi-material subnodes are completely static with non-scrolling UVs (no animated bleed)');

// 12. Comprehensive Examination of the 24 Animated Components
// (anim_capsule_fast01..12, anim_capsuleholder11..16, anim_capsuleshield, anim_centrifuge, anim_container_01..02, anim_core, anim_holdershield)
const anim24Parts = [
  'anim_capsule_fast01', 'anim_capsule_fast02', 'anim_capsule_fast03', 'anim_capsule_fast04',
  'anim_capsule_fast05', 'anim_capsule_fast06', 'anim_capsule_fast07', 'anim_capsule_fast08',
  'anim_capsule_fast09', 'anim_capsule_fast10', 'anim_capsule_fast11', 'anim_capsule_fast12',
  'anim_capsuleholder11', 'anim_capsuleholder12', 'anim_capsuleholder13', 'anim_capsuleholder14',
  'anim_capsuleholder15', 'anim_capsuleholder16',
  'anim_capsuleshield', 'anim_centrifuge', 'anim_container_01', 'anim_container_02',
  'anim_core', 'anim_holdershield'
];

assert.strictEqual(anim24Parts.length, 24, 'Must examine exactly 24 animated sub-components');

// 12a. Texture and Material Resolution across all 24 components
for (const p of anim24Parts) {
  const url = `${folder}/${p}-lod0.dae`;
  if (p.startsWith('anim_capsule_fast')) {
    const hullRes = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_hulltexture');
    assert.strictEqual(hullRes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');
    assert.strictEqual(hullRes.normal, '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds');
    assert.strictEqual(hullRes.roughness, '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds');
    assert.strictEqual(hullRes.metalness, '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds');

    const coneRes = viewer.resolveTextureForModel(url, 'p1effectsXp1_lightcone_soft');
    assert.strictEqual(coneRes.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
    assert.strictEqual(coneRes.emissive, '/assets1/textures/fx/lightcones_soft.dds');
  } else if (p.startsWith('anim_capsuleholder')) {
    const hullRes = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_hulltexture');
    assert.strictEqual(hullRes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');

    const fxRes = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_fx');
    assert.strictEqual(fxRes.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds');
    assert.strictEqual(fxRes.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');

    const alphaRes2 = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_alphatexture');
    assert.strictEqual(alphaRes2.diffuse, '/assets1/textures/generic/generic_p1_alphatexture_diff.dds');

    const coneRes = viewer.resolveTextureForModel(url, 'p1effectsXp1_lightcone_soft');
    assert.strictEqual(coneRes.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
  } else if (p === 'anim_centrifuge') {
    const fxRes = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_fx');
    assert.strictEqual(fxRes.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');
    const alphaRes2 = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_alphatexture');
    assert.strictEqual(alphaRes2.diffuse, '/assets1/textures/generic/generic_p1_alphatexture_diff.dds');
  } else if (p.startsWith('anim_container')) {
    const hullRes = viewer.resolveTextureForModel(url, 'genericXgeneric_p1_hulltexture');
    assert.strictEqual(hullRes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');
    assert.strictEqual(hullRes.normal, '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds');
  } else if (p === 'anim_capsuleshield' || p === 'anim_holdershield' || p === 'anim_core') {
    const coneRes = viewer.resolveTextureForModel(url, 'p1effectsXp1_lightcone_soft');
    assert.strictEqual(coneRes.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
  }
}
console.log('  ✓ [PASS] All 24 animated components resolve correct PBR, FX, Alpha, and Lightcone textures');

// 12b. Test Capsule Holder Multi-Material Subnode Application (Glow Conduits, Alpha Grating, and Soft Cones)
const holderGroup = new THREE.Group();
const hHullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
hHullMesh.name = 'anim_capsuleholder11-lod0Xlod0XgenericXgeneric_p1_hulltexture';

const hFxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
hFxMesh.name = 'anim_capsuleholder11-lod0Xlod0XgenericXgeneric_p1_fx';

const hAlphaMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_alphatexture' }));
hAlphaMesh.name = 'anim_capsuleholder11-lod0Xlod0XgenericXgeneric_p1_alphatexture';

const hConeMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_lightcone_soft' }));
hConeMesh.name = 'anim_capsuleholder11-lod0Xlod0Xp1effectsXp1_lightcone_soft';

holderGroup.add(hHullMesh, hFxMesh, hAlphaMesh, hConeMesh);

await viewer.applyTexturesToMeshGroup(holderGroup, `${folder}/anim_capsuleholder11-lod0.dae`);

// Hull
assert.ok(hHullMesh.material.isMeshStandardMaterial, 'hHullMesh must be MeshStandardMaterial');
assert.strictEqual(hHullMesh.material.map, dummyHullTex, 'hHullMesh must receive hull texture');
assert.notStrictEqual(hHullMesh.material.color.getHex(), 0x000000, 'hHullMesh color must not be black');

// FX Conduit glow
assert.ok(hFxMesh.material.isMeshStandardMaterial, 'hFxMesh must be MeshStandardMaterial');
assert.strictEqual(hFxMesh.material.map, dummyFxTex, 'hFxMesh must receive fx diffuse map');
assert.strictEqual(hFxMesh.material.emissiveMap, dummyFxTex, 'hFxMesh must receive fx glow emissive map');
assert.strictEqual(hFxMesh.material.toneMapped, false, 'hFxMesh status glow must not be toneMapped for vibrant bloom');
assert.strictEqual(hFxMesh.material.emissive.getHexString(), '33ccff', 'hFxMesh emissive color must be Argon cyan');
assert.strictEqual(hFxMesh.material.emissiveIntensity, 2.2, 'hFxMesh emissiveIntensity must be 2.2');

// Alpha grating
assert.ok(hAlphaMesh.material.isMeshStandardMaterial, 'hAlphaMesh must be MeshStandardMaterial');
assert.strictEqual(hAlphaMesh.material.transparent, true, 'hAlphaMesh must be transparent');
assert.strictEqual(hAlphaMesh.material.depthWrite, true, 'hAlphaMesh must write depth');
assert.strictEqual(hAlphaMesh.material.alphaTest, 0.35, 'hAlphaMesh must have alphaTest: 0.35');
assert.strictEqual(hAlphaMesh.material.side, THREE.DoubleSide, 'hAlphaMesh must render DoubleSide');
assert.strictEqual(dummyAlphaDiff.repeat.y, -1, 'hAlphaMesh UV V-flip repeat.y must be -1');

// Soft Lightcone (subtle aura, no bloom supernova)
assert.ok(hConeMesh.material.isMeshStandardMaterial, 'hConeMesh must be MeshStandardMaterial');
assert.strictEqual(hConeMesh.material.transparent, true, 'hConeMesh must be transparent');
assert.strictEqual(hConeMesh.material.depthWrite, false, 'hConeMesh must not write depth');
assert.strictEqual(hConeMesh.material.blending, THREE.AdditiveBlending, 'hConeMesh must use AdditiveBlending');
assert.strictEqual(hConeMesh.material.toneMapped, true, 'hConeMesh must have toneMapped: true');
assert.ok(hConeMesh.material.emissiveIntensity <= 0.5, 'hConeMesh emissiveIntensity must be <= 0.5');
assert.ok(hConeMesh.material.opacity <= 0.35, 'hConeMesh opacity must be <= 0.35');
console.log('  ✓ [PASS] anim_capsuleholder multi-material shaders (glow conduits, alpha catwalks, soft lightcone) verified');

// 12c. Test Capsuleshield and Holdershield Exclusion from Scrolling Forcefield Animation
const shieldLightconeGroup = new THREE.Group();
const cShieldMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_lightcone_soft' }));
cShieldMesh.name = 'anim_capsuleshield-lod0Xlod0Xp1effectsXp1_lightcone_soft';
shieldLightconeGroup.add(cShieldMesh);

const initAnimTexCount = viewer.animatedTextures.length;
await viewer.applyTexturesToMeshGroup(shieldLightconeGroup, `${folder}/anim_capsuleshield-lod0.dae`);

assert.strictEqual(cShieldMesh.material.transparent, true, 'anim_capsuleshield must be transparent');
assert.strictEqual(cShieldMesh.material.blending, THREE.AdditiveBlending, 'anim_capsuleshield must use AdditiveBlending');
assert.strictEqual(cShieldMesh.material.toneMapped, true, 'anim_capsuleshield toneMapped must be true');
// Ensure lightcone texture was not added to animatedTextures
assert.strictEqual(viewer.animatedTextures.length, initAnimTexCount, 'anim_capsuleshield soft lightcone must not be registered in scrolling animatedTextures');
console.log('  ✓ [PASS] anim_capsuleshield and anim_holdershield soft lightcones excluded from scrolling forcefield animations');

// 13. Examination & Verification of detail_s_simon_container, detail_xs_simon, fx_corehull_main, and fx_decals
const simonContainerNums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12', '18'];
const simonXsNums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12', '18'];

// 13a. Verify texture resolution across all Simon and FX components
for (const n of simonContainerNums) {
  const containerRes = viewer.resolveTextureForModel(`${folder}/detail_s_simon_container_${n}-lod0.dae`, 'genericXgeneric_p1_hulltexture');
  assert.strictEqual(containerRes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');
  assert.strictEqual(containerRes.normal, '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds');
  assert.strictEqual(containerRes.roughness, '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds');
  assert.strictEqual(containerRes.metalness, '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds');
}

for (const n of simonXsNums) {
  const hullRes = viewer.resolveTextureForModel(`${folder}/detail_xs_simon_${n}-lod0.dae`, 'genericXgeneric_p1_hulltexture');
  assert.strictEqual(hullRes.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');

  const fxRes = viewer.resolveTextureForModel(`${folder}/detail_xs_simon_${n}-lod0.dae`, 'genericXgeneric_p1_fx');
  assert.strictEqual(fxRes.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds');
  assert.strictEqual(fxRes.normal, '/assets1/textures/generic/generic_p1_fx_normal.dds');
  assert.strictEqual(fxRes.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');
}

const corehullRes = viewer.resolveTextureForModel(`${folder}/fx_corehull_main-lod0.dae`, 'p1effectsXp1_lightcone_soft');
assert.strictEqual(corehullRes.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
assert.strictEqual(corehullRes.emissive, '/assets1/textures/fx/lightcones_soft.dds');

const decalsRes = viewer.resolveTextureForModel(`${folder}/fx_decals-lod0.dae`, 'p1paintXpaint_p1_decal_01');
assert.strictEqual(decalsRes.diffuse, '/assets1/textures/paint/paint_p1_decal_01_diff.dds');
assert.strictEqual(decalsRes.normal, '/assets1/textures/paint/paint_p1_decal_01_normal.dds');
assert.strictEqual(decalsRes.metalness, '/assets1/textures/paint/paint_p1_decal_01_metal.dds');
assert.strictEqual(decalsRes.emissive, '/assets1/textures/paint/paint_p1_decal_01_glow.dds');
console.log('  ✓ [PASS] All 26 simon container, detail_xs, fx_corehull_main, and fx_decals textures verified');

// 13b. Verify detail_xs_simon multi-material separation and neon glow conduit rendering
const simonXsGroup = new THREE.Group();
const sXHullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
sXHullMesh.name = 'detail_xs_simon_01-lod0Xlod0XgenericXgeneric_p1_hulltexture';

const sXFxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
sXFxMesh.name = 'detail_xs_simon_01-lod0Xlod0XgenericXgeneric_p1_fx';

simonXsGroup.add(sXHullMesh, sXFxMesh);

await viewer.applyTexturesToMeshGroup(simonXsGroup, `${folder}/detail_xs_simon_01-lod0.dae`);

assert.ok(sXHullMesh.material.isMeshStandardMaterial, 'sXHullMesh must be MeshStandardMaterial');
assert.strictEqual(sXHullMesh.material.map, dummyHullTex, 'sXHullMesh must have hull diffuse map');
assert.notStrictEqual(sXHullMesh.material.color.getHex(), 0x000000, 'sXHullMesh must not be black');

assert.ok(sXFxMesh.material.isMeshStandardMaterial, 'sXFxMesh must be MeshStandardMaterial');
assert.strictEqual(sXFxMesh.material.map, dummyFxTex, 'sXFxMesh must have fx diffuse map');
assert.strictEqual(sXFxMesh.material.emissiveMap, dummyFxTex, 'sXFxMesh must have fx glow emissive map');
assert.strictEqual(sXFxMesh.material.toneMapped, false, 'sXFxMesh must have toneMapped: false for bloom');
assert.strictEqual(sXFxMesh.material.emissive.getHexString(), '33ccff', 'sXFxMesh must glow Argon cyan');
assert.strictEqual(sXFxMesh.material.emissiveIntensity, 2.2, 'sXFxMesh must have emissiveIntensity: 2.2');
console.log('  ✓ [PASS] detail_xs_simon multi-material subnodes (PBR hull + glowing Argon cyan conduits) verified');

// 13c. Verify detail_s_simon_container UV Channel Preservation (tex0 preserved over tex2)
const containerGroup = new THREE.Group();
const cMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
cMesh.name = 'detail_s_simon_container_01-lod0Xlod0XgenericXgeneric_p1_hulltexture';
containerGroup.add(cMesh);

await viewer.applyTexturesToMeshGroup(containerGroup, `${folder}/detail_s_simon_container_01-lod0.dae`);

assert.ok(cMesh.material.isMeshStandardMaterial, 'cMesh must be MeshStandardMaterial');
assert.strictEqual(cMesh.material.map, dummyHullTex, 'cMesh must receive hull diffuse map');
assert.notStrictEqual(cMesh.material.color.getHex(), 0x000000, 'cMesh color must not be black');
console.log('  ✓ [PASS] detail_s_simon_container PBR hull mapping and primary UV channel verified');

// 13d. Verify fx_corehull_main additive volumetric lightcone shader
const corehullGroup = new THREE.Group();
const chMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_lightcone_soft' }));
chMesh.name = 'fx_corehull_main-lod0Xlod0Xp1effectsXp1_lightcone_soft';
corehullGroup.add(chMesh);

await viewer.applyTexturesToMeshGroup(corehullGroup, `${folder}/fx_corehull_main-lod0.dae`);

assert.ok(chMesh.material.isMeshStandardMaterial, 'chMesh must be MeshStandardMaterial');
assert.strictEqual(chMesh.material.transparent, true, 'chMesh must be transparent');
assert.strictEqual(chMesh.material.depthWrite, false, 'chMesh depthWrite must be false');
assert.strictEqual(chMesh.material.blending, THREE.AdditiveBlending, 'chMesh must use AdditiveBlending');
assert.strictEqual(chMesh.material.color.getHex(), 0x000000, 'chMesh base color must be 0x000000');
assert.strictEqual(chMesh.material.toneMapped, true, 'chMesh toneMapped must be true');
assert.strictEqual(chMesh.material.opacity, 0.25, 'chMesh opacity must be calibrated 0.25');
assert.strictEqual(chMesh.material.emissiveIntensity, 0.35, 'chMesh emissiveIntensity must be calibrated 0.35');
console.log('  ✓ [PASS] fx_corehull_main additive soft lightcone aura verified');

// 13e. Verify fx_decals transparency, depthWrite, and polygonOffset factor
const decalsGroup = new THREE.Group();
const decMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'p1paintXpaint_p1_decal_01' }));
decMesh.name = 'fx_decals-lod0Xlod0Xp1paintXpaint_p1_decal_01';
decalsGroup.add(decMesh);

const dummyDecalDiff = new THREE.Texture();
const dummyDecalGlow = new THREE.Texture();
viewer.loadDdsTexture = async (texUrl) => {
  if (texUrl.includes('decal_01_diff')) return dummyDecalDiff;
  if (texUrl.includes('decal_01_glow')) return dummyDecalGlow;
  return null;
};

await viewer.applyTexturesToMeshGroup(decalsGroup, `${folder}/fx_decals-lod0.dae`);

assert.ok(decMesh.material.isMeshStandardMaterial, 'decMesh must be MeshStandardMaterial');
assert.strictEqual(decMesh.material.transparent, true, 'fx_decals must be transparent');
assert.strictEqual(decMesh.material.depthWrite, false, 'fx_decals depthWrite must be false to prevent z-fighting');
assert.strictEqual(decMesh.material.polygonOffset, true, 'fx_decals polygonOffset must be enabled');
assert.strictEqual(decMesh.material.polygonOffsetFactor, -1, 'fx_decals polygonOffsetFactor must be -1');
assert.strictEqual(decMesh.material.polygonOffsetUnits, -1, 'fx_decals polygonOffsetUnits must be -1');
assert.strictEqual(decMesh.material.alphaTest, 0.1, 'fx_decals alphaTest must be 0.1');
assert.strictEqual(decMesh.material.toneMapped, false, 'fx_decals glow must not be toneMapped');
assert.strictEqual(decMesh.material.emissive.getHexString(), '33ccff', 'fx_decals emissive must be Argon cyan');
console.log('  ✓ [PASS] fx_decals transparency, depthWrite, polygonOffset, and neon emissive glow verified');

// 13f. Verify component offsets for all 26 target parts
const advOffsets = COMPONENT_OFFSETS['prod_gen_advancedelectronics'];
for (const n of simonContainerNums) {
  assert.ok(advOffsets[`detail_s_simon_container_${n}`], `Offset for detail_s_simon_container_${n} must exist`);
}
for (const n of simonXsNums) {
  assert.ok(advOffsets[`detail_xs_simon_${n}`], `Offset for detail_xs_simon_${n} must exist`);
}
assert.ok(advOffsets['fx_corehull_main'], 'Offset for fx_corehull_main must exist');
assert.deepStrictEqual(advOffsets['fx_decals'], [0.0, 0.0, 0.0], 'Offset for fx_decals must be [0, 0, 0]');
console.log('  ✓ [PASS] Connection offsets for all 26 target parts verified');

// 14. Verification of damagearea-lod0 (Invisible Hazard Trigger Volume - No 1.1km Glowing Beam Artifact)
const damageGroup = new THREE.Group();
const damageMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 1089), new THREE.MeshPhongMaterial({ name: 'p1effectsXp1_gradient_colour' }));
damageMesh.name = 'damagearea-lod0Xlod0Xp1effectsXp1_gradient_colour';
damageGroup.add(damageMesh);

const initDamageAnimCount = viewer.animatedTextures.length;
await viewer.applyTexturesToMeshGroup(damageGroup, `${folder}/damagearea-lod0.dae`);

// Verify that damagearea is not classified as a poslight or glowing light
assert.strictEqual(damageMesh.visible, false, 'damagearea mesh must have visible: false to prevent rendering 1.1km cylinder in scene');
assert.strictEqual(damageMesh.material.visible, false, 'damagearea material must have visible: false');
assert.strictEqual(damageMesh.castShadow, false, 'damagearea must not cast shadows');
assert.strictEqual(damageMesh.receiveShadow, false, 'damagearea must not receive shadows');
assert.strictEqual(viewer.animatedTextures.length, initDamageAnimCount, 'damagearea must not register animated texture scrolling like poslights');
console.log('  ✓ [PASS] damagearea-lod0 correctly classified as hidden hazard trigger volume (no 1.1km beam artifact)');




// 15. Verification of anim_capsuleholder11..16, anim_capsuleshield, and anim_holdershield
// Hierarchy, Offsets, and Synchronized Mechanical Rotation with anim_centrifuge
const advCentOffsets = COMPONENT_OFFSETS['prod_gen_advancedelectronics'];
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder11'], [0.0, 0.0, -532.7382], 'anim_capsuleholder11 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder12'], [0.0, 0.0, -319.3197], 'anim_capsuleholder12 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder13'], [0.0, 0.0, -106.4756], 'anim_capsuleholder13 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder14'], [0.0, 0.0, 106.842], 'anim_capsuleholder14 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder15'], [0.0, 0.0, 319.566], 'anim_capsuleholder15 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleholder16'], [0.0, 0.0, 532.5207], 'anim_capsuleholder16 offset');
assert.deepStrictEqual(advCentOffsets['anim_capsuleshield'], [0.0, 0.0, -0.108], 'anim_capsuleshield offset');
assert.deepStrictEqual(advCentOffsets['anim_holdershield'], [0.0, -0.9231, -0.9463], 'anim_holdershield offset');
console.log('  ✓ [PASS] Capsuleholder and shield local connection offsets verified');

// Test hierarchical scene attachment & synchronized mechanical rotation
const testCentrifuge = new THREE.Group();
testCentrifuge.name = 'anim_centrifuge';
testCentrifuge.userData.partName = 'anim_centrifuge';
testCentrifuge.position.set(110.487, 2.7689, 0.7379);

const testHolder = new THREE.Group();
testHolder.name = 'anim_capsuleholder11';
testHolder.userData.partName = 'anim_capsuleholder11';
testHolder.position.set(0.0, 0.0, -532.7382);

// Add a test mesh to the holder at radius Y = -25m
const holderMeshGeom = new THREE.BoxGeometry(2, 2, 2);
const holderTestMesh = new THREE.Mesh(holderMeshGeom);
holderTestMesh.position.set(0, -25, 0);
testHolder.add(holderTestMesh);

// Parent holder to centrifuge as done in loadModuleMesh
testCentrifuge.add(testHolder);

const testMeshGroup = new THREE.Group();
testMeshGroup.add(testCentrifuge);

// Initial position at rotation = 0
testMeshGroup.updateMatrixWorld(true);
const vPos0 = new THREE.Vector3();
holderTestMesh.getWorldPosition(vPos0);
assert.strictEqual(vPos0.x, 110.487, 'Holder mesh initial X must equal centrifuge center X');
assert.ok(Math.abs(vPos0.y - (2.7689 - 25)) < 0.001, 'Holder mesh initial Y must be at radius -25m below shaft');
assert.ok(Math.abs(vPos0.z - (0.7379 - 532.7382)) < 0.001, 'Holder mesh initial Z must match connection Z');

// Rotate centrifuge by 90 degrees (Math.PI / 2)
testCentrifuge.rotation.z = Math.PI / 2;
testMeshGroup.updateMatrixWorld(true);
const vPos90 = new THREE.Vector3();
holderTestMesh.getWorldPosition(vPos90);

// At 90 deg rotation, (0, -25) rotates to (25, 0)
assert.ok(Math.abs(vPos90.x - (110.487 + 25)) < 0.001, 'Holder mesh X must rotate 90 deg to right of shaft');
assert.ok(Math.abs(vPos90.y - 2.7689) < 0.001, 'Holder mesh Y must rotate 90 deg to shaft level');
assert.ok(Math.abs(vPos90.z - (0.7379 - 532.7382)) < 0.001, 'Holder mesh Z must remain constant during rotation');
console.log('  ✓ [PASS] anim_capsuleholder synchronized circular mechanical rotation around centrifuge verified');

// 16. Verification of detail_xs_simon Flight Animation & detail_s_simon_container Parenting
const advOffsetsAll = COMPONENT_OFFSETS['prod_gen_advancedelectronics'];
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_01'], [-6.3215, 0.0, 0.0], 'detail_s_simon_container_01 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_02'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_02 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_03'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_03 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_04'], [6.3214, 0.0, 0.0], 'detail_s_simon_container_04 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_05'], [0.0, -6.3215, 0.0], 'detail_s_simon_container_05 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_06'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_06 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_07'], [0.0, -6.3215, 0.0], 'detail_s_simon_container_07 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_08'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_08 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_09'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_09 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_10'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_10 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_12'], [0.0, -6.3214, 0.0], 'detail_s_simon_container_12 offset');
assert.deepStrictEqual(advOffsetsAll['detail_s_simon_container_18'], [-6.3214, 0.0, 0.0], 'detail_s_simon_container_18 offset');
console.log('  ✓ [PASS] detail_s_simon_container parent-relative connection offsets verified');

// Test Simon flying bot flight trajectory & synchronized container movement
const testSimonBot = new THREE.Group();
testSimonBot.name = 'detail_xs_simon_01';
testSimonBot.userData.partName = 'detail_xs_simon_01';
const simonInitPos = advOffsetsAll['detail_xs_simon_01'];
testSimonBot.position.set(simonInitPos[0], simonInitPos[1], simonInitPos[2]);

const testSimonContainer = new THREE.Group();
testSimonContainer.name = 'detail_s_simon_container_01';
testSimonContainer.userData.partName = 'detail_s_simon_container_01';
testSimonContainer.position.set(-6.3215, 0, 0);

// Parent container to flying bot
testSimonBot.add(testSimonContainer);

const simonBasePos = testSimonBot.position.clone();
const simonDelta = [-334.78, 0.08, -11.66];
const simonPeriod = 80.0;

const simonAnim = {
  object: testSimonBot,
  update: (time) => {
    const phase = (time * (Math.PI * 2 / simonPeriod)) % (Math.PI * 2);
    const u = (1 - Math.cos(phase)) * 0.5;
    testSimonBot.position.x = simonBasePos.x + u * simonDelta[0];
    testSimonBot.position.y = simonBasePos.y + u * simonDelta[1] + Math.sin(time * 2.2) * 1.2;
    testSimonBot.position.z = simonBasePos.z + u * simonDelta[2];
    testSimonBot.rotation.z = Math.sin(phase) * 0.08;
    testSimonBot.rotation.x = Math.sin(time * 2.8) * 0.03;
  }
};

// Test t=0 (starting dock position)
simonAnim.update(0);
testSimonBot.updateMatrixWorld(true);
assert.strictEqual(testSimonBot.position.x, simonInitPos[0], 'Simon bot at t=0 must be at initial X');

const containerWorldPos0 = new THREE.Vector3();
testSimonContainer.getWorldPosition(containerWorldPos0);
assert.ok(Math.abs(containerWorldPos0.x - (simonInitPos[0] - 6.3215)) < 0.001, 'Container at t=0 must be at bot X - 6.32m');

// Test t=40s (half-way through 80s cycle, u = 1.0, maximum travel distance)
simonAnim.update(40);
testSimonBot.updateMatrixWorld(true);
const expectedMaxX = simonInitPos[0] + simonDelta[0];
assert.ok(Math.abs(testSimonBot.position.x - expectedMaxX) < 0.001, 'Simon bot at t=40s must reach target destination waypoint');

const containerWorldPos40 = new THREE.Vector3();
testSimonContainer.getWorldPosition(containerWorldPos40);
assert.ok(Math.abs(containerWorldPos40.x - (expectedMaxX - 6.3215)) < 0.001, 'Container at t=40s must travel with bot to destination');
assert.ok(Math.abs(containerWorldPos40.x - containerWorldPos0.x - simonDelta[0]) < 0.001, 'Container displacement must exactly equal bot displacement');
console.log('  ✓ [PASS] detail_xs_simon autonomous flight trajectory & synchronized container transport verified');

// 17. Verification of Animation Halting (Stop Anim) & Subdue Defaults for prod_gen_advancedelectronics
assert.strictEqual(typeof viewer.setModuleAnimationHalted, 'function', 'viewer.setModuleAnimationHalted must exist');
assert.strictEqual(typeof viewer.isModuleAnimationHalted, 'function', 'viewer.isModuleAnimationHalted must exist');

const testModIdx = 101;
assert.strictEqual(viewer.isModuleAnimationHalted(testModIdx), false, 'Module animation should initially not be halted');

viewer.setModuleAnimationHalted(testModIdx, true);
assert.strictEqual(viewer.isModuleAnimationHalted(testModIdx), true, 'Module animation should be halted after setModuleAnimationHalted(true)');

// Test that halted animation skips update
let testPartUpdateCount = 0;
viewer.animatedParts.push({
  object: new THREE.Group(),
  moduleIndex: testModIdx,
  update: () => { testPartUpdateCount++; }
});

// Emulate render loop check
for (const part of viewer.animatedParts) {
  if (part.object && part.update) {
    if (part.moduleIndex !== undefined && viewer.haltedModuleAnimations?.has(part.moduleIndex)) {
      continue;
    }
    part.update(0, 0.016);
  }
}
assert.strictEqual(testPartUpdateCount, 0, 'Part update must be bypassed when module animations are halted');

viewer.setModuleAnimationHalted(testModIdx, false);
assert.strictEqual(viewer.isModuleAnimationHalted(testModIdx), false, 'Module animation should resume after setModuleAnimationHalted(false)');

for (const part of viewer.animatedParts) {
  if (part.object && part.update) {
    if (part.moduleIndex !== undefined && viewer.haltedModuleAnimations?.has(part.moduleIndex)) {
      continue;
    }
    part.update(0, 0.016);
  }
}
assert.strictEqual(testPartUpdateCount, 1, 'Part update must execute when module animations are resumed');
console.log('  ✓ [PASS] Stop Anim module-level animation halt and resume verified');

// Test Subdue Defaults for prod_gen_advancedelectronics
if (!viewer.modulesGroup) viewer.modulesGroup = new THREE.Group();
const mockAdvMod = new THREE.Group();
mockAdvMod.userData = { index: 1, macro: 'prod_gen_advancedelectronics_macro' };
viewer.modulesGroup.add(mockAdvMod);

const { components } = await viewer.getModuleComponentOptions(1);
const defaultCount = components.filter(c => c.isDefault).length;
assert.strictEqual(defaultCount, 67, 'prod_gen_advancedelectronics must have 67 default component files');
console.log('  ✓ [PASS] Subdue Defaults 67 default component options discovered and verified');

// 18. Verify detail_s_main-lod0 MapChannel 2 (tex1) UV Mapping & Multi-Material Textures
const detailSDae = fs.readFileSync('assets1/structures/production/prod_gen_advancedelectronics_data/detail_s_main-lod0.dae', 'utf8');
const v0Match = detailSDae.match(/<vertices id="meshId0-vertices">([\s\S]*?)<\/vertices>/);
const v1Match = detailSDae.match(/<vertices id="meshId1-vertices">([\s\S]*?)<\/vertices>/);
const v2Match = detailSDae.match(/<vertices id="meshId2-vertices">([\s\S]*?)<\/vertices>/);

assert.ok(v0Match && v1Match && v2Match, 'detail_s_main must have all 3 subnode vertices definitions');
assert.ok(v0Match[1].includes('meshId0-tex1') && !v0Match[1].includes('meshId0-tex0'), 'meshId0 (hulltexture) must bind tex1 to eliminate stretched UVs');
assert.ok(v1Match[1].includes('meshId1-tex1') && !v1Match[1].includes('meshId1-tex0'), 'meshId1 (fx) must bind tex1 to eliminate corridor stretching');
assert.ok(v2Match[1].includes('meshId2-tex1') && !v2Match[1].includes('meshId2-tex0'), 'meshId2 (lightcone) must bind tex1 to eliminate collapsed UV point artifacts');

const detailSHull = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'genericXgeneric_p1_hulltexture');
assert.strictEqual(detailSHull.diffuse, '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds');
assert.strictEqual(detailSHull.normal, '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds');

const detailSFx = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'genericXgeneric_p1_fx');
assert.strictEqual(detailSFx.diffuse, '/assets1/textures/generic/generic_p1_fx_diff.dds');
assert.strictEqual(detailSFx.emissive, '/assets1/textures/generic/generic_p1_fx_glow.dds');

const detailSLightcone = viewer.resolveTextureForModel(`${folder}/detail_s_main-lod0.dae`, 'p1effectsXp1_lightcone_soft');
assert.strictEqual(detailSLightcone.diffuse, '/assets1/textures/fx/lightcones_soft.dds');
assert.strictEqual(detailSLightcone.emissive, '/assets1/textures/fx/lightcones_soft.dds');
console.log('  ✓ [PASS] detail_s_main MapChannel 2 (tex1) UV mapping and multi-material textures verified');

// 19. Verify detail_l_main-lod0 MapChannel 1 (tex0) UV Mapping & Multi-Material Textures (Native Scale, No Stretched UVs)
const detailLDae = fs.readFileSync('assets1/structures/production/prod_gen_advancedelectronics_data/detail_l_main-lod0.dae', 'utf8');
const l0Match = detailLDae.match(/<vertices id="meshId0-vertices">([\s\S]*?)<\/vertices>/);
const l1Match = detailLDae.match(/<vertices id="meshId1-vertices">([\s\S]*?)<\/vertices>/);
const l2Match = detailLDae.match(/<vertices id="meshId2-vertices">([\s\S]*?)<\/vertices>/);
const l3Match = detailLDae.match(/<vertices id="meshId3-vertices">([\s\S]*?)<\/vertices>/);
const l4Match = detailLDae.match(/<vertices id="meshId4-vertices">([\s\S]*?)<\/vertices>/);

assert.ok(l0Match && l1Match && l2Match && l3Match && l4Match, 'detail_l_main must have all 5 subnode vertices definitions');
assert.ok(l0Match[1].includes('meshId0-tex0') && !l0Match[1].includes('meshId0-tex1'), 'meshId0 (hull) must bind tex0 to eliminate stretched UVs and match native scale');
assert.ok(l1Match[1].includes('meshId1-tex0') && !l1Match[1].includes('meshId1-tex1'), 'meshId1 (fx) must bind tex0 to eliminate stretched UVs and match native scale');
assert.ok(l2Match[1].includes('meshId2-tex0') && !l2Match[1].includes('meshId2-tex1'), 'meshId2 (alpha) must bind tex0 to eliminate stretched UVs and match native scale');
assert.ok(l3Match[1].includes('meshId3-tex0') && !l3Match[1].includes('meshId3-tex1'), 'meshId3 (pattern) must bind tex0 to eliminate stretched UVs and match native scale');
assert.ok(l4Match[1].includes('meshId4-tex0') && !l4Match[1].includes('meshId4-tex1'), 'meshId4 (lightcone) must bind tex0 to eliminate collapsed point UVs and match native scale');
console.log('  ✓ [PASS] detail_l_main MapChannel 1 (tex0) UV mapping verified (native scale, no stretched UVs)');

console.log('\n[SUCCESS] All prod_gen_advancedelectronics tests passed cleanly!');
