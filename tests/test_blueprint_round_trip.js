/**
 * Blueprint export round trip: load a plan into module groups the way the viewer does, collect them
 * with the real export code (exportModulesFromScene), write the blueprint XML (generatePlanXML),
 * parse it back, and require every module to return unchanged: macro, connection, predecessor,
 * position and orientation. Run over the plans exported from X4 and the built-in samples.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

const { parseConstructionPlan } = await import('../src/parser.js');
const { computeModuleGroupRotation, computeX4RotationFromModuleGroup } = await import('../packages/adapter-three/src/math/rotation-math.js');
const { generatePlanXML } = await import('../src/blueprint-exporter.js');
const { exportModulesFromScene } = await import('../src/app/blueprint-export.js');
const { SAMPLES } = await import('../src/samples.js');

console.log('[*] Testing blueprint export round trip...');

// Module groups built like StationViewer.loadStationPlan
function sceneFor(plan) {
  const children = plan.modules.map(mod => {
    const group = new THREE.Group();
    group.position.set(mod.position.x, mod.position.y, -mod.position.z);
    group.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));
    group.userData = { index: mod.index, macro: mod.macro, connection: mod.connection };
    return group;
  });
  return {
    modulesGroup: { children },
    // Same as StationViewer.getModuleCalculatedRotation
    getModuleCalculatedRotation: (index, options) => computeX4RotationFromModuleGroup(children.find(c => c.userData.index === index), options)
  };
}
const orientation = (r) => new THREE.Quaternion().setFromEuler(computeModuleGroupRotation(r?.yaw, r?.pitch, r?.roll));

const plans = [
  ...fs.readdirSync('tests/fixtures').filter(f => f.endsWith('.xml')).map(f => [f, fs.readFileSync(`tests/fixtures/${f}`, 'utf8')]),
  ...Object.entries(SAMPLES).map(([k, xml]) => [`sample ${k}`, xml])
];
const summary = [];
for (const [name, xml] of plans) {
  const plan = parseConstructionPlan(xml);
  const exported = generatePlanXML(plan.name || 'Round trip', plan, { modules: exportModulesFromScene(sceneFor(plan), plan) });
  const back = parseConstructionPlan(exported);
  const backByIndex = new Map(back.modules.map(m => [m.index, m]));
  const problems = [];
  let worstPos = 0, worstAngle = 0;
  for (const m of plan.modules) {
    const b = backByIndex.get(m.index);
    if (!b) { problems.push(`#${m.index} missing`); continue; }
    if (b.macro !== m.macro) problems.push(`#${m.index} macro ${b.macro}`);
    if ((b.connection || '').toLowerCase() !== (m.connection || '').toLowerCase()) problems.push(`#${m.index} connection ${b.connection} vs ${m.connection}`);
    if ((b.predecessor?.index ?? null) !== (m.predecessor?.index ?? null) ||
        (b.predecessor?.connection || '').toLowerCase() !== (m.predecessor?.connection || '').toLowerCase()) problems.push(`#${m.index} predecessor changed`);
    const dp = Math.hypot(b.position.x - m.position.x, b.position.y - m.position.y, b.position.z - m.position.z);
    const da = orientation(b.rotation).angleTo(orientation(m.rotation)) * 180 / Math.PI;
    worstPos = Math.max(worstPos, dp);
    worstAngle = Math.max(worstAngle, da);
    if (dp > 0.002) problems.push(`#${m.index} ${m.macro} moved ${dp.toFixed(3)} m`);
    if (da > 0.01) problems.push(`#${m.index} ${m.macro} rotated ${da.toFixed(3)} deg (${JSON.stringify(m.rotation)} -> ${JSON.stringify(b.rotation)})`);
  }
  if (back.modules.length !== plan.modules.length) problems.push(`module count ${plan.modules.length} -> ${back.modules.length}`);
  summary.push({ name, modules: plan.modules.length, problems, worstPos, worstAngle });
}
for (const s of summary) {
  console.log(`  ${s.problems.length ? '✗' : '✓'} ${s.name}: ${s.modules} modules, worst drift ${s.worstPos.toFixed(4)} m / ${s.worstAngle.toFixed(4)} deg${s.problems.length ? `, ${s.problems.length} problems` : ''}`);
}
const failed = summary.filter(s => s.problems.length);
assert.deepStrictEqual(failed.map(s => s.name), [],
  'plans that do not survive the round trip:\n' + failed.map(s => `  ${s.name}:\n    ${s.problems.slice(0, 5).join('\n    ')}`).join('\n'));

console.log('\n[PASS] test_blueprint_round_trip');
