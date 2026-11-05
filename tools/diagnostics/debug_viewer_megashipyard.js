import fs from 'fs';
import { getModuleSnapPoints, SNAP_POINTS_DB } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xml = fs.readFileSync(xmlPath, 'utf8');
const macros = [...new Set([...xml.matchAll(/macro="([^"]+)"/g)].map(x => x[1]))];

console.log('Testing getModuleSnapPoints for all 46 macros:');
let missing = 0;
for (const mac of macros) {
  const snaps = getModuleSnapPoints(mac);
  if (!snaps || snaps.length === 0) {
    missing++;
    console.log(`[NO SNAPS] ${mac}`);
  } else {
    console.log(`[OK] ${mac}: ${snaps.length} snaps`);
  }
}
console.log(`Missing snaps: ${missing} / ${macros.length}`);
