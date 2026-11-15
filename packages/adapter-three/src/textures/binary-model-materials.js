/**
 * Texture lookups for what the rule-based resolver (texture-resolver.js) leaves untextured,
 * generated into src/texture-lookups.json by scripts/generate_texture_lookups.mjs:
 *
 * - binaryMaterials: the binary fast path (.bin + .json) keeps a model's geometry but not its
 *   material names, so the resolver only has the file name to go on and parts such as
 *   detail_m_pipes render plain grey. Their DAE names the materials; this records, per binary
 *   model, the material its merged mesh is drawn with.
 * - materialTextures: materials no resolver rule covers (e.g. generic_p1_radiator_01,
 *   natural_trees_01) mapped to texture files named after them, found under assets1/textures or
 *   the assets/ extraction.
 */
import { resolveTextureForModel } from './texture-resolver.js';

// Materials that never stand for the whole part: alpha cut-outs, effects, glows, decals
const SECONDARY = /alpha|lightcone|_fx|fx_|effects|glow|decal|multimat|haze|poslight/i;

/** Material name without its collection prefix: "generic.generic_p1_x" / "genericXgeneric_p1_x" -> "generic_p1_x". */
export function materialBaseName(name) {
  const s = String(name || '').trim();
  const dot = s.lastIndexOf('.');
  if (dot >= 0) return s.slice(dot + 1).toLowerCase();
  const x = s.indexOf('X');
  // "collectionXname": the collection is lower case and has no underscore
  if (x > 0 && /^[a-z0-9]+$/.test(s.slice(0, x))) return s.slice(x + 1).toLowerCase();
  return s.toLowerCase();
}

/**
 * Rule-based texture URLs for a model and material, else the textures found by the material's
 * name (lookups.materialTextures).
 * @param {string} modelUrl
 * @param {string} materialName
 * @param {{ materialTextures?: Record<string, object> }|null} lookups
 */
export function resolveTexturesWithLookups(modelUrl, materialName, lookups) {
  const byRule = resolveTextureForModel(modelUrl, materialName || '');
  if (byRule && byRule.diffuse) return byRule;
  const found = materialName && lookups?.materialTextures ? lookups.materialTextures[materialBaseName(materialName)] : null;
  return found ? { diffuse: null, normal: null, roughness: null, metalness: null, emissive: null, ...found } : byRule;
}

/**
 * The material a merged binary mesh should be textured as: of the DAE's materials, the first hull
 * material, else the first other non-secondary one, else any, that resolves to a diffuse texture.
 * @param {string} modelUrl the model's URL (.bin or .dae)
 * @param {string[]} materialNames DAE material names, in file order
 * @param {(url: string, mat: string) => {diffuse: string|null}} [resolve]
 * @returns {string|null}
 */
export function choosePrimaryMaterial(modelUrl, materialNames, resolve = resolveTextureForModel) {
  const names = (materialNames || []).filter(Boolean);
  const ordered = [
    ...names.filter(n => /hull/i.test(n) && !SECONDARY.test(n)),
    ...names.filter(n => !/hull/i.test(n) && !SECONDARY.test(n)),
    ...names.filter(n => SECONDARY.test(n))
  ];
  for (const name of ordered) {
    const urls = resolve(modelUrl, name);
    if (urls && urls.diffuse) return name;
  }
  return null;
}

/** Key the binary table uses for a model URL: lower case, .bin, without the query string. */
export function binaryModelKey(url) {
  return String(url || '').split('?')[0].toLowerCase().replace(/\.(dae|json)$/, '.bin');
}

/**
 * Texture URLs for a binary model: from its file name as before, or, when that gives no diffuse
 * texture, from the material recorded for it (lookups.binaryMaterials).
 * @param {string} binUrl
 * @param {{ binaryMaterials?: Record<string, string>, materialTextures?: Record<string, object> }|null} lookups
 */
export function resolveBinaryModelTextures(binUrl, lookups) {
  const fromUrl = resolveTextureForModel(binUrl);
  if (fromUrl && fromUrl.diffuse) return fromUrl;
  const mat = lookups?.binaryMaterials ? lookups.binaryMaterials[binaryModelKey(binUrl)] : null;
  return mat ? resolveTexturesWithLookups(binUrl, mat, lookups) : fromUrl;
}
