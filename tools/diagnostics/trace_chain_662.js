import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

// Trace predecessor chain backwards from 662
let curr = modMap.get(662);
const chain = [];
while (curr) {
  chain.unshift(curr);
  if (!curr.predecessor) break;
  curr = modMap.get(curr.predecessor.index);
}

console.log(`Chain length to 662: ${chain.length}`);
for (let i = 0; i < chain.length; i++) {
  const m = chain[i];
  console.log(`[${i}] index=${m.index} ${m.macro} pos=(${m.position.x}, ${m.position.y}, ${m.position.z}) yaw=${m.rotation.yaw} conn=${m.connection} pred=${m.predecessor ? m.predecessor.index + ':' + m.predecessor.connection : 'ROOT'}`);
}
