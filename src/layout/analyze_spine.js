import fs from 'fs';
import { parseConstructionPlan } from '../parser.js';
import { getModuleCategory, getFriendlyName } from '../modules.js';

export function analyzeSpine(xmlContent) {
  const plan = parseConstructionPlan(xmlContent);

  // Find all modules on the main spine (x ~ -1391 and z ~ 887):
  const spineModules = plan.modules.filter(m =>
    Math.abs(m.position.x - (-1391.228)) < 10 &&
    Math.abs(m.position.z - 887.198) < 10
  );
  spineModules.sort((a,b) => b.position.y - a.position.y);

  // Find other column spines (cross / vertical):
  const otherSpines = {};
  for (const m of plan.modules) {
    if (m.macro.includes('vertical') || m.macro.includes('cross')) {
      const key = `X=${m.position.x.toFixed(0)}, Z=${m.position.z.toFixed(0)}`;
      otherSpines[key] = (otherSpines[key] || 0) + 1;
    }
  }

  return { plan, spineModules, otherSpines };
}

// Standalone execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('analyze_spine.js')) {
  const defaultPath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Planar - Paranid.xml';
  const filePath = process.argv[2] || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`Blueprint file not found: ${filePath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(filePath, 'utf8');
  const { spineModules, otherSpines } = analyzeSpine(xml);

  console.log('Spine modules count at x=-1391, z=887:', spineModules.length);
  console.log('\nSpine layout along Y:');
  for (const m of spineModules) {
    console.log(`  Y=${m.position.y.toFixed(0).padStart(6)}: #${m.index.toString().padStart(3)} ${m.macro} (${getFriendlyName(m.macro)})`);
  }

  console.log('\nStructural columns (cross / vertical):');
  for (const [k, v] of Object.entries(otherSpines).sort((a,b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v} modules`);
  }
}
