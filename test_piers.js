import fs from 'fs';

const xmlPath = 'D:\\Ai\\X4\\ConstructionPlans\\constructionplan\\ebi trading station.xml';
const content = fs.readFileSync(xmlPath, 'utf8');

const entryRegex = /<entry\s+([^>]+)>([\s\S]*?)<\/entry>/gi;
const attrRegex = /(\w+)="([^"]*)"/g;

console.log('--- PIER MODULES IN EBI TRADING STATION ---');

while (true) {
  const match = entryRegex.exec(content);
  if (!match) break;
  
  const entryAttrs = {};
  let aMatch;
  while ((aMatch = attrRegex.exec(match[1])) !== null) {
    entryAttrs[aMatch[1]] = aMatch[2];
  }
  if (!entryAttrs.macro) continue;

  if (entryAttrs.macro.includes('pier')) {
    const innerContent = match[2];
    const posMatch = /<position\s+([^>]+)\/>/i.exec(innerContent);
    const rotMatch = /<rotation\s+([^>]+)\/>/i.exec(innerContent);

    console.log(`Index #${entryAttrs.index}: ${entryAttrs.macro}`);
    if (posMatch) console.log(`  Position: ${posMatch[0]}`);
    if (rotMatch) console.log(`  Rotation: ${rotMatch[0]}`);
  }
}
