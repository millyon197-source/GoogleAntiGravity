/**
 * Part animations from the game's .ANI files: the parser reads the real files, the sampler follows
 * step / linear / bezier keys, clip choice picks loops or open/close cycles, the animator applies a clip
 * on top of the part's connection offset (X mirrored for three), and loadModuleMesh registers an .ANI
 * clip for every part that has one, keeping the hand-made motion for parts that do not.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;

const THREE = await import('three');
const {
  parseAni, sampleChannel, choosePartAnimation, sampleSegments, createPartAnimator, aniUrlsForFolder,
  loadModuleAniClips, loadModuleMesh, CRANE_HOLDER_KEYFRAMES
} = await import('@x4/adapter-three');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readAni = (rel) => {
  const buf = fs.readFileSync(path.join(root, rel));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};
const close = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

console.log('[*] Testing .ANI part animations...');

// ---------------------------------------------------------------- parser on real files
const wheatPath = 'assets1/structures/production/PROD_ARG_WHEAT_DATA.ANI';
const dockPath = 'assets1/structures/dock/DOCKAREA_ARG_M_STATION_02_HIGHTECH_DATA.ANI';
const haveAssets = fs.existsSync(path.join(root, wheatPath)) && fs.existsSync(path.join(root, dockPath));
if (haveAssets) {
  const wheat = parseAni(readAni(wheatPath));
  assert.ok(Array.isArray(wheat) && wheat.length === 17, 'wheat farm has 17 clips');
  const crane = wheat.find(c => c.part === 'anim_crane_holder' && c.name === 'mode_active');
  assert.ok(crane && close(crane.duration, 66.667), 'crane holder mode_active lasts 66.67 s');
  assert.strictEqual(crane.position.length, CRANE_HOLDER_KEYFRAMES.length, 'one position key per hand-copied keyframe');
  crane.position.forEach((k, i) => {
    assert.ok(close(k.time, CRANE_HOLDER_KEYFRAMES[i].t, 0.01), `key ${i} time`);
    // The hand-copied keyframes are the .ANI values with X mirrored
    assert.ok(close(-k.value[0], CRANE_HOLDER_KEYFRAMES[i].v, 0.01), `key ${i} value`);
  });
  const bezier = crane.position[1];
  assert.deepStrictEqual(bezier.interp, [5, 5, 5], 'crane keys are bezier');
  assert.ok(close(bezier.handles[0][0], 8.8867) && close(bezier.handles[0][2], 4.4467), 'bezier handle times read per axis');

  const dock = parseAni(readAni(dockPath));
  const hatchClips = dock.filter(c => c.part === 'anim_hatch_01');
  assert.deepStrictEqual(hatchClips.map(c => c.name), ['dockingbay_closed', 'dockingbay_opening', 'dockingbay_open', 'dockingbay_closing']);
  const opening = hatchClips.find(c => c.name === 'dockingbay_opening');
  assert.ok(close(opening.position[3].value[2], 2.9578) && close(opening.position[3].time, 2), 'hatch slides 2.96 along z in 2 s');

  // Hatches cycle open / closed; the escalator loop is UV only, so it gets no part animation
  const cycle = choosePartAnimation(hatchClips);
  assert.deepStrictEqual(cycle.map(s => s.clip.name), ['dockingbay_opening', 'dockingbay_open', 'dockingbay_closing', 'dockingbay_closed']);
  assert.strictEqual(choosePartAnimation(dock.filter(c => c.part === 'anim_escalator')), null, 'UV-only clips are not part animations');
  assert.strictEqual(choosePartAnimation(crane ? wheat.filter(c => c.part === 'anim_crane_holder') : [])[0].clip.name, 'mode_active', 'mode_active preferred over state clips');

  // Every .ANI the game ships parses
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ani$/i.test(e.name)) files.push(p); } };
  walk(path.join(root, 'assets1'));
  const failed = files.filter(f => { const b = fs.readFileSync(f); return !parseAni(b); });
  assert.deepStrictEqual(failed, [], 'all .ANI files parse');
  console.log(`  ✓ parseAni reads all ${files.length} .ANI files; crane keys match the hand-copied keyframes`);
} else {
  console.log('  - assets1 .ANI files not present, skipping real-file checks');
}

assert.strictEqual(parseAni(new TextEncoder().encode('<!doctype html><html></html>')), null, 'an HTML fallback page is not an ANI file');
assert.strictEqual(parseAni(new ArrayBuffer(4)), null, 'truncated data is rejected');

// ---------------------------------------------------------------- sampling
const key = (time, value, interp = 2, handles) => ({ time, value, interp: [interp, interp, interp], handles: handles || [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
{
  const linear = [key(0, [0, 0, 0]), key(2, [4, 2, 0], 1)];
  assert.deepStrictEqual(sampleChannel(linear, 1, null), [2, 1, 0], 'linear midpoint');
  assert.deepStrictEqual(sampleChannel(linear, 5, null), [4, 2, 0], 'holds the last key');
  assert.deepStrictEqual(sampleChannel([key(0, [1, 1, 1], 1), key(2, [3, 3, 3])], 1.5, null), [1, 1, 1], 'step holds the value');
  assert.strictEqual(sampleChannel([], 1, null), null, 'no keys → fallback');
  // Bezier with handles a third of the way in on the line: same as linear
  const h = (outT, outV, inT, inV) => [[outT, outV, inT, inV], [outT, outV, inT, inV], [outT, outV, inT, inV]];
  const bz = [key(0, [0, 0, 0], 5, h(1, 0, -1, 0)), key(3, [3, 3, 3], 1, h(4, 3, 2, 3))];
  const mid = sampleChannel(bz, 1.5, null);
  assert.ok(close(mid[0], 1.5, 1e-3), 'symmetric bezier passes through the midpoint');
  // Flat handles ease in and out
  const ease = [key(0, [0, 0, 0], 5, h(1.5, 0, 0, 0)), key(3, [3, 3, 3], 1, h(0, 0, 1.5, 3))];
  assert.ok(sampleChannel(ease, 0.5, null)[0] < 0.5, 'eases in');
  assert.ok(close(sampleChannel(ease, 1.5, null)[0], 1.5, 1e-3), 'eased curve still passes the middle');

  const clip = (name, duration, pos) => ({ part: 'p', name, duration, position: pos, rotation: [], scale: [] });
  const segs = [{ clip: clip('opening', 2, linear) }, { clip: clip('open', 0.03, [key(0, [4, 2, 0])]), hold: 3 }];
  assert.strictEqual(sampleSegments(segs, 1).clip.name, 'opening');
  assert.strictEqual(sampleSegments(segs, 3).clip.name, 'open', 'held state shows after its transition');
  assert.strictEqual(sampleSegments(segs, 5.5).clip.name, 'opening', 'the cycle repeats');
  console.log('  ✓ sampleChannel: step, linear and bezier keys; segments cycle with holds');
}

// ---------------------------------------------------------------- animator
{
  const obj = new THREE.Object3D();
  obj.position.set(10, 0, 0);
  obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const clip = {
    part: 'p', name: 'loop', duration: 2,
    position: [key(0, [0, 0, 0]), key(2, [0, 0, 2], 1)],
    rotation: [key(0, [0, 0, 0]), key(2, [0, Math.PI / 2, 0], 1)],
    scale: []
  };
  const update = createPartAnimator(obj, [{ clip }]);
  update(0);
  assert.ok(obj.position.distanceTo(new THREE.Vector3(10, 0, 0)) < 1e-6, 'rest pose at t=0');
  update(1.999);
  // Local +z of a part turned 90° about Y points along world +x
  assert.ok(close(obj.position.x, 12, 1e-2) && close(obj.position.z, 0, 1e-2), 'offset applied in the connection frame');
  const turned = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 * 0.9995));
  assert.ok(obj.quaternion.angleTo(turned) < 1e-2, 'rotation applied after the rest rotation, Y mirrored');
  const flip = new THREE.Object3D();
  createPartAnimator(flip, [{ clip: { ...clip, rotation: [], position: [key(0, [5, 1, 0])] } }])(0);
  assert.ok(close(flip.position.x, -5) && close(flip.position.y, 1), 'X mirrored for three');
  console.log('  ✓ createPartAnimator: applies clips on the connection offset, X mirrored');
}

// ---------------------------------------------------------------- file lookup
{
  assert.deepStrictEqual(aniUrlsForFolder('/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data'), [
    '/assets1/structures/dock/DOCKAREA_ARG_M_STATION_02_HIGHTECH_DATA.ANI',
    '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data.ani'
  ]);
  if (haveAssets) {
    const urls = [];
    const fetchFromDisk = async (url) => {
      urls.push(url);
      const p = path.join(root, url);
      if (!fs.existsSync(p)) return { ok: true, arrayBuffer: async () => new TextEncoder().encode('<html></html>').buffer }; // SPA fallback
      const b = fs.readFileSync(p);
      return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    };
    const clips = await loadModuleAniClips('/assets1/structures/production/prod_arg_wheat_data', fetchFromDisk);
    assert.ok(clips.get('anim_crane_holder')?.length === 4, 'clips grouped by part');
    const again = await loadModuleAniClips('/assets1/structures/production/prod_arg_wheat_data', fetchFromDisk);
    assert.strictEqual(again, clips, 'cached per folder');
    const none = await loadModuleAniClips('/assets1/structures/nothing/none_data', fetchFromDisk);
    assert.strictEqual(none.size, 0, 'a fallback page instead of a file gives no clips');
  }
  console.log('  ✓ loadModuleAniClips: upper/lower case names, per-folder cache, HTML fallback ignored');
}

// ---------------------------------------------------------------- loadModuleMesh registration
{
  const fakeScene = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())); return g; };
  const hatchClip = { part: 'anim_hatch_01', name: 'loop', duration: 2, position: [key(0, [0, 0, 0]), key(2, [0, 0, 3], 1)], rotation: [], scale: [] };
  const folders = [];
  const host = {
    glowingEmissiveIntensity: 2.2, animatedParts: [], animatedTextures: [],
    resolveModuleAssetEntry: () => ({ baseName: 'dock_x', folderPath: '/x/dock_x_data', defaultFiles: ['part_main-lod0.dae', 'anim_hatch_01-lod0.dae', 'anim_vent-lod0.dae'] }),
    getModuleActiveComponentFiles: () => ['part_main-lod0.dae', 'anim_hatch_01-lod0.dae', 'anim_vent-lod0.dae'],
    loadBinaryModel: async () => fakeScene(),
    loadColladaModel: async () => fakeScene(),
    applyTexturesToMeshGroup: async () => {},
    loadModuleAnimations: async (folder) => { folders.push(folder); return new Map([['anim_hatch_01', [hatchClip]]]); },
    shouldAnimateModule: () => true
  };
  await loadModuleMesh(host, { macro: 'dock_x_macro', index: 7 }, {});
  assert.deepStrictEqual(folders, ['/x/dock_x_data'], 'clips loaded for the module folder');
  const hatch = host.animatedParts.find(p => p.object.name === 'anim_hatch_01');
  const vent = host.animatedParts.find(p => p.object.name === 'anim_vent');
  assert.ok(hatch && hatch.source === 'ani' && hatch.moduleIndex === 7, 'a part with an .ANI clip plays it');
  assert.ok(vent && vent.source === undefined, 'a part without one keeps its hand-made motion');
  hatch.update(1);
  assert.ok(close(hatch.object.position.z, 1.5), 'the registered update moves the hatch');

  host.animatedParts = []; folders.length = 0;
  host.shouldAnimateModule = () => false;
  await loadModuleMesh(host, { macro: 'dock_x_macro', index: 8 }, {});
  assert.deepStrictEqual(folders, [], 'no .ANI load for modules that do not animate');
  assert.strictEqual(host.animatedParts.length, 0);
  console.log('  ✓ loadModuleMesh registers .ANI clips per part, falls back to hand-made motion, skips idle modules');
}

console.log('\n[PASS] test_ani_animations');
