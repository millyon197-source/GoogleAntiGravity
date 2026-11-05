import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

console.log(`Plan: ${plan.name}, total modules: ${plan.modules.length}`);

const fileOrderRegex = /<entry\s+index="(\d+)"/g;
let m;
const fileOrder = [];
while ((m = fileOrderRegex.exec(content)) !== null) {
  fileOrder.push(parseInt(m[1]));
}

const fileIndexPos = new Map();
fileOrder.forEach((idx, pos) => fileIndexPos.set(idx, pos));

let forwardRefsInFile = 0;
for (const mod of plan.modules) {
  if (mod.predecessor) {
    const modPos = fileIndexPos.get(mod.index);
    const predPos = fileIndexPos.get(mod.predecessor.index);
    if (predPos !== undefined && predPos > modPos) {
      forwardRefsInFile++;
    }
  }
}

console.log(`In Mega Ship yard 2: Forward references in XML file: ${forwardRefsInFile} / ${plan.modules.length}`);
