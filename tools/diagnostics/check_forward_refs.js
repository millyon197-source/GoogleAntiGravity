import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

console.log(`Plan: ${plan.name}, total modules: ${plan.modules.length}`);

// Check how many modules reference a predecessor that appears LATER in plan.modules
// Wait, plan.modules was sorted by index by the parser!
// What about the order in the actual XML file?
const fileOrderRegex = /<entry\s+index="(\d+)"/g;
let m;
const fileOrder = [];
while ((m = fileOrderRegex.exec(content)) !== null) {
  fileOrder.push(parseInt(m[1]));
}

const fileIndexPos = new Map();
fileOrder.forEach((idx, pos) => fileIndexPos.set(idx, pos));

let forwardRefsInFile = 0;
const forwardRefExamples = [];

for (const mod of plan.modules) {
  if (mod.predecessor) {
    const modPos = fileIndexPos.get(mod.index);
    const predPos = fileIndexPos.get(mod.predecessor.index);
    if (predPos !== undefined && predPos > modPos) {
      forwardRefsInFile++;
      if (forwardRefExamples.length < 15) {
        forwardRefExamples.push({
          modIndex: mod.index,
          modMacro: mod.macro,
          modFilePos: modPos,
          predIndex: mod.predecessor.index,
          predFilePos: predPos
        });
      }
    }
  }
}

console.log(`Modules with forward-references in XML file: ${forwardRefsInFile} / ${plan.modules.length}`);
console.log('Sample forward references:', forwardRefExamples);
