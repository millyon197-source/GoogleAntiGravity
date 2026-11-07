import { murmur3_32 } from './module-bounds-hashtable.js';
// Macros built on a differently named game component (generated: npm run generate:macro-refs)
import MACRO_COMPONENT_REFS from './macro-component-refs.json' with { type: 'json' };

/**
 * Index over the generated DAE hash table (dae_hash_table.json): maps a module base name
 * to the folder and component .dae files that make up its 3D model.
 *
 * The table is injected rather than imported so the generated JSON can live wherever the
 * asset tooling writes it (currently the repository root).
 *
 * @param {Record<string, Array<{key: string, folder_path: string, files: string[]}>>} table
 *   Bucketed table keyed by bucket index (murmur3_32(key) % bucketCount).
 * @param {{ bucketCount?: number, componentRefs?: Record<string, string> }} [options]
 *   componentRefs: module base name -> the game component it is built on, when the names differ
 *   (defaults to macro-component-refs.json, read from the game's macro files)
 */
export function createDaeAssetIndex(table, { bucketCount = 1223, componentRefs = MACRO_COMPONENT_REFS } = {}) {
  /**
   * @param {string} key Module base name (macro without `_macro`, lower case).
   * @returns {string[]} Component URLs (`folder/file.dae`), or [] when unknown.
   */
  function lookupDaeUrls(key) {
    const hashVal = murmur3_32(key);
    const bucketIndex = hashVal % bucketCount;
    const bucket = table[bucketIndex] || [];
    const entry = bucket.find(item => item.key === key);
    if (!entry) return [];
    return entry.files.map(file => `${entry.folder_path}/${file}`);
  }

  /**
   * Resolves the DAE asset entry (hash-table key, folder path and default component files)
   * for a module macro, including faction -> gen/arg fallbacks.
   * @param {string} macro
   * @returns {{ baseName: string, folderPath: string|null, defaultFiles: string[] }}
   */
  function resolveModuleAssetEntry(macro) {
    let baseName = String(macro || '').replace('_macro', '').toLowerCase();

    // Replace buildmodule_gen_equip_* and buildmodule_gen_ships_* with _arg_ key lookups
    if (baseName.startsWith('buildmodule_gen_equip_') || baseName.startsWith('buildmodule_gen_ships_')) {
      baseName = baseName.replace('buildmodule_gen_', 'buildmodule_arg_');
    }

    let urls = lookupDaeUrls(baseName);

    // The game's own mapping: some modules are built on another module's component
    // (e.g. dockarea_tel_m_station_01 on dockarea_arg_m_station_01)
    const ref = componentRefs[baseName];
    if (urls.length === 0 && ref) {
      const refUrls = lookupDaeUrls(ref);
      if (refUrls.length > 0) {
        baseName = ref;
        urls = refUrls;
      }
    }

    if (urls.length === 0) {
      const prefixes = ['prod_', 'buildmodule_', 'landmarks_'];
      let foundGen = false;
      for (const pref of prefixes) {
        if (foundGen) break;
        if (baseName.startsWith(pref)) {
          const factions = ['arg', 'par', 'tel', 'spl', 'ter', 'bor', 'xen', 'kha', 'pir'];
          for (const fac of factions) {
            const prefix = `${pref}${fac}_`;
            if (baseName.startsWith(prefix)) {
              const candidateNames = [
                baseName.replace(prefix, `${pref}gen_`),
                baseName.replace(prefix, `${pref}arg_`)
              ];
              for (const candName of candidateNames) {
                const candUrls = lookupDaeUrls(candName);
                if (candUrls.length > 0) {
                  baseName = candName;
                  urls = candUrls;
                  foundGen = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (urls.length === 0) {
      return { baseName, folderPath: null, defaultFiles: [] };
    }
    const folderPath = urls[0].substring(0, urls[0].lastIndexOf('/'));
    const defaultFiles = urls.map(u => u.substring(u.lastIndexOf('/') + 1));
    return { baseName, folderPath, defaultFiles };
  }

  return { lookupDaeUrls, resolveModuleAssetEntry };
}
