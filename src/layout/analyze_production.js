import fs from 'fs';
import { parseConstructionPlan } from '../parser.js';
import { getModuleCategory, getFriendlyName } from '@x4/catalog';

export function analyzeProduction(xmlContent) {
  const plan = parseConstructionPlan(xmlContent);

  // Find all production modules and their positions:
  const prods = plan.modules.filter(m => getModuleCategory(m.macro) === 'production');

  // Group prods by Y:
  const prodsByY = {};
  for (const p of prods) {
    const y = Math.round(p.position.y);
    if (!prodsByY[y]) prodsByY[y] = [];
    prodsByY[y].push(p);
  }

  const sortedYs = Object.keys(prodsByY).map(Number).sort((a,b) => b - a);
  return { plan, prods, prodsByY, sortedYs };
}

// Standalone execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('analyze_production.js')) {
  const defaultPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Planar - Paranid.xml';
  const filePath = process.argv[2] || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`Blueprint file not found: ${filePath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(filePath, 'utf8');
  const { prods, prodsByY, sortedYs } = analyzeProduction(xml);

  console.log('Total production modules:', prods.length);
  console.log(`\nProduction Y levels (${sortedYs.length} unique Y levels):`);
  for (const y of sortedYs) {
    const list = prodsByY[y];
    const macros = list.map(m => m.macro.replace('prod_gen_', '').replace('prod_arg_', '').replace('_macro', ''));
    console.log(`  Y=${y.toString().padStart(6)}: ${list.length.toString().padStart(2)} prods -> ${macros.slice(0, 6).join(', ')}${macros.length > 6 ? '...' : ''}`);
  }

  if (sortedYs.length > 0) {
    console.log('\nRow sample at Y = ' + sortedYs[0] + ':');
    for (const p of prodsByY[sortedYs[0]]) {
      console.log(`  #${p.index} ${p.macro} at pos: (${p.position.x.toFixed(0)}, ${p.position.y.toFixed(0)}, ${p.position.z.toFixed(0)}) pred: #${p.predecessor ? p.predecessor.index : 'none'}`);
    }
  }
}
