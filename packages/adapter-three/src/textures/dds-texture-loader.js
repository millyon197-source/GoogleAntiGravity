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
    return host.textureCache.get(url);
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
