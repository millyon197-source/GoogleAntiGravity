import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const p1 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const p2 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";

const plan1 = parseConstructionPlan(fs.readFileSync(p1, 'utf8'));
const plan2 = parseConstructionPlan(fs.readFileSync(p2, 'utf8'));

// Filter out shields and turrets from Plan 2
const baseMods2 = plan2.modules.filter(m => !m.macro.startsWith('shield_') && !m.macro.startsWith('turret_'));

console.log('Plan 1 modules:', plan1.modules.length);
console.log('Plan 2 station modules:', baseMods2.length);

// In Plan 2, the station modules start at index 5406 to 6125.
// Let's check the offset between Plan 2 indices and Plan 1 indices!
// Mod #1 in Plan 1 is defence_arg_claim_01_macro.
// In Plan 2, defence_arg_claim_01_macro is index 5460!
// 5460 - 1 = 5459!
// Does index 5461 in Plan 2 match index 2 in Plan 1?
// Does index 5462 in Plan 2 match index 3 in Plan 1?
// Let's check for all 666 modules!

let exactMatchCount = 0;
let diffCount = 0;

for (const m1 of plan1.modules) {
  const correspondingIdx = m1.index + 5459;
  const m2 = plan2.modules.find(m => m.index === correspondingIdx);
  if (m2 && m2.macro === m1.macro) {
    exactMatchCount++;
  } else {
    diffCount++;
    console.log(`Mismatch at m1.index=${m1.index}: m1.macro=${m1.macro}, m2=${m2?.macro} (idx=${correspondingIdx})`);
    if (diffCount > 10) break;
  }
}

console.log(`Checked index mapping (+5459): ${exactMatchCount} matched, ${diffCount} mismatched!`);
