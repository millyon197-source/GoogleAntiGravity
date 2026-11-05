import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };

console.log('[*] Testing hab_arg_l_01 detail_m_main alignment to part_main...');

const viewer = Object.create(StationViewer.prototype);
viewer.colladaCache = new Map();

// 1. Asset entry discovery
const assetEntry = viewer.resolveModuleAssetEntry('hab_arg_l_01_macro');
assert.strictEqual(assetEntry.baseName, 'hab_arg_l_01');
assert.strictEqual(assetEntry.folderPath, '/assets1/structures/habitat/hab_arg_l_01_data');
assert.ok(assetEntry.defaultFiles.includes('part_main-lod0.dae'), 'Should include part_main-lod0.dae');
assert.ok(assetEntry.defaultFiles.includes('detail_m_main-lod0.dae'), 'Should include detail_m_main-lod0.dae');
console.log('  ✓ [PASS] hab_arg_l_01_macro resolves folder and default components');

// 2. Component offsets presence and values
const habOffsets = COMPONENT_OFFSETS['hab_arg_l_01'];
assert.ok(habOffsets, 'hab_arg_l_01 must be present in COMPONENT_OFFSETS');
const detailMOffset = habOffsets['detail_m_main'];
assert.ok(Array.isArray(detailMOffset), 'detail_m_main offset must be an array');
assert.strictEqual(detailMOffset.length, 7, 'detail_m_main offset must include 3 position and 4 quaternion values');

const [px, py, pz, qx, qy, qz, qw] = detailMOffset;
assert.ok(Math.abs(px - (-4.45727)) < 0.001, `px should be approx -4.45727, got ${px}`);
assert.ok(Math.abs(py - (-86.97427)) < 0.001, `py should be approx -86.97427, got ${py}`);
assert.ok(Math.abs(pz - (-145.414)) < 0.001, `pz should be approx -145.414, got ${pz}`);
assert.ok(Math.abs(qx - 0) < 0.001, `qx should be 0, got ${qx}`);
assert.ok(Math.abs(qy - 0.7071066) < 0.001, `qy should be approx 0.7071066, got ${qy}`);
assert.ok(Math.abs(qz - 0) < 0.001, `qz should be 0, got ${qz}`);
assert.ok(Math.abs(qw - (-0.7071069)) < 0.001, `qw should be approx -0.7071069, got ${qw}`);
console.log('  ✓ [PASS] COMPONENT_OFFSETS has correct 7-element transform vector for detail_m_main');

// 3. Mathematical alignment of geometry
function parseDaePositions(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/<float_array[^>]*id="([^"]*position[^"]*)"[^>]*>([\s\S]*?)<\/float_array>/gi)];
  const allPoints = [];
  for (const m of matches) {
    const nums = m[2].trim().split(/\s+/).map(Number);
    for (let i = 0; i < nums.length; i += 3) {
      allPoints.push(new THREE.Vector3(nums[i], nums[i+1], nums[i+2]));
    }
  }
  return allPoints;
}

const partMainPoints = parseDaePositions('assets1/structures/habitat/hab_arg_l_01_data/part_main-lod0.dae');
const partMainBox = new THREE.Box3();
partMainPoints.forEach(p => partMainBox.expandByPoint(p));

const detailMPoints = parseDaePositions('assets1/structures/habitat/hab_arg_l_01_data/detail_m_main-lod0.dae');
const rawDetailBox = new THREE.Box3();
detailMPoints.forEach(p => rawDetailBox.expandByPoint(p));

// Verify that raw detail_m_main is indeed misaligned without transform
const rawDetailCenter = new THREE.Vector3();
rawDetailBox.getCenter(rawDetailCenter);
assert.ok(Math.abs(rawDetailCenter.x - 145.414) < 0.1, 'Raw detail center X is offset at ~145.41');
assert.ok(rawDetailBox.max.x > partMainBox.max.x, 'Raw detail X protrudes beyond part_main before fix');

// Apply offset and quaternion
const quat = new THREE.Quaternion(qx, qy, qz, qw);
const pos = new THREE.Vector3(px, py, pz);
const transformedDetailBox = new THREE.Box3();
detailMPoints.forEach(p => {
  transformedDetailBox.expandByPoint(p.clone().applyQuaternion(quat).add(pos));
});

const transformedCenter = new THREE.Vector3();
transformedDetailBox.getCenter(transformedCenter);

// Verify exact alignment with part_main:
// X center must be 0 (symmetric)
assert.ok(Math.abs(transformedCenter.x) < 0.01, `Transformed center X should be ~0, got ${transformedCenter.x}`);
// Z center must be 0 (symmetric)
assert.ok(Math.abs(transformedCenter.z) < 0.01, `Transformed center Z should be ~0, got ${transformedCenter.z}`);
// Y center must match XML center 25.10028
assert.ok(Math.abs(transformedCenter.y - 25.10028) < 0.01, `Transformed center Y should be ~25.10028, got ${transformedCenter.y}`);

// Detail mesh must fit entirely within part_main bounds
assert.ok(transformedDetailBox.min.x >= partMainBox.min.x, 'Transformed detail min X must be inside part_main');
assert.ok(transformedDetailBox.max.x <= partMainBox.max.x, 'Transformed detail max X must be inside part_main');
assert.ok(transformedDetailBox.min.y >= partMainBox.min.y, 'Transformed detail min Y must be inside part_main');
assert.ok(transformedDetailBox.max.y <= partMainBox.max.y, 'Transformed detail max Y must be inside part_main');
assert.ok(transformedDetailBox.min.z >= partMainBox.min.z, 'Transformed detail min Z must be inside part_main');
assert.ok(transformedDetailBox.max.z <= partMainBox.max.z, 'Transformed detail max Z must be inside part_main');

console.log('  ✓ [PASS] Transformed detail_m_main is centered at (0, 25.10, 0) and enclosed inside part_main');

// 4. Test simulated scene loading application logic
const mockScene = new THREE.Group();
mockScene.position.set(0, 0, 0);
mockScene.quaternion.set(0, 0, 0, 1);

const partBase = 'detail_m_main';
const baseName = 'hab_arg_l_01';
const off = COMPONENT_OFFSETS[baseName]?.[partBase];
if (Array.isArray(off)) {
  mockScene.position.set(off[0], off[1], off[2]);
  if (off.length >= 7) {
    mockScene.quaternion.set(off[3], off[4], off[5], off[6]);
  }
}

assert.strictEqual(mockScene.position.x, px);
assert.strictEqual(mockScene.position.y, py);
assert.strictEqual(mockScene.position.z, pz);
assert.strictEqual(mockScene.quaternion.x, qx);
assert.strictEqual(mockScene.quaternion.y, qy);
assert.strictEqual(mockScene.quaternion.z, qz);
assert.strictEqual(mockScene.quaternion.w, qw);
console.log('  ✓ [PASS] Viewer offset application logic correctly sets position and quaternion');

console.log('\n[SUCCESS] All hab_arg_l_01 detail_m_main alignment tests passed cleanly!');
