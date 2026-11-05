import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_fieldcoils_data/part_main_bottom-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_fieldcoils_data/part_main_bottom-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [5.440567, -72.21127, -49.78487];

const snaps = [
  { name: 'ConnectionSnap01', pos: [-200, -200, 200] },
  { name: 'ConnectionSnap002', pos: [200, -200, 200] }
];

console.log('part_main_bottom bounding box:', meta.boundingBox);

for (const s of snaps) {
  let minD = Infinity;
  let closestV = null;

  for (let i = 0; i < meta.vertexCount; i++) {
    // Test with X reflection and offset:
    const vx = -floats[i * stride] + partOffset[0];
    const vy = floats[i * stride + 1] + partOffset[1];
    const vz = floats[i * stride + 2] + partOffset[2];

    const d = Math.hypot(vx - s.pos[0], vy - s.pos[1], vz - s.pos[2]);
    if (d < minD) {
      minD = d;
      closestV = [vx, vy, vz];
    }
  }

  console.log(`Snap ${s.name} ${s.pos} -> Min dist to part_main_bottom: ${minD.toFixed(2)}m (closest: [${closestV.map(n => n.toFixed(1))}])`);
}
