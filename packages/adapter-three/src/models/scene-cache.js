import * as THREE from 'three';
import { SCENE_CACHE_VERSION, SCENE_CACHE_MAGIC as MAGIC, ARRAY_TYPES, align4, decodeSceneBuffer } from './scene-cache-format.js';

/**
 * Scene cache: a compact binary snapshot of the scene loadColladaModel builds from a .dae part, so
 * the app can rebuild that exact scene without parsing the Collada XML again.
 *
 * The snapshot is taken from loadColladaModel's own output (see tools/generate-scene-cache.js), so
 * everything the texturing code relies on is preserved: the node tree with names and transforms,
 * every geometry attribute, index, groups and draw range, material names and settings, and the raw
 * texture-coordinate channels (userData.rawUvs). Functions are not stored; the scene-level
 * setBillboardState that loadColladaModel adds is recreated on rebuild. ColladaLoader's texture
 * slots (material.map, normalMap, ...) point at .dds files its image loader cannot decode, so they
 * never get an image; they are stored as the same empty placeholders (name, wrapping, repeat,
 * offset, colour space), which keeps materials the texturing code leaves alone exactly as before.
 *
 * File layout: "X4SC" | u32 version | u32 JSON byte length | JSON (UTF-8) | padding to 4 bytes |
 * binary blob holding every typed array, each 4-byte aligned. JSON describes the tree and refers to
 * arrays by index into `arrays`.
 *
 * Collada geometry is non-indexed, so most vertex items (a position, normal, colour or UV pair) repeat
 * many times. Each 4-byte array is therefore stored as its distinct items (compared bit for bit) plus
 * a Uint8/16/32 index per item whenever that is smaller, and expanded back on load. This is lossless
 * and cuts the files to about a third.
 */

export { SCENE_CACHE_VERSION, decodeSceneBuffer } from './scene-cache-format.js';
export const SCENE_CACHE_EXTENSION = '.x4scene';
/** Lists every cached part (written by tools/generate-scene-cache.js). */
export const SCENE_CACHE_MANIFEST_PATH = '/assets1/scene-cache-manifest.json';

// Material settings worth keeping (everything ColladaLoader sets on its Phong/Lambert/Basic materials)
const MATERIAL_COLOR_KEYS = ['color', 'specular', 'emissive'];
const MATERIAL_TEXTURE_KEYS = ['map', 'normalMap', 'specularMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap', 'aoMap', 'displacementMap', 'envMap'];
const TEXTURE_VALUE_KEYS = ['name', 'wrapS', 'wrapT', 'colorSpace', 'flipY', 'magFilter', 'minFilter', 'anisotropy', 'channel'];
const MATERIAL_VALUE_KEYS = [
  'name', 'opacity', 'transparent', 'side', 'vertexColors', 'flatShading', 'alphaTest', 'depthTest', 'depthWrite',
  'visible', 'shininess', 'reflectivity', 'wireframe', 'emissiveIntensity', 'blending', 'toneMapped'
];

/**
 * Whether a .dae part is a candidate for the scene cache: the parts module-mesh-loader always loads
 * from .dae (effects, detail parts, production part_main) whose scenes are plain data. Animated and
 * billboard parts are excluded because loadColladaModel attaches behaviour (functions) to them.
 * @param {string} url
 */
export function isSceneCacheCandidate(url) {
  const u = String(url || '').toLowerCase().replace(/\\/g, '/');
  const part = u.split('/').pop().replace(/-lod\d+\.dae$/, '');
  if (!u.endsWith('-lod0.dae')) return false; // the viewer only loads lod0 parts
  if (part.startsWith('anim') || u.includes('/anim_') || part.includes('billboard') || u.includes('billboard') ||
      part.includes('ads') || part.includes('sign') || u.includes('ad_signs') || u.includes('simon')) return false;
  return part.startsWith('fx') || u.includes('/fx_') ||
    /detail_[msl]_main/.test(u) ||
    (part === 'part_main' && u.includes('/production/'));
}

/** Path of the scene cache file for a .dae URL or path. */
export function sceneCachePathFor(daePath) {
  return String(daePath).replace(/\.dae$/i, SCENE_CACHE_EXTENSION);
}

/**
 * Serializes a scene produced by loadColladaModel.
 * @param {THREE.Object3D} root
 * @returns {ArrayBuffer}
 */
export function serializeScene(root) {
  const arrays = [];
  const arrayIndex = new Map();
  const itemSizes = [];
  const addArray = (arr, itemSize = 1) => {
    if (!arr) return null;
    if (arrayIndex.has(arr)) return arrayIndex.get(arr);
    const type = arr.constructor.name;
    if (!ARRAY_TYPES[type]) throw new Error(`unsupported array type ${type}`);
    arrays.push(arr);
    itemSizes.push(itemSize);
    arrayIndex.set(arr, arrays.length - 1);
    return arrays.length - 1;
  };
  const rawUvsIndex = new Map();
  const rawUvsList = [];
  const geometries = [];
  const geometryIndex = new Map();
  const materials = [];
  const materialIndex = new Map();

  const encodeValue = (v) => (v && v.isColor ? { color: v.getHex() } : v);
  const addMaterial = (m) => {
    if (materialIndex.has(m)) return materialIndex.get(m);
    const entry = { type: m.type };
    for (const k of MATERIAL_COLOR_KEYS) if (m[k] && m[k].isColor) entry[k] = m[k].getHex();
    for (const k of MATERIAL_VALUE_KEYS) if (m[k] !== undefined) entry[k] = encodeValue(m[k]);
    for (const k of MATERIAL_TEXTURE_KEYS) {
      const t = m[k];
      if (!t || !t.isTexture) continue;
      const tex = { repeat: t.repeat.toArray(), offset: t.offset.toArray() };
      for (const tk of TEXTURE_VALUE_KEYS) if (t[tk] !== undefined) tex[tk] = t[tk];
      (entry.textures ||= {})[k] = tex;
    }
    materials.push(entry);
    materialIndex.set(m, materials.length - 1);
    return materials.length - 1;
  };
  const addGeometry = (g) => {
    if (geometryIndex.has(g)) return geometryIndex.get(g);
    const attributes = {};
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (attr.isInterleavedBufferAttribute) throw new Error('interleaved attributes are not supported');
      attributes[name] = { array: addArray(attr.array, attr.itemSize), itemSize: attr.itemSize, normalized: attr.normalized, name: attr.name || '' };
    }
    const entry = {
      name: g.name || '',
      attributes,
      index: g.index ? addArray(g.index.array) : null,
      groups: g.groups.map(gr => ({ start: gr.start, count: gr.count, materialIndex: gr.materialIndex })),
      drawRange: { start: g.drawRange.start, count: Number.isFinite(g.drawRange.count) ? g.drawRange.count : null },
      userData: plainData(g.userData)
    };
    geometries.push(entry);
    geometryIndex.set(g, geometries.length - 1);
    return geometries.length - 1;
  };
  const addRawUvs = (raw) => {
    if (rawUvsIndex.has(raw)) return rawUvsIndex.get(raw);
    const entry = {};
    for (const [k, arr] of Object.entries(raw)) entry[k] = addArray(arr, 2); // per-vertex UV pairs
    rawUvsList.push(entry);
    rawUvsIndex.set(raw, rawUvsList.length - 1);
    return rawUvsList.length - 1;
  };

  const encodeNode = (o) => {
    if (!['Group', 'Object3D', 'Mesh', 'Scene'].includes(o.type)) throw new Error(`unsupported object type ${o.type}`);
    const { rawUvs, ...rest } = o.userData || {};
    const node = {
      type: o.type === 'Scene' ? 'Group' : o.type,
      name: o.name || '',
      position: o.position.toArray(),
      quaternion: o.quaternion.toArray(),
      scale: o.scale.toArray(),
      visible: o.visible,
      castShadow: o.castShadow,
      receiveShadow: o.receiveShadow,
      renderOrder: o.renderOrder,
      frustumCulled: o.frustumCulled,
      userData: plainData(rest),
      rawUvs: rawUvs ? addRawUvs(rawUvs) : null,
      children: o.children.map(encodeNode)
    };
    if (o.isMesh) {
      node.geometry = addGeometry(o.geometry);
      node.material = Array.isArray(o.material) ? o.material.map(addMaterial) : addMaterial(o.material);
    }
    return node;
  };
  const tree = encodeNode(root);

  // Lay out the blob
  let offset = 0;
  const chunks = [];
  const place = (typed) => { offset = align4(offset); const at = offset; chunks.push([typed, at]); offset += typed.byteLength; return at; };
  const arrayEntries = arrays.map((arr, i) => {
    const entry = { type: arr.constructor.name, length: arr.length };
    const packed = packItems(arr, itemSizes[i]);
    if (packed) {
      entry.itemSize = itemSizes[i];
      entry.values = place(packed.values);
      entry.valueCount = packed.values.length;
      entry.index = place(packed.index);
      entry.indexType = packed.index.constructor.name;
    } else {
      entry.offset = place(arr);
    }
    return entry;
  });
  const blobBytes = align4(offset);
  const json = new TextEncoder().encode(JSON.stringify({ tree, geometries, materials, rawUvs: rawUvsList, arrays: arrayEntries }));
  const headerBytes = 12;
  const blobStart = align4(headerBytes + json.byteLength);
  const out = new ArrayBuffer(blobStart + blobBytes);
  const bytes = new Uint8Array(out);
  for (let i = 0; i < 4; i++) bytes[i] = MAGIC.charCodeAt(i);
  const view = new DataView(out);
  view.setUint32(4, SCENE_CACHE_VERSION, true);
  view.setUint32(8, json.byteLength, true);
  bytes.set(json, headerBytes);
  for (const [typed, at] of chunks) bytes.set(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength), blobStart + at);
  return out;
}

/**
 * Rebuilds a scene from serializeScene output. Typed arrays are copied out of the file buffer so each
 * geometry owns its data (as with ColladaLoader).
 * @param {ArrayBuffer} buffer
 * @returns {THREE.Group}
 */
export function deserializeScene(buffer) {
  return buildScene(decodeSceneBuffer(buffer));
}

/**
 * Builds the THREE scene from decoded scene data (decodeSceneBuffer output, possibly produced in the
 * scene cache worker). Cheap: all array work has been done already.
 * @param {{ data: Object, arrays: ArrayBufferView[] }} decoded
 * @returns {THREE.Group}
 */
export function buildScene({ data, arrays }) {
  const rawUvs = data.rawUvs.map(entry => Object.fromEntries(Object.entries(entry).map(([k, i]) => [k, arrays[i]])));
  const geometries = data.geometries.map(g => {
    const geom = new THREE.BufferGeometry();
    geom.name = g.name;
    for (const [name, a] of Object.entries(g.attributes)) {
      const attr = new THREE.BufferAttribute(arrays[a.array], a.itemSize, a.normalized);
      attr.name = a.name;
      geom.setAttribute(name, attr);
    }
    if (g.index !== null) geom.setIndex(new THREE.BufferAttribute(arrays[g.index], 1));
    for (const gr of g.groups) geom.addGroup(gr.start, gr.count, gr.materialIndex);
    geom.setDrawRange(g.drawRange.start, g.drawRange.count === null ? Infinity : g.drawRange.count);
    geom.userData = decodeData(g.userData);
    return geom;
  });
  const materials = data.materials.map(m => {
    const Ctor = THREE[m.type];
    if (!Ctor) throw new Error(`unsupported material type ${m.type}`);
    const mat = new Ctor();
    for (const k of MATERIAL_COLOR_KEYS) if (m[k] !== undefined && mat[k] && mat[k].isColor) mat[k].setHex(m[k]);
    for (const k of MATERIAL_VALUE_KEYS) if (m[k] !== undefined && k in mat) mat[k] = m[k];
    for (const [k, tex] of Object.entries(m.textures || {})) {
      const t = new THREE.Texture();
      for (const tk of TEXTURE_VALUE_KEYS) if (tex[tk] !== undefined) t[tk] = tex[tk];
      t.repeat.fromArray(tex.repeat);
      t.offset.fromArray(tex.offset);
      mat[k] = t;
    }
    return mat;
  });

  const decodeNode = (n) => {
    const o = n.type === 'Mesh'
      ? new THREE.Mesh(geometries[n.geometry], Array.isArray(n.material) ? n.material.map(i => materials[i]) : materials[n.material])
      : (n.type === 'Object3D' ? new THREE.Object3D() : new THREE.Group());
    o.name = n.name;
    o.position.fromArray(n.position);
    o.quaternion.fromArray(n.quaternion);
    o.scale.fromArray(n.scale);
    o.visible = n.visible;
    o.castShadow = n.castShadow;
    o.receiveShadow = n.receiveShadow;
    o.renderOrder = n.renderOrder;
    o.frustumCulled = n.frustumCulled;
    o.userData = decodeData(n.userData);
    if (n.rawUvs !== null) o.userData.rawUvs = rawUvs[n.rawUvs];
    for (const c of n.children) o.add(decodeNode(c));
    return o;
  };
  const root = decodeNode(data.tree);
  // Same scene-level helper loadColladaModel attaches
  root.userData.setBillboardState = (state) => {
    root.traverse(child => {
      if (child !== root && child.userData && typeof child.userData.setBillboardState === 'function') {
        child.userData.setBillboardState(state);
      }
    });
  };
  return root;
}

const isNode = () => typeof process !== 'undefined' && Boolean(process.versions?.node);

// Reads a served file as bytes: fetch in the browser, the working directory under Node (tests/tools).
async function readBytes(url) {
  if (isNode() && !/^https?:/i.test(url)) {
    const fsName = 'fs'; // variable specifier keeps the bundler out
    const fs = await import(/* @vite-ignore */ fsName);
    const file = fs.readFileSync(url.replace(/^\/+/, ''));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.arrayBuffer();
}

/**
 * The cache manifest (fetched once per host), or null when there is none or it is for another
 * format version. Without a manifest the viewer simply loads every part from its .dae.
 * @param {{ sceneCacheManifest?: Promise<Object|null> }} host
 */
export function loadSceneCacheManifest(host) {
  if (!host.sceneCacheManifest) {
    host.sceneCacheManifest = (async () => {
      try {
        const manifest = JSON.parse(new TextDecoder().decode(await readBytes(SCENE_CACHE_MANIFEST_PATH)));
        return manifest && manifest.version === SCENE_CACHE_VERSION && manifest.files ? manifest : null;
      } catch {
        return null; // missing (the dev server answers unknown paths with index.html) or unreadable
      }
    })();
  }
  return host.sceneCacheManifest;
}

/** Default worker factory: a module worker Vite bundles from the co-located script. */
function createDefaultSceneCacheWorker() {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./scene-cache-worker.js', import.meta.url), { type: 'module' });
}

/**
 * Fetches and decodes scene cache files in a worker so large plan loads do not block the page. The
 * worker is started on first use. Without workers (Node), or once the worker fails, files are
 * fetched and decoded on the calling thread instead, including any requests that were in flight.
 */
export class SceneCacheDecoder {
  /** @param {() => Worker|null} [createWorker] */
  constructor(createWorker = createDefaultSceneCacheWorker) {
    this.createWorker = createWorker;
    this._worker = undefined; // undefined: not started; null: unavailable
    this._pending = new Map();
    this._nextId = 1;
  }

  /**
   * @param {string} url .x4scene URL
   * @returns {Promise<{ data: Object, arrays: ArrayBufferView[] }>}
   */
  load(url) {
    const worker = this._getWorker();
    if (!worker) return decodeOnThisThread(url);
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { url, resolve, reject });
      worker.postMessage({ id, url });
    });
  }

  dispose() {
    if (this._worker) this._worker.terminate();
    this._worker = null;
    this._retryPendingHere();
  }

  _getWorker() {
    if (this._worker !== undefined) return this._worker;
    try {
      this._worker = this.createWorker ? this.createWorker() : null;
    } catch {
      this._worker = null;
    }
    if (this._worker) {
      this._worker.onmessage = (event) => {
        const { id, decoded, error } = event.data || {};
        const pending = this._pending.get(id);
        if (!pending) return;
        this._pending.delete(id);
        if (error) pending.reject(new Error(error)); else pending.resolve(decoded);
      };
      this._worker.onerror = () => {
        // Worker unusable (e.g. failed to load): decode here from now on, including queued work
        try { this._worker.terminate(); } catch { /* already gone */ }
        this._worker = null;
        this._retryPendingHere();
      };
    }
    return this._worker;
  }

  _retryPendingHere() {
    const pending = [...this._pending.values()];
    this._pending.clear();
    for (const { url, resolve, reject } of pending) decodeOnThisThread(url).then(resolve, reject);
  }
}

async function decodeOnThisThread(url) {
  return decodeSceneBuffer(await readBytes(url));
}

/**
 * Loads a scene cache file (cached per URL in host.sceneCacheCache, like host.colladaCache). Decoding
 * runs in host.sceneCacheDecoder's worker when the host has one, otherwise on this thread.
 * @param {{ sceneCacheCache?: Map<string, Promise<THREE.Object3D>>, sceneCacheDecoder?: SceneCacheDecoder }} host
 * @param {string} cacheUrl URL of the .x4scene file
 */
export function loadSceneCache(host, cacheUrl) {
  if (!host.sceneCacheCache) host.sceneCacheCache = new Map();
  if (host.sceneCacheCache.has(cacheUrl)) return host.sceneCacheCache.get(cacheUrl);
  const promise = (host.sceneCacheDecoder ? host.sceneCacheDecoder.load(cacheUrl) : decodeOnThisThread(cacheUrl)).then(buildScene);
  host.sceneCacheCache.set(cacheUrl, promise);
  promise.catch(() => host.sceneCacheCache.delete(cacheUrl));
  return promise;
}

/**
 * The cached scene for a .dae part, or null when the manifest does not list it (the caller then
 * loads the .dae). A listed file that fails to load is reported and also gives null.
 * @param {Object} host
 * @param {string} daeUrl
 * @param {(msg: string, type?: string) => void} [log]
 * @returns {Promise<THREE.Object3D|null>}
 */
export async function loadCachedScene(host, daeUrl, log = (m) => console.warn(m)) {
  const manifest = await loadSceneCacheManifest(host);
  if (!manifest || !manifest.files[daeUrl]) return null;
  try {
    return await loadSceneCache(host, sceneCachePathFor(daeUrl));
  } catch (err) {
    log(`[!] Scene cache for ${daeUrl} could not be used (${err.message}); loading the .dae instead. Run npm run generate:scene-cache.`, 'warn');
    return null;
  }
}


/**
 * Distinct items of a 4-byte typed array (compared bit for bit) and the index of each item, or null
 * when that would not be smaller than the array itself.
 */
function packItems(arr, k) {
  if (arr.BYTES_PER_ELEMENT !== 4 || !(k >= 1) || arr.length === 0 || arr.length % k !== 0) return null;
  const words = new Uint32Array(arr.buffer, arr.byteOffset, arr.length);
  const count = arr.length / k;
  const seen = new Map();
  const index = new Uint32Array(count);
  const values = [];
  for (let v = 0; v < count; v++) {
    const base = v * k;
    let key = words[base];
    for (let j = 1; j < k; j++) key += ',' + words[base + j];
    let id = seen.get(key);
    if (id === undefined) {
      id = seen.size;
      seen.set(key, id);
      for (let j = 0; j < k; j++) values.push(words[base + j]);
    }
    index[v] = id;
  }
  const IndexCtor = seen.size <= 256 ? Uint8Array : seen.size <= 65536 ? Uint16Array : Uint32Array;
  const packedBytes = values.length * 4 + align4(count * IndexCtor.BYTES_PER_ELEMENT) + 4;
  if (packedBytes >= arr.byteLength) return null;
  return { values: Uint32Array.from(values), index: IndexCtor === Uint32Array ? index : IndexCtor.from(index) };
}

// userData without functions; typed arrays and nested objects kept only if JSON-safe
function plainData(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === 'function' || v === undefined) continue;
    if (ArrayBuffer.isView(v)) continue; // typed arrays other than rawUvs are not produced by loadColladaModel
    out[k] = JSON.parse(JSON.stringify(v));
  }
  return out;
}
function decodeData(obj) { return obj ? JSON.parse(JSON.stringify(obj)) : {}; }
