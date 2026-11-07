#!/usr/bin/env node
/**
 * Copies missing DLC component files into assets1/.
 *
 * assets1/ holds extracted game geometry as <name>_data folders. The matching component file
 * <name>.xml (snap connections, part_main offsets, ...) sits next to each folder, but extractions of
 * DLC content often contain only the _data folders. This tool finds every _data folder whose
 * component file is missing and copies it from the unpacked DLCs in the X4 profile
 * (<profile>/extensions/<dlc>/assets/<same path>.xml).
 *
 * It never overwrites a file. If two DLCs hold different versions of the same file, that file is
 * skipped and reported.
 *
 * Usage:
 *   npm run sync:dlc-components -- [--dry-run] [--check] [--extensions <dir>]... [--assets <dir>]
 *
 *   --dry-run         report what would be copied, change nothing
 *   --check           also compare existing component files with their DLC versions
 *   --extensions DIR  an X4 profile "extensions" folder (repeatable); default: X4_EXTENSIONS_DIR,
 *                     else every Documents/Egosoft/X4/<id>/extensions (plain or OneDrive)
 *   --assets DIR      the extracted assets folder (default: assets1)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every "<name>_data" directory under `root`, as paths relative to `root` (forward slashes). */
export function findDataFolders(root) {
  const found = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name.endsWith('_data')) found.push(childRel);
      else walk(childRel);
    }
  };
  if (fs.existsSync(root)) walk('');
  return found.sort();
}

/** X4 profile extensions folders to search when none are given. */
export function defaultExtensionsDirs(env = process.env, home = os.homedir()) {
  if (env.X4_EXTENSIONS_DIR) return env.X4_EXTENSIONS_DIR.split(path.delimiter).filter(Boolean);
  const dirs = [];
  for (const docs of [path.join(home, 'Documents'), path.join(home, 'OneDrive', 'Documents')]) {
    const x4 = path.join(docs, 'Egosoft', 'X4');
    if (!fs.existsSync(x4)) continue;
    for (const profile of fs.readdirSync(x4, { withFileTypes: true })) {
      const ext = path.join(x4, profile.name, 'extensions');
      if (profile.isDirectory() && fs.existsSync(ext)) dirs.push(ext);
    }
  }
  return dirs;
}

/** The "<extensions>/<dlc>/assets" roots of every DLC/extension found in `extensionsDirs`. */
export function dlcAssetRoots(extensionsDirs) {
  const roots = [];
  for (const dir of extensionsDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const dlc of fs.readdirSync(dir, { withFileTypes: true })) {
      const assets = path.join(dir, dlc.name, 'assets');
      if (dlc.isDirectory() && fs.existsSync(assets)) roots.push({ name: dlc.name, assets });
    }
  }
  return roots;
}

/**
 * Finds (and unless dryRun, copies) missing component files.
 * @returns {{ copied: Array<{file: string, from: string}>, present: string[], notFound: string[],
 *             conflicts: Array<{file: string, sources: string[]}>, differs: Array<{file: string, from: string}> }}
 */
export function syncComponents({ assetsRoot, extensionsDirs, dryRun = false, check = false }) {
  const roots = dlcAssetRoots(extensionsDirs);
  const report = { copied: [], present: [], notFound: [], conflicts: [], differs: [] };
  for (const dataRel of findDataFolders(assetsRoot)) {
    const file = dataRel.replace(/_data$/, '') + '.xml';
    const target = path.join(assetsRoot, file);
    const sources = roots
      .map(r => ({ name: r.name, path: path.join(r.assets, file) }))
      .filter(s => fs.existsSync(s.path));

    if (fs.existsSync(target)) {
      report.present.push(file);
      if (check) {
        const current = fs.readFileSync(target);
        for (const s of sources) if (!current.equals(fs.readFileSync(s.path))) report.differs.push({ file, from: s.name });
      }
      continue;
    }
    if (sources.length === 0) { report.notFound.push(file); continue; }
    const first = fs.readFileSync(sources[0].path);
    if (sources.some(s => !first.equals(fs.readFileSync(s.path)))) {
      report.conflicts.push({ file, sources: sources.map(s => s.name) });
      continue;
    }
    if (!dryRun) fs.copyFileSync(sources[0].path, target, fs.constants.COPYFILE_EXCL);
    report.copied.push({ file, from: sources[0].name });
  }
  return report;
}

function parseArgs(argv) {
  const opts = { dryRun: false, check: false, extensionsDirs: [], assetsRoot: 'assets1' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--extensions') opts.extensionsDirs.push(argv[++i]);
    else if (a === '--assets') opts.assetsRoot = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: npm run sync:dlc-components -- [--dry-run] [--check] [--extensions <dir>]... [--assets <dir>]');
    return 0;
  }
  const extensionsDirs = opts.extensionsDirs.length ? opts.extensionsDirs : defaultExtensionsDirs();
  if (!fs.existsSync(opts.assetsRoot)) { console.error(`Assets folder not found: ${opts.assetsRoot}`); return 1; }
  if (extensionsDirs.length === 0) {
    console.error('No X4 extensions folder found. Pass --extensions <dir> or set X4_EXTENSIONS_DIR.');
    return 1;
  }
  console.log(`Assets: ${opts.assetsRoot}`);
  for (const r of dlcAssetRoots(extensionsDirs)) console.log(`Source: ${r.assets}`);

  const report = syncComponents({ ...opts, extensionsDirs });
  const verb = opts.dryRun ? 'Would copy' : 'Copied';
  for (const c of report.copied) console.log(`  ${verb}: ${c.file}  (from ${c.from})`);
  for (const c of report.conflicts) console.log(`  Skipped, DLC versions differ: ${c.file}  (${c.sources.join(', ')})`);
  for (const f of report.notFound) console.log(`  Not found in any DLC: ${f}`);
  for (const d of report.differs) console.log(`  Differs from ${d.from}: ${d.file}`);
  console.log(`\n${verb} ${report.copied.length}, already present ${report.present.length}, ` +
    `not found ${report.notFound.length}, conflicts ${report.conflicts.length}` +
    (opts.check ? `, existing files differing from a DLC ${report.differs.length}` : ''));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
