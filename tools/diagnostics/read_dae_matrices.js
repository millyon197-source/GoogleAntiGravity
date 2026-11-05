import fs from 'fs';

const daePath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.dae';
const content = fs.readFileSync(daePath, 'utf8');

// Look for <matrix> or <translate> tags in the DAE
const matrices = [...content.matchAll(/<matrix[^>]*>([\s\S]*?)<\/matrix>/g)];
console.log('DAE matrices count:', matrices.length);
for (const [_, m] of matrices) {
  console.log('Matrix:', m.trim().replace(/\s+/g, ' '));
}

const translates = [...content.matchAll(/<translate[^>]*>([\s\S]*?)<\/translate>/g)];
console.log('DAE translates count:', translates.length);
for (const [_, t] of translates) {
  console.log('Translate:', t.trim());
}
