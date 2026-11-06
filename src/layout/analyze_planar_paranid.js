import fs from 'fs';
import { parseConstructionPlan } from '../parser.js';
import { getModuleCategory, getFriendlyName } from '@x4/catalog';

export function analyzePlanarParanid(xmlContent) {
  const plan = parseConstructionPlan(xmlContent);
  const totalModules = plan.modules.length;

  const macroCounts = {};
  for (const m of plan.modules) {
    macroCounts[m.macro] = (macroCounts[m.macro] || 0) + 1;
  }

  const catY = {};
  for (const m of plan.modules) {
    const cat = getModuleCategory(m.macro);
    if (!catY[cat]) catY[cat] = { min: Infinity, max: -Infinity, count: 0, ys: [] };
    catY[cat].min = Math.min(catY[cat].min, m.position.y);
    catY[cat].max = Math.max(catY[cat].max, m.position.y);
    catY[cat].count++;
    catY[cat].ys.push(m.position.y);
  }

  return { plan, totalModules, macroCounts, catY };
}

// Standalone execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('analyze_planar_paranid.js')) {
  const defaultPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Planar - Paranid.xml';
  const filePath = process.argv[2] || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`Blueprint file not found: ${filePath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(filePath, 'utf8');
  const { plan, totalModules, macroCounts, catY } = analyzePlanarParanid(xml);

  console.log('=== PLANAR - PARANID DETAILED ANALYSIS ===');
  console.log('Total modules:', totalModules);

  console.log('\nTop macros:');
  for (const [macro, count] of Object.entries(macroCounts).sort((a,b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${count.toString().padStart(3)}x ${macro} (${getFriendlyName(macro)})`);
  }

  console.log('\nCategory Y Ranges:');
  for (const [cat, data] of Object.entries(catY)) {
    const avg = data.ys.reduce((a,b) => a+b, 0) / data.count;
    console.log(`  ${cat.padEnd(12)}: count=${data.count.toString().padStart(3)}, Y min=${data.min.toFixed(1)}, Y max=${data.max.toFixed(1)}, Y avg=${avg.toFixed(1)}`);
  }

  console.log('\nFirst 20 modules in XML:');
  for (const m of plan.modules.slice(0, 20)) {
    const pred = m.predecessor ? `pred: #${m.predecessor.index} (${m.predecessor.connection})` : 'ROOT';
    console.log(`  #${m.index.toString().padStart(3)} [${getModuleCategory(m.macro).padEnd(10)}] ${m.macro.padEnd(35)} pos: (${m.position.x.toFixed(0)}, ${m.position.y.toFixed(0)}, ${m.position.z.toFixed(0)}) ${pred}`);
  }
}
