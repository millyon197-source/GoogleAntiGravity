/**
 * Test that black background in anim_arrows is rendered transparent,
 * allowing the neon glow of anim_cross to shine through across the stencil.
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing anim_arrows transparent black shader hook and materials...');

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
viewer.getBillboardState = StationViewer.prototype.getBillboardState;
viewer.hasModuleBillboards = StationViewer.prototype.hasModuleBillboards;
viewer.updateAnimatedParts = StationViewer.prototype.updateAnimatedParts;

const dummyTexture = new THREE.Texture();
dummyTexture.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => dummyTexture;

// 1. Load struct_arg_cross_01 anim_arrows Collada model
const scene = await viewer.loadColladaModel('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae');
assert.ok(scene, 'anim_arrows scene must load');

let arrowMesh = null;
scene.traverse((child) => {
  if (child.isMesh && child.name.includes('anim_arrows')) {
    arrowMesh = child;
  }
});
assert.ok(arrowMesh, 'anim_arrows mesh must exist');

// 2. Apply textures to anim_arrows
await viewer.applyTexturesToMeshGroup(
  scene,
  '/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae',
  10
);

// 3. Verify material transparency & depth parameters
const mat = arrowMesh.material;
assert.strictEqual(mat.transparent, true, 'anim_arrows material must be transparent');
assert.strictEqual(mat.depthWrite, false, 'anim_arrows material depthWrite must be false');
assert.strictEqual(mat.alphaTest, 0.05, 'anim_arrows material alphaTest must be 0.05');

// 4. Verify onBeforeCompile maps black pixels to transparent via arrowLuma
assert.ok(typeof mat.onBeforeCompile === 'function', 'anim_arrows must have onBeforeCompile hook');
const mockShader = {
  fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>\n'
};
mat.onBeforeCompile(mockShader);

assert.ok(
  mockShader.fragmentShader.includes('arrowLuma'),
  'Fragment shader must calculate arrowLuma from sampledDiffuseColor'
);
assert.ok(
  mockShader.fragmentShader.includes('diffuseColor.a *= smoothstep(0.02, 0.15, arrowLuma);'),
  'Fragment shader must scale diffuseColor.a by arrowLuma'
);
console.log('  ✓ Verified fragment shader hook scales alpha by arrowLuma to make black transparent');

// 5. Verify customProgramCacheKey is defined
assert.ok(typeof mat.customProgramCacheKey === 'function', 'customProgramCacheKey must be defined');
assert.ok(mat.customProgramCacheKey().includes('anim_arrows_cutout'), 'customProgramCacheKey must include anim_arrows_cutout');
console.log('  ✓ Verified customProgramCacheKey identifies cutout shader variant');

// 6. Verify isolated billboard sign sub-meshes inherit the transparent black shader
assert.ok(arrowMesh.userData.isolatedBillboards, 'isolatedBillboards must exist on arrowMesh');
for (const signKey of ['billboard_cross', 'billboard_info', 'billboard_food', 'billboard_tools']) {
  const signMesh = arrowMesh.userData.isolatedBillboards[signKey];
  assert.ok(signMesh, `${signKey} sub-mesh must exist`);
  const signMat = signMesh.material;
  assert.strictEqual(signMat.transparent, true, `${signKey} material must be transparent`);
  assert.strictEqual(signMat.depthWrite, false, `${signKey} material depthWrite must be false`);
  assert.strictEqual(signMat.alphaTest, 0.05, `${signKey} material alphaTest must be 0.05`);

  const signShader = { fragmentShader: '#include <map_fragment>\n' };
  signMat.onBeforeCompile(signShader);
  assert.ok(signShader.fragmentShader.includes('arrowLuma'), `${signKey} shader must include arrowLuma`);
}
console.log('  ✓ Verified all isolated physical billboard signs inherit transparent black shader and alphaTest');

// 7. Verify flipped up/down orientation on billboard UVs
const crossMesh = arrowMesh.userData.isolatedBillboards.billboard_cross;
const pos = crossMesh.geometry.attributes.position.array;
const uvs = crossMesh.geometry.attributes.uv.array;
// Vertex 0 is bottom Y (~83.1), Vertex 1 is top Y (~125.4)
assert.ok(pos[1] < pos[4], 'v0 Y is lower than v1 Y');
assert.ok(uvs[1] > uvs[3], 'v0 V is mapped to vMax and v1 V is mapped to vMin (up/down orientation flipped)');
console.log('  ✓ Verified billboard up/down UV orientation matches top-to-bottom spatial alignment');

console.log('[PASS] test_anim_arrows_transparent_black completed successfully!');
