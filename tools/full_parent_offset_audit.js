import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentOffsets = JSON.parse(fs.readFileSync(path.join(root, 'src/component-offsets.json'), 'utf8'));
const partMainOffsets = JSON.parse(fs.readFileSync(path.join(root, 'src/part-main-offsets.json'), 'utf8'));

function findXmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findXmlFiles(full));
    } else if (entry.name.endsWith('.xml') && !entry.name.includes('_macro')) {
      results.push(full);
    }
  }
  return results;
}

const xmlFiles = [
  ...findXmlFiles(path.join(root, 'assets1/structures')),
  ...findXmlFiles(path.join(root, 'assets/structures'))
];

function parseComponentConnections(xml) {
  const connections = new Map();
  const partToConn = new Map();

  const connRegex = /<connection\s+([^>]*?)>([\s\S]*?)<\/connection>/g;
  let match;
  while ((match = connRegex.exec(xml)) !== null) {
    const attrStr = match[1];
    const bodyStr = match[2];

    const nameMatch = attrStr.match(/name=["']([^"']+)["']/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const parentMatch = attrStr.match(/parent=["']([^"']+)["']/);
    const tagsMatch = attrStr.match(/tags=["']([^"']+)["']/);

    const partMatch = bodyStr.match(/<part\s+name=["']([^"']+)["']/);
    const posMatch = bodyStr.match(/<offset>[\s\S]*?<position\s+x=["']([^"']+)["']\s+y=["']([^"']+)["']\s+z=["']([^"']+)["']/);
    const quatMatch = bodyStr.match(/<offset>[\s\S]*?<quaternion\s+qx=["']([^"']+)["']\s+qy=["']([^"']+)["']\s+qz=["']([^"']+)["']\s+qw=["']([^"']+)["']/);
    const hasAnim = bodyStr.includes('<animation') || (tagsMatch && tagsMatch[1].includes('animation'));

    const conn = {
      name,
      parent: parentMatch ? parentMatch[1] : null,
      tags: tagsMatch ? tagsMatch[1] : '',
      part: partMatch ? partMatch[1] : null,
      hasAnim,
      pos: posMatch ? [parseFloat(posMatch[1]), parseFloat(posMatch[2]), parseFloat(posMatch[3])] : [0, 0, 0],
      quat: quatMatch ? [parseFloat(quatMatch[1]), parseFloat(quatMatch[2]), parseFloat(quatMatch[3]), parseFloat(quatMatch[4])] : null
    };

    connections.set(name, conn);
    if (conn.part) {
      partToConn.set(conn.part, conn);
    }
  }

  return { connections, partToConn };
}

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];

const vRotate = (v, q) => {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
};

function composeToRoot(conn, connections, partToConn) {
  let curr = conn;
  let pos = [...curr.pos];
  let quat = curr.quat ? [...curr.quat] : [0, 0, 0, 1];
  const visited = new Set();
  const chain = [curr.part || curr.name];

  while (curr.parent) {
    if (visited.has(curr.parent)) break;
    visited.add(curr.parent);
    chain.push(curr.parent);

    const parentConn = partToConn.get(curr.parent) || connections.get(curr.parent);
    if (!parentConn) break;

    const pPos = parentConn.pos || [0, 0, 0];
    const pQuat = parentConn.quat || [0, 0, 0, 1];

    pos = vRotate(pos, pQuat);
    pos = [pos[0] + pPos[0], pos[1] + pPos[1], pos[2] + pPos[2]];
    quat = qMul(pQuat, quat);

    curr = parentConn;
  }

  return { pos, quat, chain };
}

const HIERARCHICAL_MODULES = new Set([
  'prod_gen_advancedelectronics',
  'prod_arg_wheat'
]);

const report = [];

for (const xmlFile of xmlFiles) {
  const component = path.basename(xmlFile, '.xml');
  if (!componentOffsets[component]) continue;

  const xml = fs.readFileSync(xmlFile, 'utf8');
  if (!xml.includes('parent=')) continue;

  const { connections, partToConn } = parseComponentConnections(xml);
  const partMainOffset = partMainOffsets[component] || [0, 0, 0];

  for (const [part, conn] of partToConn.entries()) {
    if (!conn.parent) continue;

    const tableOff = componentOffsets[component]?.[part];
    if (tableOff === undefined) continue;

    const isAnim = conn.hasAnim || part.startsWith('anim') || conn.tags.includes('animation');
    if (!isAnim) continue; // Focused on animations as requested

    const composed = composeToRoot(conn, connections, partToConn);
    const composedX4 = [composed.pos[0] - partMainOffset[0], composed.pos[1] - partMainOffset[1], composed.pos[2] - partMainOffset[2]];
    const composedThree = [-composedX4[0], composedX4[1], composedX4[2]];
    const localThree = [-conn.pos[0], conn.pos[1], conn.pos[2]];

    const tablePos = Array.isArray(tableOff) ? tableOff.slice(0, 3) : (tableOff.position ? tableOff.position : null);
    if (!tablePos) continue;

    const distToLocal = Math.hypot(tablePos[0] - localThree[0], tablePos[1] - localThree[1], tablePos[2] - localThree[2]);
    const distToComposed = Math.hypot(tablePos[0] - composedThree[0], tablePos[1] - composedThree[1], tablePos[2] - composedThree[2]);

    const isHierarchical = HIERARCHICAL_MODULES.has(component);

    let classification = 'UNKNOWN';
    if (isHierarchical) {
      if (distToLocal < 0.1) classification = 'HIERARCHICAL_OK_LOCAL';
      else if (distToComposed < 0.1) classification = 'HIERARCHICAL_WARN_COMPOSED';
      else classification = 'HIERARCHICAL_CUSTOM';
    } else {
      if (distToComposed < 0.1) classification = 'FLAT_OK_COMPOSED';
      else if (distToLocal < 0.1) classification = 'FLAT_BUG_LOCAL_OFFSET';
      else classification = 'FLAT_DISAGREE_BOTH';
    }

    report.push({
      component,
      part,
      parent: conn.parent,
      chain: composed.chain,
      xmlPos: conn.pos,
      localThree,
      composedThree,
      tablePos,
      distToLocal,
      distToComposed,
      classification
    });
  }
}

console.log('=== SUMMARY OF ANIMATED PARENTED CONNECTIONS ===');
const counts = {};
for (const r of report) {
  counts[r.classification] = (counts[r.classification] || 0) + 1;
}
console.log(JSON.stringify(counts, null, 2));

console.log('\n=== CRITICAL DEFECTS: FLAT_BUG_LOCAL_OFFSET ===');
const bugs = report.filter(r => r.classification === 'FLAT_BUG_LOCAL_OFFSET');
for (const b of bugs) {
  console.log(`Component: ${b.component} | Part: ${b.part} | Parent: ${b.parent}`);
  console.log(`  Table (current in app): [${b.tablePos.map(x=>x.toFixed(4)).join(', ')}]`);
  console.log(`  Local (XML mirrored):   [${b.localThree.map(x=>x.toFixed(4)).join(', ')}]`);
  console.log(`  Composed (world space): [${b.composedThree.map(x=>x.toFixed(4)).join(', ')}]`);
  console.log(`  Chain: ${b.chain.join(' -> ')}`);
}

console.log('\n=== INVESTIGATE: FLAT_DISAGREE_BOTH ===');
const byComp = new Map();
for (const r of report.filter(r => r.classification === 'FLAT_DISAGREE_BOTH')) {
  if (!byComp.has(r.component)) byComp.set(r.component, []);
  byComp.get(r.component).push(r);
}
for (const [comp, list] of byComp.entries()) {
  console.log(`Module: ${comp} (${list.length} parts)`);
  for (const item of list.slice(0, 5)) {
    console.log(`  ${item.part} (parent: ${item.parent}): Table=[${item.tablePos.map(x=>x.toFixed(2)).join(', ')}] vs Composed=[${item.composedThree.map(x=>x.toFixed(2)).join(', ')}] vs Local=[${item.localThree.map(x=>x.toFixed(2)).join(', ')}]`);
  }
  if (list.length > 5) console.log(`  ... and ${list.length - 5} more`);
}
