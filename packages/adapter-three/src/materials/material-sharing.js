import * as THREE from 'three';

/**
 * Material sharing and shadow casting for placed modules.
 *
 * The texturing code makes a new material for every mesh of every placed part, so a 585-module plan
 * drew 20,000 meshes with 17,000 materials, nearly all of them duplicates. Every material change
 * between draw calls uploads its uniforms again. Sharing identical materials across the plan (17,000
 * -> about 2,100) made frames about 20% faster. A material is shared only when everything that affects
 * drawing is identical: type, settings, colours, the same texture objects, defines and the source of
 * its onBeforeCompile hook. Meshes with their own shader uniform (the cross arrow sign scanline) keep
 * their material.
 */

const VALUE_KEYS = [
  'type', 'name', 'opacity', 'transparent', 'alphaTest', 'depthWrite', 'depthTest', 'side', 'blending',
  'vertexColors', 'toneMapped', 'visible', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits',
  'roughness', 'metalness', 'emissiveIntensity', 'wireframe', 'flatShading', 'fog', 'premultipliedAlpha',
  'alphaToCoverage', 'colorWrite', 'blendSrc', 'blendDst', 'blendEquation', 'shininess', 'reflectivity',
  'stencilWrite', 'stencilRef', 'stencilFunc', 'stencilFuncMask', 'stencilFail', 'stencilZFail', 'stencilZPass', 'stencilWriteMask'
];
const COLOR_KEYS = ['color', 'emissive', 'specular'];
const TEXTURE_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap',
  'lightMap', 'envMap', 'displacementMap', 'specularMap'
];

const sharedMaterials = new WeakSet();

/** Whether a material is shared between meshes (possibly of different modules). */
export function isSharedMaterial(material) {
  return sharedMaterials.has(material);
}

const ownHook = (material, name) => {
  const own = Object.prototype.hasOwnProperty.call(material, name) ? material[name] : null;
  return typeof own === 'function' ? own.toString() : '';
};

/**
 * Key that is equal for materials that draw identically, or null when the material must stay with
 * its mesh.
 * @param {THREE.Material} material
 * @param {THREE.Object3D} mesh
 * @returns {string|null}
 */
export function materialShareKey(material, mesh) {
  if (!material || !material.isMaterial) return null;
  if (mesh && mesh.userData && mesh.userData.scanlineVOffset) return null; // per-mesh shader uniform
  if (material.userData && Object.keys(material.userData).length > 0) return null;
  const parts = VALUE_KEYS.map(k => material[k]);
  for (const k of COLOR_KEYS) parts.push(material[k] && material[k].isColor ? material[k].getHex() : null);
  for (const k of TEXTURE_KEYS) parts.push(material[k] ? material[k].uuid : null);
  parts.push(material.normalScale ? `${material.normalScale.x},${material.normalScale.y}` : null);
  parts.push(JSON.stringify(material.defines || {}));
  parts.push(ownHook(material, 'onBeforeCompile'), ownHook(material, 'customProgramCacheKey'));
  return JSON.stringify(parts);
}

/**
 * Replaces each material in `root` by the first identical one in `registry` (a Map kept for one plan
 * load), registering new ones. Meshes kept only in userData are left alone.
 * @param {THREE.Object3D} root
 * @param {Map<string, THREE.Material>} registry
 * @returns {number} How many materials were replaced by shared ones
 */
export function shareModuleMaterials(root, registry) {
  let replaced = 0;
  const share = (material, mesh) => {
    const key = materialShareKey(material, mesh);
    if (key === null) return material;
    const existing = registry.get(key);
    if (!existing) {
      registry.set(key, material);
      sharedMaterials.add(material);
      return material;
    }
    if (existing !== material) replaced++;
    return existing;
  };
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => share(m, o)) : share(o.material, o);
  });
  return replaced;
}

/**
 * Gives every mesh in `root` its own copies of shared materials (one copy per original, shared within
 * `root`), so a change to this module's materials leaves other modules alone.
 * @param {THREE.Object3D} root
 * @returns {number} How many copies were made
 */
export function ownModuleMaterials(root) {
  const copies = new Map();
  const own = (material) => {
    if (!sharedMaterials.has(material)) return material;
    if (!copies.has(material)) {
      const copy = material.clone();
      for (const name of ['onBeforeCompile', 'customProgramCacheKey']) {
        if (Object.prototype.hasOwnProperty.call(material, name)) copy[name] = material[name];
      }
      copies.set(material, copy);
    }
    return copies.get(material);
  };
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  return copies.size;
}

const tmpScale = new THREE.Vector3();

/**
 * Whether a placed mesh should cast a shadow. Effects (transparent, additive, not writing depth or not
 * drawn: glows, decals, light cones, haze) cast none, and neither do parts under 15 m across, whose
 * shadows do not show at station scale. 18,000 casters on a 585-module plan made the shadow pass a
 * third of each frame.
 * @param {THREE.Mesh} mesh
 */
export function castsShadow(mesh) {
  if (!mesh || !mesh.isMesh) return false;
  const materials = [].concat(mesh.material || []);
  if (materials.length === 0) return false;
  if (materials.every(m => !m || m.transparent || m.blending === THREE.AdditiveBlending || m.depthWrite === false || m.visible === false)) return false;
  const geometry = mesh.geometry;
  if (geometry) {
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere ? geometry.boundingSphere.radius : Infinity;
    mesh.getWorldScale(tmpScale);
    if (Number.isFinite(radius) && radius * Math.max(tmpScale.x, tmpScale.y, tmpScale.z) < 15) return false;
  }
  return true;
}
