import assert from 'assert';
import * as THREE from 'three';
import { applyTexturesToMeshGroup } from '../packages/adapter-three/src/materials/mesh-group-materials.js';
import { loadBinaryModel } from '../packages/adapter-three/src/models/binary-model-loader.js';
import { resolveTextureForModel } from '../packages/adapter-three/src/textures/texture-resolver.js';

console.log('[*] Testing fx_lightcones Plane Edge Attenuation & Volumetric Shader...');

// 1. Texture resolution for fx_lightcones-lod0
const coneUrls = resolveTextureForModel('assets1/structures/dock/dockarea_par_m_station_01_data/fx_lightcones-lod0.dae', 'p1effects.p1_lightcone_soft');
assert.strictEqual(coneUrls.diffuse, '/assets1/textures/fx/lightcones_soft.dds', 'fx_lightcones diffuse must resolve to lightcones_soft.dds');
assert.strictEqual(coneUrls.emissive, '/assets1/textures/fx/lightcones_soft.dds', 'fx_lightcones emissive must resolve to lightcones_soft.dds');
console.log('  ✓ [PASS] fx_lightcones resolves to lightcones_soft.dds');

// 2. Mock Mesh & Texture Setup
const host = {
  textureCache: new Map(),
  animatedTextures: [],
  loadDdsTexture: async (url) => {
    const tex = new THREE.Texture();
    tex.name = url;
    return tex;
  }
};

const lightconeMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ name: 'effectsXlightcone_env' })
);
lightconeMesh.name = 'fx_lightcones-lod0Xlod0XeffectsXlightcone_env';

// Add vertex colors (typical in X4 lightcone geometry)
const colors = new Float32Array([
  0.792, 0.909, 1.0,
  0.792, 0.909, 1.0,
  0.792, 0.909, 1.0,
  0.792, 0.909, 1.0
]);
lightconeMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const group = new THREE.Group();
group.add(lightconeMesh);

await applyTexturesToMeshGroup(host, group, 'assets/structures/dock/dockarea_par_m_station_01_data/fx_lightcones-lod0.dae');

const mat = lightconeMesh.material;

// 3. Verify Material Parameters
assert.ok(mat.isMeshStandardMaterial, 'Material must be MeshStandardMaterial');
assert.strictEqual(mat.transparent, true, 'Lightcone must be transparent');
assert.strictEqual(mat.depthWrite, false, 'Lightcone must not write depth');
assert.strictEqual(mat.blending, THREE.AdditiveBlending, 'Lightcone must use AdditiveBlending');
assert.strictEqual(mat.color.getHex(), 0x000000, 'Base color must be black to prevent planar illumination');
assert.strictEqual(mat.side, THREE.DoubleSide, 'Lightcone must render DoubleSide for multi-angle beam visibility');
assert.strictEqual(mat.toneMapped, true, 'Lightcone must be toneMapped: true to avoid supernova blowout');
assert.strictEqual(mat.opacity, 0.25, 'Lightcone opacity must be tuned to 0.25');
assert.strictEqual(mat.emissiveIntensity, 0.35, 'Lightcone emissiveIntensity must be tuned to 0.35');
assert.ok(mat.emissiveMap, 'Lightcone must have emissiveMap set');

console.log('  ✓ [PASS] fx_lightcones material parameters configured correctly (opacity 0.25, emissiveIntensity 0.35, DoubleSide)');

// 4. Verify onBeforeCompile Shader Attenuation
assert.ok(typeof mat.onBeforeCompile === 'function', 'Material must have onBeforeCompile hook');

const dummyShader = {
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)
};

mat.onBeforeCompile(dummyShader);

assert.ok(dummyShader.fragmentShader.includes('coneLuma'), 'Shader must compute coneLuma');
assert.ok(dummyShader.fragmentShader.includes('coneFade'), 'Shader must compute coneFade');
assert.ok(dummyShader.fragmentShader.includes('smoothstep(0.06, 0.30, coneLuma)'), 'Shader must use smoothstep(0.06, 0.30, coneLuma) edge attenuation');
// three's emissivemap_fragment declares the sampled texel as emissiveColor; texelEmissive does not exist and fails to compile
assert.ok(dummyShader.fragmentShader.includes('emissiveColor.r') && !dummyShader.fragmentShader.includes('texelEmissive'), 'Shader must read the emissive texel three declares (emissiveColor)');
assert.ok(dummyShader.fragmentShader.includes('totalEmissiveRadiance *= coneFade;'), 'Shader must attenuate totalEmissiveRadiance');
assert.ok(dummyShader.fragmentShader.includes('diffuseColor.a *= coneFade;'), 'Shader must attenuate diffuseColor.a');

console.log('  ✓ [PASS] Shader onBeforeCompile smoothly eliminates low-luminance edge noise and planar silhouettes');

// 5. Verify Program Cache Key
assert.ok(typeof mat.customProgramCacheKey === 'function', 'Material must have customProgramCacheKey');
const cacheKey = mat.customProgramCacheKey();
assert.ok(cacheKey.includes('_lightcone'), `Cache key must contain _lightcone, got "${cacheKey}"`);
assert.ok(cacheKey.includes('_vcolor'), `Cache key must contain _vcolor for vertex color modulation, got "${cacheKey}"`);

console.log('  ✓ [PASS] customProgramCacheKey includes _lightcone and _vcolor');

// 6. Mathematical Verification of Edge Cutoff vs Core Retention
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Edge noise (e.g. DXT5 residual values: 14/255 ≈ 0.055)
const edgeLuma = 14 / 255;
const edgeFade = smoothstep(0.06, 0.30, edgeLuma);
assert.strictEqual(edgeFade, 0.0, 'Edge noise <= 0.06 must evaluate to strictly 0.0 (no visible plane)');

// Intermediate soft transition
const midLuma = 0.18;
const midFade = smoothstep(0.06, 0.30, midLuma);
assert.ok(midFade > 0.0 && midFade < 1.0, 'Mid-beam luminance must have smooth non-zero falloff');

// Beam core (e.g. 100/255 ≈ 0.392)
const coreLuma = 100 / 255;
const coreFade = smoothstep(0.06, 0.30, coreLuma);
assert.strictEqual(coreFade, 1.0, 'Core light beam >= 0.30 must retain 100% full radiance');

console.log('  ✓ [PASS] Edge cutoff completely zeros out perimeter noise while preserving 100% of the light beam core');
console.log('\n[SUCCESS] All fx_lightcones plane attenuation and volumetric light tests passed cleanly!');
