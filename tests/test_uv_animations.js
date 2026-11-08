/**
 * X4 UV animations from component XML (packages/adapter-three/src/materials/uv-animations.js).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { componentUrlForPart, parseComponentUvAnimations, loadPartUvAnimations, sampleTrack, applyUvTrack, X4_ANIMATION_FPS } from '../packages/adapter-three/src/materials/uv-animations.js';

console.log('[*] Testing X4 UV animations...');

assert.strictEqual(componentUrlForPart('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae'), '/assets1/structures/connectionmodules/struct_arg_cross_01.xml');
assert.strictEqual(componentUrlForPart('/x/loose.dae'), null);

// Track sampling: linear between keys, held outside them
const toggle = [[0, 0], [95, 0], [100, 0.25], [195, 0.25], [200, 0]];
assert.deepStrictEqual([0, 50, 95, 97.5, 100, 150, 197.5, 200, 250].map(f => +sampleTrack(toggle, f).toFixed(4)), [0, 0, 0, 0.125, 0.25, 0.25, 0.125, 0, 0]);
assert.strictEqual(sampleTrack([], 10), 0);
const tex = { offset: { x: 0, y: 0 } };
applyUvTrack(tex, { v: [[0, 4], [200, -4]] }, 200, 100 / X4_ANIMATION_FPS);
assert.strictEqual(tex.offset.y, 0, 'v at frame 100 of 4 -> -4');
applyUvTrack(tex, { v: [[0, 4], [200, -4]] }, 200, 300 / X4_ANIMATION_FPS);
assert.strictEqual(tex.offset.y, 0, 'loops');
console.log('  ✓ keyframe sampling and looping at 30 frames/s');

// A real component file
const file = 'assets1/structures/connectionmodules/struct_arg_cross_01.xml';
if (fs.existsSync(file)) {
  const parts = parseComponentUvAnimations(fs.readFileSync(file, 'utf8'));
  const arrows = parts.get('anim_arrows');
  assert.strictEqual(arrows.loopFrames, 200);
  assert.deepStrictEqual(arrows.channels[1].u, toggle, 'atlas channel toggles one cell');
  assert.deepStrictEqual(arrows.channels[3].v, [[0, 4], [200, -4]], 'wave channel scrolls');
  assert.deepStrictEqual(parts.get('anim_cross').channels[3].v, [[0, -0], [100, -4]]);
  assert.strictEqual(parts.get('anim_cross').loopFrames, 100);
  assert.deepStrictEqual(parts.get('anim_poslights').channels[1].u, [[0, 0], [100, -1]]);
  const loaded = await loadPartUvAnimations('/' + file.replace('.xml', '_data/anim_arrows-lod0.dae'), 'anim_arrows');
  assert.deepStrictEqual(loaded, arrows, 'loaded from the part URL');
  assert.strictEqual(await loadPartUvAnimations('/' + file.replace('.xml', '_data/part_main-lod0.dae'), 'part_main'), null, 'a part without UV animations');
  console.log('  ✓ struct_arg_cross_01.xml: anim_arrows toggle, anim_cross and anim_poslights scrolls parsed');
}
assert.strictEqual(await loadPartUvAnimations('/assets1/nowhere/missing_data/anim_arrows-lod0.dae', 'anim_arrows'), null, 'missing component file: null');

console.log('\n[PASS] test_uv_animations');
