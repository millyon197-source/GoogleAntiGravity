import {
  Vector3D,
  EulerRotation,
  BoundingBox3D,
  PlotBounds,
  StationModule,
  StationPlan,
  StationLayoutEngine
} from '../src/domain/index.js';

console.log('[*] Testing Domain Core (Hexagonal Architecture Domain Layer)...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Vector3D Value Object
console.log('\n--- Test Group 1: Vector3D Value Object ---');
const v1 = new Vector3D(10, 20, 30);
const v2 = new Vector3D(5, 5, 5);

assert(v1.x === 10 && v1.y === 20 && v1.z === 30, 'Vector3D initialization');
assert(Object.isFrozen(v1), 'Vector3D is immutable (frozen)');

const vAdd = v1.add(v2);
assert(vAdd.equals(new Vector3D(15, 25, 35)), 'Vector3D addition');

const vSub = v1.sub(v2);
assert(vSub.equals(new Vector3D(5, 15, 25)), 'Vector3D subtraction');

const vScale = v1.scale(2);
assert(vScale.equals(new Vector3D(20, 40, 60)), 'Vector3D scaling');

assert(v1.dot(v2) === 10 * 5 + 20 * 5 + 30 * 5, 'Vector3D dot product');
assert(v1.distanceTo(vAdd) === v2.length(), 'Vector3D distance calculation');

// 2. EulerRotation Value Object
console.log('\n--- Test Group 2: EulerRotation Value Object ---');
const rot1 = new EulerRotation(90, 45, 0);
assert(rot1.yaw === 90 && rot1.pitch === 45 && rot1.roll === 0, 'EulerRotation initialization');
assert(Object.isFrozen(rot1), 'EulerRotation is immutable (frozen)');

const rotOver = new EulerRotation(450, -200, 180);
const rotNorm = rotOver.normalize();
assert(rotNorm.yaw === 90 && rotNorm.pitch === 160 && rotNorm.roll === 180, 'EulerRotation angle normalization');

// 3. BoundingBox3D Value Object
console.log('\n--- Test Group 3: BoundingBox3D Value Object ---');
const bb1 = new BoundingBox3D(-50, 50, -20, 20, -100, 100);
assert(bb1.widthX === 100 && bb1.heightY === 40 && bb1.depthZ === 200, 'BoundingBox3D dimensions calculation');
assert(bb1.center.equals(new Vector3D(0, 0, 0)), 'BoundingBox3D center calculation');
assert(bb1.containsPoint(new Vector3D(0, 10, -50)), 'BoundingBox3D contains inside point');
assert(!bb1.containsPoint(new Vector3D(60, 0, 0)), 'BoundingBox3D rejects outside point');

const bb2 = new BoundingBox3D(40, 140, -10, 30, -50, 50);
assert(bb1.intersectsBox(bb2), 'BoundingBox3D intersection detection');

const bb3 = new BoundingBox3D(200, 300, 0, 10, 0, 10);
assert(!bb1.intersectsBox(bb3), 'BoundingBox3D non-intersection');
assert(bb1.intersectsBox(bb3, 160), 'BoundingBox3D intersection with safety margin');

// 4. PlotBounds Value Object
console.log('\n--- Test Group 4: PlotBounds Value Object ---');
const defaultPlot = PlotBounds.defaultBounds();
assert(defaultPlot.minX === -10000 && defaultPlot.maxX === 10000, 'PlotBounds X span is [-10km, +10km]');
assert(defaultPlot.minY === -10000 && defaultPlot.maxY === 10000, 'PlotBounds Y span is [-10km, +10km]');
assert(defaultPlot.minZ === -10000 && defaultPlot.maxZ === 10000, 'PlotBounds Z span is [-10km, +10km] (inverted game coords)');

// Test 20km cumulative axis constraint
const constrainedAxis = PlotBounds.normalizeAxis({ plus: 15, minus: 10 });
assert(constrainedAxis.plus === 15 && constrainedAxis.minus === 5, 'PlotBounds enforces max 20km span constraint');

// Test module clamping
const outsidePos = new Vector3D(15000, 0, 0);
const modSize = new Vector3D(200, 200, 200);
const clampedPos = defaultPlot.clampPosition(outsidePos, modSize);
assert(clampedPos.x === 9900, 'PlotBounds clamps module position honoring bounding box half-extents (9900 <= 10000 - 100)');

// 5. StationModule Entity
console.log('\n--- Test Group 5: StationModule Entity ---');
const moduleEntity = new StationModule({
  index: 1,
  macro: 'struct_arg_cross_01_macro',
  position: new Vector3D(100, 200, 300),
  rotation: new EulerRotation(0, 90, 0),
  connection: 'conn_01',
  category: 'Structure'
});

assert(moduleEntity.index === 1, 'StationModule index stored');
assert(moduleEntity.macro === 'struct_arg_cross_01_macro', 'StationModule macro stored');
assert(moduleEntity.position.equals(new Vector3D(100, 200, 300)), 'StationModule position stored as Vector3D');

moduleEntity.moveTo(new Vector3D(400, 500, 600));
assert(moduleEntity.position.equals(new Vector3D(400, 500, 600)), 'StationModule moveTo updates position');

moduleEntity.setVisibility(false);
assert(!moduleEntity.isVisible, 'StationModule visibility toggle');

const modDto = moduleEntity.toDto();
assert(modDto.index === 1 && modDto.position.x === 400 && modDto.rotation.pitch === 90, 'StationModule serializes to DTO');

// 6. StationPlan Aggregate Root
console.log('\n--- Test Group 6: StationPlan Aggregate Root ---');
const plan = new StationPlan({
  id: 'test_plan_01',
  name: 'Alpha Defense Complex',
  modules: [
    new StationModule({ index: 3, macro: 'defense_macro', position: new Vector3D(0, 200, 0) }),
    new StationModule({ index: 1, macro: 'dock_macro', position: new Vector3D(0, 0, 0) }),
    new StationModule({ index: 2, macro: 'hab_macro', position: new Vector3D(0, 100, 0) })
  ]
});

assert(plan.count === 3, 'StationPlan holds 3 modules');
const sortedMods = plan.getModules();
assert(sortedMods[0].index === 1 && sortedMods[1].index === 2 && sortedMods[2].index === 3,
  'StationPlan.getModules() returns modules sorted by build sequence index');

const planBounds = plan.computeCollectiveBounds(() => ({ x: 50, y: 50, z: 50 }));
assert(planBounds.minY === -25 && planBounds.maxY === 225, 'StationPlan computes collective bounds correctly');

// 7. StationLayoutEngine Domain Service
console.log('\n--- Test Group 7: StationLayoutEngine Domain Service ---');
const overlap = StationLayoutEngine.doBoxesOverlap(
  { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 },
  { x: 50, y: 0, z: 0 }, { x: 100, y: 100, z: 100 },
  0
);
assert(overlap, 'StationLayoutEngine detects overlapping 3D boxes');

const noOverlap = StationLayoutEngine.doBoxesOverlap(
  { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 },
  { x: 200, y: 0, z: 0 }, { x: 100, y: 100, z: 100 },
  0
);
assert(!noOverlap, 'StationLayoutEngine detects non-overlapping 3D boxes');

const collidingModules = [
  { position: { x: 0, y: 0, z: 0 }, initialSize: { x: 100, y: 100, z: 100 } },
  { position: { x: 10, y: 0, z: 0 }, initialSize: { x: 100, y: 100, z: 100 } }
];

const resolvedCount = StationLayoutEngine.ensureNoBoundingBoxOverlaps(collidingModules, defaultPlot, { gap: 20 });
assert(resolvedCount > 0, `StationLayoutEngine resolved collision (${resolvedCount} overlap resolved)`);
assert(!StationLayoutEngine.doBoxesOverlap(
  collidingModules[0].position, collidingModules[0].initialSize,
  collidingModules[1].position, collidingModules[1].initialSize,
  20
), 'Modules are separated after collision resolution');

if (allPassed) {
  console.log('\n[PASS] All Domain Layer unit tests passed successfully!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Some Domain Layer unit tests failed.');
  process.exit(1);
}
