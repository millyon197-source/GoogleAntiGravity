import hashTableData from './module-bounds-hashtable.json' with { type: 'json' };

export const HASH_TABLE_SIZE = 503;
const H2_PRIME = 499;

/**
 * 32-bit MurmurHash3 implementation matching viewer.js
 */
export function murmur3_32(key, seed = 0) {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) & 0xffffffff;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * The 503-slot double hash table containing bounding boxes for all modules in All Modules Showcase
 */
export const MODULE_BOUNDS_TABLE = hashTableData;

/**
 * Double hashing lookup by macro key
 * @param {string} macroKey
 * @returns {object|null}
 */
export function lookupModuleBounds(macroKey) {
  if (!macroKey) return null;
  const keyName = typeof macroKey === 'object' ? (macroKey.macro || macroKey.key || macroKey.name) : macroKey;
  if (!keyName || typeof keyName !== 'string') return null;

  // Try exact key first, then with or without '_macro' suffix
  const candidates = [keyName];
  if (keyName.endsWith('_macro')) {
    candidates.push(keyName.replace(/_macro$/, ''));
  } else {
    candidates.push(`${keyName}_macro`);
  }

  for (const key of candidates) {
    const hashVal = murmur3_32(key);
    const h1 = hashVal % HASH_TABLE_SIZE;
    const h2 = H2_PRIME - (hashVal % H2_PRIME);

    for (let i = 0; i < HASH_TABLE_SIZE; i++) {
      const idx = (h1 + i * h2) % HASH_TABLE_SIZE;
      const entry = MODULE_BOUNDS_TABLE[idx];
      if (entry === null) {
        break; // Empty slot found; key does not exist in table
      }
      if (entry.key === key) {
        return {
          key: entry.key,
          get macro() {
            return this.key;
          },
          name: entry.name,
          index: entry.index,
          hash: entry.hash,
          boundingBox: {
            size: entry.boundingBox.size,
            get min() {
              const [w, h, d] = this.size;
              return [Number((-w / 2).toFixed(2)), Number((-h / 2).toFixed(2)), Number((-d / 2).toFixed(2))];
            },
            get max() {
              const [w, h, d] = this.size;
              return [Number((w / 2).toFixed(2)), Number((h / 2).toFixed(2)), Number((d / 2).toFixed(2))];
            }
          }
        };
      }
    }
  }

  return null;
}

/**
 * Returns initial bounding box size [sizeX, sizeY, sizeZ] for a macro from module-bounds-hashtable.
 * Uses the macro name as the key into the hashtable.
 * 
 * @param {string|object} macro - Macro name or object containing macro/key
 * @param {Array<number>} fallback - Default [width, height, depth] if not found in hashtable
 * @returns {Array<number>} [sizeX, sizeY, sizeZ]
 */
export function getInitialModuleSize(macro, fallback = [150, 100, 150]) {
  const entry = lookupModuleBounds(macro);
  if (entry && entry.boundingBox && Array.isArray(entry.boundingBox.size)) {
    return entry.boundingBox.size;
  }
  return fallback;
}

/**
 * Returns initial bounding box dimensions as { x, y, z } for any of the three dimensions being considered.
 * Uses the macro name as the key into the hashtable.
 * 
 * @param {string|object} macro - Macro name or object containing macro/key
 * @param {{ x: number, y: number, z: number }} fallback
 * @returns {{ x: number, y: number, z: number }}
 */
export function getInitialModuleDimensions(macro, fallback = { x: 150, y: 100, z: 150 }) {
  const [x, y, z] = getInitialModuleSize(macro, [fallback.x, fallback.y, fallback.z]);
  return { x, y, z };
}

/**
 * Returns full initial bounding box object { size, min, max } from hashtable using macro name as key.
 * 
 * @param {string|object} macro
 * @returns {object|null}
 */
export function getInitialModuleBounds(macro) {
  const entry = lookupModuleBounds(macro);
  return entry ? entry.boundingBox : null;
}

/**
 * Proxy registry allowing direct property access e.g. MODULE_BOUNDS_REGISTRY['struct_arg_base_01_macro']
 */
export const MODULE_BOUNDS_REGISTRY = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string') {
      return lookupModuleBounds(prop);
    }
    return undefined;
  },
  has(target, prop) {
    if (typeof prop === 'string') {
      return lookupModuleBounds(prop) !== null;
    }
    return false;
  }
});
