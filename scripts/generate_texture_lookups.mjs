/**
 * Builds src/texture-lookups.json (see packages/adapter-three/src/textures/binary-model-materials.js):
 *
 * - materialTextures: for every material of the modules' components that the rule-based resolver
 *   gives no diffuse texture, the texture files named after it (<name>_diff, _normal,
 *   _smooth/_spec, _metal, _glow), searched in assets1/textures and then in the assets/ extraction
 *   (assets/textures, assets/assets/textures), as .dds or .gz.
 * - binaryMaterials: for every binary model (…-lod0.bin) whose file name resolves to no texture,
 *   the material its merged mesh is drawn with, read from its DAE in assets1/ or, failing that,
 *   assets/.
 *
 * Usage: node scripts/generate_texture_lookups.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveTextureForModel } from '../packages/adapter-three/src/textures/texture-resolver.js';
import {
  choosePrimaryMaterial, binaryModelKey, materialBaseName, resolveTexturesWithLookups
} from '../packages/adapter-three/src/textures/binary-model-materials.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'texture-lookups.json');
const TEXTURE_DIRS = [
  path.join(ROOT, 'assets1', 'textures'),
  path.join(ROOT, 'assets', 'textures'),
  path.join(ROOT, 'assets', 'assets', 'textures')
];
const MODEL_ROOTS = [path.join(ROOT, 'assets1'), path.join(ROOT, 'assets', 'assets'), path.join(ROOT, 'assets')];

function* walk(dir, test) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, test);
    else if (test(entry.name)) yield full;
  }
}

/** Texture base name (lower case, no extension, no "-small") -> URL served by the dev server. */
export function buildTextureIndex(dirs = TEXTURE_DIRS) {
  const index = new Map();
  for (const dir of dirs) {
    for (const file of walk(dir, n => /\.(dds|gz)$/i.test(n) && !/-small\.gz$/i.test(n))) {
      const rel = path.relative(dir, file).split(path.sep).join('/').replace(/\.gz$/i, '.dds');
      const key = path.basename(rel, '.dds').toLowerCase();
      // assets1 first: an earlier directory wins
      if (!index.has(key)) index.set(key, `/assets1/textures/${rel}`);
    }
  }
  return index;
}

/** Texture URLs named after a material, or null when it has no diffuse texture of its own. */
export function texturesByMaterialName(materialName, index) {
  const base = materialBaseName(materialName);
  const pick = (...names) => { for (const n of names) if (index.has(n)) return index.get(n); return null; };
  const diffuse = pick(`${base}_diff`, base);
  if (!diffuse) return null;
  return {
    diffuse,
    normal: pick(`${base}_normal`, `${base}_norm`),
    roughness: pick(`${base}_smooth`, `${base}_spec`),
    metalness: pick(`${base}_metal`),
    emissive: pick(`${base}_glow`)
  };
}

/** A model's DAE: assets1/ first, then the assets/ extraction. */
export function findDae(modelUrl) {
  const rel = String(modelUrl).replace(/^\/assets1?\//i, '').replace(/\.(bin|json)$/i, '.dae');
  for (const base of MODEL_ROOTS) {
    const p = path.join(base, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const materialCache = new Map();
export function daeMaterialNames(daePath) {
  if (materialCache.has(daePath)) return materialCache.get(daePath);
  const xml = fs.readFileSync(daePath, 'utf8');
  const names = [];
  for (const m of xml.matchAll(/<material\s[^>]*?name="([^"]+)"/g)) if (!names.includes(m[1])) names.push(m[1]);
  materialCache.set(daePath, names);
  return names;
}

function main() {
  const index = buildTextureIndex();
  const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'dae_hash_table.json'), 'utf8'));
  const entries = (Array.isArray(table) ? table : Object.values(table)).flat();

  // Every model the viewer loads: the hash table's component files and every binary model
  const models = new Set();
  for (const e of entries) {
    if (!e || !e.folder_path || !Array.isArray(e.files)) continue;
    for (const f of e.files) models.add(`${e.folder_path}/${f}`);
  }
  const bins = [...walk(path.join(ROOT, 'assets1', 'structures'), n => /-lod0\.bin$/i.test(n))]
    .map(p => '/' + path.relative(ROOT, p).split(path.sep).join('/'));
  for (const b of bins) models.add(b.replace(/\.bin$/i, '.dae'));

  // 1. Materials no rule textures, by name
  const materialTextures = {};
  const unmatched = new Set();
  for (const url of models) {
    const dae = findDae(url);
    if (!dae) continue;
    for (const mat of daeMaterialNames(dae)) {
      if (resolveTextureForModel(url, mat).diffuse) continue;
      const base = materialBaseName(mat);
      if (base in materialTextures) continue;
      const found = texturesByMaterialName(mat, index);
      if (found) materialTextures[base] = found;
      else unmatched.add(base);
    }
  }
  const lookups = { materialTextures };

  // 2. Binary models whose file name gives no texture: their primary DAE material
  const binaryMaterials = {};
  let needed = 0, fromAssets = 0;
  for (const url of bins) {
    if (resolveTextureForModel(url).diffuse) continue;
    needed++;
    const dae = findDae(url);
    if (!dae) continue;
    if (!dae.startsWith(path.join(ROOT, 'assets1'))) fromAssets++;
    const mat = choosePrimaryMaterial(url, daeMaterialNames(dae), (u, m) => resolveTexturesWithLookups(u, m, lookups));
    if (mat) binaryMaterials[binaryModelKey(url)] = mat;
  }

  const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT, JSON.stringify({ materialTextures: sortObj(materialTextures), binaryMaterials: sortObj(binaryMaterials) }, null, 1) + '\n');
  console.log(`Textures indexed: ${index.size}`);
  console.log(`Materials textured by name: ${Object.keys(materialTextures).length} (${[...Object.keys(materialTextures)].join(', ')})`);
  console.log(`Materials with no rule and no texture of that name: ${unmatched.size} (${[...unmatched].slice(0, 30).join(', ')})`);
  console.log(`Binary models: ${bins.length}; ${needed} untextured by file name; ${Object.keys(binaryMaterials).length} now textured from their DAE material (${fromAssets} DAEs from assets/)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
