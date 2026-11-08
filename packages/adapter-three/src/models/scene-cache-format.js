/**
 * Scene cache file decoding without THREE, shared by the main thread (scene-cache.js) and the scene
 * cache worker: checks the header, parses the JSON description and turns the binary blob back into
 * typed arrays, expanding arrays stored as distinct items + index. See scene-cache.js for the layout.
 */

export const SCENE_CACHE_VERSION = 3; // 3: geometry may be stored indexed
export const SCENE_CACHE_MAGIC = 'X4SC';

export const ARRAY_TYPES = {
  Float32Array, Float64Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array
};

export function align4(n) { return (n + 3) & ~3; }

/**
 * Decodes a scene cache file. Every returned array owns its own ArrayBuffer (so the arrays can be
 * transferred from a worker and each geometry owns its data, as with ColladaLoader).
 * @param {ArrayBuffer} buffer
 * @returns {{ data: Object, arrays: ArrayBufferView[] }}
 */
export function decodeSceneBuffer(buffer) {
  if (!buffer || !(buffer.byteLength >= 12)) throw new Error('not a scene cache file');
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== SCENE_CACHE_MAGIC) throw new Error('not a scene cache file');
  const view = new DataView(buffer);
  const version = view.getUint32(4, true);
  if (version !== SCENE_CACHE_VERSION) throw new Error(`scene cache version ${version}, expected ${SCENE_CACHE_VERSION}`);
  const jsonLength = view.getUint32(8, true);
  const data = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + jsonLength)));
  const blobStart = align4(12 + jsonLength);

  const arrays = data.arrays.map(a => {
    const Ctor = ARRAY_TYPES[a.type];
    if (!Ctor) throw new Error(`unsupported array type ${a.type}`);
    if (a.values === undefined) return new Ctor(buffer.slice(blobStart + a.offset, blobStart + a.offset + a.length * Ctor.BYTES_PER_ELEMENT));
    // Distinct items + index: expand bit for bit through 32-bit views
    const IndexCtor = ARRAY_TYPES[a.indexType];
    const k = a.itemSize;
    const values = new Uint32Array(buffer, blobStart + a.values, a.valueCount);
    const index = new IndexCtor(buffer, blobStart + a.index, a.length / k);
    const out = new Ctor(a.length);
    const out32 = new Uint32Array(out.buffer);
    for (let v = 0, o = 0; v < index.length; v++) {
      const src = index[v] * k;
      for (let j = 0; j < k; j++) out32[o++] = values[src + j];
    }
    return out;
  });
  return { data, arrays };
}
