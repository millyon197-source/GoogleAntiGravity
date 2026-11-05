import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';
import PART_MAIN_OFFSETS from '../../src/part-main-offsets.json' with { type: 'json' };

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');

const plan = parseConstructionPlan(xmlContent);
console.log(`Plan Name: ${plan.name}`);
console.log(`Total modules: ${plan.modules.length}`);

// Count by macro
const macroCounts = {};
for (const m of plan.modules) {
  macroCounts[m.macro] = (macroCounts[m.macro] || 0) + 1;
}
console.log('Macro counts:', JSON.stringify(macroCounts, null, 2));

// Check missing snap points
const missingSnapMacros = new Set();
for (const m of plan.modules) {
  const baseName = m.macro.replace(/_macro$/, '');
  if (!SNAP_POINTS_DB[baseName] && !SNAP_POINTS_DB[m.macro]) {
    missingSnapMacros.add(m.macro);
  }
}
console.log('Missing snap macros:', [...missingSnapMacros]);

// Inspect connections
let connectedCount = 0;
for (const m of plan.modules) {
  if (m.connection) {
    connectedCount++;
  }
}
console.log(`Modules with connection attribute: ${connectedCount} / ${plan.modules.length}`);

// Sample module
console.log('Sample module:', JSON.stringify(plan.modules[1], null, 2));
