import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

// Let's test if propagating positions from predecessor makes every connection 0.00m!
// Start with root modules (predecessor === null)
// For every module with a predecessor:
// If predecessor has computed position:
// computedPos(mod) = predComputedSnap - R(mod.rotation) * snapM

function getRotMatrix(rot) {
  const euler = new THREE.Euler(
    (rot.pitch + 180) * Math.PI / 180,
    rot.yaw * Math.PI / 180,
    (rot.roll + 180) * Math.PI / 180,
    'YXZ'
  );
  return new THREE.Matrix4().makeRotationFromEuler(euler);
}

function getLocalSnap(macro, snapName) {
  const snaps = getModuleSnapPoints(macro);
  const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
  if (!snap) return null;
  return new THREE.Vector3(-snap.pos[0], snap.pos[1], -snap.pos[2]);
}

// Let's test propagation
const computedPositions = new Map();
// Set roots
for (const m of plan.modules) {
  if (!m.predecessor) {
    computedPositions.set(m.index, new THREE.Vector3(m.position.x, m.position.y, -m.position.z));
  }
}

let changed = true;
let solved = 0;
while (changed) {
  changed = false;
  for (const m of plan.modules) {
    if (computedPositions.has(m.index)) continue;
    if (!m.predecessor) continue;
    const predPos = computedPositions.get(m.predecessor.index);
    if (!predPos) continue;

    const predMod = modMap.get(m.predecessor.index);
    const snapPLocal = getLocalSnap(predMod.macro, m.predecessor.connection);
    const snapMLocal = getLocalSnap(m.macro, m.connection);

    if (!snapPLocal || !snapMLocal) continue;

    const rotP = getRotMatrix(predMod.rotation);
    const rotM = getRotMatrix(m.rotation);

    // World snap pos of pred
    const worldSnapP = snapPLocal.clone().applyMatrix4(rotP).add(predPos);

    // World pos of mod: worldSnapP - rotM * snapMLocal
    const worldPosM = worldSnapP.clone().sub(snapMLocal.clone().applyMatrix4(rotM));

    computedPositions.set(m.index, worldPosM);
    changed = true;
    solved++;
  }
}

console.log(`Solved ${solved} / ${plan.modules.length - 4} non-root module positions via snap propagation!`);

// Let's compare computedPositions with XML positions for the 4 problem areas:
console.log('\n--- AREA 1: Admin Claim #1 & Docks #2-#5 ---');
for (let i = 1; i <= 5; i++) {
  const m = modMap.get(i);
  const comp = computedPositions.get(i);
  const xml = new THREE.Vector3(m.position.x, m.position.y, -m.position.z);
  console.log(`Mod #${i} (${m.macro}):`);
  console.log(`   XML Pos:      (${xml.x.toFixed(1)}, ${xml.y.toFixed(1)}, ${xml.z.toFixed(1)})`);
  console.log(`   Computed Pos: (${comp?.x.toFixed(1)}, ${comp?.y.toFixed(1)}, ${comp?.z.toFixed(1)})`);
  if (comp) console.log(`   Displacement: ${comp.distanceTo(xml).toFixed(1)}m`);
}

console.log('\n--- AREA 2: Piers ---');
const piers = plan.modules.filter(m => m.macro.includes('pier_arg_harbor_03'));
for (const p of piers) {
  const comp = computedPositions.get(p.index);
  const xml = new THREE.Vector3(p.position.x, p.position.y, -p.position.z);
  console.log(`Pier #${p.index}:`);
  console.log(`   XML Pos:      (${xml.x.toFixed(1)}, ${xml.y.toFixed(1)}, ${xml.z.toFixed(1)})`);
  console.log(`   Computed Pos: (${comp?.x.toFixed(1)}, ${comp?.y.toFixed(1)}, ${comp?.z.toFixed(1)})`);
  if (comp) console.log(`   Displacement: ${comp.distanceTo(xml).toFixed(1)}m`);
}

console.log('\n--- AREA 3: Shipyards (subset: 93, 97, 122, 123, 152) ---');
for (const idx of [93, 97, 122, 123, 152]) {
  const s = modMap.get(idx);
  const comp = computedPositions.get(idx);
  const xml = new THREE.Vector3(s.position.x, s.position.y, -s.position.z);
  console.log(`Shipyard #${idx} (${s.macro}):`);
  console.log(`   XML Pos:      (${xml.x.toFixed(1)}, ${xml.y.toFixed(1)}, ${xml.z.toFixed(1)})`);
  console.log(`   Computed Pos: (${comp?.x.toFixed(1)}, ${comp?.y.toFixed(1)}, ${comp?.z.toFixed(1)})`);
  if (comp) console.log(`   Displacement: ${comp.distanceTo(xml).toFixed(1)}m`);
}

console.log('\n--- AREA 4: Energy Cells (116, 117, 118, 119) ---');
for (const idx of [116, 117, 118, 119]) {
  const e = modMap.get(idx);
  const comp = computedPositions.get(idx);
  const xml = new THREE.Vector3(e.position.x, e.position.y, -e.position.z);
  console.log(`ECell #${idx}:`);
  console.log(`   XML Pos:      (${xml.x.toFixed(1)}, ${xml.y.toFixed(1)}, ${xml.z.toFixed(1)})`);
  console.log(`   Computed Pos: (${comp?.x.toFixed(1)}, ${comp?.y.toFixed(1)}, ${comp?.z.toFixed(1)})`);
  if (comp) console.log(`   Displacement: ${comp.distanceTo(xml).toFixed(1)}m`);
}
