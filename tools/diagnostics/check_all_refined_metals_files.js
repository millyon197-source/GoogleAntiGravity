import fs from 'fs';

const folder = 'assets1/structures/production/prod_gen_refinedmetals_data';
const files = ['part_main-lod0', 'detail_l_main-lod0', 'detail_s_main-lod0', 'detail_s_alpha-lod0'];

const snaps = [
  { name: 'ConnectionSnap001', pos: [200, -400, -600] },
  { name: 'ConnectionSnap002', pos: [-200, -400, 200] }
];

for (const file of files) {
  const jsonPath = `${folder}/${file}.json`;
  const binPath = `${folder}/${file}.bin`;
  if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) continue;

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  console.log(`\n=== ${file} (verts: ${meta.vertexCount}) ===`);
  console.log('Bounding box:', meta.boundingBox);

  for (const s of snaps) {
    let minD = Infinity;
    let closestV = null;
    for (let i = 0; i < meta.vertexCount; i++) {
      const vx = floats[i * stride];
      const vy = floats[i * stride + 1];
      const vz = floats[i * stride + 2];
      const d = Math.hypot(vx - s.pos[0], vy - s.pos[1], vz - s.pos[2]);
      if (d < minD) {
        minD = d;
        closestV = [vx, vy, vz];
      }
    }
    console.log(`  Snap ${s.name} ${s.pos} -> min dist: ${minD.toFixed(2)}m (closest: [${closestV.map(n => n.toFixed(1))}])`);
  }
}
