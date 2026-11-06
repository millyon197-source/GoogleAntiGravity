/**
 * Verifies the BC4/BC5 CPU decoder and X4DDSLoader (three's DDSLoader + ATI1/ATI2 support)
 * against hand-built blocks and real X4 texture files.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import * as THREE from 'three';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';
import {
  X4DDSLoader, detectX4BlockFormat, decodeBC4Block, decodeBC4ToRGBA, decodeBC5NormalToRGBA, bcLevelByteLength
} from '@x4/adapter-three';

console.log('[*] Testing BC4/BC5 DDS decoding...');

// Pack 16 3-bit indices into the 6 index bytes of a BC4 block (two little-endian 24-bit halves)
function bc4Block(e0, e1, indices) {
  const b = new Uint8Array(8);
  b[0] = e0; b[1] = e1;
  for (let half = 0; half < 2; half++) {
    let bits = 0;
    for (let i = 0; i < 8; i++) bits |= (indices[half * 8 + i] & 7) << (3 * i);
    b[2 + half * 3] = bits & 0xff; b[3 + half * 3] = (bits >> 8) & 0xff; b[4 + half * 3] = (bits >> 16) & 0xff;
  }
  return b;
}
const ramp = [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0];

// 1. Eight-value mode (e0 > e1): 6 interpolants
{
  const out = decodeBC4Block(bc4Block(255, 0, ramp), 0, new Uint8Array(16));
  assert.deepStrictEqual(Array.from(out.slice(0, 8)), [255, 0, 219, 182, 146, 109, 73, 36]);
  assert.deepStrictEqual(Array.from(out.slice(8)), [36, 73, 109, 146, 182, 219, 0, 255]);
  console.log('  ✓ BC4 eight-value palette (e0 > e1) decodes exactly');
}
// 2. Six-value mode (e0 <= e1): 4 interpolants + explicit 0 and 255
{
  const out = decodeBC4Block(bc4Block(0, 255, ramp), 0, new Uint8Array(16));
  assert.deepStrictEqual(Array.from(out.slice(0, 8)), [0, 255, 51, 102, 153, 204, 0, 255]);
  console.log('  ✓ BC4 six-value palette (e0 <= e1) decodes exactly, incl. explicit 0/255');
}
// 3. Image layout: 8x4 BC4 image (2 blocks) -> grey RGBA in row-major order
{
  const left = bc4Block(10, 10, new Array(16).fill(0));
  const right = bc4Block(200, 200, new Array(16).fill(0));
  const src = new Uint8Array([...left, ...right]);
  const rgba = decodeBC4ToRGBA(src, 8, 4);
  assert.strictEqual(rgba.length, 8 * 4 * 4);
  assert.deepStrictEqual(Array.from(rgba.slice(0, 4)), [10, 10, 10, 255], 'left block grey');
  assert.deepStrictEqual(Array.from(rgba.slice(4 * 4, 4 * 4 + 4)), [200, 200, 200, 255], 'right block starts at x=4');
  // non-multiple-of-4 sizes (mip tails) are cropped, not overrun
  assert.strictEqual(decodeBC4ToRGBA(left, 2, 1).length, 2 * 1 * 4);
  assert.strictEqual(bcLevelByteLength(1, 1, 8), 8);
  assert.strictEqual(bcLevelByteLength(5, 3, 16), 2 * 1 * 16);
  console.log('  ✓ BC4 image layout, cropping and level sizes');
}
// 4. BC5 normal: X/Y kept, Z reconstructed
{
  const flat = new Uint8Array([...bc4Block(128, 128, new Array(16).fill(0)), ...bc4Block(128, 128, new Array(16).fill(0))]);
  const n = decodeBC5NormalToRGBA(flat, 4, 4);
  assert.deepStrictEqual(Array.from(n.slice(0, 4)), [128, 128, 255, 255], 'flat normal -> (128,128,255)');
  const tilted = new Uint8Array([...bc4Block(255, 255, new Array(16).fill(0)), ...bc4Block(128, 128, new Array(16).fill(0))]);
  const t = decodeBC5NormalToRGBA(tilted, 4, 4);
  assert.ok(t[0] === 255 && t[1] === 128 && t[2] <= 130, 'X = +1 -> Z ~ 0');
  console.log('  ✓ BC5 normal decode keeps X/Y and reconstructs Z');
}

// 5. Real X4 files
const load = (p) => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const x4 = new X4DDSLoader();
{
  const buf = load('assets1/textures/generic/generic_engine_trim_metal.dds'); // ATI1, 16x16, 5 mips
  assert.deepStrictEqual(detectX4BlockFormat(buf), { kind: 'bc4', dataOffset: 128 });
  const dds = x4.parse(buf, true);
  assert.strictEqual(dds.format, THREE.RGBAFormat);
  assert.deepStrictEqual(dds.mipmaps.map(m => [m.width, m.height, m.data.length]), [[16, 16, 1024], [8, 8, 256], [4, 4, 64], [2, 2, 16], [1, 1, 4]]);
  const px = dds.mipmaps[0].data;
  for (let i = 0; i < px.length; i += 4) assert.ok(px[i] === px[i + 1] && px[i] === px[i + 2] && px[i + 3] === 255, 'BC4 decodes to opaque grey');
  console.log('  ✓ real ATI1 file: full mip chain decoded to opaque grey RGBA');
}
{
  const buf = load('assets1/textures/natural/natural_cow_01_normal.dds'); // DX10 BC5_UNORM, 64x32, 7 mips
  assert.deepStrictEqual(detectX4BlockFormat(buf), { kind: 'bc5', dataOffset: 148 });
  const dds = x4.parse(buf, true);
  assert.deepStrictEqual(dds.mipmaps.map(m => [m.width, m.height]), [[64, 32], [32, 16], [16, 8], [8, 4], [4, 2], [2, 1], [1, 1]]);
  const px = dds.mipmaps[0].data;
  let maxDev = 0;
  for (let i = 0; i < px.length; i += 4) {
    const x = px[i] / 127.5 - 1, y = px[i + 1] / 127.5 - 1, z = px[i + 2] / 127.5 - 1;
    if (x * x + y * y <= 1) maxDev = Math.max(maxDev, Math.abs(Math.hypot(x, y, z) - 1));
  }
  assert.ok(maxDev < 0.02, `decoded normals are unit length (max deviation ${maxDev.toFixed(4)})`);
  console.log(`  ✓ real BC5 normal map: 7 mips, unit-length normals (max deviation ${maxDev.toFixed(4)})`);
}
{
  // Formats three already handles are delegated unchanged
  const buf = load('assets1/textures/fx/fx_p2_grey_01_diff.dds'); // DXT5
  assert.strictEqual(detectX4BlockFormat(buf), null);
  const ours = x4.parse(buf, true), stock = new DDSLoader().parse(buf, true);
  assert.strictEqual(ours.format, stock.format);
  assert.deepStrictEqual(ours.mipmaps.map(m => m.data.length), stock.mipmaps.map(m => m.data.length));
  // Texture arrays and volume textures are left to the stock loader
  const arrHead = fs.readFileSync('assets1/textures/multimat/multimat_normal2.dds').subarray(0, 148);
  assert.strictEqual(detectX4BlockFormat(arrHead.buffer.slice(arrHead.byteOffset, arrHead.byteOffset + 148)), null, 'texture array delegated');
  const volHead = fs.readFileSync('assets1/textures/multimat/multimat_volume_normal.dds').subarray(0, 148);
  assert.strictEqual(detectX4BlockFormat(volHead.buffer.slice(volHead.byteOffset, volHead.byteOffset + 148)), null, 'volume texture delegated');
  console.log('  ✓ DXT5 parse identical to stock; texture arrays / volumes delegated');
}

{
  // maxDecodedSize: levels above the cap are skipped (not decoded); texture starts at first level within cap
  const buf = load('assets1/textures/natural/natural_cow_01_normal.dds'); // 64x32
  const capped = new X4DDSLoader(undefined, { maxDecodedSize: 16 }).parse(buf, true);
  assert.deepStrictEqual([capped.width, capped.height], [16, 8]);
  assert.deepStrictEqual(capped.mipmaps.map(m => [m.width, m.height]), [[16, 8], [8, 4], [4, 2], [2, 1], [1, 1]]);
  const full = x4.parse(buf, true);
  assert.deepStrictEqual(Array.from(capped.mipmaps[0].data), Array.from(full.mipmaps[2].data), 'capped level 0 == full level 2');
  assert.strictEqual(new X4DDSLoader().maxDecodedSize, 2048, 'default cap is 2048');
  console.log('  ✓ maxDecodedSize skips oversized mip levels');
}

console.log('\n[PASS] test_dds_bc_decoder');
