/**
 * Audits the textures the viewer resolves for every module's detail_m, detail_xs and detail_s meshes:
 * for each such component (dae_hash_table.json), reads its DAE material names, resolves them as the
 * viewer does (resolver rules, then src/texture-lookups.json) and checks every texture file exists where the dev server
 * looks for it (texture-sources.js): /assets1/textures (.dds or .gz), then /assets.
 *
 * Usage: node scripts/audit_detail_textures.mjs [--json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveTexturesWithLookups } from '../packages/adapter-three/src/textures/binary-model-materials.js';
import { textureCandidatePaths } from '../texture-sources.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'dae_hash_table.json'), 'utf8'));
const LOOKUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'texture-lookups.json'), 'utf8'));
const entries = (Array.isArray(table) ? table : Object.values(table)).flat();

const DETAIL_RE = /^detail_(m|xs|s)(_|-)/i;
const CHANNELS = ['diffuse', 'normal', 'roughness', 'metalness', 'emissive'];

/** Where a /…/textures/… URL is found locally: { found: 'assets1'|'assets'|null, path } */
export function locateTexture(url, root = ROOT) {
  for (const candidate of textureCandidatePaths(url, root, { includeSteam: false })) {
    if (fs.existsSync(candidate.path)) return { found: candidate.source, path: candidate.path };
  }
  return { found: null, path: null };
}

function materialNames(daePath) {
  const xml = fs.readFileSync(daePath, 'utf8');
  const names = new Set();
  for (const m of xml.matchAll(/<material\s[^>]*?(?:name|id)="([^"]+)"/g)) names.add(m[1]);
  return [...names];
}

function main() {
  const asJson = process.argv.includes('--json');
  const missing = new Map();      // texture url -> Set of "module/file material"
  const fromAssets = new Map();   // texture url -> path found only under /assets
  let components = 0, materials = 0, lookups = 0;
  const checked = new Map();

  for (const entry of entries) {
    if (!entry || !entry.folder_path || !Array.isArray(entry.files)) continue;
    for (const file of entry.files) {
      if (!DETAIL_RE.test(file)) continue;
      const url = `${entry.folder_path}/${file}`;
      const daePath = path.join(ROOT, url);
      if (!fs.existsSync(daePath)) continue;
      components++;
      for (const mat of materialNames(daePath)) {
        materials++;
        const urls = resolveTexturesWithLookups(url, mat, LOOKUPS) || {};
        for (const ch of CHANNELS) {
          const tex = urls[ch];
          if (!tex) continue;
          lookups++;
          if (!checked.has(tex)) checked.set(tex, locateTexture(tex));
          const where = checked.get(tex);
          const user = `${entry.key}/${file} [${mat}] ${ch}`;
          if (!where.found) {
            if (!missing.has(tex)) missing.set(tex, new Set());
            missing.get(tex).add(user);
          } else if (where.found === 'assets') {
            fromAssets.set(tex, where.path);
          }
        }
      }
    }
  }

  const report = {
    components, materials, lookups, distinctTextures: checked.size,
    missing: [...missing].map(([tex, users]) => ({ texture: tex, usedBy: users.size, examples: [...users].slice(0, 3) })),
    foundOnlyUnderAssets: [...fromAssets].map(([tex, p]) => ({ texture: tex, path: path.relative(ROOT, p) }))
  };
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`detail_m / detail_xs / detail_s components: ${components}, materials: ${materials}, texture lookups: ${lookups}, distinct textures: ${checked.size}`);
  console.log(`Found only under /assets: ${report.foundOnlyUnderAssets.length}`);
  for (const r of report.foundOnlyUnderAssets) console.log(`  ${r.texture} -> ${r.path}`);
  console.log(`Missing everywhere: ${report.missing.length}`);
  for (const r of report.missing) console.log(`  ${r.texture} (${r.usedBy} uses, e.g. ${r.examples[0]})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
