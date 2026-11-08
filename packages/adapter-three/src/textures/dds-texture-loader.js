import * as THREE from 'three';

/**
 * @typedef {Object} DdsTextureHost
 * @property {Map<string, *>} textureCache Shared per-URL cache (holds the in-flight promise, then the texture or null).
 * @property {{ load: Function }} ddsLoader A THREE DDSLoader (or compatible stub).
 */

/**
 * Loads a DDS texture once per URL with repeat wrapping; invalid or failed loads resolve to null.
 * `alphatexture` maps are flipped vertically to match X4 UV conventions.
 * @param {DdsTextureHost} host
 * @param {string} url
 * @returns {Promise<THREE.Texture|null>}
 */
export async function loadDdsTexture(host, url) {
  if (!url) return null;
  if (host.textureCache.has(url)) {
    const cached = host.textureCache.get(url);
    // Callers may change the texture and re-upload it, which needs its data: decode it again if freed
    if (cached && cached.isTexture && releasedTextures.has(cached)) return restoreTextureData(host, url, cached);
    return cached;
  }
  const loadPromise = new Promise((resolve) => {
    host.ddsLoader.load(
      url,
      (texture) => {
        if (!texture || !texture.format || !texture.image || texture.image.width <= 0 || !texture.mipmaps || texture.mipmaps.length === 0) {
          host.textureCache.set(url, null);
          resolve(null);
          return;
        }
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (url.toLowerCase().includes('alphatexture')) {
          texture.repeat.set(1, -1);
          texture.offset.set(0, 1);
        }
        texture.needsUpdate = true;
        host.textureCache.set(url, texture);
        resolve(texture);
      },
      undefined,
      () => {
        host.textureCache.set(url, null);
        resolve(null);
      }
    );
  });
  host.textureCache.set(url, loadPromise);
  return loadPromise;
}

/**
 * Decodes a texture's data again into the same texture object after releaseTextureData freed it. The
 * GPU copy was never dropped, so nothing is uploaded until a caller changes the texture.
 * @param {DdsTextureHost} host
 * @param {string} url
 * @param {THREE.Texture} texture
 * @returns {Promise<THREE.Texture>}
 */
// Textures whose data releaseTextureData freed, and restores in progress (kept out of userData, which
// Texture.clone copies)
const releasedTextures = new WeakSet();
const restoringTextures = new WeakMap();

/** Whether releaseTextureData freed this texture's data (and it has not been decoded again). */
export function isTextureDataReleased(texture) {
  return releasedTextures.has(texture);
}

function restoreTextureData(host, url, texture) {
  if (restoringTextures.has(texture)) return restoringTextures.get(texture);
  const restoring = new Promise((resolve) => {
    const done = () => { restoringTextures.delete(texture); resolve(texture); };
    host.ddsLoader.load(
      url,
      (fresh) => {
        if (fresh && fresh.mipmaps && fresh.mipmaps.length > 0) {
          texture.mipmaps = fresh.mipmaps;
          texture.image = fresh.image;
          releasedTextures.delete(texture);
        }
        done();
      },
      undefined,
      done
    );
  });
  restoringTextures.set(texture, restoring);
  return restoring;
}

/**
 * Frees the JavaScript copy of the data of cached textures that are already on the GPU. The DDS loader
 * keeps every mip level, decoded to uncompressed RGBA for BC4/BC5 maps, after upload: about 640 MB with
 * all 247 module types loaded. loadDdsTexture decodes a freed texture again before handing it out, so
 * callers that change it (and so upload it again) still have its data. Clones keep their own data: the
 * mipmap list is replaced, not emptied in place.
 * @param {DdsTextureHost} host
 * @param {(texture: THREE.Texture) => boolean} isOnGpu Whether the current version is uploaded
 * @returns {number} How many textures were freed
 */
export function releaseTextureData(host, isOnGpu) {
  let released = 0;
  for (const texture of host.textureCache.values()) {
    if (!texture || !texture.isTexture || !texture.mipmaps || texture.mipmaps.length === 0) continue;
    if (releasedTextures.has(texture) || restoringTextures.has(texture) || !isOnGpu(texture)) continue;
    texture.mipmaps = texture.mipmaps.map(m => ({ width: m.width, height: m.height, data: null }));
    releasedTextures.add(texture);
    released++;
  }
  return released;
}
