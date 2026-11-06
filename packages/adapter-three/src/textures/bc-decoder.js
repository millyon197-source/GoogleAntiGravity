/**
 * CPU decoders for the BC4 (ATI1 / RGTC1) and BC5 (ATI2 / RGTC2) block-compressed formats
 * used by many X4 textures (single-channel masks/diffuse and two-channel normal maps).
 *
 * Output is plain RGBA8 so three.js materials can sample it without channel remapping:
 *  - BC4 -> grey (R = G = B = value, A = 255): works as map, roughnessMap (G), metalnessMap (B).
 *  - BC5 normal maps -> tangent-space RGB with Z reconstructed from X/Y, A = 255.
 * Pure functions, no three.js dependency.
 */

/**
 * Builds the 8-entry palette for one BC4 (UNORM) channel block.
 * @param {number} e0 First endpoint (0..255).
 * @param {number} e1 Second endpoint (0..255).
 * @param {Uint8Array} out Receives 8 palette values.
 */
function bc4Palette(e0, e1, out) {
  out[0] = e0;
  out[1] = e1;
  if (e0 > e1) {
    // 6 interpolated values
    for (let i = 1; i <= 6; i++) out[i + 1] = Math.round(((7 - i) * e0 + i * e1) / 7);
  } else {
    // 4 interpolated values, then explicit 0 and 255
    for (let i = 1; i <= 4; i++) out[i + 1] = Math.round(((5 - i) * e0 + i * e1) / 5);
    out[6] = 0;
    out[7] = 255;
  }
}

/**
 * Decodes one 8-byte BC4 block into 16 values (row-major 4x4).
 * @param {Uint8Array} src Source bytes.
 * @param {number} offset Byte offset of the block.
 * @param {Uint8Array} out Receives 16 decoded values.
 * @param {Uint8Array} [palette] Scratch buffer (8 bytes).
 * @returns {Uint8Array} `out`
 */
export function decodeBC4Block(src, offset, out, palette = new Uint8Array(8)) {
  bc4Palette(src[offset], src[offset + 1], palette);
  // 48 bits of 3-bit indices, little-endian, in two 24-bit halves (8 texels each)
  for (let half = 0; half < 2; half++) {
    const o = offset + 2 + half * 3;
    const bits = src[o] | (src[o + 1] << 8) | (src[o + 2] << 16);
    for (let i = 0; i < 8; i++) out[half * 8 + i] = palette[(bits >> (3 * i)) & 7];
  }
  return out;
}

/**
 * Number of bytes for one mip level of a BC4 (8 B/block) or BC5 (16 B/block) image.
 * @param {number} width
 * @param {number} height
 * @param {8|16} blockBytes
 */
export function bcLevelByteLength(width, height, blockBytes) {
  return Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * blockBytes;
}

/**
 * Decodes a BC4 image to RGBA8 grey.
 * @param {Uint8Array} src Compressed level data.
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} width*height*4 bytes.
 */
export function decodeBC4ToRGBA(src, width, height) {
  const out = new Uint8Array(width * height * 4);
  const block = new Uint8Array(16);
  const palette = new Uint8Array(8);
  const bw = Math.max(1, Math.ceil(width / 4));
  const bh = Math.max(1, Math.ceil(height / 4));
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      decodeBC4Block(src, (by * bw + bx) * 8, block, palette);
      for (let py = 0; py < 4; py++) {
        const y = by * 4 + py;
        if (y >= height) break;
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          if (x >= width) break;
          const v = block[py * 4 + px];
          const o = (y * width + x) * 4;
          out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * Decodes a BC5 image (R = X, G = Y) to an RGBA8 normal map, reconstructing
 * Z = sqrt(1 - X^2 - Y^2) into B. X/Y are written back unchanged, so the material's
 * normalScale (e.g. the DirectX green flip) still applies as before.
 * @param {Uint8Array} src Compressed level data.
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} width*height*4 bytes.
 */
export function decodeBC5NormalToRGBA(src, width, height) {
  const out = new Uint8Array(width * height * 4);
  const red = new Uint8Array(16);
  const green = new Uint8Array(16);
  const palette = new Uint8Array(8);
  const bw = Math.max(1, Math.ceil(width / 4));
  const bh = Math.max(1, Math.ceil(height / 4));
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const offset = (by * bw + bx) * 16;
      decodeBC4Block(src, offset, red, palette);
      decodeBC4Block(src, offset + 8, green, palette);
      for (let py = 0; py < 4; py++) {
        const y = by * 4 + py;
        if (y >= height) break;
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          if (x >= width) break;
          const r = red[py * 4 + px];
          const g = green[py * 4 + px];
          const nx = r / 127.5 - 1;
          const ny = g / 127.5 - 1;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const o = (y * width + x) * 4;
          out[o] = r; out[o + 1] = g; out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255); out[o + 3] = 255;
        }
      }
    }
  }
  return out;
}
