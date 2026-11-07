/**
 * Reads snap connections from the extracted X4 game files in assets1/ and compares them with
 * SNAP_POINTS_DB. Used by tools/diagnostics/audit_all_module_snap_points.js and
 * tests/test_snap_table_matches_game.js.
 */
import fs from 'node:fs';

/**
 * Snap connections in a game component file. A connection faces along its local +Z rotated by its
 * offset quaternion (identity when the quaternion is omitted). Tags are a space-separated list:
 * "snap" marks a module docking snap; "room_snap" marks where a room (e.g. room_gen_venturerroom_01)
 * attaches inside another structure, which has no docking collar.
 * @param {string} file path of the component XML
 * @returns {Map<string, { pos: number[], facing: number[], isRoomSnap: boolean }>|null}
 *   positions and facings in X4 component space; null if the file is missing
 */
export function readComponentSnaps(file) {
  if (!fs.existsSync(file)) return null;
  const xml = fs.readFileSync(file, 'utf8');
  const snaps = new Map();
  for (const [, name, attrs, body] of xml.matchAll(/<connection name="([^"]+)"([^>]*)>([\s\S]*?)<\/connection>/g)) {
    const tags = ((attrs.match(/tags="([^"]*)"/) || [])[1] || '').split(/\s+/);
    const isSnap = tags.includes('snap');
    const isRoomSnap = tags.includes('room_snap') && !isSnap;
    if (!isSnap && !isRoomSnap) continue;
    const p = body.match(/<position x="([-\d.Ee]+)" y="([-\d.Ee]+)" z="([-\d.Ee]+)"/);
    const q = body.match(/<quaternion qx="([-\d.Ee]+)" qy="([-\d.Ee]+)" qz="([-\d.Ee]+)" qw="([-\d.Ee]+)"/);
    const [x, y, z, w] = q ? q.slice(1).map(Number) : [0, 0, 0, 1];
    snaps.set(name, {
      pos: p ? p.slice(1).map(Number) : [0, 0, 0],
      facing: [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)],
      isRoomSnap
    });
  }
  return snaps;
}

/** Every macro file (<name>_macro.xml) and component file (<name>.xml) under `root`, by lowercase name. */
export function indexGameFiles(root = 'assets1') {
  const macros = new Map();
  const components = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!e.name.endsWith('_data')) walk(p); continue; }
      if (!e.name.toLowerCase().endsWith('.xml')) continue;
      const name = e.name.slice(0, -4).toLowerCase();
      if (name.endsWith('_macro')) macros.set(name, p);
      else if (!components.has(name)) components.set(name, p);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return { macros, components };
}

/**
 * Compares each module's snaps with its game component file: same snap names, and positions equal
 * to the game values rounded to 2 decimals (the table's convention). The component is found the way
 * X4 does it: the macro file's <component ref="..."/> (several modules are built on another module's
 * component, e.g. prod_tel_scanningarrays on prod_gen_scanningarrays). Without a macro file, a
 * component named after the module is used.
 * @param {string[]} macros module macro names (e.g. Object.keys(SNAP_POINTS_DB))
 * @param {(macro: string) => Array<{ name: string, pos: number[] }>} getSnaps the table lookup
 * @param {string} [root] extracted assets folder
 */
export function compareSnapTableWithGame(macros, getSnaps, root = 'assets1') {
  const files = indexGameFiles(root);
  const report = { own: 0, referenced: 0, noFile: [], mismatches: [] };
  for (const macro of macros) {
    const ownBase = macro.replace(/_macro$/, '');
    const macroFile = files.macros.get(macro.toLowerCase());
    const ref = macroFile ? (fs.readFileSync(macroFile, 'utf8').match(/<component ref="([^"]+)"/) || [])[1]?.toLowerCase() : null;
    const componentName = ref || ownBase;
    const componentFile = files.components.get(componentName);
    const game = componentFile ? readComponentSnaps(componentFile) : null;
    if (!game) { report.noFile.push(ownBase); continue; }
    const source = componentName === ownBase ? 'own' : `component ${componentName}`;
    report[source === 'own' ? 'own' : 'referenced']++;

    const table = getSnaps(macro);
    const problems = [];
    for (const s of table) {
      const g = game.get(s.name);
      if (!g) { problems.push(`${s.name} not in game file`); continue; }
      const off = Math.max(...s.pos.map((c, i) => Math.abs(c - g.pos[i])));
      if (off > 0.0051) problems.push(`${s.name} table ${JSON.stringify(s.pos)} vs game ${JSON.stringify(g.pos.map(n => Math.round(n * 100) / 100))}`);
    }
    for (const name of game.keys()) if (!table.some(s => s.name === name)) problems.push(`game snap ${name} missing from table`);
    if (problems.length) report.mismatches.push({ module: ownBase, source, problems });
  }
  return report;
}
