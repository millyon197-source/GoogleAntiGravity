import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[*] Testing Selected Module Details Effects Pill & Sliders...');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});

const { document } = dom.window;

// 1. Check DOM structure: Effects pill is present, and Module Components pill is removed from Selected Module Details
const detailsCard = document.getElementById('details-card');
assert.ok(detailsCard, 'Expected #details-card to exist');

const effectsSection = document.getElementById('det-effects-section');
assert.ok(effectsSection, 'Expected #det-effects-section to exist');

const componentsSection = document.getElementById('det-components-section');
assert.strictEqual(componentsSection, null, 'Expected #det-components-section to be removed from Selected Module Details');

const cardChildren = Array.from(detailsCard.querySelector('.details-scroll-body').children);
const effectsIdx = cardChildren.indexOf(effectsSection);
assert.ok(effectsIdx !== -1, 'Expected #det-effects-section inside .details-scroll-body');
console.log('  ✓ [PASS] Effects pill positioned in Selected Module Details with Module Components pill cleanly removed');

// 2. Check Sliders elements, min/max bounds, and values
const sliderBloom = document.getElementById('slider-bloom-strength');
const valBloom = document.getElementById('val-bloom-strength');
assert.ok(sliderBloom, 'Expected #slider-bloom-strength to exist');
assert.ok(valBloom, 'Expected #val-bloom-strength to exist');
assert.strictEqual(sliderBloom.min, '0', 'Expected bloom slider min 0');
assert.strictEqual(sliderBloom.max, '5', 'Expected bloom slider max 5');
assert.strictEqual(parseFloat(sliderBloom.value), 0.35, 'Expected default bloom value 0.35');

const sliderEmissive = document.getElementById('slider-emissive-intensity');
const valEmissive = document.getElementById('val-emissive-intensity');
assert.ok(sliderEmissive, 'Expected #slider-emissive-intensity to exist');
assert.ok(valEmissive, 'Expected #val-emissive-intensity to exist');
assert.strictEqual(sliderEmissive.min, '0', 'Expected emissive slider min 0');
assert.strictEqual(sliderEmissive.max, '10', 'Expected emissive slider max 10');
assert.strictEqual(parseFloat(sliderEmissive.value), 2.2, 'Expected default emissive value 2.2');
console.log('  ✓ [PASS] Sliders min/max bounds and initial values verified');

// 3. Test StationViewer prototype setEmissiveIntensity and getBloomStrength methods
const mockMesh = new THREE.Mesh(
  new THREE.BoxGeometry(10, 10, 10),
  new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 2.2
  })
);
const mockGroup = new THREE.Group();
mockGroup.userData = { index: 1 };
mockGroup.add(mockMesh);

const mockModulesGroup = new THREE.Group();
mockModulesGroup.add(mockGroup);

const viewerInstance = {
  glowingEmissiveIntensity: 2.2,
  bloomStrength: 0.35,
  bloomPass: { strength: 0.35 },
  modulesGroup: mockModulesGroup,
  setBloomParams: StationViewer.prototype.setBloomParams,
  getBloomStrength: StationViewer.prototype.getBloomStrength,
  getEmissiveIntensity: StationViewer.prototype.getEmissiveIntensity,
  setEmissiveIntensity: StationViewer.prototype.setEmissiveIntensity,
  renderScene() {}
};

// Test bloom strength adjustment
viewerInstance.setBloomParams({ strength: 3.5 });
assert.strictEqual(viewerInstance.getBloomStrength(), 3.5, 'Expected updated bloom strength 3.5');
console.log('  ✓ [PASS] Bloom Strength slider adjustment updates viewer bloom strength');

// Test emissive intensity adjustment on meshes
viewerInstance.setEmissiveIntensity(6.8, 1);
assert.strictEqual(viewerInstance.getEmissiveIntensity(), 6.8, 'Expected updated emissive intensity 6.8');
assert.strictEqual(mockMesh.material.emissiveIntensity, 6.8, 'Expected mesh material emissiveIntensity 6.8');
console.log('  ✓ [PASS] HDR Emissive Intensity slider adjustment updates station mesh emissive intensity');

console.log('\n[SUCCESS] All Selected Module Details Effects pill and slider tests passed cleanly!');
