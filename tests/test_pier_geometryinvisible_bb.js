import assert from 'assert';
import * as THREE from 'three';
import {
  isPierModule,
  isGeometryInvisibleComponent
} from '../src/viewer.js';
import {
  getInitialModuleSize,
  getInitialModuleDimensions,
  getInitialModuleBounds,
  isPierHarbor
} from '@x4/catalog';
import {
  StationLayoutEngine,
  PlotBounds
} from '../packages/domain/src/index.js';
import {
  moveMovingModuleOutsideOverlap
} from '../src/module-display-panel.js';

console.log('[*] Testing pier module bounding box exclusion of geometryinvisible components...');

// Test 1: Recognition of pier modules
console.log('--- Test 1: Pier Module Recognition ---');
assert(isPierModule('pier_arg_harbor_04_macro'), 'pier_arg_harbor_04_macro must be recognized as pier');
assert(isPierModule('pier_arg_harbor_01_macro'), 'pier_arg_harbor_01_macro must be recognized as pier');
assert(isPierModule('pier_bor_harbor_01_macro'), 'pier_bor_harbor_01_macro must be recognized as pier');
assert(isPierModule('pier_ter_harbor_02_macro'), 'pier_ter_harbor_02_macro must be recognized as pier');
assert(isPierModule({ userData: { macro: 'pier_arg_harbor_04_macro' } }), 'Object3D with pier macro must be recognized');
assert(!isPierModule('dockarea_arg_m_station_01_macro'), 'Regular dockarea is not a pier');
assert(!isPierModule('prod_arg_meat_macro'), 'Production module is not a pier');
console.log('✓ Pier module identification verified.');

// Test 2: Detection of geometryinvisible and clearance components
console.log('--- Test 2: Geometryinvisible Component Detection ---');
const geomInvisMesh = new THREE.Mesh(
  new THREE.BoxGeometry(4000, 2000, 2000),
  new THREE.MeshBasicMaterial({ name: 'materials' })
);
geomInvisMesh.name = 'geometryinvisible-lod0';
assert(isGeometryInvisibleComponent(geomInvisMesh, true), 'geometryinvisible-lod0 must be detected');

const bboxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(4400, 2000, 7600),
  new THREE.MeshBasicMaterial({ name: 'p1_lightcone_soft' })
);
bboxMesh.name = 'bounding_box-lod0';
assert(isGeometryInvisibleComponent(bboxMesh, true), 'bounding_box-lod0 for pier must be detected');

const physicalMesh = new THREE.Mesh(
  new THREE.BoxGeometry(260, 100, 230),
  new THREE.MeshBasicMaterial({ name: 'generic_p1_hulltexture' })
);
physicalMesh.name = 'part_main-lod0';
assert(!isGeometryInvisibleComponent(physicalMesh, true), 'part_main-lod0 must NOT be flagged as invisible');
console.log('✓ Component filtering correctly distinguishes physical vs invisible clearance geometry.');

// Test 3: Bounding box computation with mock pier group
console.log('--- Test 3: Bounding Box Calculation Excludes geometryinvisible ---');

// Create mock StationViewer with bounding box methods
const mockViewer = {
  isPierModule,
  isGeometryInvisibleComponent,
  getModuleLocalBounds(targetModule) {
    if (!targetModule) return null;
    const isPier = isPierModule(targetModule);
    const box = new THREE.Box3();
    let hasStructuralMesh = false;
    targetModule.updateMatrixWorld(true);
    const invWorldMatrix = new THREE.Matrix4().copy(targetModule.matrixWorld).invert();

    targetModule.traverse(child => {
      if (child.isMesh) {
        if (child.userData?.isSnapPoint || isGeometryInvisibleComponent(child, isPier)) {
          return;
        }
        if (child.geometry) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const geomBox = child.geometry.boundingBox.clone();
          const localMat = child.matrixWorld.clone().premultiply(invWorldMatrix);
          geomBox.applyMatrix4(localMat);
          box.union(geomBox);
          hasStructuralMesh = true;
        }
      }
    });
    return hasStructuralMesh ? box : null;
  },
  getModuleWorldBoundingBox(targetModule) {
    if (!targetModule) return null;
    targetModule.updateMatrixWorld(true);
    const localBox = this.getModuleLocalBounds(targetModule);
    if (localBox && !localBox.isEmpty()) {
      const worldBox = localBox.clone();
      worldBox.applyMatrix4(targetModule.matrixWorld);
      return worldBox;
    }
    return null;
  }
};

// Assemble mock pier_arg_harbor_04 with both physical structure and 4000m clearance box
const pierGroup = new THREE.Group();
pierGroup.userData.macro = 'pier_arg_harbor_04_macro';
pierGroup.userData.index = 1;

// Physical structure mesh: 260m x 100m x 230m
const partMain = new THREE.Mesh(
  new THREE.BoxGeometry(260, 100, 230),
  new THREE.MeshBasicMaterial()
);
partMain.name = 'part_main-lod0';
pierGroup.add(partMain);

// Detail structural mesh: 80m x 40m x 60m
const detailMain = new THREE.Mesh(
  new THREE.BoxGeometry(80, 40, 60),
  new THREE.MeshBasicMaterial()
);
detailMain.name = 'detail_s_main-lod0';
pierGroup.add(detailMain);

// Huge invisible clearance box: 4000m x 2000m x 2000m
const clearanceBox = new THREE.Mesh(
  new THREE.BoxGeometry(4000, 2000, 2000),
  new THREE.MeshBasicMaterial()
);
clearanceBox.name = 'geometryinvisible-lod0';
clearanceBox.userData.isGeometryInvisible = true;
pierGroup.add(clearanceBox);

const bounds = mockViewer.getModuleLocalBounds(pierGroup);
assert(bounds, 'Local bounds should be calculated');
const size = bounds.getSize(new THREE.Vector3());

console.log(`Computed Pier Local Bounds: ${size.x}m x ${size.y}m x ${size.z}m`);
assert(Math.abs(size.x - 260) < 1, `Pier width must be 260m, got ${size.x}m`);
assert(Math.abs(size.y - 100) < 1, `Pier height must be 100m, got ${size.y}m`);
assert(Math.abs(size.z - 230) < 1, `Pier depth must be 230m, got ${size.z}m`);
assert(size.x < 1000, 'Bounding box must NOT be expanded by the 4000m geometryinvisible component');
console.log('✓ Pier local and world bounding boxes strictly exclude geometryinvisible components.');

// Test 4: Overlap detection during movement
console.log('--- Test 4: Movement and Overlap Resolution ---');

// Stationary module at (500, 0, 0)
const stationaryMod = new THREE.Group();
stationaryMod.userData.macro = 'prod_arg_meat_macro';
stationaryMod.userData.index = 2;
stationaryMod.position.set(500, 0, 0);
const stationaryMesh = new THREE.Mesh(
  new THREE.BoxGeometry(150, 100, 150),
  new THREE.MeshBasicMaterial()
);
stationaryMod.add(stationaryMesh);

// Function to check overlap between two objects using their world boxes
function checkObjectsOverlap(objA, objB) {
  const boxA = mockViewer.getModuleWorldBoundingBox(objA);
  const boxB = mockViewer.getModuleWorldBoundingBox(objB);
  if (!boxA || !boxB) return false;
  const eps = 0.5;
  return (boxA.max.x - boxB.min.x > eps && boxB.max.x - boxA.min.x > eps) &&
         (boxA.max.y - boxB.min.y > eps && boxB.max.y - boxA.min.y > eps) &&
         (boxA.max.z - boxB.min.z > eps && boxB.max.z - boxA.min.z > eps);
}

// At (0, 0, 0), pier physical edge is at x=130. Stationary is at x=500 (edge at x=425).
// They must NOT overlap!
pierGroup.position.set(0, 0, 0);
const overlapsAt500 = checkObjectsOverlap(pierGroup, stationaryMod);
assert.strictEqual(overlapsAt500, false, 'Pier at (0,0,0) must NOT overlap module at (500,0,0)');
console.log('✓ Pier does not falsely collide with nearby module at 500m (would have collided if geometryinvisible was included).');

// Move stationary module to (150, 0, 0), overlapping the pier's physical body [-130, 130]
stationaryMod.position.set(150, 0, 0);
const overlapsAt150 = checkObjectsOverlap(pierGroup, stationaryMod);
assert.strictEqual(overlapsAt150, true, 'Pier at (0,0,0) must overlap module at (150,0,0)');

// Test resolving overlap using StationLayoutEngine
const plotBounds = new PlotBounds({ minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, minZ: -5000, maxZ: 5000 });
const result = StationLayoutEngine.moveMovingModuleOutsideOverlap(
  pierGroup,
  [stationaryMod],
  plotBounds,
  {
    gap: 5,
    dragAxis: 'X',
    getModuleWorldBox: (m) => mockViewer.getModuleWorldBoundingBox(m),
    applyToObject: true
  }
);

assert(result.moved, 'Pier must be moved to resolve physical overlap');
assert(result.resolved, 'Overlap must be successfully resolved');
console.log(`Resolved pier position: (${pierGroup.position.x}, ${pierGroup.position.y}, ${pierGroup.position.z})`);

const remainingOverlap = checkObjectsOverlap(pierGroup, stationaryMod);
assert.strictEqual(remainingOverlap, false, 'Pier must no longer overlap stationary module after movement resolution');
console.log('✓ Overlap resolution successfully placed pier just outside physical bounding box.');

// Test 5: Catalog module-bounds-hashtable pier dimensions check
console.log('--- Test 5: Catalog Module Bounds for All Known Piers ---');
const testPiers = [
  { macro: 'pier_arg_harbor_01_macro', maxDim: 3600 },
  { macro: 'pier_arg_harbor_02_macro', maxDim: 2000 },
  { macro: 'pier_arg_harbor_03_macro', maxDim: 6200 },
  { macro: 'pier_arg_harbor_04_macro', maxDim: 260 },
  { macro: 'pier_bor_harbor_01_macro', maxDim: 3650 },
  { macro: 'pier_par_harbor_01_macro', maxDim: 3650 },
  { macro: 'pier_tel_harbor_01_macro', maxDim: 3650 },
  { macro: 'pier_ter_harbor_02_macro', maxDim: 2000 },
  { macro: 'pier_ter_harbor_04_macro', maxDim: 350 }
];

for (const p of testPiers) {
  const size = getInitialModuleSize(p.macro);
  assert(size && Array.isArray(size), `Hashtable size must exist for ${p.macro}`);
  const maxActual = Math.max(...size);
  assert(maxActual <= p.maxDim + 50, `Pier ${p.macro} max dimension must be around ${p.maxDim}, got ${maxActual}`);
  console.log(`✓ ${p.macro} size: [${size.join(', ')}] correctly reflects physical structure.`);
}

console.log('\n✅ ALL PIER GEOMETRYINVISIBLE EXCLUSION TESTS PASSED SUCCESSFULLY!');
