import assert from 'assert';
import fs from 'fs';
import * as THREE from 'three';
import { attachChildParts } from '../packages/adapter-three/src/models/module-mesh-loader.js';
import { createPartAnimator } from '../packages/adapter-three/src/models/ani-animations.js';

console.log('[*] Testing child parts attached to the part the game moves them with...');

const part = (name, pos, quat = [0, 0, 0, 1]) => {
  const o = new THREE.Group();
  o.name = name;
  o.userData.partName = name;
  o.position.set(...pos);
  o.quaternion.set(...quat).normalize();
  return o;
};
const world = (o) => o.getWorldPosition(new THREE.Vector3());

// A rotated root with a two-link chain, as prod_ter_proteinpaste's algae (anim_alge01_004 -> 005 -> 006)
const group = new THREE.Group();
group.position.set(0, 100, 0); // a part-main shift
const root = part('anim_alge01_004', [-67.66, 215.88, -123.14], [0, -0.258819, 0, -0.9659258]);
const mid = part('anim_alge01_005', [-93.74, 230.29, -163.46], [0, -0.258819, 0, -0.9659258]);
const tip = part('anim_alge01_006', [-115.75, 254.89, -203.87], [0, -0.258819, 0, -0.9659258]);
const loose = part('anim_bubbles', [0, 20, 0]);
const scenes = [root, mid, tip, loose];
scenes.forEach(s => group.add(s));
group.updateMatrixWorld(true);
const before = scenes.map(world);

const n = attachChildParts(group, scenes, { anim_alge01_005: 'anim_alge01_004', anim_alge01_006: 'anim_alge01_005', missing_part: 'anim_alge01_004' });
assert.strictEqual(n, 2, 'two links attached; a part not loaded is skipped');
assert.strictEqual(mid.parent, root);
assert.strictEqual(tip.parent, mid);
assert.strictEqual(loose.parent, group, 'parts without a link stay on the mesh group');
group.updateMatrixWorld(true);
scenes.forEach((s, i) => assert(world(s).distanceTo(before[i]) < 1e-6, `${s.name} keeps where it is drawn`));
console.log('  ✓ children attached under their parent part, nothing moves');

// The root animates: the chain follows it
const tipBefore = world(tip);
const midOnRoot = mid.position.clone();
const animate = createPartAnimator(root, [{ clip: { duration: 2, position: [], scale: [], rotation: [
  { time: 0, value: [0, 0, 0], interp: [2, 2, 2], handles: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  { time: 2, value: [0.4, 0, 0], interp: [2, 2, 2], handles: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }
] } }]);
animate(0);
animate(1);
group.updateMatrixWorld(true);
assert(world(tip).distanceTo(tipBefore) > 1, 'the chain tip moved with its animated root');
assert(mid.position.distanceTo(midOnRoot) < 1e-9, 'the middle link stays at its attachment point on the root');
console.log('  ✓ an animated root carries its chain');

// No cycles: a link back to an ancestor is ignored
const a = part('a', [0, 0, 0]);
const b = part('b', [1, 0, 0]);
const g2 = new THREE.Group();
g2.add(a, b);
assert.strictEqual(attachChildParts(g2, [a, b], { b: 'a', a: 'b' }), 1, 'the second, cyclic link is skipped');
assert.strictEqual(b.parent, a);
assert.strictEqual(a.parent, g2);
console.log('  ✓ cyclic links are skipped');

// The generated table: proteinpaste's 36 algae links
const parents = JSON.parse(fs.readFileSync(new URL('../src/component-part-parents.json', import.meta.url), 'utf8'));
assert.strictEqual(Object.keys(parents.prod_ter_proteinpaste || {}).length, 36, 'prod_ter_proteinpaste has 36 child algae');
assert.strictEqual(parents.prod_ter_proteinpaste.anim_alge01_006, 'anim_alge01_005');
for (const [comp, links] of Object.entries(parents)) {
  for (const [child, parent] of Object.entries(links)) {
    assert.notStrictEqual(parent, 'part_main', `${comp}/${child}: parts hanging off part_main are not listed`);
    assert.notStrictEqual(child, parent, `${comp}/${child} is not its own parent`);
  }
}
console.log(`  ✓ component-part-parents.json: ${Object.keys(parents).length} components`);

console.log('[PASS] test_attach_child_parts');
