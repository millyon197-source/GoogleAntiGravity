import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = "tools/diagnostics/cleaned_megashipyard.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);
const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

function worldSnapX4(mod, snapName) {
  const snaps = getModuleSnapPoints(mod.macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;

  const yawRad = mod.rotation.yaw * Math.PI / 180;
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const rx = snap.pos[0] * cosY + snap.pos[2] * sinY;
  const ry = snap.pos[1];
  const rz = -snap.pos[0] * sinY + snap.pos[2] * cosY;
  return new THREE.Vector3(mod.position.x + rx, mod.position.y + ry, mod.position.z + rz);
}

console.log('--- 1. ADMIN CLAIM (#1) & DOCKS (#2-#5) ---');
for (let i = 2; i <= 5; i++) {
  const m = modMap.get(i);
  const pred = modMap.get(m.predecessor.index);
  const sM = worldSnapX4(m, m.connection);
  const sP = worldSnapX4(pred, m.predecessor.connection);
  console.log(`Mod #${i} -> Pred #${pred.index}: dist=${sM && sP ? sM.distanceTo(sP).toFixed(4) : 'N/A'}m`);
}

console.log('\n--- 2. PIERS ---');
const piers = plan.modules.filter(m => m.macro.includes('pier_arg_harbor_03'));
for (const p of piers) {
  const pred = modMap.get(p.predecessor.index);
  const sM = worldSnapX4(p, p.connection);
  const sP = worldSnapX4(pred, p.predecessor.connection);
  console.log(`Pier #${p.index} -> Pred #${pred.index}: dist=${sM && sP ? sM.distanceTo(sP).toFixed(4) : 'N/A'}m`);
}

console.log('\n--- 3. SHIPYARDS (subset: 93, 97, 122, 123, 152) ---');
for (const idx of [93, 97, 122, 123, 152]) {
  const s = modMap.get(idx);
  const pred = modMap.get(s.predecessor.index);
  const sM = worldSnapX4(s, s.connection);
  const sP = worldSnapX4(pred, s.predecessor.connection);
  console.log(`Shipyard #${idx} -> Pred #${pred?.index}: dist=${sM && sP ? sM.distanceTo(sP).toFixed(4) : 'N/A'}m`);
}

console.log('\n--- 4. ENERGY CELLS (116, 117, 118, 119) ---');
for (const idx of [116, 117, 118, 119]) {
  const e = modMap.get(idx);
  const pred = modMap.get(e.predecessor.index);
  const sM = worldSnapX4(e, e.connection);
  const sP = worldSnapX4(pred, e.predecessor.connection);
  console.log(`ECell #${idx} -> Pred #${pred?.index}: dist=${sM && sP ? sM.distanceTo(sP).toFixed(4) : 'N/A'}m`);
}
