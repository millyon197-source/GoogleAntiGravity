import fs from 'fs';
import * as THREE from 'three';
import { parseConstructionPlan } from '../../src/parser.js';
import { generatePlanXML } from '../../src/blueprint-exporter.js';

const p1 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const p2 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";

const plan1 = parseConstructionPlan(fs.readFileSync(p1, 'utf8'));
const plan2 = parseConstructionPlan(fs.readFileSync(p2, 'utf8'));

const m2Map = new Map();
plan2.modules.forEach(m => m2Map.set(m.index, m));

// Station offset between Plan 1 and Plan 2:
const offsetX = 0;
const offsetY = 3222.683;
const offsetZ = 1806.753;

// Map each module in Plan 1 to its clean counterpart in Plan 2
const cleanModules = [];

for (const m1 of plan1.modules) {
  const m2 = m2Map.get(m1.index + 5459);
  if (!m2) {
    console.error(`Cannot find m2 for m1.index=${m1.index}`);
    continue;
  }

  // Predecessor in Plan 1 terms:
  let predecessor = null;
  if (m2.predecessor && m2.predecessor.index >= 5460) {
    predecessor = {
      index: m2.predecessor.index - 5459,
      connection: m2.predecessor.connection
    };
  }

  cleanModules.push({
    index: m1.index,
    macro: m2.macro,
    connection: m2.connection,
    predecessor: predecessor,
    position: {
      x: Math.round((m2.position.x + offsetX) * 1000) / 1000,
      y: Math.round((m2.position.y + offsetY) * 1000) / 1000,
      z: Math.round((m2.position.z + offsetZ) * 1000) / 1000
    },
    rotation: {
      yaw: Math.round(m2.rotation.yaw * 1000) / 1000,
      pitch: Math.round(m2.rotation.pitch * 1000) / 1000,
      roll: Math.round(m2.rotation.roll * 1000) / 1000
    }
  });
}

console.log(`Reconstructed ${cleanModules.length} clean modules from Plan 2.`);

// Topologically sort so EVERY predecessor appears BEFORE its child
const modMap = new Map();
cleanModules.forEach(m => modMap.set(m.index, m));

const visited = new Set();
const sortedModules = [];

function visit(m) {
  if (visited.has(m.index)) return;
  if (m.predecessor && modMap.has(m.predecessor.index)) {
    visit(modMap.get(m.predecessor.index));
  }
  visited.add(m.index);
  sortedModules.push(m);
}

for (const m of cleanModules) {
  visit(m);
}

console.log(`Topologically sorted: ${sortedModules.length} modules.`);

// Verify 0 forward references:
const posMap = new Map();
sortedModules.forEach((m, pos) => posMap.set(m.index, pos));
let forwardCount = 0;
for (const m of sortedModules) {
  if (m.predecessor && posMap.has(m.predecessor.index)) {
    if (posMap.get(m.predecessor.index) > posMap.get(m.index)) {
      forwardCount++;
    }
  }
}
console.log(`Forward references in sorted list: ${forwardCount}`);

// Generate clean XML using generatePlanXML
const newXml = generatePlanXML(plan1.name, plan1, {
  id: plan1.id,
  description: plan1.description,
  modules: sortedModules
});

console.log('Generated new XML length:', newXml.length);
fs.writeFileSync('tools/diagnostics/cleaned_megashipyard.xml', newXml, 'utf8');
console.log('Wrote tools/diagnostics/cleaned_megashipyard.xml');
