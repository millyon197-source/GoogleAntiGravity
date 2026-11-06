import { CompressedTexture, FileLoader, LinearFilter } from 'three';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';
import { detectX4BlockFormat, decodeX4BlockDDS } from './bc-dds-parse.js';

export { detectX4BlockFormat } from './bc-dds-parse.js';

/** Default worker factory: a module worker Vite bundles from the co-located script. */
function createDefaultDecodeWorker() {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./bc-decode-worker.js', import.meta.url), { type: 'module' });
}

/**
 * Fills a CompressedTexture from a DDSLoader.parse-shaped result, exactly as three's
 * CompressedTextureLoader.load does for a single (possibly cubemap) DDS file.
 */
function fillTexture(texture, texDatas) {
  if (texDatas.isCubemap) {
    const images = [];
    const faces = texDatas.mipmaps.length / texDatas.mipmapCount;
    for (let f = 0; f < faces; f++) {
      images[f] = { mipmaps: [] };
      for (let i = 0; i < texDatas.mipmapCount; i++) {
        images[f].mipmaps.push(texDatas.mipmaps[f * texDatas.mipmapCount + i]);
        images[f].format = texDatas.format;
        images[f].width = texDatas.width;
        images[f].height = texDatas.height;
      }
    }
    texture.image = images;
  } else {
    texture.image.width = texDatas.width;
    texture.image.height = texDatas.height;
    texture.mipmaps = texDatas.mipmaps;
  }
  if (texDatas.mipmapCount === 1) texture.minFilter = LinearFilter;
  texture.format = texDatas.format;
  texture.needsUpdate = true;
  return texture;
}

/**
 * DDSLoader that additionally reads BC4 (ATI1/BC4U, DXGI 80) and BC5 (ATI2/BC5U, DXGI 83)
 * 2D textures, decoding them to RGBA8 mip chains (see bc-decoder.js). All other formats are
 * handled by three's DDSLoader unchanged.
 *
 * - `load()` decodes BC4/BC5 in a module worker (bc-decode-worker.js) so large textures do
 *   not stall the main thread; without Worker support, or if the worker fails, it decodes
 *   on the main thread instead. `parse()` stays synchronous.
 * - Decoded RGBA is 4-8x larger than the compressed source, so mip levels larger than
 *   `maxDecodedSize` (default 2048) are skipped: never decoded, and the texture starts at the
 *   first level within the cap.
 */
export class X4DDSLoader extends DDSLoader {
  /**
   * @param {import('three').LoadingManager} [manager]
   * @param {{ maxDecodedSize?: number, createWorker?: (() => Worker|null) | null }} [options]
   *   createWorker: factory for the decode worker (null disables the worker).
   */
  constructor(manager, { maxDecodedSize = 2048, createWorker = createDefaultDecodeWorker } = {}) {
    super(manager);
    this.maxDecodedSize = maxDecodedSize;
    this.createWorker = createWorker;
    this._worker = undefined; // undefined = not created yet, null = unavailable/failed
    this._pending = new Map();
    this._nextId = 1;
  }

  parse(buffer, loadMipmaps) {
    const fmt = detectX4BlockFormat(buffer);
    if (!fmt) return super.parse(buffer, loadMipmaps);
    return decodeX4BlockDDS(buffer, fmt, { loadMipmaps, maxDecodedSize: this.maxDecodedSize });
  }

  load(url, onLoad, onProgress, onError) {
    if (Array.isArray(url)) return super.load(url, onLoad, onProgress, onError); // 6-file cubemaps: stock path

    const texture = new CompressedTexture();
    const fileLoader = new FileLoader(this.manager);
    fileLoader.setPriority?.(this.priority);
    fileLoader.setCache?.(this.cache);
    fileLoader.setPath(this.path);
    fileLoader.setResponseType('arraybuffer');
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);

    // FileLoader reports the item done as soon as the bytes arrive, but BC4/BC5 decoding finishes
    // later (in the worker). Hold one extra manager item open until the texture is filled, so
    // manager.onLoad fires only when every texture is actually ready.
    const managerKey = this.manager.resolveURL(this.path + url);
    this.manager.itemStart(managerKey);
    let settled = false;
    const finish = (failed) => {
      if (settled) return;
      settled = true;
      if (failed) this.manager.itemError(managerKey);
      this.manager.itemEnd(managerKey);
    };

    try {
      this._loadFile(fileLoader, url, texture, onLoad, onProgress, onError, finish);
    } catch (err) {
      finish(true); // e.g. an unparseable URL throws before FileLoader registers the item
      throw err;
    }

    return texture;
  }

  _loadFile(fileLoader, url, texture, onLoad, onProgress, onError, finish) {
    fileLoader.load(url, (buffer) => {
      this.decodeInto(texture, buffer).then(
        () => {
          try { if (onLoad) onLoad(texture); } finally { finish(false); }
        },
        (err) => {
          try { if (onError) onError(err); else console.error(err); } finally { finish(true); }
        }
      );
    }, onProgress, (err) => {
      try { if (onError) onError(err); } finally { finish(true); }
    });
  }

  /**
   * Parses `buffer` into `texture` (worker for BC4/BC5 when available, otherwise synchronously).
   * @param {CompressedTexture} texture
   * @param {ArrayBuffer} buffer
   * @returns {Promise<CompressedTexture>}
   */
  decodeInto(texture, buffer) {
    try {
      const fmt = detectX4BlockFormat(buffer);
      const worker = fmt ? this._getWorker() : null;
      if (worker) {
        return this._decodeInWorker(worker, buffer).then(
          (dds) => fillTexture(texture, dds),
          () => fillTexture(texture, this.parse(buffer, true)) // worker failed: decode here
        );
      }
      return Promise.resolve(fillTexture(texture, this.parse(buffer, true)));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /** Terminates the decode worker (pending decodes fall back to the main thread). */
  dispose() {
    if (this._worker) this._worker.terminate();
    this._failPending(new Error('X4DDSLoader disposed'));
    this._worker = undefined;
  }

  _getWorker() {
    if (this._worker !== undefined) return this._worker;
    try {
      this._worker = this.createWorker ? this.createWorker() : null;
    } catch (_) {
      this._worker = null;
    }
    if (this._worker) {
      this._worker.onmessage = (event) => {
        const { id, dds, error } = event.data || {};
        const pending = this._pending.get(id);
        if (!pending) return;
        this._pending.delete(id);
        if (error) pending.reject(new Error(error)); else pending.resolve(dds);
      };
      this._worker.onerror = (event) => {
        // Worker unusable (e.g. failed to load): stop using it, fall back for queued work
        this._worker = null;
        this._failPending(new Error(event && event.message || 'decode worker error'));
      };
    }
    return this._worker;
  }

  _decodeInWorker(worker, buffer) {
    const id = this._nextId++;
    // Send a copy: the source buffer may be held by THREE.Cache and is needed for fallback.
    const copy = buffer.slice(0);
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      worker.postMessage({ id, buffer: copy, maxDecodedSize: this.maxDecodedSize }, [copy]);
    });
  }

  _failPending(err) {
    for (const { reject } of this._pending.values()) reject(err);
    this._pending.clear();
  }
}
