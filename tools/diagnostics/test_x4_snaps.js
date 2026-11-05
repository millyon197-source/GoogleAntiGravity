import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

const modMap = new Map();
for (const m of plan.modules) {
  modMap.set(m.index, m);
}

function getSnapPoints(macro) {
  const baseName = macro.replace(/_macro$/, '');
  return SNAP_POINTS_DB[baseName] || SNAP_POINTS_DB[macro] || [];
}

// Let's test different rotation conventions!
// Convention A: Current viewer.js:
// moduleGroup.position.set(mod.position.x, mod.position.y, -mod.position.z);
// moduleGroup.rotation.order = 'YXZ';
// moduleGroup.rotation.y = yaw * PI/180;
// moduleGroup.rotation.x = (pitch + 180) * PI/180;
// moduleGroup.rotation.z = (roll + 180) * PI/180;
// snap dot local pos = (-snap.pos[0], snap.pos[1], -snap.pos[2]);

// Convention B: What if yaw in X4 is in X4 space:
// In X4 space, module pos is (x, y, z).
// Rotation is yaw around Y, pitch around X, roll around Z.
// Snap point local pos is (snap.pos[0], snap.pos[1], snap.pos[2]).
// World snap pos in X4 space = mod.position + R(yaw, pitch, roll) * snap.pos.
// Then convert to visualizer space: (worldX, worldY, -worldZ).

function computeX4WorldSnap(mod, snapName, yawSign = 1) {
  const snaps = getSnapPoints(mod.macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;

  // X4 coordinate frame:
  // Let's try standard YXZ Euler rotation:
  // In X4, yaw is around Y.
  const euler = new THREE.Euler(
    mod.rotation.pitch * Math.PI / 180,
    yawSign * mod.rotation.yaw * Math.PI / 180,
    mod.rotation.roll * Math.PI / 180,
    'YXZ'
  );
  
  // Snap pos in X4 local module space:
  const p = new THREE.Vector3(snap.pos[0], snap.pos[1], snap.pos[2]);
  p.applyEuler(euler);
  p.add(new THREE.Vector3(mod.position.x, mod.position.y, mod.position.z));
  return p;
}

// Let's test non-Entry-1 connections:
let validConns = 0;
let errorsYawPos = [];
let errorsYawNeg = [];

for (const mod of plan.modules) {
  if (!mod.connection || !mod.predecessor) continue;
  if (mod.index === 1 || mod.predecessor.index === 1) continue; // skip entry 1 for now

  const pred = modMap.get(mod.predecessor.index);
  if (!pred) continue;

  const snapM_pos = computeX4WorldSnap(mod, mod.connection, 1);
  const snapP_pos = computeX4WorldSnap(pred, mod.predecessor.connection, 1);

  const snapM_neg = computeX4WorldSnap(mod, mod.connection, -1);
  const snapP_neg = computeX4WorldSnap(pred, mod.predecessor.connection, -1);

  if (snapM_pos && snapP_pos) {
    validConns++;
    errorsYawPos.push({
      dist: snapM_pos.distanceTo(snapP_pos),
      mod,
      pred
    });
    errorsYawNeg.push({
      dist: snapM_neg.distanceTo(snapP_neg),
      mod,
      pred
    });
  }
}

console.log(`Evaluated ${validConns} non-Entry-1 connections:`);
const closePos = errorsYawPos.filter(e => e.dist < 1.0).length;
const closeNeg = errorsYawNeg.filter(e => e.dist < 1.0).length;

console.log(`With yawSign = +1: ${closePos} / ${validConns} have dist < 1m`);
console.log(`With yawSign = -1: ${closeNeg} / ${validConns} have dist < 1m`);

// Let's see histogram of distances for yawSign = +1:
console.log('Distance percentiles for yawSign = +1:');
const sortedPos = errorsYawPos.map(e => e.dist).sort((a,b) => a - b);
console.log('min:', sortedPos[0]);
console.log('25%:', sortedPos[Math.floor(sortedPos.length * 0.25)]);
console.log('50%:', sortedPos[Math.floor(sortedPos.length * 0.50)]);
console.log('75%:', sortedPos[Math.floor(sortedPos.length * 0.75)]);
console.log('90%:', sortedPos[Math.floor(sortedPos.length * 0.90)]);
console.log('max:', sortedPos[sortedPos.length - 1]);
