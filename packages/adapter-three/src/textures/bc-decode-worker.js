/**
 * Module worker: decodes BC4/BC5 DDS buffers off the main thread for X4DDSLoader.
 * Request:  { id, buffer: ArrayBuffer (transferred), maxDecodedSize }
 * Response: { id, dds } with mip data buffers transferred, or { id, error }.
 */
import { detectX4BlockFormat, decodeX4BlockDDS } from './bc-dds-parse.js';

self.onmessage = (event) => {
  const { id, buffer, maxDecodedSize } = event.data;
  try {
    const fmt = detectX4BlockFormat(buffer);
    if (!fmt) throw new Error('not a BC4/BC5 2D DDS');
    const dds = decodeX4BlockDDS(buffer, fmt, { loadMipmaps: true, maxDecodedSize });
    self.postMessage({ id, dds }, dds.mipmaps.map(m => m.data.buffer));
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
