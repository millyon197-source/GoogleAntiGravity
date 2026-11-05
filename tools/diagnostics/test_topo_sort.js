import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

console.log('Testing topological sort of plan...');

// Build dependency graph
const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

// Topologically sort modules
const visited = new Set();
const sorted = [];

function visit(mod) {
  if (visited.has(mod.index)) return;
  if (mod.predecessor && modMap.has(mod.predecessor.index)) {
    visit(modMap.get(mod.predecessor.index));
  }
  visited.add(mod.index);
  sorted.push(mod);
}

for (const mod of plan.modules) {
  visit(mod);
}

console.log(`Topologically sorted ${sorted.length} / ${plan.modules.length} modules!`);

// Verify that sorted has 0 forward references:
const sortedPosMap = new Map();
sorted.forEach((m, pos) => sortedPosMap.set(m.index, pos));

let forwardRefs = 0;
for (const m of sorted) {
  if (m.predecessor && sortedPosMap.has(m.predecessor.index)) {
    const pPos = sortedPosMap.get(m.predecessor.index);
    const mPos = sortedPosMap.get(m.index);
    if (pPos > mPos) forwardRefs++;
  }
}
console.log(`Forward references after topological sort: ${forwardRefs}`);
