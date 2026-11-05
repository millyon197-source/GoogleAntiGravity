import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

console.log('Bounding Box in JSON:', meta.boundingBox);
console.log('partOffset in XML:', partOffset);

const snaps = [
  { name: 'ConnectionSnap001', pos: [200, -400, -600] },
  { name: 'ConnectionSnap002', pos: [-200, -400, 200] }
];

for (const s of snaps) {
  let minRawDist = Infinity;
  let minOffsetDist = Infinity;
  let minNegXZDist = Infinity;
  let minNegXZOffsetDist = Infinity;

  let closestRawVert = null;
  let closestOffsetVert = null;

  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride];
    const vy = floats[i * stride + 1];
    const vz = floats[i * stride + 2];

    const dRaw = Math.hypot(vx - s.pos[0], vy - s.pos[1], vz - s.pos[2]);
    if (dRaw < minRawDist) {
      minRawDist = dRaw;
      closestRawVert = [vx, vy, vz];
    }

    const ox = vx + partOffset[0];
    const oy = vy + partOffset[1];
    const oz = vz + partOffset[2];
    const dOff = Math.hypot(ox - s.pos[0], oy - s.pos[1], oz - s.pos[2]);
    if (dOff < minOffsetDist) {
      minOffsetDist = dOff;
      closestOffsetVert = [ox, oy, oz];
    }

    const dNeg = Math.hypot(vx - (-s.pos[0]), vy - s.pos[1], vz - (-s.pos[2]));
    if (dNeg < minNegXZDist) minNegXZDist = dNeg;

    const dNegOff = Math.hypot(ox - (-s.pos[0]), oy - s.pos[1], oz - (-s.pos[2]));
    if (dNegOff < minNegXZOffsetDist) minNegXZOffsetDist = dNegOff;
  }

  console.log(`\nSnap ${s.name} pos=${s.pos}:`);
  console.log(`  Raw dist (no offset): ${minRawDist.toFixed(2)}m (closest vert: ${closestRawVert.map(v => v.toFixed(1))})`);
  console.log(`  Offset dist (XYZ):     ${minOffsetDist.toFixed(2)}m (closest vert: ${closestOffsetVert.map(v => v.toFixed(1))})`);
  console.log(`  Raw dist (-X,-Z):     ${minNegXZDist.toFixed(2)}m`);
  console.log(`  Offset dist (-X,-Z):  ${minNegXZOffsetDist.toFixed(2)}m`);
}
