export const USER_CONSTRUCTION_PLANS_DIR = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan';

let fs = null;
let path = null;

if (typeof process !== 'undefined' && Boolean(process.versions?.node)) {
  try {
    const fsName = 'fs';
    const pathName = 'path';
    fs = await import(/* @vite-ignore */ fsName);
    path = await import(/* @vite-ignore */ pathName);
  } catch (_) {}
}

function getPathBasename(p) {
  if (path?.basename) return path.basename(p);
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

function getPathJoin(...parts) {
  if (path?.join) return path.join(...parts);
  return parts.join('/').replace(/\/+/g, '/');
}

function isPathAbsolute(p) {
  if (path?.isAbsolute) return path.isAbsolute(p);
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
}

function getPathResolve(...parts) {
  if (path?.resolve) return path.resolve(...parts);
  return parts.join('/').replace(/\/+/g, '/');
}

/**
 * Searches for a blueprint XML file, checking the user's Egosoft constructionplan folder FIRST.
 * @param {string} fileNameOrPath
 * @returns {string|null} The resolved absolute file path, or null if not found.
 */
export function resolveBlueprintXmlPath(fileNameOrPath) {
  if (!fileNameOrPath || typeof fileNameOrPath !== 'string') return null;
  if (!fs) return null;

  const baseName = getPathBasename(fileNameOrPath);
  const withExt = baseName.toLowerCase().endsWith('.xml') ? baseName : `${baseName}.xml`;

  // 1. Search C:\Users\Zeus\OneDrive\Documents\Egosoft\X4\47624366\constructionplan first
  const userPlanPath = getPathJoin(USER_CONSTRUCTION_PLANS_DIR, withExt);
  try {
    if (fs.existsSync(userPlanPath)) {
      return userPlanPath;
    }
  } catch (_) {}

  // Also check direct absolute path if provided
  if (isPathAbsolute(fileNameOrPath)) {
    try {
      if (fs.existsSync(fileNameOrPath)) return fileNameOrPath;
    } catch (_) {}
  }

  // 2. Search tests/fixtures/
  const fixturePath = getPathResolve('tests/fixtures', withExt);
  try {
    if (fs.existsSync(fixturePath)) return fixturePath;
  } catch (_) {}

  // 3. Search relative or project root
  const relPath = getPathResolve(fileNameOrPath);
  try {
    if (fs.existsSync(relPath)) return relPath;
  } catch (_) {}

  return null;
}

/**
 * Reads a blueprint XML file as a UTF-8 string, searching the user's constructionplan directory first.
 * @param {string} fileNameOrPath
 * @returns {string|null}
 */
export function readBlueprintXml(fileNameOrPath) {
  const resolved = resolveBlueprintXmlPath(fileNameOrPath);
  if (!resolved || !fs) return null;
  return fs.readFileSync(resolved, 'utf8');
}
