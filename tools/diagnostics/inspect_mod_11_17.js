import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/A600_2 ENERGY CELL.xml";
const content = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(content);

for (let i = 10; i < 17; i++) {
  const m = plan.modules[i];
  console.log(`\n[${m.index}] ${m.macro}`);
  console.log('Pos:', m.position);
  console.log('Rot:', m.rotation);
  console.log('Conn:', m.connection, 'Pred:', m.predecessor);
}
