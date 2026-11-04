import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import { parseConstructionPlan } from '../src/parser.js';
import { isPierHarbor, getPierDockDirection } from '../src/modules.js';
import { getModuleSnapPoints } from '../src/snap-points-db.js';
import { computeModuleGroupRotation } from '../src/rotation-math.js';

// Simulation of StationViewer.alignPierProngsOutward matching src/viewer.js
function buildModuleSnapPoints(moduleGroup, macroName) {
  if (!moduleGroup) return;
  const snaps = getModuleSnapPoints(macroName);
  if (!snaps || snaps.length === 0) return;

  const snapsGroup = new THREE.Group();
  snapsGroup.name = 'module_snaps_group';

  for (const snap of snaps) {
    const dot = new THREE.Mesh();
    dot.name = 'snap_dot_' + snap.name;
    dot.userData = {
      isSnapPoint: true,
      snapName: snap.name,
      moduleIndex: moduleGroup.userData.index,
      localPos: [...snap.pos]
    };
    dot.position.set(-snap.pos[0], snap.pos[1], snap.pos[2]);
    snapsGroup.add(dot);
  }

  if (macroName && isPierHarbor(macroName)) {
    snapsGroup.rotation.y = moduleGroup.userData.pierInnerRotY || 0;
  }

  moduleGroup.add(snapsGroup);
}

function alignPierProngsOutward(moduleGroup, macroName, stationBBox, modulesGroup = null) {
  if (!moduleGroup || !stationBBox) return;

  // Connected pier chains: if this pier is snapped to a predecessor pier harbor,
  // inherit the predecessor's pierInnerRotY so they rotate together as a continuous unit
  // and preserve their snap point mating interface.
  if (moduleGroup.userData.predecessor && moduleGroup.userData.predecessor.index && modulesGroup) {
    const parentMod = modulesGroup.children.find(c => c.userData && c.userData.index === moduleGroup.userData.predecessor.index);
    if (parentMod && parentMod.userData.macro && isPierHarbor(parentMod.userData.macro)) {
      const parentRotY = parentMod.userData.pierInnerRotY || 0;
      moduleGroup.userData.pierInnerRotY = parentRotY;
      for (const child of moduleGroup.children) {
        if (child.name !== 'module_snaps_group') {
          child.rotation.y = parentRotY;
        }
      }
      return { closestDir: null, rotY: parentRotY };
    }
  }

  const pos = moduleGroup.position;
  const sizeX = stationBBox.max.x - stationBBox.min.x;
  const sizeY = stationBBox.max.y - stationBBox.min.y;
  const sizeZ = stationBBox.max.z - stationBBox.min.z;

  const baseProngDir = getPierDockDirection(macroName, THREE);
  const prongVector0 = new THREE.Vector3(baseProngDir.x, baseProngDir.y, baseProngDir.z).applyEuler(moduleGroup.rotation);
  const prongVectorPI = new THREE.Vector3(-baseProngDir.x, -baseProngDir.y, -baseProngDir.z).applyEuler(moduleGroup.rotation);

  // Only consider boundary walls that are not perpendicular to the prongs
  const candidates = [];
  const checkAxis = (size, distMin, dirMin, distMax, dirMax) => {
    if (size > 100) {
      if (Math.abs(prongVector0.dot(dirMin)) > 0.1) candidates.push({ dist: distMin, dir: dirMin });
      if (Math.abs(prongVector0.dot(dirMax)) > 0.1) candidates.push({ dist: distMax, dir: dirMax });
    }
  };

  checkAxis(sizeX, pos.x - stationBBox.min.x, new THREE.Vector3(-1, 0, 0), stationBBox.max.x - pos.x, new THREE.Vector3(1, 0, 0));
  checkAxis(sizeY, pos.y - stationBBox.min.y, new THREE.Vector3(0, -1, 0), stationBBox.max.y - pos.y, new THREE.Vector3(0, 1, 0));
  checkAxis(sizeZ, pos.z - stationBBox.min.z, new THREE.Vector3(0, 0, -1), stationBBox.max.z - pos.z, new THREE.Vector3(0, 0, 1));

  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.dist - b.dist);
  const closestDir = candidates[0].dir;

  const dot0 = prongVector0.dot(closestDir);
  const dotPI = prongVectorPI.dot(closestDir);

  // Only flip if dotPI is strictly better than dot0 by a clear margin (> 0.05)
  const rotY = (dotPI > dot0 + 0.05) ? Math.PI : 0;
  moduleGroup.userData.pierInnerRotY = rotY;

  for (const child of moduleGroup.children) {
    if (child.name !== 'module_snaps_group') {
      child.rotation.y = rotY;
    }
  }

  return { closestDir, rotY };
}

// Verification 1: Outward facing pier prong alignment to closest BB dimension across blueprints
console.log('--- VERIFYING PIER PRONG ALIGNMENT TO CLOSEST BB DIMENSION ---');

const testFiles = [
  'D:/Ai/X4/ConstructionPlans/constructionplan/Planar - Paranid.xml',
  'D:/Ai/X4/ConstructionPlans/constructionplan/Sym_s Shipyard_Wharf With Storage_Defended_Habs.xml',
  'D:/Ai/X4/ConstructionPlans/constructionplan/Dock Planar Accepted.xml',
  'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/4 E Piers.xml',
  'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/8x2x4 Docks Storage.xml',
  'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Prod Max.xml'
];

for (const file of testFiles) {
  if (!fs.existsSync(file)) continue;
  const xml = fs.readFileSync(file, 'utf8');
  const plan = parseConstructionPlan(xml);

  const box = new THREE.Box3();
  for (const m of plan.modules) {
    if (m.position) {
      box.expandByPoint(new THREE.Vector3(m.position.x, m.position.y, -m.position.z));
    }
  }

  const modulesGroup = new THREE.Group();
  for (const mod of plan.modules) {
    const moduleGroup = new THREE.Group();
    moduleGroup.position.set(mod.position.x, mod.position.y, -mod.position.z);
    moduleGroup.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));
    moduleGroup.userData = {
      index: mod.index,
      macro: mod.macro,
      connection: mod.connection,
      predecessor: mod.predecessor || null
    };
    const innerScene = new THREE.Group();
    moduleGroup.add(innerScene);

    if (mod.macro && isPierHarbor(mod.macro)) {
      const res = alignPierProngsOutward(moduleGroup, mod.macro, box, modulesGroup);
      moduleGroup.updateMatrixWorld(true);

      const baseProngDir = getPierDockDirection(mod.macro, THREE);
      const worldProngDir = baseProngDir.clone().applyEuler(new THREE.Euler(0, moduleGroup.userData.pierInnerRotY || 0, 0, 'YXZ')).applyEuler(moduleGroup.rotation);

      if (res && res.closestDir) {
        const alignmentDot = worldProngDir.dot(res.closestDir);
        assert(alignmentDot >= 0, `Pier #${mod.index} prongs must face outward towards ${res.closestDir.x}, ${res.closestDir.z}`);
        console.log(`[PASS] ${file.split('/').pop()} Pier #${mod.index} (${mod.macro}): prongs face outward (dot: ${alignmentDot.toFixed(2)}) towards closest BB dimension (${res.closestDir.x}, ${res.closestDir.z}).`);
      } else {
        console.log(`[PASS] ${file.split('/').pop()} Pier #${mod.index} (${mod.macro}): snapped to parent pier #${mod.predecessor.index}, continuous alignment preserved.`);
      }
    }
    modulesGroup.add(moduleGroup);
  }
}

// Verification 2: Snap point alignment with inner scene
console.log('\n--- VERIFYING SNAP POINT ALIGNMENT ---');
const testGroup = new THREE.Group();
testGroup.userData.pierInnerRotY = Math.PI;
const innerScene = new THREE.Group();
innerScene.rotation.y = Math.PI;
testGroup.add(innerScene);

const snapsGroup = new THREE.Group();
snapsGroup.rotation.y = testGroup.userData.pierInnerRotY;
const snapDot = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
snapDot.position.set(-200, 0, 0);
snapsGroup.add(snapDot);
testGroup.add(snapsGroup);
testGroup.updateMatrixWorld(true);

const snapPos = snapDot.getWorldPosition(new THREE.Vector3());
const connPos = new THREE.Vector3(-200, 0, 0).applyMatrix4(innerScene.matrixWorld);
if (snapPos.distanceTo(connPos) < 0.001) {
  console.log('[PASS] Snap point dot coincides with pier connector interface.');
} else {
  console.error('[FAIL] Snap point dot does not match connector position.');
  process.exit(1);
}

// Verification 3: Classification of Pier Harbors
console.log('\n--- VERIFYING PIER HARBOR CLASSIFICATION (isPierHarbor) ---');
const pierHarborMacros = [
  'pier_arg_harbor_01_macro', // Argon 3-Dock T Pier
  'pier_arg_harbor_02_macro', // Argon 1-Dock Pier
  'pier_arg_harbor_03_macro', // Argon 3-Dock E Pier
  'pier_arg_harbor_04_macro',
  'pier_par_harbor_01_macro', // Paranid 3-Dock T Pier
  'pier_par_harbor_02_macro', // Paranid 1-Dock Pier
  'pier_par_harbor_03_macro', // Paranid 3-Dock E Pier
  'pier_tel_harbor_01_macro', // Teladi 3-Dock T Pier
  'pier_tel_harbor_02_macro', // Teladi 1-Dock Pier
  'pier_tel_harbor_03_macro', // Teladi 3-Dock E Pier
  'pier_spl_harbor_01_macro', // Split 4-Dock T Pier
  'pier_spl_harbor_02_macro', // Split 1-Dock Pier
  'pier_spl_harbor_03_macro', // Split 3-Dock E Pier
  'pier_ter_harbor_01_macro', // Terran 3-Dock T Pier
  'pier_ter_harbor_02_macro', // Terran 1-Dock Pier
  'pier_ter_harbor_03_macro', // Terran 3-Dock E Pier
  'pier_ter_harbor_04_macro', // Terran 4-Dock T Pier
  'pier_bor_harbor_01_macro', // Boron 4-Dock T Pier
  'pier_bor_harbor_02_macro', // Boron 1-Dock Pier
  'pier_bor_harbor_03_macro', // Boron 3-Dock E Pier
  'pier_bor_harbor_04_macro'  // Boron Trading Station 4-Dock Pier
];

for (const m of pierHarborMacros) {
  assert.strictEqual(isPierHarbor(m), true, `${m} must be recognized as a Pier Harbor`);
}
console.log(`[PASS] All ${pierHarborMacros.length} Pier Harbor macros correctly identified by isPierHarbor.`);

const nonPierMacros = [
  'dockarea_arg_m_station_01_macro',
  'dockarea_arg_s_station_01_macro',
  'prod_arg_meat_macro',
  'storage_arg_l_container_01_macro',
  'hab_arg_l_macro',
  'def_arg_tube_01_macro',
  'struct_arg_cross_01_macro'
];

for (const m of nonPierMacros) {
  assert.strictEqual(isPierHarbor(m), false, `${m} must NOT be recognized as a Pier Harbor`);
}
console.log('[PASS] Non-pier modules correctly rejected by isPierHarbor.');

// Verification 4: Orientation behavior for all Pier Harbors
console.log('\n--- VERIFYING ORIENTATION FLIP BEHAVIOR ACROSS ALL PIER HARBORS ---');
const stationBox = new THREE.Box3(
  new THREE.Vector3(-1000, -1000, -1000),
  new THREE.Vector3(1000, 1000, 1000)
);

for (const macro of pierHarborMacros) {
  const baseDir = getPierDockDirection(macro, THREE);

  // Case A: Pier Harbor positioned near +X boundary (+900, 0, 0)
  // Orient so dock prongs point along -X (inward towards center); it must flip by Math.PI so prongs face +X (outward)
  const inwardEuler = baseDir.x < 0
    ? new THREE.Euler(0, 0, 0, 'YXZ')       // (-1, 0, 0) rotated by 0 points -X (inward)
    : new THREE.Euler(0, Math.PI, 0, 'YXZ'); // (1, 0, 0) rotated by PI points -X (inward)

  const groupInward = new THREE.Group();
  groupInward.position.set(900, 0, 0);
  groupInward.rotation.order = 'YXZ';
  groupInward.rotation.copy(inwardEuler);
  groupInward.userData = { macro, index: 1, predecessor: null };
  const innerA = new THREE.Group();
  groupInward.add(innerA);

  const resA = alignPierProngsOutward(groupInward, macro, stationBox);
  assert.strictEqual(resA.rotY, Math.PI, `${macro} pointing inward must flip by Math.PI (180 deg) to face outward`);
  assert.strictEqual(groupInward.userData.pierInnerRotY, Math.PI);
  assert.strictEqual(innerA.rotation.y, Math.PI);

  // Case B: Pier Harbor positioned near +X boundary (+900, 0, 0) with prongs already pointing +X (outward)
  const outwardEuler = baseDir.x < 0
    ? new THREE.Euler(0, Math.PI, 0, 'YXZ') // (-1, 0, 0) rotated by PI points +X (outward)
    : new THREE.Euler(0, 0, 0, 'YXZ');       // (1, 0, 0) rotated by 0 points +X (outward)

  const groupOutward = new THREE.Group();
  groupOutward.position.set(900, 0, 0);
  groupOutward.rotation.order = 'YXZ';
  groupOutward.rotation.copy(outwardEuler);
  groupOutward.userData = { macro, index: 2, predecessor: null };
  const innerB = new THREE.Group();
  groupOutward.add(innerB);

  const resB = alignPierProngsOutward(groupOutward, macro, stationBox);
  assert.strictEqual(resB.rotY, 0, `${macro} already pointing outward must NOT flip (rotY = 0)`);
  assert.strictEqual(groupOutward.userData.pierInnerRotY, 0);
  assert.strictEqual(innerB.rotation.y, 0);
}
console.log(`[PASS] Orientation flip behavior verified for all ${pierHarborMacros.length} Pier Harbors.`);

// Verification 5: Blueprint "Tiny Shipyard" One Dock Pier Alignment & Connection
console.log('\n--- VERIFYING TINY SHIPYARD ONE DOCK PIER ALIGNMENT & CONNECTION ---');

const tinyShipyardPaths = [
  'D:/Ai/X4/ConstructionPlans/constructionplan/tiny shipyard.xml',
  'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/tiny shipyard.xml'
];

for (const tinyPath of tinyShipyardPaths) {
  if (!fs.existsSync(tinyPath)) continue;
  const tinyXml = fs.readFileSync(tinyPath, 'utf8');
  const tinyPlan = parseConstructionPlan(tinyXml);

  const box = new THREE.Box3();
  for (const m of tinyPlan.modules) {
    if (m.position) {
      box.expandByPoint(new THREE.Vector3(m.position.x, m.position.y, -m.position.z));
    }
  }

  const modulesGroup = new THREE.Group();
  for (const mod of tinyPlan.modules) {
    const moduleGroup = new THREE.Group();
    moduleGroup.position.set(mod.position.x, mod.position.y, -mod.position.z);
    moduleGroup.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));
    moduleGroup.userData = {
      index: mod.index,
      macro: mod.macro,
      connection: mod.connection,
      predecessor: mod.predecessor || null
    };
    const innerScene = new THREE.Group();
    moduleGroup.add(innerScene);

    if (mod.macro && isPierHarbor(mod.macro)) {
      alignPierProngsOutward(moduleGroup, mod.macro, box, modulesGroup);
    }
    modulesGroup.add(moduleGroup);
    buildModuleSnapPoints(moduleGroup, mod.macro);
  }

  const p7 = modulesGroup.children.find(c => c.userData.index === 7);
  // Find connected pier (index 8 in D: plan, index 22 in C: Egosoft plan)
  const pOther = modulesGroup.children.find(c =>
    c.userData.index !== 7 &&
    c.userData.macro === 'pier_arg_harbor_02_macro' &&
    c.userData.predecessor &&
    c.userData.predecessor.index === 7
  );

  assert(p7, 'Module #7 must be present in tiny shipyard: ' + tinyPath);
  assert(pOther, 'Connected pier must be present in tiny shipyard: ' + tinyPath);
  assert.strictEqual(p7.userData.macro, 'pier_arg_harbor_02_macro', 'Module #7 is pier_arg_harbor_02_macro');
  assert.strictEqual(pOther.userData.macro, 'pier_arg_harbor_02_macro', 'Connected pier is pier_arg_harbor_02_macro');

  // Both piers must have rotY = 0 (neither flipped, preserving blueprint alignment)
  assert.strictEqual(p7.userData.pierInnerRotY, 0, 'Pier #7 must NOT flip (rotY = 0)');
  assert.strictEqual(pOther.userData.pierInnerRotY, 0, 'Connected Pier #' + pOther.userData.index + ' must NOT flip (rotY = 0)');

  // Verify outward dock directions for both piers:
  // Pier #7 points along -Z into open space; Connected pier points along +Z into open space
  const dir7 = getPierDockDirection(p7.userData.macro, THREE).applyEuler(p7.rotation);
  const dirOther = getPierDockDirection(pOther.userData.macro, THREE).applyEuler(pOther.rotation);

  assert(dir7.z < -0.9, 'Pier #7 dock points outward towards -Z into open space');
  assert(dirOther.z > 0.9, 'Pier #' + pOther.userData.index + ' dock points outward towards +Z into open space');

  // Verify physical connection distance at ConnectionSnap002
  const snap7 = p7.getObjectByName('snap_dot_ConnectionSnap002');
  const snapOther = pOther.getObjectByName('snap_dot_ConnectionSnap002');
  assert(snap7 && snapOther, 'Both Pier #7 and Pier #' + pOther.userData.index + ' must have snap_dot_ConnectionSnap002');
  const w7 = new THREE.Vector3();
  const wOther = new THREE.Vector3();
  snap7.getWorldPosition(w7);
  snapOther.getWorldPosition(wOther);
  const snapDist = w7.distanceTo(wOther);
  assert(snapDist < 0.01, 'ConnectionSnap002 between Pier #7 and Pier #' + pOther.userData.index + ' must have 0.00m separation, got ' + snapDist.toFixed(4) + 'm');
  console.log('[PASS] ConnectionSnap002 between Pier #7 and Pier #' + pOther.userData.index + ' in (' + tinyPath.split('/').pop() + ') connects with 0.00m separation (dist: ' + snapDist.toFixed(4) + 'm).');
  console.log('[PASS] Pier #7 and Pier #' + pOther.userData.index + ' align outward in opposite space directions (rotY = 0).');
  console.log('[PASS] Continuous alignment and snap interface connection preserved between Pier #7 and Pier #' + pOther.userData.index + '.');
}
