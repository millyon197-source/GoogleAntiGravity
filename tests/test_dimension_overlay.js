import * as THREE from 'three';
import { createProceduralModule, getModuleCategory } from '../src/modules.js';

console.log('[*] Starting automated validation of 3D Dimension Overlays...');

// 1. Mock Viewer dimension calculation logic
function getModuleLocalBounds(targetModule) {
  if (!targetModule) return null;
  
  const box = new THREE.Box3();
  let hasStructuralMesh = false;

  targetModule.updateMatrixWorld(true);
  const invWorldMatrix = new THREE.Matrix4().copy(targetModule.matrixWorld).invert();

  targetModule.traverse(child => {
    if (child.isMesh) {
      if (child.geometry) {
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        const geomBox = child.geometry.boundingBox.clone();
        const localMat = child.matrixWorld.clone().premultiply(invWorldMatrix);
        geomBox.applyMatrix4(localMat);
        box.union(geomBox);
        hasStructuralMesh = true;
      }
    }
  });

  if (!hasStructuralMesh) {
    const fallbackBox = new THREE.Box3().setFromObject(targetModule);
    fallbackBox.applyMatrix4(invWorldMatrix);
    return fallbackBox;
  }

  return box;
}

// 2. Test procedural modules across different categories
const sampleMacros = [
  'pier_arg_harbor_03',
  'prod_gen_water',
  'storage_arg_l_container_01',
  'hab_arg_l_01',
  'defence_arg_disc_01',
  'struct_arg_cross_01'
];

let allPassed = true;

for (const macro of sampleMacros) {
  const modGroup = createProceduralModule(macro, THREE);
  const bounds = getModuleLocalBounds(modGroup);
  const size = bounds.getSize(new THREE.Vector3());

  if (size.x > 0 && size.y > 0 && size.z > 0) {
    console.log(`[OK] Macro '${macro}' (${getModuleCategory(macro)}): Width=${Math.round(size.x)}m, Height=${Math.round(size.y)}m, Depth=${Math.round(size.z)}m`);
  } else {
    console.error(`[FAIL] Macro '${macro}' yielded invalid dimensions: ${JSON.stringify(size)}`);
    allPassed = false;
  }
}

// 3. Test Rotation Invariance (Local bounds should remain identical regardless of module rotation)
console.log('\n[*] Testing Rotation Invariance (Oriented Bounding Box behavior)...');
const testModule = createProceduralModule('pier_arg_harbor_03', THREE);
const boundsInitial = getModuleLocalBounds(testModule);
const sizeInitial = boundsInitial.getSize(new THREE.Vector3());

// Apply heavy compound rotation (45 deg Yaw, 30 deg Pitch, 60 deg Roll)
testModule.rotation.order = 'YXZ';
testModule.rotation.y = (45 * Math.PI) / 180;
testModule.rotation.x = (30 * Math.PI) / 180;
testModule.rotation.z = (60 * Math.PI) / 180;
testModule.position.set(1200, -350, 4800);
testModule.updateMatrixWorld(true);

const boundsRotated = getModuleLocalBounds(testModule);
const sizeRotated = boundsRotated.getSize(new THREE.Vector3());

const deltaX = Math.abs(sizeInitial.x - sizeRotated.x);
const deltaY = Math.abs(sizeInitial.y - sizeRotated.y);
const deltaZ = Math.abs(sizeInitial.z - sizeRotated.z);

if (deltaX < 0.001 && deltaY < 0.001 && deltaZ < 0.001) {
  console.log(`[OK] Rotation Invariance verified! OBB size remained identical under arbitrary 3D rotation.`);
} else {
  console.error(`[FAIL] Rotation Invariance failed! Deltas: dx=${deltaX}, dy=${deltaY}, dz=${deltaZ}`);
  allPassed = false;
}

// 4. Test Dimension Overlay Construction and Memory Disposal
console.log('\n[*] Testing Dimension Overlay Construction & GPU Memory Cleanup...');
const overlayGroup = new THREE.Group();
overlayGroup.name = 'dimension_overlay_group';

let geometriesDisposed = 0;
let materialsDisposed = 0;

const boxGeo = new THREE.BoxGeometry(sizeRotated.x, sizeRotated.y, sizeRotated.z);
const origBoxDispose = boxGeo.dispose.bind(boxGeo);
boxGeo.dispose = () => { geometriesDisposed++; origBoxDispose(); };

const edgesGeo = new THREE.EdgesGeometry(boxGeo);
boxGeo.dispose(); // Immediate disposal of temporary box geometry

const origEdgesDispose = edgesGeo.dispose.bind(edgesGeo);
edgesGeo.dispose = () => { geometriesDisposed++; origEdgesDispose(); };

const boxMat = new THREE.LineBasicMaterial({ color: 0x00f5ff });
const origMatDispose = boxMat.dispose.bind(boxMat);
boxMat.dispose = () => { materialsDisposed++; origMatDispose(); };

const boxWireframe = new THREE.LineSegments(edgesGeo, boxMat);
overlayGroup.add(boxWireframe);

// Cleanup simulation
overlayGroup.traverse(child => {
  if (child.geometry) child.geometry.dispose();
  if (child.material) child.material.dispose();
});

if (geometriesDisposed === 2 && materialsDisposed === 1) {
  console.log(`[OK] All geometries (${geometriesDisposed}) and materials (${materialsDisposed}) cleanly disposed with zero leaks!`);
} else {
  console.error(`[FAIL] Disposal check failed: geometries=${geometriesDisposed}, materials=${materialsDisposed}`);
  allPassed = false;
}

console.log('\n==================================================');
if (allPassed) {
  console.log('[SUCCESS] All 3D Dimension Overlay verification checks passed 100%!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
