import fs from 'fs';

const jsonPath = 'assets1/structures/production/prod_arg_foodrations_data/part_main_bottom-lod0.json';
const binPath = 'assets1/structures/production/prod_arg_foodrations_data/part_main_bottom-lod0.bin';

if (fs.existsSync(jsonPath) && fs.existsSync(binPath)) {
  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
  const stride = meta.vertexStrideBytes / 4;

  const partOffset = [193.6553, -270.6909, 1.191498];
  console.log('part_main_bottom bounding box:', meta.boundingBox);

  const snaps = [
    { name: 'ConnectionSnap001', pos: [200, -400, 0] },
    { name: 'ConnectionSnap002', pos: [400, -200, 0] }
  ];

  for (const s of snaps) {
    let minD = Infinity;
    let closestV = null;
    for (let i = 0; i < meta.vertexCount; i++) {
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
} else {
  console.log('part_main_bottom files not found for prod_arg_foodrations');
}
