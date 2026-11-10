import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing struct_arg_cross_01 Billboard Parameters & Matching In-Game Capture...');

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.colladaCache = new Map();
viewer.modulesGroup = new THREE.Group();
viewer.scene = new THREE.Scene();
viewer.renderScene = () => {};
const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
viewer.colladaLoader = new ColladaLoader();
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;
viewer.getRaceHullColor = StationViewer.prototype.getRaceHullColor;
viewer.resolveTextureForModel = StationViewer.prototype.resolveTextureForModel;
viewer.applyTexturesToMeshGroup = StationViewer.prototype.applyTexturesToMeshGroup;
viewer.loadColladaModel = StationViewer.prototype.loadColladaModel;
viewer.loadModuleMesh = StationViewer.prototype.loadModuleMesh;
viewer.resolveModuleAssetEntry = StationViewer.prototype.resolveModuleAssetEntry;
viewer.getModuleActiveComponentFiles = StationViewer.prototype.getModuleActiveComponentFiles;
viewer.setBillboardState = StationViewer.prototype.setBillboardState;
viewer.getBillboardState = StationViewer.prototype.getBillboardState;
viewer.hasModuleBillboards = StationViewer.prototype.hasModuleBillboards;
viewer.updateAnimatedParts = StationViewer.prototype.updateAnimatedParts;

const dummyTexture = new THREE.Texture();
dummyTexture.offset = new THREE.Vector2(0, 0);
const requestedTextures = [];
viewer.loadDdsTexture = async (url) => { requestedTextures.push(url); return dummyTexture; };

// 1. Verify Texture Atlas Resolution for Cross Modules
console.log('  [1] Verifying billboard texture resolution for connection cross modules...');
const crossResolutionTests = [
  {
    desc: 'Argon Cross 01 anim_arrows',
    url: '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Paranid Cross 01 anim_arrows',
    url: '/assets1/structures/connectionmodules/struct_par_cross_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  },
  {
    desc: 'Teladi Cross 01 anim_arrows',
    url: '/assets1/structures/connectionmodules/struct_tel_cross_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  }
];

for (const tc of crossResolutionTests) {
  const resolved = viewer.resolveTextureForModel(tc.url, tc.mat);
  assert.strictEqual(resolved.diffuse, tc.expected, `${tc.desc}: expected ${tc.expected}, got ${resolved.diffuse}`);
  console.log(`    ✓ ${tc.desc}: resolved diffuse -> ${resolved.diffuse}`);
}

// 2. Verify Material Vertex Colors, Emissive Shaders & Static Isolation
console.log('  [2] Verifying vertex color modulation, emissive shaders & static isolation on struct_arg_cross_01...');
const scene = await viewer.loadColladaModel('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae');
assert.ok(scene, 'struct_arg_cross_01 anim_arrows scene must load');

let arrowMesh = null;
scene.traverse((child) => {
  if (child.isMesh && child.name.includes('anim_arrows')) {
    arrowMesh = child;
  }
});
assert.ok(arrowMesh, 'anim_arrows mesh must exist in struct_arg_cross_01');

// Verify geometry attributes and quads
assert.strictEqual(arrowMesh.geometry.attributes.position.count, 264, 'Mesh must preserve all 44 quads (264 vertices)');
assert.ok(arrowMesh.geometry.attributes.color, 'Mesh must preserve authored vertex colors');

// Check Medical Cross Quad (Q36 / Q37) Vertex Color: Neon lime green [0.71, 1.00, 0.00]
const colorAttr = arrowMesh.geometry.attributes.color;
const stride = colorAttr.itemSize;
const colors = colorAttr.array;
const q36Start = 36 * 6 * stride;
const r = colors[q36Start];
const g = colors[q36Start + 1];
const b = colors[q36Start + 2];
// Verify Medical Cross (Q36/Q37), Info (Q38/Q39), Food (Q40/Q41), and Tools (Q42/Q43) vertex colors
const getQuadColor = (q) => {
  const idx = q * 6 * stride;
  return [colors[idx], colors[idx + 1], colors[idx + 2]];
};

const crossCol = getQuadColor(36);
assert.ok(Math.abs(crossCol[0] - 0.71) < 0.05, `Medical Cross R ~0.71, got ${crossCol[0]}`);
assert.ok(Math.abs(crossCol[1] - 1.00) < 0.05, `Medical Cross G ~1.00, got ${crossCol[1]}`);
assert.ok(Math.abs(crossCol[2] - 0.00) < 0.05, `Medical Cross B ~0.00, got ${crossCol[2]}`);
console.log(`    ✓ Verified Medical Cross quad vertex color: [${crossCol.map(c => c.toFixed(2)).join(', ')}] (matches Cross - Green.png)`);

const infoCol = getQuadColor(38);
assert.ok(Math.abs(infoCol[1] - 1.00) < 0.05, `Info G ~1.00, got ${infoCol[1]}`);
console.log(`    ✓ Verified Info quad vertex color: [${infoCol.map(c => c.toFixed(2)).join(', ')}] (Lime Green)`);

const foodCol = getQuadColor(40);
assert.ok(Math.abs(foodCol[0] - 1.00) < 0.05, `Food R ~1.00, got ${foodCol[0]}`);
assert.ok(Math.abs(foodCol[1] - 0.28) < 0.05, `Food G ~0.28, got ${foodCol[1]}`);
console.log(`    ✓ Verified Burger & Drink quad vertex color: [${foodCol.map(c => c.toFixed(2)).join(', ')}] (Amber/Orange)`);

const toolCol = getQuadColor(42);
assert.ok(Math.abs(toolCol[1] - 1.00) < 0.05, `Tools G ~1.00, got ${toolCol[1]}`);
assert.ok(Math.abs(toolCol[2] - 0.59) < 0.05, `Tools B ~0.59, got ${toolCol[2]}`);
console.log(`    ✓ Verified Repair Tools quad vertex color: [${toolCol.map(c => c.toFixed(2)).join(', ')}] (Teal/Cyan)`);

// Apply textures
viewer.animatedTextures = [];
await viewer.applyTexturesToMeshGroup(
  scene,
  '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae',
  10
);

// Verify material parameters
const mat = arrowMesh.material;
assert.strictEqual(mat.vertexColors, true, 'Material must enable vertexColors');
assert.strictEqual(mat.emissiveIntensity, 1.0, 'Billboard display emissiveIntensity must be 1.0');
assert.strictEqual(mat.emissive.getHexString(), 'ffffff', 'Billboard display emissive color must be 0xffffff');
assert.ok(typeof mat.onBeforeCompile === 'function', 'Material must have onBeforeCompile shader hook');

// Verify shader modulation
const mockShader = {
  fragmentShader: '#include <emissivemap_fragment>\n'
};
mat.onBeforeCompile(mockShader);
assert.ok(
  mockShader.fragmentShader.includes('totalEmissiveRadiance *= vColor.rgb;'),
  'Fragment shader must multiply totalEmissiveRadiance by vColor.rgb'
);
console.log('    ✓ Verified shader hook multiplies totalEmissiveRadiance by vColor.rgb for authored icon glow');

const mapShader = {
  fragmentShader: '#include <map_fragment>\n'
};
mat.onBeforeCompile(mapShader);
assert.ok(
  mapShader.fragmentShader.includes('arrowLuma'),
  'Fragment shader must make black transparent in anim_arrows via arrowLuma'
);
console.log('    ✓ Verified shader hook makes black background transparent in anim_arrows');

// No continuous scroll scrambling the signs: only X4's keyframed toggle from struct_arg_cross_01.xml
// (map channel 1 u_offset 0 -> 0.25 -> 0 over 200 frames), on the arrows' own texture copy
assert.strictEqual(viewer.animatedTextures.filter(t => t.speedX || t.speedY).length, 0, 'no continuous scroll on the arrows');
const arrowToggle = viewer.animatedTextures.filter(t => t.uvTracks);
assert.strictEqual(arrowToggle.length, 1, 'one keyframed arrow toggle');
assert.deepStrictEqual(arrowToggle[0].uvTracks.u, [[0, 0], [95, 0], [100, 0.25], [195, 0.25], [200, 0]]);
console.log('    ✓ struct_arg_cross_01 arrows: no continuous scroll, only the X4 keyframed toggle');

// Verify isolated billboard sub-meshes: all 8 commercial sub-meshes defined
assert.ok(arrowMesh.userData.isolatedBillboards, 'arrowMesh must isolate billboard sub-meshes');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_cross, 'Medical Cross billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_capsule, 'Capsule billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_info, 'Info billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_shopping_cart, 'Shopping Cart billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_food, 'Food billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_bed, 'Bed billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_tools, 'Tools billboard must be isolated');
assert.ok(arrowMesh.userData.isolatedBillboards.billboard_law, 'Law billboard must be isolated');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.physicalSigns.length, 4, 'Must define 4 physical double-sided signs');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.sign1, arrowMesh.userData.isolatedBillboards.billboard_cross, 'sign1 must alias Sign 1');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.sign2, arrowMesh.userData.isolatedBillboards.billboard_info, 'sign2 must alias Sign 2');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.sign3, arrowMesh.userData.isolatedBillboards.billboard_food, 'sign3 must alias Sign 3');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.sign4, arrowMesh.userData.isolatedBillboards.billboard_tools, 'sign4 must alias Sign 4');

// Verify physicalSigns array definition and backing screen linkage specification
const ps = arrowMesh.userData.isolatedBillboards.physicalSigns;
assert.strictEqual(ps.length, 4, 'Must define 4 physical double-sided signs');
const expectedSigns = [
  { signIndex: 1, quads: [36, 37], stateA: 'billboard_cross', stateB: 'billboard_capsule', backingName: 'bg_cross', backingQuads: [10, 11, 12] },
  { signIndex: 2, quads: [38, 39], stateA: 'billboard_info', stateB: 'billboard_shopping_cart', backingName: 'bg_info', backingQuads: [13, 14, 15] },
  { signIndex: 3, quads: [40, 41], stateA: 'billboard_food', stateB: 'billboard_bed', backingName: 'bg_food', backingQuads: [16, 17, 18] },
  { signIndex: 4, quads: [42, 43], stateA: 'billboard_tools', stateB: 'billboard_law', backingName: 'bg_tools', backingQuads: [19, 20, 21] }
];
for (let i = 0; i < 4; i++) {
  const sign = ps[i];
  const exp = expectedSigns[i];
  assert.strictEqual(sign.signIndex, exp.signIndex, `Sign ${i+1} signIndex must match`);
  assert.deepStrictEqual(sign.quads, exp.quads, `Sign ${i+1} quads must match ${exp.quads}`);
  assert.strictEqual(sign.stateA, arrowMesh.userData.isolatedBillboards[exp.stateA], `Sign ${i+1} stateA must match ${exp.stateA}`);
  assert.strictEqual(sign.stateB, arrowMesh.userData.isolatedBillboards[exp.stateB], `Sign ${i+1} stateB must match ${exp.stateB}`);
  assert.strictEqual(sign.backingName, exp.backingName, `Sign ${i+1} backingName must match ${exp.backingName}`);
  assert.deepStrictEqual(sign.backingQuads, exp.backingQuads, `Sign ${i+1} backingQuads must match ${exp.backingQuads}`);
  assert.ok(sign.mesh, `Sign ${i+1} active display mesh must be defined`);
  assert.strictEqual(sign.mesh.material.transparent, true, `Sign ${i+1} material must be transparent`);
  assert.strictEqual(sign.mesh.material.depthWrite, false, `Sign ${i+1} material depthWrite must be false`);
  assert.strictEqual(sign.mesh.material.alphaTest, 0.05, `Sign ${i+1} material alphaTest must be 0.05`);
  assert.strictEqual(sign.mesh.renderOrder, 2, `Sign ${i+1} renderOrder must be 2 (rendered after backing screen)`);
}
console.log('    ✓ Verified all 8 isolated billboard sub-meshes and 4 physical double-sided signs (Quads 36..43)');

// Verify UV ranges for all 8 billboard sub-meshes on ads_billboard_02_diff.dds
const expectedCells = [
  { name: 'billboard_cross', uMin: 0.00, uMax: 0.25, vMin: 0.50, vMax: 0.75 },
  { name: 'billboard_capsule', uMin: 0.25, uMax: 0.50, vMin: 0.50, vMax: 0.75 },
  { name: 'billboard_info', uMin: 0.75, uMax: 1.00, vMin: 0.50, vMax: 0.75 },
  { name: 'billboard_shopping_cart', uMin: 0.00, uMax: 0.25, vMin: 0.75, vMax: 1.00 },
  { name: 'billboard_food', uMin: 0.50, uMax: 0.75, vMin: 0.50, vMax: 0.75 },
  { name: 'billboard_bed', uMin: 0.25, uMax: 0.50, vMin: 0.75, vMax: 1.00 },
  { name: 'billboard_tools', uMin: 0.75, uMax: 1.00, vMin: 0.75, vMax: 1.00 },
  { name: 'billboard_law', uMin: 0.50, uMax: 0.75, vMin: 0.75, vMax: 1.00 }
];

for (const exp of expectedCells) {
  const mesh = arrowMesh.userData.isolatedBillboards[exp.name];
  assert.ok(mesh, `${exp.name} must exist`);
  const uvs = mesh.geometry.attributes.uv.array;
  for (let i = 0; i < uvs.length; i += 2) {
    const u = uvs[i];
    const v = uvs[i + 1];
    assert.ok(u >= exp.uMin - 0.01 && u <= exp.uMax + 0.01, `${exp.name} U out of range [${exp.uMin}, ${exp.uMax}]: got ${u}`);
    assert.ok(v >= exp.vMin - 0.01 && v <= exp.vMax + 0.01, `${exp.name} V out of range [${exp.vMin}, ${exp.vMax}]: got ${v}`);
  }
}
console.log('    ✓ Verified exact UV cell coordinates for all 8 sub-meshes on ads_billboard_02_diff.dds atlas');

// 3. Verify anim_cross Background Matrix Screen & Vertical Green Striping
console.log('  [3] Verifying anim_cross background matrix screens & animated green striping...');
const crossScene = await viewer.loadColladaModel('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_cross-lod0.dae');
assert.ok(crossScene, 'struct_arg_cross_01 anim_cross scene must load');

let crossBgMesh = null;
crossScene.traverse((child) => {
  if (child.isMesh && child.name.includes('anim_cross')) {
    crossBgMesh = child;
  }
});
assert.ok(crossBgMesh, 'anim_cross mesh must exist in struct_arg_cross_01');
assert.strictEqual(crossBgMesh.geometry.attributes.position.count, 132, 'Mesh must preserve all 22 quads (132 vertices)');

// Apply textures to anim_cross
viewer.animatedTextures = [];
await viewer.applyTexturesToMeshGroup(
  crossScene,
  '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_cross-lod0.dae',
  10
);

// Verify isolated background screens
assert.ok(crossBgMesh.userData.isolatedBackgrounds, 'crossBgMesh must isolate background screen sub-meshes');
assert.ok(crossBgMesh.userData.isolatedBackgrounds.bg_cross, 'bg_cross matrix screen must be isolated');
assert.ok(crossBgMesh.userData.isolatedBackgrounds.bg_info, 'bg_info matrix screen must be isolated');
assert.ok(crossBgMesh.userData.isolatedBackgrounds.bg_food, 'bg_food matrix screen must be isolated');
assert.ok(crossBgMesh.userData.isolatedBackgrounds.bg_tools, 'bg_tools matrix screen must be isolated');
console.log('    ✓ Verified isolated background matrix sub-meshes (bg_cross, bg_info, bg_food, bg_tools)');

// Verify bg_cross UV mapping on tex2 (mapchannel 3)
const bgCross = crossBgMesh.userData.isolatedBackgrounds.bg_cross;
const bgUvs = bgCross.geometry.attributes.uv.array;
let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
for (let i = 0; i < bgUvs.length; i += 2) {
  minU = Math.min(minU, bgUvs[i]); maxU = Math.max(maxU, bgUvs[i]);
  minV = Math.min(minV, bgUvs[i + 1]); maxV = Math.max(maxV, bgUvs[i + 1]);
}
assert.ok(minU < 0.0 && maxU > 1.0, `bg_cross U must span matrix repeat range (~[-0.6, 1.6]), got [${minU}, ${maxU}]`);
assert.ok(minV < -5.0 && maxV > 4.0, `bg_cross V must span matrix repeat range (~[-6.5, 5.3]), got [${minV}, ${maxV}]`);
console.log(`    ✓ Verified bg_cross matrix UV range: U=[${minU.toFixed(2)}, ${maxU.toFixed(2)}], V=[${minV.toFixed(2)}, ${maxV.toFixed(2)}]`);

// Verify emerald green vertex color on bg_cross
const bgCol = bgCross.geometry.attributes.color.array;
const bgR = bgCol[0];
const bgG = bgCol[1];
const bgB = bgCol[2];
assert.ok(Math.abs(bgR - 0.33) < 0.05, `bg_cross R ~0.33, got ${bgR}`);
assert.ok(Math.abs(bgG - 0.47) < 0.05, `bg_cross G ~0.47, got ${bgG}`);
assert.ok(Math.abs(bgB - 0.00) < 0.05, `bg_cross B ~0.00, got ${bgB}`);
console.log(`    ✓ Verified bg_cross emerald green vertex color: [${bgR.toFixed(2)}, ${bgG.toFixed(2)}, ${bgB.toFixed(2)}]`);

// Verify animated green striping registered
assert.ok(viewer.animatedTextures.length > 0, 'Vertical scanline animation must be registered');
// The screens' gradient layer plays anim_cross's own UV animation from struct_arg_cross_01.xml
// (map channel 3: v_offset 0 -> -4 over 100 frames), in step with the arrow reveal
await new Promise(r => setTimeout(r, 50)); // the component file is read asynchronously
const animEntry = viewer.animatedTextures.find(a => a.uvTracks && a.uvTracks.v && a.loopFrames === 100);
assert.ok(animEntry, 'screens play the component channel 3 animation');
assert.deepEqual(animEntry.uvTracks.v, [[0, 0], [100, -4]]); // the file writes the first key as -0
assert.strictEqual(animEntry.loopFrames, 100);
console.log('    ✓ screens scroll with the anim_cross X4 keyframes (v 0 -> -4 per 100 frames)');

// Verify background matrix material transparency & render ordering
assert.strictEqual(bgCross.material.transparent, true, 'bg_cross material must be transparent');
assert.strictEqual(bgCross.material.depthWrite, false, 'bg_cross material depthWrite must be false');
assert.strictEqual(bgCross.renderOrder, 1, 'bg_cross renderOrder must be 1 (rendered before foreground sign)');
// Drawn like X4's ads_p1_billboardtrims material: unlit and additive, vertex colour times the gradient layer
assert.ok(bgCross.material.isMeshBasicMaterial, 'bg_cross is unlit (p1_complex_unlit)');
assert.strictEqual(bgCross.material.blending, THREE.AdditiveBlending, 'bg_cross blends additively (blendmode ADDITIVE)');
assert.strictEqual(bgCross.material.vertexColors, true, 'bg_cross takes its colour from the vertex colours');
assert.strictEqual(bgCross.material.toneMapped, false);
assert.ok(requestedTextures.includes('/assets1/textures/fx/gradient_wave_01_diff.dds'), "the screens use the material's gradient_wave layer texture");
assert.ok(!requestedTextures.includes('/assets1/textures/ad_signs/ads_bg_trims.dds'), 'not ads_bg_trims, which this material does not use');
console.log('    ✓ bg_cross drawn unlit and additive, vertex colour times the gradient wave layer');

// 4. Verify 3D Alignment Between Foreground Physical Signs and Background Matrix Screens
console.log('  [4] Verifying 3D spatial alignment between all 4 physical signs and background matrix screens...');
const signBgPairs = [
  { sign: arrowMesh.userData.isolatedBillboards.billboard_cross, bg: crossBgMesh.userData.isolatedBackgrounds.bg_cross, name: 'Sign 1 (Medical Cross) -> bg_cross' },
  { sign: arrowMesh.userData.isolatedBillboards.billboard_info, bg: crossBgMesh.userData.isolatedBackgrounds.bg_info, name: 'Sign 2 (Info) -> bg_info' },
  { sign: arrowMesh.userData.isolatedBillboards.billboard_food, bg: crossBgMesh.userData.isolatedBackgrounds.bg_food, name: 'Sign 3 (Food) -> bg_food' },
  { sign: arrowMesh.userData.isolatedBillboards.billboard_tools, bg: crossBgMesh.userData.isolatedBackgrounds.bg_tools, name: 'Sign 4 (Tools) -> bg_tools' }
];

for (const pair of signBgPairs) {
  pair.sign.geometry.computeBoundingBox();
  pair.bg.geometry.computeBoundingBox();
  const sc = new THREE.Vector3();
  const bc = new THREE.Vector3();
  pair.sign.geometry.boundingBox.getCenter(sc);
  pair.bg.geometry.boundingBox.getCenter(bc);
  const dist = sc.distanceTo(bc);
  assert.ok(dist < 5.0, `${pair.name} distance must be < 5.0m, got ${dist.toFixed(2)}m`);
  console.log(`    ✓ ${pair.name} center distance: ${dist.toFixed(2)}m (directly behind sign)`);
}

// 5. Verify Billboard Cycling Animation Between State A and State B
console.log('  [5] Verifying 200-frame cycle billboard animation between State A and State B...');
assert.ok(typeof arrowMesh.userData.setBillboardState === 'function', 'setBillboardState function must exist on arrowMesh.userData');

// State A checks:
arrowMesh.userData.setBillboardState('A');
assert.strictEqual(arrowMesh.userData.currentBillboardState, 'A', 'Current state must be A');
assert.strictEqual(arrowMesh.geometry.drawRange.count, 216, 'arrowMesh drawRange must be 216 (quads 0..35 chevrons only, no billboards)');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_cross.visible, true, 'billboard_cross must be visible in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_info.visible, true, 'billboard_info must be visible in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_food.visible, true, 'billboard_food must be visible in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_tools.visible, true, 'billboard_tools must be visible in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_capsule.visible, false, 'billboard_capsule must be hidden in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_shopping_cart.visible, false, 'billboard_shopping_cart must be hidden in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_bed.visible, false, 'billboard_bed must be hidden in State A');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_law.visible, false, 'billboard_law must be hidden in State A');
const uvsA = arrowMesh.geometry.attributes.uv.array;
// Sign 1 (Quads 36, 37): Cross U in [0.00, 0.25], V in [0.50, 0.75]
for (const q of [36, 37]) {
  for (let v = 0; v < 6; v++) {
    const u = uvsA[(q * 6 + v) * 2];
    const valV = uvsA[(q * 6 + v) * 2 + 1];
    assert.ok(u >= -0.01 && u <= 0.26, `State A Q${q} U out of bounds: ${u}`);
    assert.ok(valV >= 0.49 && valV <= 0.76, `State A Q${q} V out of bounds: ${valV}`);
  }
}
console.log('    ✓ State A Sign 1 (Quads 36 & 37 both sides) displays Medical Cross');

// State B checks:
arrowMesh.userData.setBillboardState('B');
assert.strictEqual(arrowMesh.userData.currentBillboardState, 'B', 'Current state must be B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_cross.visible, false, 'billboard_cross must be hidden in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_info.visible, false, 'billboard_info must be hidden in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_food.visible, false, 'billboard_food must be hidden in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_tools.visible, false, 'billboard_tools must be hidden in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_capsule.visible, true, 'billboard_capsule must be visible in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_shopping_cart.visible, true, 'billboard_shopping_cart must be visible in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_bed.visible, true, 'billboard_bed must be visible in State B');
assert.strictEqual(arrowMesh.userData.isolatedBillboards.billboard_law.visible, true, 'billboard_law must be visible in State B');
const uvsB = arrowMesh.geometry.attributes.uv.array;
// Sign 1 (Quads 36, 37): Capsule U in [0.25, 0.50], V in [0.50, 0.75]
for (const q of [36, 37]) {
  for (let v = 0; v < 6; v++) {
    const u = uvsB[(q * 6 + v) * 2];
    const valV = uvsB[(q * 6 + v) * 2 + 1];
    assert.ok(u >= 0.24 && u <= 0.51, `State B Q${q} U out of bounds: ${u}`);
    assert.ok(valV >= 0.49 && valV <= 0.76, `State B Q${q} V out of bounds: ${valV}`);
  }
}
// Sign 2 (Quads 38, 39): Shopping Cart U in [0.00, 0.25], V in [0.75, 1.00]
for (const q of [38, 39]) {
  for (let v = 0; v < 6; v++) {
    const u = uvsB[(q * 6 + v) * 2];
    const valV = uvsB[(q * 6 + v) * 2 + 1];
    assert.ok(u >= -0.01 && u <= 0.26, `State B Q${q} U out of bounds: ${u}`);
    assert.ok(valV >= 0.74 && valV <= 1.01, `State B Q${q} V out of bounds: ${valV}`);
  }
}
console.log('    ✓ State B Sign 1 displays Capsule, Sign 2 displays Shopping Cart');

// Clear manual lock to test automatic animated cycling
arrowMesh.userData.setBillboardState('auto');

// Verify animatedParts updates based on cycle time
const animPart = viewer.animatedParts.find(p => p.object === arrowMesh);
assert.ok(animPart, 'arrowMesh must be registered in animatedParts');
animPart.update(1.0); // t = 1.0s (within frames 0..95) -> State A
assert.strictEqual(arrowMesh.userData.currentBillboardState, 'A', 't=1.0s must activate State A');
animPart.update(4.0); // t = 4.0s (within frames 100..195) -> State B
assert.strictEqual(arrowMesh.userData.currentBillboardState, 'B', 't=4.0s must activate State B');
animPart.update(7.0); // t = 7.0s (loops back to ~0.33s) -> State A
assert.strictEqual(arrowMesh.userData.currentBillboardState, 'A', 't=7.0s must loop back to State A');
console.log('    ✓ Verified animatedParts flips cleanly between State A and State B across the 200-frame cycle');

// 6. Verify Cloned Mesh in Viewer, StationViewer Methods & UI Controls
console.log('  [6] Verifying mesh.userData.setBillboardState survival through clone() and UI visibility...');
const modGroup = await viewer.loadModuleMesh({
  macro: 'struct_arg_cross_01_macro',
  index: 99
});
assert.ok(modGroup, 'loadModuleMesh must return a group for struct_arg_cross_01');
viewer.modulesGroup.add(modGroup);

let clonedArrowMesh = null;
modGroup.traverse((child) => {
  if (child.isMesh && child.name && child.name.includes('anim_arrows')) {
    clonedArrowMesh = child;
  }
});
assert.ok(clonedArrowMesh, 'cloned anim_arrows mesh must exist in loaded module');
assert.ok(typeof clonedArrowMesh.userData.setBillboardState === 'function', 'mesh.userData.setBillboardState must survive Three.js clone() and be a function');
assert.ok(typeof modGroup.userData.setBillboardState === 'function', 'modGroup.userData.setBillboardState must exist');
assert.ok(viewer.hasModuleBillboards(99), 'viewer.hasModuleBillboards(99) must be true');

// Verify modGroup cross-links physicalSigns to anim_cross backing matrix screens
assert.ok(modGroup.userData.physicalSigns, 'modGroup.userData.physicalSigns must exist');
assert.strictEqual(modGroup.userData.physicalSigns.length, 4, 'modGroup.userData.physicalSigns must have 4 signs');
for (const sign of modGroup.userData.physicalSigns) {
  assert.ok(sign.backingMesh, `Sign ${sign.signIndex} must have its backingMesh connected from anim_cross`);
  assert.strictEqual(sign.backingMesh.name, sign.backingName, `Sign ${sign.signIndex} backingMesh name must match ${sign.backingName}`);
  assert.strictEqual(sign.backingMesh.userData.physicalSign, sign, `Sign ${sign.signIndex} backingMesh must link to physicalSign`);
}
console.log('    ✓ Verified modGroup cross-links all 4 physicalSigns to dedicated anim_cross backing matrix screens');

// Test manual state change on mesh
clonedArrowMesh.userData.setBillboardState('B');
assert.strictEqual(clonedArrowMesh.userData.currentBillboardState, 'B', 'mesh.userData.setBillboardState("B") must set state B');
assert.strictEqual(clonedArrowMesh.userData.manualBillboardState, 'B', 'manual state must be B');
assert.strictEqual(viewer.getBillboardState(99), 'B', 'viewer.getBillboardState(99) must return B');

// Verify updateAnimatedParts() does not overwrite manual locked state B at t=1.0s (which is state A's window)
const clonedAnimPart = viewer.animatedParts.find(p => p.object === clonedArrowMesh);
assert.ok(clonedAnimPart, 'cloned mesh must be registered in animatedParts');
viewer.updateAnimatedParts(1.0); // 1.0 second in animate loop
assert.strictEqual(clonedArrowMesh.userData.currentBillboardState, 'B', 'updateAnimatedParts() must not overwrite manually locked state B');

// Test viewer-level API to set State A
viewer.setBillboardState('A', 99);
assert.strictEqual(clonedArrowMesh.userData.currentBillboardState, 'A', 'viewer.setBillboardState("A") must set mesh to State A');
assert.strictEqual(viewer.getBillboardState(99), 'A', 'viewer.getBillboardState(99) must return A');

// Test auto cycle resume
viewer.setBillboardState('auto', 99);
assert.strictEqual(clonedArrowMesh.userData.manualBillboardState, null, 'auto must clear manualBillboardState');
viewer.updateAnimatedParts(4.0); // 4.0 seconds (State B's window)
assert.strictEqual(clonedArrowMesh.userData.currentBillboardState, 'B', 'updateAnimatedParts() at t=4.0s must cycle to State B when auto');
console.log('    ✓ Verified mesh.userData.setBillboardState survives clone(), locks manual states, and restores auto cycle');

// Verify UI elements in index.html
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('id="sel-billboard-state"'), 'index.html must include #sel-billboard-state dropdown in floating pill');
assert.strictEqual(html.includes('id="sel-det-billboard-state"'), false, 'Selected Module Details must not include removed #sel-det-billboard-state');
assert.ok(html.includes('value="auto"'), 'Dropdown must include auto cycle option');
assert.ok(html.includes('value="A"'), 'Dropdown must include State A option');
assert.ok(html.includes('value="B"'), 'Dropdown must include State B option');
console.log('    ✓ Verified visible UI controls in index.html for floating pill and removal of details pill');

// 7. Render 3D Viewer Output and Generate Screenshot PNG
console.log('  [7] Generating 3D visualizer output PNG with billboard displays & holographic backing...');
let server = null;
let serverUrl = 'http://localhost:3000';
try {
  const resp = await fetch(serverUrl, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
  if (!resp.ok) throw new Error('Not responding');
} catch {
  // Vite's dependency cache is keyed on NODE_ENV (tests/run-all.js sets it to 'test'), and sharing
  // node_modules/.vite with dev servers made every switch re-optimize for ~40s, sometimes mid-test.
  // Use a dedicated cache and a fixed NODE_ENV so this server's cache stays warm.
  // open: false - vite.config.js sets open: true, which opened a tab in the user's browser on every
  // run; those tabs then reconnected and reloaded the whole app whenever this server came up again.
  // A fresh free port each run keeps any such stale tabs away from this server.
  process.env.NODE_ENV = 'development';
  const net = await import('node:net');
  const freePort = await new Promise((resolve, reject) => {
    const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
  const { createServer } = await import('vite');
  server = await createServer({
    cacheDir: 'node_modules/.vite-billboard-test',
    server: { port: freePort, open: false }
  });
  await server.listen();
  serverUrl = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const puppeteer = (await import('puppeteer')).default;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_profile_cross_'));
const launchOptions = {
  headless: 'new',
  userDataDir: userProfileDir,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800', '--use-gl=angle']
};
if (fs.existsSync(chromePath)) {
  launchOptions.executablePath = chromePath;
}

const browser = await puppeteer.launch(launchOptions);
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  // Generous timeouts: a cold Vite dependency cache takes ~45s to build on first use
  await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 120000 });
  // main.js shows "Loading..." in #plan-name from the start of a plan load until the viewer has
  // finished it (camera fit, filters reset). Wait for the startup sample so the switch below does
  // not overlap a load that is still running.
  const planLoaded = () => window.viewer?.modulesGroup?.children.length > 0 &&
    document.getElementById('sample-selector') &&
    document.getElementById('plan-name')?.textContent !== 'Loading...';
  await page.waitForFunction(planLoaded, { timeout: 90000, polling: 250 });

  await page.evaluate(async () => {
    const v = window.viewer;
    if (!v) return;
    v.setColorized(false);
    // Tag modules from the startup sample so the wait below only accepts freshly loaded ones
    v.modulesGroup.children.forEach(m => { m.userData.__beforeSampleSwitch = true; });
    const sel = document.getElementById('sample-selector');
    if (sel) {
      sel.value = 'defenseFortress';
      sel.dispatchEvent(new Event('change'));
    }
  });

  // Wait until the whole defenseFortress plan has finished loading (it re-fits the camera and resets
  // visibility at the end, which would undo the framing below) and Argon Cross 01 has its billboard mesh.
  try {
    await page.waitForFunction(() => {
      if (document.getElementById('plan-name')?.textContent === 'Loading...') return false;
      const mod = window.viewer?.modulesGroup?.children.find(m => m.userData?.macro === 'struct_arg_cross_01_macro' && !m.userData.__beforeSampleSwitch);
      let ready = false;
      mod?.traverse(c => { if (c.isMesh && c.name.includes('anim_arrows') && c.userData?.setBillboardState) ready = true; });
      return ready;
    }, { timeout: 90000, polling: 250 });
  } catch (err) {
    throw new Error(`struct_arg_cross_01 with its anim_arrows billboard did not load in the defenseFortress sample: ${err.message}`);
  }

  const framed = await page.evaluate(async () => {
    const v = window.viewer;
    let mod = v.modulesGroup.children.find(m => m.userData?.macro === 'struct_arg_cross_01_macro');
    if (!mod) return false;

    v.setColorized(false);

    // Disable wireframes, dimension boxes, and snap point markers for clear analysis view
    const toggleDims = document.getElementById('toggle-dimensions');
    if (toggleDims && toggleDims.checked) {
      toggleDims.checked = false;
      toggleDims.dispatchEvent(new Event('change'));
    }
    const toggleSnaps = document.getElementById('toggle-snaps');
    if (toggleSnaps && toggleSnaps.checked) {
      toggleSnaps.checked = false;
      toggleSnaps.dispatchEvent(new Event('change'));
    }
    if (typeof v.setShowDimensions === 'function') v.setShowDimensions(false);
    if (typeof v.setShowSnapPoints === 'function') v.setShowSnapPoints(false);

    // Isolate module so only Argon Cross 01 is rendered
    v.modulesGroup.children.forEach(m => {
      m.visible = (m === mod);
    });

    let arrowMesh = null;
    let crossBgMesh = null;
    mod.traverse(c => {
      if (c.isMesh && c.name.includes('anim_arrows')) arrowMesh = c;
      if (c.isMesh && c.name.includes('anim_cross')) crossBgMesh = c;
    });

    // Explicitly lock to State A (Medical Cross)
    if (arrowMesh?.userData?.setBillboardState) {
      arrowMesh.userData.setBillboardState('A', true);
    }

    const s1 = arrowMesh?.userData?.isolatedBillboards?.billboard_cross;
    if (s1) {
      s1.geometry.computeBoundingBox();
      const box = s1.geometry.boundingBox;
      const center = box.min.clone().add(box.max).multiplyScalar(0.5);
      s1.updateMatrixWorld(true);
      const worldCenter = center.clone().applyMatrix4(s1.matrixWorld);

      // Frame the billboard sign and dedicated holographic matrix backing screen
      const camPos = worldCenter.clone();
      camPos.x += 52;
      camPos.y += 8;
      camPos.z += 52;

      v.camera.position.copy(camPos);
      if (v.controls && v.controls.target) {
        v.controls.target.copy(worldCenter);
        v.controls.update();
      }
    }
    v.renderScene();
    return !!s1;
  });
  assert.ok(framed, 'Camera must be framed on the struct_arg_cross_01 billboard_cross sign');

  // Let the renderer present a couple of frames before capturing
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const buf = await page.screenshot({ type: 'png' });
  const localPngPath = path.resolve('tests/test_struct_arg_cross_01_billboards.png');
  const artifactPngPath = 'C:/Users/Zeus/.gemini/antigravity/brain/48ad60fc-7cd5-4289-a878-762081c382e8/test_struct_arg_cross_01_billboards.png';

  fs.writeFileSync(localPngPath, buf);
  if (fs.existsSync(path.dirname(artifactPngPath))) {
    fs.writeFileSync(artifactPngPath, buf);
  }

  assert.ok(fs.existsSync(localPngPath), 'Viewer output PNG must be written to tests/test_struct_arg_cross_01_billboards.png');
  assert.ok(fs.statSync(localPngPath).size > 50000, 'Viewer output PNG must be non-empty (>50KB)');
  console.log(`    ✓ Saved viewer output PNG to: ${localPngPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  if (fs.existsSync(artifactPngPath)) {
    console.log(`    ✓ Saved viewer output PNG to artifact: ${artifactPngPath}`);
  }
} finally {
  await browser.close();
  if (server) {
    await server.close();
  }
}

console.log('\n[SUCCESS] All struct_arg_cross_01 Billboard & Animated Striping Parameters Verified Cleanly!');
