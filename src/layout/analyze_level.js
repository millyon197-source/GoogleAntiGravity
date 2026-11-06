import fs from 'fs';
import { parseConstructionPlan } from '../parser.js';
import { getModuleCategory, getFriendlyName } from '@x4/catalog';

export function analyzeLevel(xmlContent, targetY = -4570, tolerance = 100) {
  const plan = parseConstructionPlan(xmlContent);
  const levelMods = plan.modules.filter(m => Math.abs(m.position.y - targetY) < tolerance);
  return { plan, levelMods, targetY };
}

// Standalone execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('analyze_level.js')) {
  const defaultPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Planar - Paranid.xml';
  const filePath = process.argv[2] || defaultPath;
  const targetY = process.argv[3] ? parseFloat(process.argv[3]) : -4570;

  if (!fs.existsSync(filePath)) {
    console.error(`Blueprint file not found: ${filePath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(filePath, 'utf8');
  const { levelMods } = analyzeLevel(xml, targetY);

  console.log(`Modules at Y ~ ${targetY} (Count: ${levelMods.length}):`);
  for (const m of levelMods) {
    console.log(`  #${m.index.toString().padStart(3)} ${m.macro.padEnd(32)} pos: (${m.position.x.toFixed(0)}, ${m.position.y.toFixed(0)}, ${m.position.z.toFixed(0)}) pred: #${m.predecessor ? m.predecessor.index : 'none'}`);
  }
}
