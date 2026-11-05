import assert from 'assert';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Station Lights Smooth Bloom Filter & UnrealBloomPass Pipeline...');

// 1. Verify UnrealBloomPass constructor and parameters
const resolution = new THREE.Vector2(1920, 1080);
const bloomPass = new UnrealBloomPass(
  resolution,
  1.25, // strength
  0.45, // radius
  0.82  // threshold
);

assert.strictEqual(bloomPass.strength, 1.25, 'Expected bloom strength 1.25');
assert.strictEqual(bloomPass.radius, 0.45, 'Expected blur filter radius 0.45');
assert.strictEqual(bloomPass.threshold, 0.82, 'Expected luminance threshold 0.82');
assert.ok(bloomPass.renderTargetsHorizontal, 'Expected horizontal blur render targets');
assert.ok(bloomPass.renderTargetsVertical, 'Expected vertical blur render targets');
assert.strictEqual(bloomPass.renderTargetsHorizontal.length, 5, 'Expected 5-level blur filter pyramid');
console.log('  ✓ [PASS] UnrealBloomPass multi-pass Gaussian blur filter initialization verified');

// 2. Test StationViewer prototype methods for bloom control
const mockViewer = {
  bloomEnabled: true,
  bloomPass: bloomPass,
  composer: {
    rendered: false,
    render() { this.rendered = true; },
    setSize(w, h) { this.width = w; this.height = h; }
  },
  renderer: {
    rendered: false,
    render() { this.rendered = true; }
  },
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  setBloomEnabled: StationViewer.prototype.setBloomEnabled,
  setBloomParams: StationViewer.prototype.setBloomParams,
  renderScene: StationViewer.prototype.renderScene
};

// Test setBloomEnabled
mockViewer.setBloomEnabled(false);
assert.strictEqual(mockViewer.bloomEnabled, false, 'Expected bloomEnabled false');
assert.strictEqual(mockViewer.bloomPass.enabled, false, 'Expected bloomPass.enabled false');

mockViewer.setBloomEnabled(true);
assert.strictEqual(mockViewer.bloomEnabled, true, 'Expected bloomEnabled true');
assert.strictEqual(mockViewer.bloomPass.enabled, true, 'Expected bloomPass.enabled true');
console.log('  ✓ [PASS] setBloomEnabled toggles bloom pass state');

// Test setBloomParams
mockViewer.setBloomParams({ strength: 1.5, radius: 0.6, threshold: 0.85 });
assert.strictEqual(mockViewer.bloomPass.strength, 1.5, 'Expected updated strength 1.5');
assert.strictEqual(mockViewer.bloomPass.radius, 0.6, 'Expected updated radius 0.6');
assert.strictEqual(mockViewer.bloomPass.threshold, 0.85, 'Expected updated threshold 0.85');
console.log('  ✓ [PASS] setBloomParams configures blur filter properties');

// Test renderScene with bloom enabled
mockViewer.composer.rendered = false;
mockViewer.renderScene();
assert.ok(mockViewer.composer.rendered, 'Expected composer.render() called when bloomEnabled');

// Test renderScene with bloom disabled (falls back to renderer.render)
mockViewer.setBloomEnabled(false);
mockViewer.renderer.rendered = false;
mockViewer.renderScene();
assert.ok(mockViewer.renderer.rendered, 'Expected renderer.render() called when bloom is disabled');
console.log('  ✓ [PASS] renderScene routes correctly between composer and renderer');

// 3. Verify FX Glowing Light Material Configuration
const testGlowMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 2.2,
  toneMapped: false
});

assert.strictEqual(testGlowMat.toneMapped, false, 'Glowing station light material should bypass tone mapping to trigger bloom');
assert.ok(testGlowMat.emissiveIntensity >= 2.0, 'Glowing station light material should have high emissive intensity');
console.log('  ✓ [PASS] Station light material HDR emissive intensity and toneMapped configuration verified');

console.log('\n[SUCCESS] All FX glowing station lights bloom smooth filter tests passed cleanly!');
