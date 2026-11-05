import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

const snaps = [
  { name: 'ConnectionSnap001', pos: [200, -400, -600] },
  { name: 'ConnectionSnap002', pos: [-200, -400, 200] }
];

console.log('--- Testing prod_gen_refinedmetals with X-inversion (-vx + partOffset[0]) ---');

for (const s of snaps) {
  let minD = Infinity;
  let closestV = null;

  for (let i = 0; i < meta.vertexCount; i++) {
    // Reflect X: vx -> -vx
    const x = -floats[i * stride] + partOffset[0];
    const y = floats[i * stride + 1] + partOffset[1];
    const z = floats[i * stride + 2] + partOffset[2];

    const d = Math.hypot(x - s.pos[0], y - s.pos[1], z - s.pos[2]);
    if (d < minD) {
      minD = d;
      closestV = [x, y, z];
    }
  }

  console.log(`Snap ${s.name} ${s.pos} -> Min dist to reflected mesh: ${minD.toFixed(2)}m (closest: [${closestV.map(n => n.toFixed(1))}])`);
}

console.log('\n--- Testing prod_gen_refinedmetals with both X and Z inversion (-vx, vy, -vz) ---');

for (const s of snaps) {
  let minD = Infinity;
  let closestV = null;

  for (let i = 0; i < meta.vertexCount; i++) {
    const x = -floats[i * stride] + partOffset[0];
    const y = floats[i * stride + 1] + partOffset[1];
    const z = -floats[i * stride + 2] + partOffset[2];

    const d = Math.hypot(x - s.pos[0], y - s.pos[1], z - s.pos[2]);
    if (d < minD) {
      minD = d;
      closestV = [x, y, z];
    }
  }

  console.log(`Snap ${s.name} ${s.pos} -> Min dist to (-X, -Z) mesh: ${minD.toFixed(2)}m (closest: [${closestV.map(n => n.toFixed(1))}])`);
}
