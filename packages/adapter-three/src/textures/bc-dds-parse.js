/**
 * Pure DDS header detection + BC4/BC5 mip-chain decoding (no three.js import), shared by
 * X4DDSLoader on the main thread and by bc-decode-worker.js, so both produce identical output.
 */
import { decodeBC4ToRGBA, decodeBC5NormalToRGBA, bcLevelByteLength } from './bc-decoder.js';

/** three.js RGBAFormat constant (kept local so workers need not import three). */
export const RGBA_FORMAT = 1023;

const DDS_MAGIC = 0x20534444;
const DDSD_MIPMAPCOUNT = 0x20000;
const DDSCAPS2_CUBEMAP = 0x200;
const DDSCAPS2_VOLUME = 0x200000;
const DDPF_FOURCC = 0x4;

// Header int32 offsets (same layout as three's DDSLoader)
const OFF_SIZE = 1, OFF_FLAGS = 2, OFF_HEIGHT = 3, OFF_WIDTH = 4, OFF_MIPMAPCOUNT = 7;
const OFF_PF_FLAGS = 20, OFF_PF_FOURCC = 21, OFF_CAPS2 = 28;
const DX10_HEADER_BYTES = 20;
const DXGI_FORMAT_BC4_UNORM = 80;
const DXGI_FORMAT_BC5_UNORM = 83;

const fourCC = (s) => s.charCodeAt(0) + (s.charCodeAt(1) << 8) + (s.charCodeAt(2) << 16) + (s.charCodeAt(3) << 24);
const FOURCC_BC4 = new Set([fourCC('ATI1'), fourCC('BC4U')]);
const FOURCC_BC5 = new Set([fourCC('ATI2'), fourCC('BC5U')]);
const FOURCC_DX10 = fourCC('DX10');

/**
 * Identifies the BC variant of a DDS buffer that X4DDSLoader decodes itself.
 * @param {ArrayBuffer} buffer
 * @returns {{ kind: 'bc4'|'bc5', dataOffset: number } | null} null when the stock loader should handle it.
 */
export function detectX4BlockFormat(buffer) {
  if (buffer.byteLength < 128) return null;
  const header = new Int32Array(buffer, 0, 31);
  if (header[0] !== DDS_MAGIC) return null;
  if (header[OFF_CAPS2] & (DDSCAPS2_CUBEMAP | DDSCAPS2_VOLUME)) return null; // 2D only
  if (!(header[OFF_PF_FLAGS] & DDPF_FOURCC)) return null;
  const cc = header[OFF_PF_FOURCC];
  const dataOffset = header[OFF_SIZE] + 4;
  if (FOURCC_BC4.has(cc)) return { kind: 'bc4', dataOffset };
  if (FOURCC_BC5.has(cc)) return { kind: 'bc5', dataOffset };
  if (cc === FOURCC_DX10 && buffer.byteLength >= dataOffset + DX10_HEADER_BYTES) {
    const ext = new Uint32Array(buffer, dataOffset, 5);
    const [dxgi, , , arraySize] = ext;
    if (arraySize > 1) return null; // texture arrays: not supported here
    if (dxgi === DXGI_FORMAT_BC4_UNORM) return { kind: 'bc4', dataOffset: dataOffset + DX10_HEADER_BYTES };
    if (dxgi === DXGI_FORMAT_BC5_UNORM) return { kind: 'bc5', dataOffset: dataOffset + DX10_HEADER_BYTES };
  }
  return null;
}

/**
 * Decodes a BC4/BC5 DDS into an RGBA8 mip chain in three's DDSLoader.parse result shape.
 * Mip levels larger than maxDecodedSize are skipped (never decoded).
 * @param {ArrayBuffer} buffer
 * @param {{ kind: 'bc4'|'bc5', dataOffset: number }} fmt From detectX4BlockFormat.
 * @param {{ loadMipmaps?: boolean, maxDecodedSize?: number }} [options]
 * @returns {{ mipmaps: Array<{data: Uint8Array, width: number, height: number}>, width: number, height: number, format: number, mipmapCount: number, isCubemap: false }}
 */
export function decodeX4BlockDDS(buffer, fmt, { loadMipmaps = true, maxDecodedSize = 2048 } = {}) {
  const header = new Int32Array(buffer, 0, 31);
  const width = header[OFF_WIDTH];
  const height = header[OFF_HEIGHT];
  const mipmapCount = (header[OFF_FLAGS] & DDSD_MIPMAPCOUNT) && loadMipmaps !== false
    ? Math.max(1, header[OFF_MIPMAPCOUNT]) : 1;
  const blockBytes = fmt.kind === 'bc4' ? 8 : 16;
  const decode = fmt.kind === 'bc4' ? decodeBC4ToRGBA : decodeBC5NormalToRGBA;

  const dds = { mipmaps: [], width, height, format: RGBA_FORMAT, mipmapCount, isCubemap: false };
  let offset = fmt.dataOffset;
  let w = width, h = height;
  for (let level = 0; level < mipmapCount; level++) {
    const len = bcLevelByteLength(w, h, blockBytes);
    if (offset + len > buffer.byteLength) break; // truncated file: keep the levels we have
    const overCap = Math.max(w, h) > maxDecodedSize && level < mipmapCount - 1;
    if (!overCap) dds.mipmaps.push({ data: decode(new Uint8Array(buffer, offset, len), w, h), width: w, height: h });
    offset += len;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  if (dds.mipmaps.length) {
    dds.width = dds.mipmaps[0].width;
    dds.height = dds.mipmaps[0].height;
  }
  dds.mipmapCount = dds.mipmaps.length;
  return dds;
}
