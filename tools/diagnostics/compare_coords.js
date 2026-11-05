import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const p1 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const p2 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";

const plan1 = parseConstructionPlan(fs.readFileSync(p1, 'utf8'));
const plan2 = parseConstructionPlan(fs.readFileSync(p2, 'utf8'));

const m2Map = new Map();
plan2.modules.forEach(m => m2Map.set(m.index, m));

// Sample comparisons:
for (const i of [1, 2, 3, 4, 5, 6, 8, 93, 97, 116, 222, 662]) {
  const m1 = plan1.modules.find(m => m.index === i);
  const m2 = m2Map.get(i + 5459);
  console.log(`--- Index ${i} (${m1.macro}) ---`);
  console.log(`Plan 1 Pos: (${m1.position.x}, ${m1.position.y}, ${m1.position.z}) yaw=${m1.rotation.yaw}`);
  console.log(`Plan 2 Pos: (${m2.position.x}, ${m2.position.y}, ${m2.position.z}) yaw=${m2.rotation.yaw}`);
  console.log(`Delta Pos (Plan 1 - Plan 2): dx=${(m1.position.x - m2.position.x).toFixed(1)}, dy=${(m1.position.y - m2.position.y).toFixed(1)}, dz=${(m1.position.z - m2.position.z).toFixed(1)}`);
}
