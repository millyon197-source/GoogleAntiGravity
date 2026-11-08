import * as THREE from 'three';

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
 */

export const SCENE_CACHE_VERSION = 1;
export const SCENE_CACHE_EXTENSION = '.x4scene';
/** Lists every cached part (written by tools/generate-scene-cache.js). */
export const SCENE_CACHE_MANIFEST_PATH = '/assets1/scene-cache-manifest.json';
const MAGIC = 'X4SC';

const ARRAY_TYPES = {
  Float32Array, Float64Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array
};

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
  const addArray = (arr) => {
    if (!arr) return null;
    if (arrayIndex.has(arr)) return arrayIndex.get(arr);
    const type = arr.constructor.name;
    if (!ARRAY_TYPES[type]) throw new Error(`unsupported array type ${type}`);
    arrays.push(arr);
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
      attributes[name] = { array: addArray(attr.array), itemSize: attr.itemSize, normalized: attr.normalized, name: attr.name || '' };
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
    for (const [k, arr] of Object.entries(raw)) entry[k] = addArray(arr);
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
  const arrayEntries = arrays.map(arr => {
    offset = align4(offset);
    const entry = { type: arr.constructor.name, offset, length: arr.length };
    offset += arr.byteLength;
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
  arrays.forEach((arr, i) => bytes.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), blobStart + arrayEntries[i].offset));
  return out;
}

/**
 * Rebuilds a scene from serializeScene output. Typed arrays are copied out of the file buffer so each
 * geometry owns its data (as with ColladaLoader).
 * @param {ArrayBuffer} buffer
 * @returns {THREE.Group}
 */
export function deserializeScene(buffer) {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== MAGIC) throw new Error('not a scene cache file');
  const view = new DataView(buffer);
  const version = view.getUint32(4, true);
  if (version !== SCENE_CACHE_VERSION) throw new Error(`scene cache version ${version}, expected ${SCENE_CACHE_VERSION}`);
  const jsonLength = view.getUint32(8, true);
  const data = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + jsonLength)));
  const blobStart = align4(12 + jsonLength);

  const arrays = data.arrays.map(a => {
    const Ctor = ARRAY_TYPES[a.type];
    if (!Ctor) throw new Error(`unsupported array type ${a.type}`);
    return new Ctor(buffer.slice(blobStart + a.offset, blobStart + a.offset + a.length * Ctor.BYTES_PER_ELEMENT));
  });
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

/**
 * Loads a scene cache file (cached per URL in host.sceneCacheCache, like host.colladaCache).
 * @param {{ sceneCacheCache?: Map<string, Promise<THREE.Object3D>> }} host
 * @param {string} cacheUrl URL of the .x4scene file
 */
export function loadSceneCache(host, cacheUrl) {
  if (!host.sceneCacheCache) host.sceneCacheCache = new Map();
  if (host.sceneCacheCache.has(cacheUrl)) return host.sceneCacheCache.get(cacheUrl);
  const promise = readBytes(cacheUrl).then(deserializeScene);
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

function align4(n) { return (n + 3) & ~3; }

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
