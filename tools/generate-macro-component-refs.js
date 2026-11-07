#!/usr/bin/env node
/**
 * Generates packages/catalog/src/macro-component-refs.json from the extracted game files.
 *
 * In X4 a module macro (<name>_macro.xml) names the component it is built on with
 * <component ref="..."/>. Usually that is the module's own name, but some modules reuse another
 * module's component and therefore its 3D model, e.g. dockarea_tel_m_station_01 is built on
 * dockarea_arg_m_station_01. The browser cannot read the macro files, so this tool records the
 * macros whose component has a different name; the catalog's asset index uses the map to find
 * their models.
 *
 * Usage: npm run generate:macro-refs [-- --assets <dir>] [--out <file>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} assetsRoot extracted assets folder (scans its structures/ subfolder)
 * @returns {{ refs: Record<string, string>, macroFiles: number }} base name -> component name
 *   (lower case, without "_macro"), only where the two differ; keys sorted
 */
export function collectMacroComponentRefs(assetsRoot) {
  const refs = {};
  let macroFiles = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.endsWith('_data')) walk(p); continue; }
      if (!/_macro\.xml$/i.test(e.name)) continue;
      macroFiles++;
      const base = e.name.slice(0, -'_macro.xml'.length).toLowerCase();
      const ref = (fs.readFileSync(p, 'utf8').match(/<component ref="([^"]+)"/) || [])[1]?.toLowerCase();
      if (ref && ref !== base) refs[base] = ref;
    }
  };
  const structures = path.join(assetsRoot, 'structures');
  if (fs.existsSync(structures)) walk(structures);
  const sorted = Object.fromEntries(Object.keys(refs).sort().map(k => [k, refs[k]]));
  return { refs: sorted, macroFiles };
}

function main(argv) {
  let assets = 'assets1';
  let out = 'packages/catalog/src/macro-component-refs.json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--assets') assets = argv[++i];
    else if (argv[i] === '--out') out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!fs.existsSync(path.join(assets, 'structures'))) {
    console.error(`No ${assets}/structures folder: extract the X4 game assets first.`);
    return 1;
  }
  const { refs, macroFiles } = collectMacroComponentRefs(assets);
  fs.writeFileSync(out, JSON.stringify(refs, null, 2) + '\n');
  console.log(`Read ${macroFiles} macro files; ${Object.keys(refs).length} use a differently named component. Wrote ${out}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exitCode = 1; }
}
