import assert from 'assert';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };
import PART_PARENTS from '../src/component-part-parents.json' with { type: 'json' };

console.log('[*] Testing prod_gen_hullparts part offsets are in component space...');

const offsets = COMPONENT_OFFSETS.prod_gen_hullparts;
const parents = PART_PARENTS.prod_gen_hullparts;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The loader looks parts up by lower-case name, so mixed-case keys would never be read
for (const k of Object.keys(offsets)) {
  if (k.startsWith('anim_') || k.startsWith('detail_')) assert.strictEqual(k, k.toLowerCase(), `${k}: unread mixed-case key`);
}
console.log('  ✓ [PASS] every drawn part key is lower case');

// Each welding arm's segments were stored relative to their parent part, so all nine arms'
// anim_part02..04 and lasers collapsed onto one spot. In component space they follow their arm.
for (const seg of ['anim_part02', 'anim_part03', 'anim_part04', 'detail_m_laser']) {
  const arms = Object.keys(offsets).filter(k => k.startsWith(seg));
  const spots = new Set(arms.map(k => offsets[k].map(v => v.toFixed(1)).join(',')));
  assert.ok(arms.length >= 6 && spots.size === arms.length, `${seg}*: ${arms.length} parts share ${spots.size} positions`);
}
console.log('  ✓ [PASS] arm segments and lasers each sit on their own arm');

// Every child stays close to the part it hangs off (the arm, robot and container chains are a few metres to tens of metres)
for (const [child, parent] of Object.entries(parents)) {
  if (!offsets[child] || !offsets[parent]) continue;
  const d = dist(offsets[child], offsets[parent]);
  assert.ok(d < 150, `${child} is ${d.toFixed(1)} m from its parent ${parent}`);
}
// The laser at the tip of each arm is attached at its last segment's origin
for (let i = 1; i <= 8; i++) {
  assert.ok(dist(offsets[`detail_m_laser0${i}`], offsets[`anim_part04_arm0${i}`]) < 0.01, `detail_m_laser0${i} at anim_part04_arm0${i}`);
}
console.log('  ✓ [PASS] child parts sit at their parents');
