/**
 * Builds the per-part placement offsets (src/component-offsets.json) from the game's component XML.
 *
 * In X4 every part of a component hangs off a <connection> whose <offset> places it in the component
 * (optionally relative to another part, via the connection's parent="..." attribute). The converted
 * .dae meshes hold each part in its own local space, so the viewer must apply that offset or the part
 * is drawn at the module origin (e.g. detail_s_main of dockarea_bor_m_station_01_standard).
 *
 * Conversions applied so the values match what module-mesh-loader.js expects:
 *   - The converted meshes are mirrored on X relative to the game XML, so positions become (-x, y, z)
 *     and quaternions (qx, -qy, -qz, qw).
 *   - The loader shifts the whole module mesh group by the part_main offset (part-main-offsets.json),
 *     so each part's offset is stored relative to that shift.
 *   - Parented connections are composed down to component space first.
 *
 * Components already in component-offsets.json are hand-maintained (some rely on loader-side
 * parenting, e.g. prod_gen_advancedelectronics) and are never changed; the report compares them with
 * the generated values. Only components missing from the table are added.
 *
 *   node tools/generate-component-offsets.js            report only
 *   node tools/generate-component-offsets.js --write    add the missing components to the table
 *   node tools/generate-component-offsets.js --verbose  also list every disagreeing existing part
 *   node tools/generate-component-offsets.js --check    verify each new part's mesh against the XML
 *                                                      <size><center> once placed (slower: reads the .dae files)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');
const VERBOSE = args.has('--verbose');
const CHECK = args.has('--check');

const OFFSETS_PATH = path.join(root, 'src/component-offsets.json');
const PART_MAIN_PATH = path.join(root, 'src/part-main-offsets.json');
const HASH_TABLE_PATH = path.join(root, 'dae_hash_table.json');

// Components whose parts the loader places itself rather than through the table
const LOADER_PLACED = new Set(['dockarea_arg_m_02_tradestation_01']);

const EPS = 1e-4;

// ---- quaternion / vector helpers ([x, y, z, w]) ----
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
function qRotate(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x
  ];
}
function qNormalize(q) {
  const l = Math.hypot(...q) || 1;
  return q.map(v => v / l);
}
const isIdentityQ = q => Math.abs(Math.abs(q[3]) - 1) < 1e-6;
const round = v => (Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(7)));

// ---- XML parsing ----
const attr = (s, name) => s.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** @returns {Map<string, {name: string, parent: string|null, pos: number[], quat: number[], parts: string[]}>} */
function parseConnections(xml) {
  const conns = new Map();
  const re = /<connection\b([^>]*?)(\/>|>([\s\S]*?)<\/connection>)/g;
  for (const m of xml.matchAll(re)) {
    const head = m[1];
    const body = m[3] || '';
    const name = attr(head, 'name');
    if (!name) continue;
    // Only the connection's own direct offset, before child elements like <parts>, <animations>
    const preParts = body.split(/<parts\b|<animations\b/)[0] || '';
    const off = preParts.match(/<offset>([\s\S]*?)<\/offset>/)?.[1] || '';
    const p = off.match(/<position\b[^>]*>/)?.[0];
    const q = off.match(/<quaternion\b[^>]*>/)?.[0];
    const pos = p ? ['x', 'y', 'z'].map(k => parseFloat(attr(p, k)) || 0) : [0, 0, 0];
    const quat = q ? qNormalize(['qx', 'qy', 'qz', 'qw'].map(k => parseFloat(attr(q, k)) || 0)) : [0, 0, 0, 1];
    // Only the connection's own parts, not parts listed inside nested elements such as <wreck>
    const parts = [...body.matchAll(/<part\b[^>]*\bname="([^"]+)"/g)].map(x => x[1].toLowerCase());
    const sizeCenter = body.match(/<size>[\s\S]*?<center\b[^>]*>/)?.[0].match(/<center\b[^>]*>/)?.[0];
    const sizeMax = body.match(/<size>[\s\S]*?<max\b[^>]*>/)?.[0].match(/<max\b[^>]*>/)?.[0];
    const size = sizeCenter && sizeMax
      ? { center: ['x', 'y', 'z'].map(k => parseFloat(attr(sizeCenter, k)) || 0), max: ['x', 'y', 'z'].map(k => parseFloat(attr(sizeMax, k)) || 0) }
      : null;
    conns.set(name, { name, parent: attr(head, 'parent') || null, pos, quat, parts, size });
  }
  return conns;
}

/** Composes a connection's transform down to component space through its parent chain. */
function worldTransform(conn, byPart, byName, seen = new Set()) {
  if (!conn.parent) return { pos: conn.pos, quat: conn.quat, unresolved: false };
  const parentConn = byPart.get(conn.parent.toLowerCase()) || byName.get(conn.parent);
  if (!parentConn || seen.has(parentConn)) return { pos: conn.pos, quat: conn.quat, unresolved: true };
  seen.add(conn);
  const pw = worldTransform(parentConn, byPart, byName, seen);
  return {
    pos: pw.pos.map((v, i) => v + qRotate(pw.quat, conn.pos)[i]),
    quat: qNormalize(qMul(pw.quat, conn.quat)),
    unresolved: pw.unresolved
  };
}

/** Part names that have a .dae mesh in the component's folder. */
function meshParts(folderAbs, files) {
  const names = new Set(files.map(f => f.replace(/-lod\d+\.dae$/i, '').toLowerCase()));
  try {
    for (const f of fs.readdirSync(folderAbs)) {
      if (/-lod\d+\.dae$/i.test(f)) names.add(f.replace(/-lod\d+\.dae$/i, '').toLowerCase());
    }
  } catch { /* folder missing: use the hash-table list */ }
  return names;
}

/** Vertex bounds centre of a part's lowest-index .dae, or null. */
function meshCenter(folderAbs, partName) {
  let file;
  try {
    file = fs.readdirSync(folderAbs)
      .filter(f => f.toLowerCase().startsWith(partName + '-lod') && f.toLowerCase().endsWith('.dae'))
      .sort()[0];
  } catch { return null; }
  if (!file) return null;
  const xml = fs.readFileSync(path.join(folderAbs, file), 'utf8');
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [, id, body] of xml.matchAll(/<float_array id="([^"]+)"[^>]*>([^<]*)<\/float_array>/g)) {
    if (!/position/i.test(id)) continue;
    const v = body.trim().split(/\s+/).map(Number);
    for (let i = 0; i + 2 < v.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (v[i + a] < min[a]) min[a] = v[i + a];
        if (v[i + a] > max[a]) max[a] = v[i + a];
      }
    }
  }
  return Number.isFinite(min[0]) ? [0, 1, 2].map(a => (min[a] + max[a]) / 2) : null;
}

function toEntry(pos, quat) {
  const e = pos.map(round);
  if (!isIdentityQ(quat)) e.push(...quat.map(round));
  return e;
}

function sameEntry(a, b) {
  const pa = Array.isArray(a) ? a : [...(a.position || []), ...(a.quaternion || [])];
  const qa = pa.length >= 7 ? pa.slice(3, 7) : [0, 0, 0, 1];
  const qb = b.length >= 7 ? b.slice(3, 7) : [0, 0, 0, 1];
  const posOk = [0, 1, 2].every(i => Math.abs((pa[i] || 0) - b[i]) < 0.01);
  const dot = Math.abs(qa.reduce((s, v, i) => s + v * qb[i], 0));
  return posOk && dot > 0.9999;
}

// ---- main ----
const offsets = JSON.parse(fs.readFileSync(OFFSETS_PATH, 'utf8'));
const partMainOffsets = JSON.parse(fs.readFileSync(PART_MAIN_PATH, 'utf8'));
const table = JSON.parse(fs.readFileSync(HASH_TABLE_PATH, 'utf8'));

const generated = {};
const report = { components: 0, noXml: [], unresolvedParents: [], rotatedPartMain: [], partMainMismatch: [], checkOk: 0, checkFail: [] };
const comparison = { agree: 0, disagree: [], missingInTable: 0 };

for (const bucket of Object.values(table)) {
  for (const entry of bucket) {
    const key = entry.key;
    if (LOADER_PLACED.has(key)) continue;
    let xmlPath = path.join(root, entry.folder_path.replace(/^\//, '').replace(/_data$/, '') + '.xml');
    if (!fs.existsSync(xmlPath)) {
      xmlPath = path.join(root, entry.folder_path.replace(/^\/assets1\//, 'assets/').replace(/_data$/, '') + '.xml');
    }
    if (!fs.existsSync(xmlPath)) { report.noXml.push(key); continue; }
    report.components++;

    const conns = parseConnections(fs.readFileSync(xmlPath, 'utf8'));
    const byPart = new Map();
    for (const c of conns.values()) for (const p of c.parts) if (!byPart.has(p)) byPart.set(p, c);

    // The loader shifts the whole mesh group by part-main-offsets.json (X mirrored)
    const pmConn = byPart.get('part_main');
    const pmTable = partMainOffsets[key];
    const groupShift = pmTable ? [-pmTable[0], pmTable[1], pmTable[2]] : [0, 0, 0];
    if (pmConn) {
      const pmWorld = worldTransform(pmConn, byPart, conns);
      if (!isIdentityQ(pmWorld.quat)) report.rotatedPartMain.push(key);
      const xmlShift = [-pmWorld.pos[0], pmWorld.pos[1], pmWorld.pos[2]];
      if (xmlShift.some((v, i) => Math.abs(v - groupShift[i]) > 0.01)) {
        report.partMainMismatch.push(`${key}: part-main-offsets ${JSON.stringify(pmTable || null)} vs XML ${JSON.stringify(pmWorld.pos.map(round))}`);
      }
    }

    const folderAbs = path.join(root, entry.folder_path);
    const parts = {};
    for (const partName of meshParts(folderAbs, entry.files)) {
      if (partName === 'part_main') continue; // placed by the group shift
      const conn = byPart.get(partName);
      if (!conn) continue;
      const w = worldTransform(conn, byPart, conns);
      if (w.unresolved) report.unresolvedParents.push(`${key}/${partName} (parent ${conn.parent})`);
      const pos = [-w.pos[0], w.pos[1], w.pos[2]].map((v, i) => v - groupShift[i]);
      const quat = [w.quat[0], -w.quat[1], -w.quat[2], w.quat[3]];
      if (pos.every(v => Math.abs(v) < EPS) && isIdentityQ(quat)) continue;
      parts[partName] = toEntry(pos, quat);

      // Placed mesh centre must land where the XML puts the part's bounding-box centre
      if (CHECK && !offsets[key] && conn.size) {
        const c = meshCenter(folderAbs, partName);
        if (c) {
          const placed = qRotate(quat, c).map((v, i) => v + pos[i] + groupShift[i]);
          const xmlWorld = qRotate(w.quat, conn.size.center).map((v, i) => v + w.pos[i]);
          const expected = [-xmlWorld[0], xmlWorld[1], xmlWorld[2]];
          const err = Math.hypot(...placed.map((v, i) => v - expected[i]));
          const tol = Math.max(1, Math.max(...conn.size.max) * 0.02);
          if (err <= tol) report.checkOk++;
          else report.checkFail.push(`${key}/${partName}: off by ${err.toFixed(1)} m (part size ${Math.max(...conn.size.max).toFixed(0)} m)`);
        }
      }
    }
    if (Object.keys(parts).length) generated[key] = parts;
  }
}

// Compare with the hand-maintained components
for (const [key, parts] of Object.entries(generated)) {
  if (!offsets[key]) continue;
  for (const [partName, gen] of Object.entries(parts)) {
    const existing = offsets[key][partName];
    if (!existing) { comparison.missingInTable++; continue; }
    if (sameEntry(existing, gen)) comparison.agree++;
    else comparison.disagree.push(`${key}/${partName}: table ${JSON.stringify(existing)} vs generated ${JSON.stringify(gen)}`);
  }
}

const newKeys = Object.keys(generated).filter(k => !offsets[k]).sort();
const newParts = newKeys.reduce((n, k) => n + Object.keys(generated[k]).length, 0);

console.log(`Components scanned: ${report.components} (no XML: ${report.noXml.length})`);
console.log(`Components with offset parts: ${Object.keys(generated).length}`);
console.log(`Existing table: ${comparison.agree} parts agree, ${comparison.disagree.length} differ, ${comparison.missingInTable} generated parts not in existing components (left unchanged)`);
if (VERBOSE) comparison.disagree.forEach(l => console.log(`  ~ ${l}`));
console.log(`New components: ${newKeys.length} (${newParts} parts)`);
if (CHECK) {
  console.log(`Mesh check: ${report.checkOk} parts land on their XML bounds, ${report.checkFail.length} do not`);
  report.checkFail.slice(0, VERBOSE ? Infinity : 25).forEach(l => console.log(`  x ${l}`));
}
if (report.unresolvedParents.length) {
  console.log(`Unresolved parents (${report.unresolvedParents.length}), placed by their own offset only:`);
  report.unresolvedParents.slice(0, 20).forEach(l => console.log(`  ? ${l}`));
}
if (report.rotatedPartMain.length) console.log(`part_main is rotated (group shift ignores rotation): ${report.rotatedPartMain.join(', ')}`);
if (report.partMainMismatch.length) {
  console.log(`part-main-offsets.json disagrees with XML (${report.partMainMismatch.length}); offsets are relative to the table value the loader uses:`);
  report.partMainMismatch.slice(0, 20).forEach(l => console.log(`  ! ${l}`));
}

if (WRITE) {
  const merged = { ...offsets };
  for (const k of newKeys) merged[k] = generated[k];
  fs.writeFileSync(OFFSETS_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Wrote ${newKeys.length} new components to ${path.relative(root, OFFSETS_PATH)}`);
} else {
  console.log('Report only; run with --write to add the new components.');
}
