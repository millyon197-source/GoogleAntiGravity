const fs = require('fs');

function extractFloatArray(txt, sourceId) {
  const start = txt.indexOf(`id="${sourceId}"`);
  if (start === -1) return null;
  const arrStart = txt.indexOf('<float_array', start);
  const tagEnd = txt.indexOf('>', arrStart);
  const arrEnd = txt.indexOf('</float_array>', tagEnd);
  const content = txt.substring(tagEnd + 1, arrEnd).trim();
  return content.split(/\s+/).map(Number);
}

const txt = fs.readFileSync('assets/structures/production/prod_gen_advancedelectronics_data/fx_shield-lod0.dae', 'utf8');
const uvs = extractFloatArray(txt, 'meshId0-tex0');
let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
for (let i = 0; i < uvs.length; i += 2) {
  const u = uvs[i];
  const v = uvs[i + 1];
  if (u < minU) minU = u;
  if (u > maxU) maxU = u;
  if (v < minV) minV = v;
  if (v > maxV) maxV = v;
}
console.log(`fx_shield UV Range: U [${minU.toFixed(3)}, ${maxU.toFixed(3)}], V [${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
console.log(`Span: deltaU = ${(maxU - minU).toFixed(3)}, deltaV = ${(maxV - minV).toFixed(3)}`);
