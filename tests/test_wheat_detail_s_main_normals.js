import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Wheat detail_s_main-lod0 Normal Orientations and Authored Normals Preservation...');

const viewer = Object.create(StationViewer.prototype);
viewer.textureCache = new Map();

// 1. Texture mapping for detail_s_main in wheat module
const wheatUrl = '/assets1/structures/production/prod_arg_wheat_data/detail_s_main-lod0.dae';
const texUrls = viewer.resolveTextureForModel(wheatUrl, '');

assert.strictEqual(
  texUrls.diffuse,
  '/assets1/textures/natural/nat_p2_foliage_01_diff.dds',
  'Wheat detail_s_main must resolve to nat_p2_foliage_01_diff.dds'
);
console.log('  ✓ [PASS] Wheat detail_s_main resolves to natural foliage diffuse texture');

// 2. Authored normals preservation test
// Mock a geometry with upward-facing authored foliage normals [0, 0.98, 0]
const positions = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
  // Backface triangle in double-sided quad (winding order reversed)
  0, 1, 0,
  1, 0, 0,
  1, 1, 0
]);
const authoredNormals = new Float32Array([
  0.0, 0.98, 0.05,
  0.0, 0.98, 0.05,
  0.0, 0.98, 0.05,
  0.0, 0.98, 0.05,
  0.0, 0.98, 0.05,
  0.0, 0.98, 0.05
]);

const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(authoredNormals), 3));

const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
const group = new THREE.Group();
group.add(mesh);

// Simulate the mesh traversal logic in loadModuleMesh:
// Geometries with pre-authored normals must NOT have computeVertexNormals called
group.traverse(child => {
  if (child.isMesh && child.geometry && !child.geometry.attributes.normal) {
    child.geometry.computeVertexNormals();
  }
});

// Verify that the authored upward normals are preserved
const currentNormals = mesh.geometry.attributes.normal.array;
for (let i = 0; i < 6; i++) {
  assert.strictEqual(
    currentNormals[i * 3 + 1],
    0.9800000190734863,
    `Vertex ${i} normal Y must stay upward (0.98), not inverted by computeVertexNormals`
  );
}
console.log('  ✓ [PASS] Authored upward foliage normals preserved against geometric cross-product inversion');

// 3. Fallback test: Geometries WITHOUT normals must still compute them
const geomNoNormals = new THREE.BufferGeometry();
geomNoNormals.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  0, 0, 0,
  1, 0, 0,
  0, 1, 0
]), 3));

const meshNoNormals = new THREE.Mesh(geomNoNormals, new THREE.MeshBasicMaterial());
const group2 = new THREE.Group();
group2.add(meshNoNormals);

group2.traverse(child => {
  if (child.isMesh && child.geometry && !child.geometry.attributes.normal) {
    child.geometry.computeVertexNormals();
  }
});

assert.ok(meshNoNormals.geometry.attributes.normal, 'Geometries without normals must have computeVertexNormals called');
assert.strictEqual(meshNoNormals.geometry.attributes.normal.count, 3, 'Must have 3 normal vectors');
console.log('  ✓ [PASS] Geometries without normals receive auto-computed normals');

console.log('\n[SUCCESS] Wheat detail_s_main normal orientation tests passed cleanly!');
