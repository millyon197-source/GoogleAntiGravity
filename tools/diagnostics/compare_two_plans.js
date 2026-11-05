import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const p1 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const p2 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";

const plan1 = parseConstructionPlan(fs.readFileSync(p1, 'utf8'));
const plan2 = parseConstructionPlan(fs.readFileSync(p2, 'utf8'));

console.log('Plan 1 (Oct 19):', plan1.name, 'modules:', plan1.modules.length);
console.log('Plan 2 (Oct 8):', plan2.name, 'modules:', plan2.modules.length);

// In Plan 2, find non-equipment modules (exclude shields/turrets):
const baseMods2 = plan2.modules.filter(m => !m.macro.startsWith('shield_') && !m.macro.startsWith('turret_'));
console.log('Plan 2 non-equipment modules:', baseMods2.length);

// Compare macros:
const count1 = {}, count2 = {};
plan1.modules.forEach(m => count1[m.macro] = (count1[m.macro] || 0) + 1);
baseMods2.forEach(m => count2[m.macro] = (count2[m.macro] || 0) + 1);

let macroMatch = true;
for (const k in count1) {
  if (count1[k] !== count2[k]) {
    console.log(`Diff: ${k}: plan1=${count1[k]}, plan2=${count2[k]}`);
    macroMatch = false;
  }
}
if (macroMatch) console.log('[MATCH] All station module counts match exactly between plan 1 and plan 2!');
