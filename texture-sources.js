/**
 * Where the dev server looks for a texture requested as /assets1/textures/…, /assets/textures/… or
 * /textures/…, in order: the converted assets in assets1/, then the second extraction in assets/
 * (both its textures/ folder and the game-layout assets/assets/textures/), then the Steam install.
 * Each place is tried as the .dds itself and as the game's gzip-compressed .gz.
 *
 * Shared by vite.config.js (serving) and scripts/audit_detail_textures.mjs (auditing) so both agree.
 */
import path from 'path';

export const STEAM_TEXTURES_DIR = 'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\assets\\textures';

/** The path under textures/ a texture URL names, e.g. "generic/generic_p1_hulltexture_diff.dds". */
export function textureRelativePath(url) {
  return String(url || '').split('?')[0].replace(/^\/(?:assets1?\/(?:assets\/)?)?textures\//i, '');
}

/**
 * Candidate files for a texture URL, in lookup order.
 * @param {string} url
 * @param {string} root project root
 * @param {{ includeSteam?: boolean }} [options]
 * @returns {Array<{ source: 'assets1'|'assets'|'steam', path: string, gzip: boolean }>}
 */
export function textureCandidatePaths(url, root, { includeSteam = true } = {}) {
  const rel = textureRelativePath(url);
  if (!rel || rel.includes('..')) return [];
  const gzRel = rel.replace(/\.dds$/i, '.gz');
  const dirs = [
    { source: 'assets1', dir: path.resolve(root, 'assets1', 'textures') },
    { source: 'assets', dir: path.resolve(root, 'assets', 'textures') },
    { source: 'assets', dir: path.resolve(root, 'assets', 'assets', 'textures') }
  ];
  const out = [];
  for (const { source, dir } of dirs) {
    out.push({ source, path: path.resolve(dir, rel), gzip: false });
    if (gzRel !== rel) out.push({ source, path: path.resolve(dir, gzRel), gzip: true });
  }
  if (includeSteam && gzRel !== rel) out.push({ source: 'steam', path: path.resolve(STEAM_TEXTURES_DIR, gzRel), gzip: true });
  return out;
}
