import fs from 'fs';
import { parseConstructionPlan } from '../parser.js';
import { getModuleCategory, getFriendlyName } from '@x4/catalog';

export function analyzeDeltas(xmlContent) {
  const plan = parseConstructionPlan(xmlContent);

  // Analyze horizontal and vertical spacing:
  // Group modules by Y levels
  const levelMap = new Map();
  for (const m of plan.modules) {
    const y = Math.round(m.position.y);
    if (!levelMap.has(y)) levelMap.set(y, []);
    levelMap.get(y).push(m);
  }

  const levels = Array.from(levelMap.keys()).sort((a,b) => b - a);
  return { plan, levelMap, levels };
}

// Standalone execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('analyze_deltas.js')) {
  const defaultPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Planar - Paranid.xml';
  const filePath = process.argv[2] || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`Blueprint file not found: ${filePath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(filePath, 'utf8');
  const { levelMap, levels } = analyzeDeltas(xml);

  console.log('Total unique Y levels in Planar - Paranid:', levels.length);
  console.log('\nSample Y Levels and Delta Y:');
  for (let i = 0; i < Math.min(20, levels.length); i++) {
    const y = levels[i];
    const nextY = levels[i+1];
    const dy = nextY !== undefined ? y - nextY : 0;
    const mods = levelMap.get(y);
    const catSummary = {};
    mods.forEach(m => {
      const c = getModuleCategory(m.macro);
      catSummary[c] = (catSummary[c] || 0) + 1;
    });
    console.log(`  Y=${y.toString().padStart(6)} (dY=${dy.toString().padStart(4)}m) [${mods.length.toString().padStart(2)} mods] -> ${JSON.stringify(catSummary)}`);
  }
}
