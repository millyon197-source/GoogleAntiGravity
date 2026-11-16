/**
 * Builds src/pier-lane-directions.json: for every pier component in assets1/structures/dock, the
 * horizontal direction (X4 component space, unit x/z) its docking lanes run, from where the pier
 * attaches to the station (its in-plane snap points) towards its docking bays.
 *
 * Piers whose bays sit all around their attachment (hubs such as pier_bor_harbor_04) have no single
 * lane direction and are written as null.
 *
 * Also builds src/pier-lane-boxes.json: every pier's lane volumes (its geometryinvisible
 * connections' <size> boxes), in the module's mesh space, so the viewer has a lane box for piers
 * whose lane model was never extracted.
 *
 * And src/pier-clamps.json: every pier's docking clamps (clampsFromXml), so the space ships use to
 * reach each clamp can be kept clear out to the plot wall.
 *
 * Usage: node generate_pier_lanes.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCK_DIR = path.join(__dirname, 'assets1', 'structures', 'dock');
const OUT = path.join(__dirname, 'src', 'pier-lane-directions.json');
const BOXES_OUT = path.join(__dirname, 'src', 'pier-lane-boxes.json');
const CLAMPS_OUT = path.join(__dirname, 'src', 'pier-clamps.json');

/** Connections of a component XML with their tags and offset position (X4 space). */
export function parseConnections(xml) {
  const out = [];
  const re = /<connection\s+name="([^"]*)"[^>]*?tags="([^"]*)"[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, name, tags, selfClosing] = m;
    let position = { x: 0, y: 0, z: 0 };
    if (!selfClosing) {
      const end = xml.indexOf('</connection>', re.lastIndex);
      const body = xml.slice(re.lastIndex, end < 0 ? undefined : end);
      // The connection's own offset comes before any nested part/size data
      const offset = body.match(/<offset>\s*<position\s+([^>]*)\/>/);
      if (offset) {
        const attr = (k) => Number((offset[1].match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1] || 0);
        position = { x: attr('x'), y: attr('y'), z: attr('z') };
      }
    }
    out.push({ name, tags: tags.trim().split(/\s+/), position });
  }
  return out;
}

/** Unit horizontal lane direction {x, z} in X4 component space, or null when the pier has none. */
export function laneDirectionFromConnections(connections) {
  const bays = connections.filter(c => c.tags.includes('dockingbay')).map(c => c.position);
  const snaps = connections.filter(c => c.tags.includes('snap')).map(c => c.position);
  if (bays.length === 0) return null;
  // Attachment: snaps in the pier's horizontal plane (the vertical ones stack modules above/below)
  const flatSnaps = snaps.filter(p => Math.abs(p.y) < 1);
  const anchors = flatSnaps.length ? flatSnaps : (snaps.length ? snaps : [{ x: 0, y: 0, z: 0 }]);
  const mean = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, z: a.z + p.z / pts.length }), { x: 0, z: 0 });
  const a = mean(anchors);
  const b = mean(bays);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  // Reach of the bays from the attachment: a lane centroid this close to it means bays all around
  const reach = Math.max(...bays.map(p => Math.hypot(p.x - a.x, p.z - a.z)), 1);
  if (len < 0.25 * reach) return null;
  // Snap to the component's axes when nearly aligned, so placement lands on clean yaws
  let x = dx / len;
  let z = dz / len;
  if (Math.abs(x) > 0.99) { x = Math.sign(x); z = 0; }
  else if (Math.abs(z) > 0.99) { z = Math.sign(z); x = 0; }
  return { x: Math.round(x * 1e4) / 1e4, z: Math.round(z * 1e4) / 1e4 };
}

const round = (n) => Math.round(n * 1000) / 1000 + 0; // + 0: no -0 in the JSON

/**
 * Lane volumes of a component XML: for each geometryinvisible connection with a <size>, its box in
 * the viewer's mesh space, which mirrors X4 on X (positions (-x, y, z), quaternions (qx, -qy, -qz, qw)).
 * The size's max is the half-extent around its centre, both in the connection's frame.
 * @returns {{ part: string, center: number[], halfSize: number[], quaternion: number[] }[]}
 */
export function laneBoxesFromXml(xml) {
  const num = (attrs, k) => Number((attrs.match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`)) || [])[1] || 0);
  const boxes = [];
  for (const [, tags, body] of xml.matchAll(/<connection\s[^>]*?tags="([^"]*)"[^>]*>([\s\S]*?)<\/connection>/g)) {
    if (!tags.split(/\s+/).includes('geometryinvisible')) continue;
    const size = body.match(/<size>\s*<max\s+([^>]*?)\/>\s*<center\s+([^>]*?)\/>/);
    if (!size) continue;
    const pre = body.split(/<parts\b/)[0];
    const pos = pre.match(/<position\s+([^>]*?)\/>/);
    const quat = pre.match(/<quaternion\s+([^>]*?)\/>/);
    const p = pos ? ['x', 'y', 'z'].map(k => num(pos[1], k)) : [0, 0, 0];
    let q = quat ? ['qx', 'qy', 'qz', 'qw'].map(k => num(quat[1], k)) : [0, 0, 0, 1];
    const len = Math.hypot(...q) || 1;
    q = q.map(v => v / len);
    const c = ['x', 'y', 'z'].map(k => num(size[2], k));
    // Centre in component space: offset + rotated size centre
    const [qx, qy, qz, qw] = q;
    const ix = qw * c[0] + qy * c[2] - qz * c[1], iy = qw * c[1] + qz * c[0] - qx * c[2];
    const iz = qw * c[2] + qx * c[1] - qy * c[0], iw = -qx * c[0] - qy * c[1] - qz * c[2];
    const rc = [ix * qw - iw * qx - iy * qz + iz * qy, iy * qw - iw * qy - iz * qx + ix * qz, iz * qw - iw * qz - ix * qy + iy * qx];
    const world = p.map((v, i) => v + rc[i]);
    boxes.push({
      part: (body.match(/<part\s[^>]*?name="([^"]+)"/) || [])[1] || 'geometryinvisible',
      center: [-world[0], world[1], world[2]].map(round),
      halfSize: ['x', 'y', 'z'].map(k => round(num(size[1], k))),
      quaternion: [q[0], -q[1], -q[2], q[3]].map(round)
    });
  }
  return boxes;
}

/**
 * Docking clamps of a pier XML, each with where its tunnel starts and the horizontal direction ships
 * come and go, in the viewer's mesh space. One per `exclusionzone ship_xl` connection (its local +Z is
 * the way out of the clamp); the tunnel starts at the docking bay facing the same way next to it, or at
 * the zone itself when there is none close by (hubs whose bays sit at the centre). Piers without
 * exclusion zones use their docking bays.
 * @returns {{ position: number[], direction: number[] }[]}
 */
export function clampsFromXml(xml) {
  const num = (attrs, k) => Number((attrs.match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`)) || [])[1] || 0);
  const zones = [], bays = [];
  for (const [, tags, body] of xml.matchAll(/<connection\s[^>]*?tags="([^"]*)"[^>]*>([\s\S]*?)<\/connection>/g)) {
    const t = tags.split(/\s+/);
    const list = t.includes('exclusionzone') && t.includes('ship_xl') ? zones : (t.includes('dockingbay') ? bays : null);
    if (!list) continue;
    const pre = body.split(/<parts\b/)[0];
    const pos = pre.match(/<position\s+([^>]*?)\/>/);
    const quat = pre.match(/<quaternion\s+([^>]*?)\/>/);
    const p = pos ? ['x', 'y', 'z'].map(k => num(pos[1], k)) : [0, 0, 0];
    const [qx, qy, qz, qw] = quat ? ['qx', 'qy', 'qz', 'qw'].map(k => num(quat[1], k)) : [0, 0, 0, 1];
    // Local +Z turned by the quaternion, kept horizontal
    const dx = 2 * (qx * qz + qw * qy), dz = 1 - 2 * (qx * qx + qy * qy);
    const len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    list.push({ p, d: [dx / len, dz / len] });
  }
  const out = [];
  for (const z of (zones.length ? zones : bays)) {
    const bay = zones.length ? bays
      .filter(b => b.d[0] * z.d[0] + b.d[1] * z.d[1] > 0.99 && Math.hypot(b.p[0] - z.p[0], b.p[1] - z.p[1], b.p[2] - z.p[2]) < 500)
      .sort((a, b) => Math.hypot(a.p[0] - z.p[0], a.p[2] - z.p[2]) - Math.hypot(b.p[0] - z.p[0], b.p[2] - z.p[2]))[0] : null;
    const start = (bay || z).p;
    // X4 component space -> mesh space mirrors X
    out.push({ position: [-start[0], start[1], start[2]].map(round), direction: [-z.d[0], 0, z.d[1]].map(v => Math.round(v * 1e4) / 1e4 + 0) });
  }
  return out;
}

function main() {
  const table = {};
  const boxes = {};
  const clamps = {};
  for (const file of fs.readdirSync(DOCK_DIR).sort()) {
    if (!/^pier_.*\.xml$/i.test(file)) continue;
    const xml = fs.readFileSync(path.join(DOCK_DIR, file), 'utf8');
    const key = file.replace(/\.xml$/i, '').toLowerCase();
    table[key] = laneDirectionFromConnections(parseConnections(xml));
    const lanes = laneBoxesFromXml(xml);
    if (lanes.length) boxes[key] = lanes;
    const c = clampsFromXml(xml);
    if (c.length) clamps[key] = c;
  }
  fs.writeFileSync(CLAMPS_OUT, JSON.stringify(clamps, null, 1) + '\n');
  console.log(`Wrote clamps of ${Object.keys(clamps).length} piers to ${path.relative(__dirname, CLAMPS_OUT)}`);
  fs.writeFileSync(BOXES_OUT, JSON.stringify(boxes, null, 1) + '\n');
  console.log(`Wrote lane boxes of ${Object.keys(boxes).length} piers to ${path.relative(__dirname, BOXES_OUT)}`);
  fs.writeFileSync(OUT, JSON.stringify(table, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(table).length} piers to ${path.relative(__dirname, OUT)}`);
  for (const [k, v] of Object.entries(table)) console.log(`  ${k}: ${v ? `x=${v.x} z=${v.z}` : 'none (bays all around)'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
