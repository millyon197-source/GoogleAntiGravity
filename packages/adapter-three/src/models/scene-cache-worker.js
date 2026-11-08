/**
 * Scene cache worker: fetches a .x4scene file and decodes it (header, JSON, expanding repeated vertex
 * items) off the main thread, then transfers the typed arrays back. The main thread only builds the
 * THREE objects around them (scene-cache.js, buildScene).
 *
 * Message in:  { id, url }
 * Message out: { id, decoded: { data, arrays } } or { id, error }
 */
import { decodeSceneBuffer } from './scene-cache-format.js';

self.onmessage = async (event) => {
  const { id, url } = event.data || {};
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const decoded = decodeSceneBuffer(await res.arrayBuffer());
    const transfer = [...new Set(decoded.arrays.map(a => a.buffer))];
    self.postMessage({ id, decoded }, transfer);
  } catch (err) {
    self.postMessage({ id, error: (err && err.message) || String(err) });
  }
};
