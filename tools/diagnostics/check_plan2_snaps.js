import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

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

// Check non-equipment station modules
const stationMods = plan.modules.filter(m => !m.macro.startsWith('shield_') && !m.macro.startsWith('turret_'));

let checked = 0;
let exactMatches = 0; // < 1.0m
let errors = [];

for (const mod of stationMods) {
  if (!mod.connection || !mod.predecessor) continue;
  const pred = modMap.get(mod.predecessor.index);
  if (!pred) continue;

  const snapM = getViewerSnapWorldPos(mod, mod.connection);
  const snapP = getViewerSnapWorldPos(pred, mod.predecessor.connection);

  if (snapM && snapP) {
    checked++;
    const dist = snapM.distanceTo(snapP);
    if (dist < 1.0) {
      exactMatches++;
    } else {
      errors.push({
        modIndex: mod.index,
        macro: mod.macro,
        predIndex: pred.index,
        predMacro: pred.macro,
        dist: dist.toFixed(2)
      });
    }
  }
}

console.log(`Plan 2: Checked ${checked} connected station modules:`);
console.log(`Matches (< 1.0m): ${exactMatches} / ${checked} (${(exactMatches/checked*100).toFixed(1)}%)`);
console.log(`Errors (>= 1.0m): ${errors.length}`);
if (errors.length > 0) {
  console.log('Sample errors:', errors.slice(0, 10));
}
