import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';
import PART_MAIN_OFFSETS from '../../src/part-main-offsets.json' with { type: 'json' };

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

// Build map of modules
const modMap = new Map();
for (const m of plan.modules) {
  modMap.set(m.index, m);
}

function getSnapPoints(macro) {
  const baseName = macro.replace(/_macro$/, '');
  return SNAP_POINTS_DB[baseName] || SNAP_POINTS_DB[macro] || [];
}

// Compute world position of a snap point in our visualizer space:
// Visualizer world pos of module: (mod.position.x, mod.position.y, -mod.position.z)
// Visualizer rotation of moduleGroup:
// order = 'YXZ'
// rotation.y = yaw * PI/180
// rotation.x = (pitch + 180) * PI/180
// rotation.z = (roll + 180) * PI/180
// Snap point local pos inside moduleGroup:
// dot.position.set(-snap.pos[0], snap.pos[1], -snap.pos[2])
function getVisualizerSnapWorldPos(mod, snapName) {
  const snaps = getSnapPoints(mod.macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;

  const rotEuler = new THREE.Euler(
    (mod.rotation.pitch + 180) * Math.PI / 180,
    mod.rotation.yaw * Math.PI / 180,
    (mod.rotation.roll + 180) * Math.PI / 180,
    'YXZ'
  );

  const localPos = new THREE.Vector3(-snap.pos[0], snap.pos[1], -snap.pos[2]);
  localPos.applyEuler(rotEuler);
  localPos.add(new THREE.Vector3(mod.position.x, mod.position.y, -mod.position.z));
  return { pos: localPos, snap };
}

// Also compute in raw X4 space:
// X4 module pos: (mod.position.x, mod.position.y, mod.position.z)
// X4 rotation: yaw around Y, pitch around X, roll around Z (or whatever X4 does)
// Let's check visualizer snap world pos distance for every connection
let totalChecked = 0;
let missingSnaps = 0;
let perfectlySnapped = 0; // dist < 0.1m
let misaligned = [];

for (const mod of plan.modules) {
  if (!mod.connection || !mod.predecessor) continue;
  const pred = modMap.get(mod.predecessor.index);
  if (!pred) continue;

  totalChecked++;
  const modSnap = getVisualizerSnapWorldPos(mod, mod.connection);
  const predSnap = getVisualizerSnapWorldPos(pred, mod.predecessor.connection);

  if (!modSnap || !predSnap) {
    missingSnaps++;
    misaligned.push({
      modIndex: mod.index,
      modMacro: mod.macro,
      modConn: mod.connection,
      predIndex: pred.index,
      predMacro: pred.macro,
      predConn: mod.predecessor.connection,
      reason: `Missing snap data: modSnap=${!!modSnap}, predSnap=${!!predSnap}`
    });
    continue;
  }

  const dist = modSnap.pos.distanceTo(predSnap.pos);
  if (dist < 0.2) {
    perfectlySnapped++;
  } else {
    misaligned.push({
      modIndex: mod.index,
      modMacro: mod.macro,
      modConn: mod.connection,
      predIndex: pred.index,
      predMacro: pred.macro,
      predConn: mod.predecessor.connection,
      dist: dist.toFixed(3),
      modPos: modSnap.pos,
      predPos: predSnap.pos,
      modRot: mod.rotation,
      predRot: pred.rotation
    });
  }
}

console.log(`Total connections checked: ${totalChecked}`);
console.log(`Perfect snap matches (dist < 0.2m): ${perfectlySnapped}`);
console.log(`Missing snap data: ${missingSnaps}`);
console.log(`Misaligned count: ${misaligned.length}`);

// Group misalignments by macro
const misalignedByMacro = {};
for (const m of misaligned) {
  const key = `${m.modMacro} -> ${m.predMacro}`;
  misalignedByMacro[key] = (misalignedByMacro[key] || 0) + 1;
}
console.log('Misalignments by macro pair:', JSON.stringify(misalignedByMacro, null, 2));

// Print first 10 misalignments
console.log('Sample misalignments (first 10):');
console.log(JSON.stringify(misaligned.slice(0, 10), null, 2));
