import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

console.log('Total modules in plan:', plan.modules.length);

// Check root modules (modules with no predecessor)
const roots = plan.modules.filter(m => !m.predecessor);
console.log('Root modules (no predecessor):', roots.map(r => ({
  index: r.index,
  macro: r.macro,
  pos: r.position,
  rot: r.rotation
})));
