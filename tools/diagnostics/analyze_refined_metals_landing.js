import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

// Find all vertices in the bottom feet/structures (Y < -240 in raw mesh, or Y < -380 with offset)
const bottomVerts = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (vy <= -250) {
    bottomVerts.push({
      raw: [vx, vy, vz],
      withOffset: [vx + partOffset[0], vy + partOffset[1], vz + partOffset[2]]
    });
  }
}

console.log('Total vertices at bottom (vy <= -250):', bottomVerts.length);

const c1 = bottomVerts.filter(v => v.raw[2] < -200);
const c2 = bottomVerts.filter(v => v.raw[2] > 0);

function printCluster(name, list) {
  let minRawX = Infinity, maxRawX = -Infinity;
  let minRawY = Infinity, maxRawY = -Infinity;
  let minRawZ = Infinity, maxRawZ = -Infinity;

  let minOffX = Infinity, maxOffX = -Infinity;
  let minOffY = Infinity, maxOffY = -Infinity;
  let minOffZ = Infinity, maxOffZ = -Infinity;

  let sumOffX = 0, sumOffY = 0, sumOffZ = 0;

  for (const v of list) {
    minRawX = Math.min(minRawX, v.raw[0]); maxRawX = Math.max(maxRawX, v.raw[0]);
    minRawY = Math.min(minRawY, v.raw[1]); maxRawY = Math.max(maxRawY, v.raw[1]);
    minRawZ = Math.min(minRawZ, v.raw[2]); maxRawZ = Math.max(maxRawZ, v.raw[2]);

    minOffX = Math.min(minOffX, v.withOffset[0]); maxOffX = Math.max(maxOffX, v.withOffset[0]);
    minOffY = Math.min(minOffY, v.withOffset[1]); maxOffY = Math.max(maxOffY, v.withOffset[1]);
    minOffZ = Math.min(minOffZ, v.withOffset[2]); maxOffZ = Math.max(maxOffZ, v.withOffset[2]);

    sumOffX += v.withOffset[0]; sumOffY += v.withOffset[1]; sumOffZ += v.withOffset[2];
  }

  console.log(`\n=== ${name} (${list.length} vertices) ===`);
  console.log('Raw mesh bounds:');
  console.log(`  X: [${minRawX.toFixed(2)}, ${maxRawX.toFixed(2)}] (center: ${((minRawX + maxRawX)/2).toFixed(2)})`);
  console.log(`  Y: [${minRawY.toFixed(2)}, ${maxRawY.toFixed(2)}] (min: ${minRawY.toFixed(2)})`);
  console.log(`  Z: [${minRawZ.toFixed(2)}, ${maxRawZ.toFixed(2)}] (center: ${((minRawZ + maxRawZ)/2).toFixed(2)})`);

  console.log('With partOffset bounds (in viewer space):');
  console.log(`  X: [${minOffX.toFixed(2)}, ${maxOffX.toFixed(2)}] (midpoint: ${((minOffX + maxOffX)/2).toFixed(2)}, centroid: ${(sumOffX/list.length).toFixed(2)})`);
  console.log(`  Y: [${minOffY.toFixed(2)}, ${maxOffY.toFixed(2)}] (min: ${minOffY.toFixed(2)})`);
  console.log(`  Z: [${minOffZ.toFixed(2)}, ${maxOffZ.toFixed(2)}] (midpoint: ${((minOffZ + maxOffZ)/2).toFixed(2)}, centroid: ${(sumOffZ/list.length).toFixed(2)})`);
}

printCluster('Mounting Part 1 (Z ~ -600)', c1);
printCluster('Mounting Part 2 (Z ~ +200)', c2);
