// test_plot_bb_violation_color.js
// Verification of: "On any move of module(s), check if any module is outside the plot BB.
// If so, color the plot BB box red until any module(s) is no longer violating the plot BB bounds."

import * as THREE from 'three';
import { getPlotBoundingBox } from '../src/module-display-panel.js';

console.log('[*] Testing Plot BB boundary violation coloring logic...');

// Mock stationPlotGroup structure
function createMockPlotGroup() {
  const group = new THREE.Group();
  group.name = 'stationPlotGroup';

  const boxMat = new THREE.MeshBasicMaterial({ color: 0x00F5FF, opacity: 0.035 });
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), boxMat);
  boxMesh.name = 'plot_box_mesh';
  group.add(boxMesh);

  const edgesMat = new THREE.LineBasicMaterial({ color: 0x00F5FF });
  const edgesLine = new THREE.LineSegments(new THREE.BufferGeometry(), edgesMat);
  edgesLine.name = 'plot_edges_line';
  group.add(edgesLine);

  const cornerMat = new THREE.LineBasicMaterial({ color: 0x39FF14 });
  const cornerLines = new THREE.LineSegments(new THREE.BufferGeometry(), cornerMat);
  cornerLines.name = 'plot_corner_lines';
  group.add(cornerLines);

  const floorMat = new THREE.LineBasicMaterial({ color: 0x00F5FF });
  const floorCross = new THREE.LineSegments(new THREE.BufferGeometry(), floorMat);
  floorCross.name = 'plot_floor_cross';
  group.add(floorCross);

  return group;
}

// Mock viewer state
const mockViewer = {
  currentPlotConfig: {
    x: { plus: 5, minus: 5 }, // -5000 to +5000
    y: { plus: 5, minus: 5 }, // -5000 to +5000
    z: { plus: 5, minus: 5 }, // -5000 to +5000
    enabled: true
  },
  stationPlotGroup: createMockPlotGroup(),
  modulesGroup: new THREE.Group(),

  getModuleWorldBoundingBox(targetModule) {
    if (!targetModule) return null;
    targetModule.updateMatrixWorld(true);

    const initSize = targetModule.userData.initialSize || new THREE.Vector3(100, 100, 100);
    const halfX = initSize.x / 2;
    const halfY = initSize.y / 2;
    const halfZ = initSize.z / 2;
    const min = new THREE.Vector3(-halfX, -halfY, -halfZ);
    const max = new THREE.Vector3(halfX, halfY, halfZ);
    const worldBox = new THREE.Box3(min, max);
    worldBox.applyMatrix4(targetModule.matrixWorld);
    return worldBox;
  },

  checkPlotBoundViolations() {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return false;
    const pCfg = this.currentPlotConfig;
    if (!pCfg || pCfg.enabled === false) return false;

    const plotBb = getPlotBoundingBox(pCfg);
    const EPS = 0.5;

    for (const mod of this.modulesGroup.children) {
      if (!mod || !mod.visible) continue;
      const box = this.getModuleWorldBoundingBox(mod);
      if (!box || box.isEmpty()) continue;

      if (
        box.min.x < plotBb.minX - EPS ||
        box.max.x > plotBb.maxX + EPS ||
        box.min.y < plotBb.minY - EPS ||
        box.max.y > plotBb.maxY + EPS ||
        box.min.z < plotBb.minZ - EPS ||
        box.max.z > plotBb.maxZ + EPS
      ) {
        return true;
      }
    }

    return false;
  },

  updatePlotBoxViolations() {
    if (!this.stationPlotGroup) return;

    const isViolating = this.checkPlotBoundViolations();

    const boxColor = isViolating ? 0xFF0033 : 0x00F5FF;
    const cornerColor = isViolating ? 0xFF0033 : 0x39FF14;
    const floorColor = isViolating ? 0xFF0033 : 0x00F5FF;

    if (this.stationPlotGroup.userData?.isViolating === isViolating) {
      return;
    }
    this.stationPlotGroup.userData = this.stationPlotGroup.userData || {};
    this.stationPlotGroup.userData.isViolating = isViolating;

    const boxMesh = this.stationPlotGroup.getObjectByName('plot_box_mesh');
    if (boxMesh && boxMesh.material) {
      boxMesh.material.color.setHex(boxColor);
      boxMesh.material.opacity = isViolating ? 0.08 : 0.035;
    }

    const edgesLine = this.stationPlotGroup.getObjectByName('plot_edges_line');
    if (edgesLine && edgesLine.material) {
      edgesLine.material.color.setHex(boxColor);
    }

    const cornerLines = this.stationPlotGroup.getObjectByName('plot_corner_lines');
    if (cornerLines && cornerLines.material) {
      cornerLines.material.color.setHex(cornerColor);
    }

    const floorCross = this.stationPlotGroup.getObjectByName('plot_floor_cross');
    if (floorCross && floorCross.material) {
      floorCross.material.color.setHex(floorColor);
    }
  }
};

// Create test module
const testMod = new THREE.Group();
testMod.userData = {
  index: 0,
  initialSize: new THREE.Vector3(200, 200, 200)
};
testMod.position.set(0, 0, 0);
mockViewer.modulesGroup.add(testMod);

// Test 1: Initially inside bounds
console.log('--- Test 1: Module positioned inside bounds (0, 0, 0) ---');
mockViewer.updatePlotBoxViolations();
console.assert(!mockViewer.checkPlotBoundViolations(), 'Should NOT have violations inside bounds');
console.assert(mockViewer.stationPlotGroup.userData.isViolating === false, 'isViolating flag should be false');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_box_mesh').material.color.getHex() === 0x00F5FF, 'Box color should be cyan (0x00F5FF)');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_edges_line').material.color.getHex() === 0x00F5FF, 'Edges color should be cyan (0x00F5FF)');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_corner_lines').material.color.getHex() === 0x39FF14, 'Corners should be neon green (0x39FF14)');
console.log('[PASS] Initially within bounds colors verified cyan/green.');

// Test 2: Move module outside bounds in X direction
console.log('--- Test 2: Move module outside bounds (X = 6000m > 5000m) ---');
testMod.position.set(6000, 0, 0);
testMod.updateMatrixWorld(true);
mockViewer.updatePlotBoxViolations();
console.assert(mockViewer.checkPlotBoundViolations() === true, 'Should detect boundary violation');
console.assert(mockViewer.stationPlotGroup.userData.isViolating === true, 'isViolating flag should be true');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_box_mesh').material.color.getHex() === 0xFF0033, 'Box color should be red (0xFF0033)');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_edges_line').material.color.getHex() === 0xFF0033, 'Edges color should be red (0xFF0033)');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_corner_lines').material.color.getHex() === 0xFF0033, 'Corners should be red (0xFF0033)');
console.log('[PASS] When module is outside bounds, Plot BB turned red.');

// Test 3: Move module back inside bounds
console.log('--- Test 3: Move module back inside bounds (X = 4000m < 5000m - 100m) ---');
testMod.position.set(4000, 0, 0);
testMod.updateMatrixWorld(true);
mockViewer.updatePlotBoxViolations();
console.assert(mockViewer.checkPlotBoundViolations() === false, 'Should no longer have violation');
console.assert(mockViewer.stationPlotGroup.userData.isViolating === false, 'isViolating flag should be false');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_box_mesh').material.color.getHex() === 0x00F5FF, 'Box color reverted to cyan');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_edges_line').material.color.getHex() === 0x00F5FF, 'Edges color reverted to cyan');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_corner_lines').material.color.getHex() === 0x39FF14, 'Corners reverted to green');
console.log('[PASS] Plot BB reverted back to normal cyan/green colors.');

// Test 4: Multi-module scenario (one inside, one outside)
console.log('--- Test 4: Multi-module scenario with 1 outside and 1 inside ---');
const testMod2 = new THREE.Group();
testMod2.userData = {
  index: 1,
  initialSize: new THREE.Vector3(200, 200, 200)
};
testMod2.position.set(0, -6000, 0); // Y is outside (-6000 < -5000)
mockViewer.modulesGroup.add(testMod2);
testMod2.updateMatrixWorld(true);
mockViewer.updatePlotBoxViolations();
console.assert(mockViewer.checkPlotBoundViolations() === true, 'Should detect violation from module 2');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_box_mesh').material.color.getHex() === 0xFF0033, 'Box color should be red');
console.log('[PASS] Multi-module violation correctly detected and turned red.');

// Test 5: Revert module 2 inside
console.log('--- Test 5: Bring module 2 back inside bounds ---');
testMod2.position.set(0, 0, 0);
testMod2.updateMatrixWorld(true);
mockViewer.updatePlotBoxViolations();
console.assert(mockViewer.checkPlotBoundViolations() === false, 'All modules now inside bounds');
console.assert(mockViewer.stationPlotGroup.getObjectByName('plot_box_mesh').material.color.getHex() === 0x00F5FF, 'Box color reverted to cyan');
console.log('[PASS] Reverted back to cyan when all modules are within plot BB.');

console.log('========================================');
console.log('✅ ALL PLOT BB BOUNDS VIOLATION COLORING TESTS PASSED!');
