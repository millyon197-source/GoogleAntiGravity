import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";
if (!fs.existsSync(xmlPath)) {
  console.log(`[SKIP] File not found: ${xmlPath}`);
  process.exit(0);
}
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

function buildCleanSnap(mod, snapName) {
  const snaps = getModuleSnapPoints(mod.macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;

  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.y = -mod.rotation.yaw * Math.PI / 180;
  g.rotation.x = -mod.rotation.pitch * Math.PI / 180;
  g.rotation.z = mod.rotation.roll * Math.PI / 180;
  g.position.set(mod.position.x, mod.position.y, -mod.position.z);

  const dot = new THREE.Vector3(snap.pos[0], snap.pos[1], -snap.pos[2]);
  dot.applyEuler(g.rotation);
  dot.add(g.position);
  return dot;
}

const stationMods = plan.modules.filter(m => !m.macro.startsWith('shield_') && !m.macro.startsWith('turret_'));

let checked = 0;
let exactMatches = 0;
let errors = [];

for (const mod of stationMods) {
  if (!mod.connection || !mod.predecessor) continue;
  const pred = modMap.get(mod.predecessor.index);
  if (!pred) continue;

  const snapM = buildCleanSnap(mod, mod.connection);
  const snapP = buildCleanSnap(pred, mod.predecessor.connection);

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
        dist: dist.toFixed(2),
        modPos: mod.position,
        predPos: pred.position,
        modRot: mod.rotation,
        predRot: pred.rotation
      });
    }
  }
}

console.log(`Plan 2 with CLEAN MATH: Checked ${checked} connections:`);
console.log(`Matches (< 1.0m): ${exactMatches} / ${checked} (${(exactMatches/checked*100).toFixed(1)}%)`);
console.log(`Errors (>= 1.0m): ${errors.length}`);
if (errors.length > 0) {
  console.log('Sample errors (first 10):', errors.slice(0, 10));
}
