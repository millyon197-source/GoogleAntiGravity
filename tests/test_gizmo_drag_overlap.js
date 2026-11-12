import * as THREE from 'three';
import { StationLayoutEngine } from '../packages/domain/src/services/station-layout-engine.js';
import { PlotBounds } from '../packages/domain/src/value-objects/plot-bounds.js';
import {
  doBoxesOverlap,
  moveMovingModuleOutsideOverlap,
  DEFAULT_PLOT_CONFIG
} from '../src/module-display-panel.js';

console.log('[*] Starting automated validation of gizmo drag overlap resolution...');

let allPassed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[OK] ${message}`);
  }
}

// 1. Direct overlap detection & resolution
{
  const plotBounds = new PlotBounds({
    enabled: true,
    x: { plus: 5, minus: 5 },
    y: { plus: 5, minus: 5 },
    z: { plus: 5, minus: 5 }
  });

  // Stationary module at (0, 0, 0) with size 200x200x200
  const stationary = {
    position: { x: 0, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  // Moving module dragged right into overlap at (50, 0, 0)
  const moving = {
    position: { x: 50, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  const initialOverlap = doBoxesOverlap(moving.position, moving.initialSize, stationary.position, stationary.initialSize, 0);
  assert(initialOverlap === true, 'Initial placement correctly detects overlap');

  const result = moveMovingModuleOutsideOverlap(moving, [stationary], plotBounds, {
    gap: 10,
    fromPos: { x: 300, y: 0, z: 0 },
    dragAxis: 'X'
  });

  assert(result.moved === true, 'Module was moved outside of overlap');
  assert(result.resolved === true, 'Overlap was successfully resolved');

  const postOverlap = doBoxesOverlap(moving.position, moving.initialSize, stationary.position, stationary.initialSize, 0);
  assert(postOverlap === false, 'Moving module no longer overlaps stationary module BB');
  assert(Math.abs(moving.position.x) >= 200, `Moving module moved outside BB boundary (pos.x=${moving.position.x})`);
}

// 2. Non-overlapping move leaves module in place
{
  const plotBounds = new PlotBounds({
    enabled: true,
    x: { plus: 5, minus: 5 },
    y: { plus: 5, minus: 5 },
    z: { plus: 5, minus: 5 }
  });

  const stationary = {
    position: { x: 0, y: 0, z: 0 },
    initialSize: { x: 100, y: 100, z: 100 }
  };

  const moving = {
    position: { x: 500, y: 200, z: -300 },
    initialSize: { x: 100, y: 100, z: 100 }
  };

  const initialPos = { ...moving.position };
  const result = moveMovingModuleOutsideOverlap(moving, [stationary], plotBounds, {
    gap: 10
  });

  assert(result.moved === false, 'Non-overlapping module was not moved');
  assert(
    moving.position.x === initialPos.x &&
    moving.position.y === initialPos.y &&
    moving.position.z === initialPos.z,
    'Module remained at dropped coordinates'
  );
}

// 3. Multi-module collision cascade (moving into gap between two modules)
{
  const plotBounds = new PlotBounds({
    enabled: true,
    x: { plus: 5, minus: 5 },
    y: { plus: 5, minus: 5 },
    z: { plus: 5, minus: 5 }
  });

  const stationary1 = {
    position: { x: -150, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };
  const stationary2 = {
    position: { x: 150, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  const moving = {
    position: { x: 0, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  const result = moveMovingModuleOutsideOverlap(moving, [stationary1, stationary2], plotBounds, {
    gap: 5
  });

  assert(result.moved === true, 'Trapped module moved to open axis');
  assert(result.resolved === true, 'Cascade overlaps resolved');

  const overlap1 = doBoxesOverlap(moving.position, moving.initialSize, stationary1.position, stationary1.initialSize, 0);
  const overlap2 = doBoxesOverlap(moving.position, moving.initialSize, stationary2.position, stationary2.initialSize, 0);
  assert(!overlap1 && !overlap2, 'Resolved position clears both stationary modules');
}

// 4. Confinement to plot bounding box
{
  // Small plot: 1km total width
  const plotBounds = new PlotBounds({
    enabled: true,
    x: { plus: 0.5, minus: 0.5 },
    y: { plus: 0.5, minus: 0.5 },
    z: { plus: 0.5, minus: 0.5 }
  });

  const stationary = {
    position: { x: 300, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  const moving = {
    position: { x: 350, y: 0, z: 0 },
    initialSize: { x: 200, y: 200, z: 200 }
  };

  const result = moveMovingModuleOutsideOverlap(moving, [stationary], plotBounds, {
    gap: 5
  });

  assert(result.resolved === true, 'Resolved within small plot');
  assert(moving.position.x + 100 <= plotBounds.maxX + 0.1, 'Module right edge does not exceed plot maxX');
  assert(moving.position.x - 100 >= plotBounds.minX - 0.1, 'Module left edge does not exceed plot minX');
}

// 5. Integration with Three.js Object3D and handleModuleDragEnd workflow
{
  const modMesh1 = new THREE.Group();
  modMesh1.userData = { index: 1, macro: 'station_dock' };
  modMesh1.position.set(0, 0, 0);
  modMesh1.userData.initialSize = new THREE.Vector3(200, 100, 200);

  const modMesh2 = new THREE.Group();
  modMesh2.userData = { index: 2, macro: 'station_prod' };
  modMesh2.position.set(50, 0, 0); // Overlaps modMesh1
  modMesh2.userData.initialSize = new THREE.Vector3(200, 100, 200);

  const mockViewer = {
    modulesGroup: {
      children: [modMesh1, modMesh2]
    },
    currentPlan: {
      modules: [
        { index: 1, macro: 'station_dock', position: { x: 0, y: 0, z: 0 } },
        { index: 2, macro: 'station_prod', position: { x: 50, y: 0, z: 0 } }
      ]
    },
    transformControls: {
      object: modMesh2,
      axis: 'X'
    },
    getModuleInitialSize: (m) => m.userData.initialSize,
    dragStartPosition: { x: 300, y: 0, z: 0 },
    hasGizmoMoved: true,
    isGizmoDragging: () => true,
    updatePlotBoxViolations: () => {},
    restoreFullPlanGrid: () => {},
    rendered: false,
    renderScene: function() { this.rendered = true; }
  };

  // Simulate viewer.handleModuleDragEnd() logic
  const targetModule = mockViewer.transformControls.object;
  const modIndex = targetModule.userData.index;
  const mod = mockViewer.currentPlan?.modules?.find(m => m.index === modIndex);

  const plotConfig = DEFAULT_PLOT_CONFIG;
  const stationaryModules = (mockViewer.modulesGroup?.children || []).filter(
    m => m !== targetModule && m.visible !== false && m.userData?.index !== undefined
  );

  const fromPosThree = mockViewer.dragStartPosition ? {
    x: mockViewer.dragStartPosition.x,
    y: mockViewer.dragStartPosition.y,
    z: -mockViewer.dragStartPosition.z
  } : null;

  moveMovingModuleOutsideOverlap(targetModule, stationaryModules, plotConfig, {
    gap: 5,
    fromPos: fromPosThree,
    dragAxis: mockViewer.transformControls?.axis || '',
    getSize: (m) => mockViewer.getModuleInitialSize(m),
    applyToObject: true
  });

  const planPos = {
    x: Math.round(targetModule.position.x),
    y: Math.round(targetModule.position.y),
    z: Math.round(-targetModule.position.z)
  };

  targetModule.position.set(planPos.x, planPos.y, -planPos.z);
  targetModule.updateMatrixWorld(true);

  if (mod) {
    mod.position.x = planPos.x;
    mod.position.y = planPos.y;
    mod.position.z = planPos.z;
  }

  mockViewer.renderScene();

  const finalOverlap = doBoxesOverlap(
    targetModule.position,
    targetModule.userData.initialSize,
    modMesh1.position,
    modMesh1.userData.initialSize,
    0
  );

  assert(finalOverlap === false, 'handleModuleDragEnd simulation resolves overlap completely');
  assert(mockViewer.rendered === true, 'Scene re-render was triggered on gizmo release');
  assert(mod.position.x === planPos.x, `Plan coordinates updated to match resolved position (${planPos.x}, ${planPos.y}, ${planPos.z})`);
}

// 6. Drag axis prioritization (dragging along X separates along X, not jumping in Y)
{
  const plotBounds = new PlotBounds();

  // Stationary module with large width X (1200), smaller height Y (260), depth Z (800)
  const stationary = {
    position: { x: 0, y: 0, z: 0 },
    initialSize: { x: 1200, y: 260, z: 800 }
  };

  // Moving module dragged along X into overlap at (200, 0, 0)
  const moving = {
    position: { x: 200, y: 0, z: 0 },
    initialSize: { x: 400, y: 290, z: 400 }
  };

  const result = moveMovingModuleOutsideOverlap(moving, [stationary], plotBounds, {
    gap: 5,
    fromPos: { x: -1000, y: 0, z: 0 }, // Dragged from left to right (+X)
    dragAxis: 'X'
  });

  assert(result.moved === true, 'Overlapping module moved');
  assert(result.resolved === true, 'Resolved along drag axis');
  assert(moving.position.y === 0, `Module stayed in horizontal plane without jumping in Y (y=${moving.position.y})`);
  assert(moving.position.x >= 805, `Module moved past stationary along X in direction of drag (x=${moving.position.x})`);
  assert(!doBoxesOverlap(moving.position, moving.initialSize, stationary.position, stationary.initialSize, 0), 'No overlap remaining');
}

// 7. Rotated module bounding box with getModuleWorldBox
{
  const plotBounds = new PlotBounds();

  // Stationary module at (0, 0, 0)
  const stationary = new THREE.Group();
  stationary.position.set(0, 0, 0);
  stationary.userData.initialSize = new THREE.Vector3(400, 200, 400);

  // Moving module rotated 90 deg around Y: width 200 becomes 1200 in world Z!
  const moving = new THREE.Group();
  moving.position.set(100, 0, 0);
  moving.rotation.y = Math.PI / 2;
  moving.userData.initialSize = new THREE.Vector3(1200, 200, 300);

  const getWorldBox = (m) => {
    const halfX = m.userData.initialSize.x / 2;
    const halfY = m.userData.initialSize.y / 2;
    const halfZ = m.userData.initialSize.z / 2;
    const min = new THREE.Vector3(-halfX, -halfY, -halfZ);
    const max = new THREE.Vector3(halfX, halfY, halfZ);
    const box = new THREE.Box3(min, max);
    m.updateMatrixWorld(true);
    box.applyMatrix4(m.matrixWorld);
    return box;
  };

  const result = moveMovingModuleOutsideOverlap(moving, [stationary], plotBounds, {
    gap: 5,
    fromPos: { x: 500, y: 0, z: 0 },
    dragAxis: 'X',
    getModuleWorldBox: getWorldBox
  });

  assert(result.resolved === true, 'Rotated module overlap resolved');
  const boxM = getWorldBox(moving);
  const boxS = getWorldBox(stationary);
  const penetrates = (boxM.max.x - boxS.min.x > 0.5 && boxS.max.x - boxM.min.x > 0.5) &&
                     (boxM.max.y - boxS.min.y > 0.5 && boxS.max.y - boxM.min.y > 0.5) &&
                     (boxM.max.z - boxS.min.z > 0.5 && boxS.max.z - boxM.min.z > 0.5);
  assert(!penetrates, 'Rotated world bounding box has zero overlap with stationary BB');
}

if (allPassed) {
  console.log('\n[PASS] All gizmo drag overlap resolution tests passed successfully.');
} else {
  console.error('\n[FAIL] One or more gizmo drag overlap tests failed.');
  process.exit(1);
}
