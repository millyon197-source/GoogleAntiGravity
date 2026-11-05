import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB, getModuleSnapPoints } from '../../src/snap-points-db.js';
import PART_MAIN_OFFSETS from '../../src/part-main-offsets.json' with { type: 'json' };

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);
const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

console.log('====================================================');
console.log('DETAILED INVESTIGATION OF THE 4 REPORTED AREAS');
console.log('====================================================');

// Function to compute snap world position in viewer space:
function getViewerSnapWorldPos(mod, snapName) {
  const snaps = getModuleSnapPoints(mod.macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;

  const rotEuler = new THREE.Euler(
    (mod.rotation.pitch + 180) * Math.PI / 180,
    mod.rotation.yaw * Math.PI / 180,
    (mod.rotation.roll + 180) * Math.PI / 180,
    'YXZ'
  );
  const p = new THREE.Vector3(-snap.pos[0], snap.pos[1], -snap.pos[2]);
  p.applyEuler(rotEuler);
  p.add(new THREE.Vector3(mod.position.x, mod.position.y, -mod.position.z));
  return p;
}

// 1. Admin claim (#1) and #2-#5
console.log('\n--- AREA 1: Admin Claim #1 and Docks #2-#5 ---');
for (let i = 2; i <= 5; i++) {
  const m = modMap.get(i);
  const pred = modMap.get(m.predecessor.index);
  const snapM = getViewerSnapWorldPos(m, m.connection);
  const snapP = getViewerSnapWorldPos(pred, m.predecessor.connection);
  console.log(`Mod #${m.index} (${m.macro}) -> Pred #${pred.index} (${pred.macro})`);
  console.log(`   Mod Pos:  (${m.position.x}, ${m.position.y}, ${m.position.z}) rot: yaw=${m.rotation.yaw}`);
  console.log(`   Pred Pos: (${pred.position.x}, ${pred.position.y}, ${pred.position.z}) rot: yaw=${pred.rotation.yaw}`);
  console.log(`   Snap M (${m.connection}):  ${snapM ? snapM.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  console.log(`   Snap P (${m.predecessor.connection}): ${snapP ? snapP.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  if (snapM && snapP) {
    console.log(`   Distance between snap points: ${snapM.distanceTo(snapP).toFixed(2)}m`);
  }
}

// 2. Piers (pier_arg_harbor_03)
console.log('\n--- AREA 2: Piers (pier_arg_harbor_03) ---');
const piers = plan.modules.filter(m => m.macro.includes('pier_arg_harbor_03'));
for (const p of piers) {
  const pred = modMap.get(p.predecessor.index);
  const snapM = getViewerSnapWorldPos(p, p.connection);
  const snapP = getViewerSnapWorldPos(pred, p.predecessor.connection);
  console.log(`Pier #${p.index} -> Pred #${pred.index} (${pred.macro})`);
  console.log(`   Pier Pos: (${p.position.x}, ${p.position.y}, ${p.position.z}) rot: yaw=${p.rotation.yaw}`);
  console.log(`   Pred Pos: (${pred.position.x}, ${pred.position.y}, ${pred.position.z}) rot: yaw=${pred.rotation.yaw}`);
  console.log(`   Snap M (${p.connection}):  ${snapM ? snapM.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  console.log(`   Snap P (${p.predecessor.connection}): ${snapP ? snapP.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  if (snapM && snapP) {
    console.log(`   Distance between snap points: ${snapM.distanceTo(snapP).toFixed(2)}m`);
  }
}

// 3. XL/L Shipyard and Equipment Docks
console.log('\n--- AREA 3: Shipyards & Equipment Docks ---');
const shipyards = plan.modules.filter(m => m.macro.includes('buildmodule'));
for (const s of shipyards) {
  const pred = modMap.get(s.predecessor.index);
  const snapM = getViewerSnapWorldPos(s, s.connection);
  const snapP = pred ? getViewerSnapWorldPos(pred, s.predecessor.connection) : null;
  console.log(`Shipyard #${s.index} (${s.macro}) -> Pred #${pred?.index} (${pred?.macro})`);
  console.log(`   Shipyard Pos: (${s.position.x}, ${s.position.y}, ${s.position.z}) rot: yaw=${s.rotation.yaw}`);
  console.log(`   Pred Pos:     (${pred?.position.x}, ${pred?.position.y}, ${pred?.position.z}) rot: yaw=${pred?.rotation.yaw}`);
  console.log(`   Snap M (${s.connection}):  ${snapM ? snapM.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  console.log(`   Snap P (${s.predecessor?.connection}): ${snapP ? snapP.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  if (snapM && snapP) {
    console.log(`   Distance between snap points: ${snapM.distanceTo(snapP).toFixed(2)}m`);
  }
}

// 4. Energy Cells
console.log('\n--- AREA 4: Energy Cells Array ---');
const eCells = plan.modules.filter(m => m.macro.includes('energycells'));
for (const e of eCells) {
  const pred = modMap.get(e.predecessor.index);
  const snapM = getViewerSnapWorldPos(e, e.connection);
  const snapP = pred ? getViewerSnapWorldPos(pred, e.predecessor.connection) : null;
  console.log(`ECell #${e.index} -> Pred #${pred?.index} (${pred?.macro})`);
  console.log(`   ECell Pos: (${e.position.x}, ${e.position.y}, ${e.position.z}) rot: yaw=${e.rotation.yaw}`);
  console.log(`   Pred Pos:  (${pred?.position.x}, ${pred?.position.y}, ${pred?.position.z}) rot: yaw=${pred?.rotation.yaw}`);
  console.log(`   Snap M (${e.connection}):  ${snapM ? snapM.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  console.log(`   Snap P (${e.predecessor?.connection}): ${snapP ? snapP.toArray().map(v=>v.toFixed(1)) : 'null'}`);
  if (snapM && snapP) {
    console.log(`   Distance between snap points: ${snapM.distanceTo(snapP).toFixed(2)}m`);
  }
}
