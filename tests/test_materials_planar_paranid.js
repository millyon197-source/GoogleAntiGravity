import fs from 'fs';
import { estimateModuleCosts } from '../src/modules.js';

function parseXmlPlan(xmlText) {
  const entryRegex = /<entry\s+([^>]+)>/gi;
  const attrRegex = /(\w+)="([^"]*)"/g;

  const modules = [];
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryAttrs = {};
    let aMatch;
    while ((aMatch = attrRegex.exec(match[1])) !== null) {
      entryAttrs[aMatch[1]] = aMatch[2];
    }
    if (entryAttrs.macro) {
      modules.push({
        index: parseInt(entryAttrs.index || (modules.length + 1), 10),
        macro: entryAttrs.macro
      });
    }
  }
  return modules;
}

const xmlPath = 'D:\\Ai\\X4\\ConstructionPlans\\constructionplan\\Planar - Paranid.xml';
console.log('[*] Testing Total Construction Materials calculation for:', xmlPath);

const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const modules = parseXmlPlan(xmlContent);

const totalResources = {};

modules.forEach(mod => {
  const costs = estimateModuleCosts(mod.macro);
  for (const key in costs) {
    if (costs[key] > 0) {
      totalResources[key] = (totalResources[key] || 0) + costs[key];
    }
  }
});

console.log(`\n========================================`);
console.log(`[SUCCESS] Total Construction Materials for ${modules.length} modules:`);
for (const [material, amount] of Object.entries(totalResources)) {
  console.log(`- ${material}: ${amount.toLocaleString()}`);
}
