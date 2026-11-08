/**
 * The JavaScript copies of texture data are freed once the textures are on the GPU (they took about
 * 640 MB with every module type loaded), and decoded again when the texturing code asks for a texture
 * it may change and upload again.
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}
const THREE = await import('three');
const { loadDdsTexture, releaseTextureData, isTextureDataReleased } = await import('../packages/adapter-three/src/textures/dds-texture-loader.js');
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing texture data release...');

function makeHost() {
  const loads = [];
  return {
    loads,
    textureCache: new Map(),
    ddsLoader: {
      load(url, onLoad) {
        loads.push(url);
        const t = new THREE.CompressedTexture(
          [{ width: 4, height: 4, data: new Uint8Array(64).fill(loads.length) }, { width: 2, height: 2, data: new Uint8Array(16) }],
          4, 4, THREE.RGBAFormat
        );
        setTimeout(() => onLoad(t), 1);
        return t;
      }
    }
  };
}

// 1. Release and restore
{
  const host = makeHost();
  const tex = await loadDdsTexture(host, '/t/hull_normal.dds');
  assert.ok(tex && tex.mipmaps[0].data.length === 64, 'loaded with data');
  const clone = tex.clone();
  const other = await loadDdsTexture(host, '/t/not_drawn_yet.dds');
  host.textureCache.set('/t/missing.dds', null);
  host.textureCache.set('/t/pending.dds', new Promise(() => {}));

  const released = releaseTextureData(host, (t) => t === tex); // only tex is on the GPU
  assert.strictEqual(released, 1, 'only textures already on the GPU are freed');
  assert.ok(isTextureDataReleased(tex) && tex.mipmaps.every(m => m.data === null), 'data freed');
  assert.deepStrictEqual(tex.mipmaps.map(m => [m.width, m.height]), [[4, 4], [2, 2]], 'mip sizes kept');
  assert.ok(clone.mipmaps[0].data && clone.mipmaps[0].data.length === 64, 'a clone keeps its data');
  assert.ok(!isTextureDataReleased(other) && other.mipmaps[0].data, 'a texture not yet drawn keeps its data');
  assert.strictEqual(releaseTextureData(host, () => true), 1, 'a second pass frees only what is left (other)');

  const loadsBefore = host.loads.length;
  const [a, b] = await Promise.all([loadDdsTexture(host, '/t/hull_normal.dds'), loadDdsTexture(host, '/t/hull_normal.dds')]);
  assert.strictEqual(a, tex, 'the same texture object comes back');
  assert.strictEqual(b, tex);
  assert.strictEqual(host.loads.length, loadsBefore + 1, 'decoded again once for simultaneous requests');
  assert.ok(!isTextureDataReleased(tex) && tex.mipmaps[0].data && tex.mipmaps[0].data.length === 64, 'data restored');
  assert.strictEqual(await loadDdsTexture(host, '/t/hull_normal.dds'), tex);
  assert.strictEqual(host.loads.length, loadsBefore + 1, 'a restored texture is not decoded again');
  console.log('  ✓ data freed only for textures on the GPU (clones keep theirs) and decoded again on request');
}

// 2. The viewer frees uploaded texture data after a successful plan load, not after a failed one
{
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene(); v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group(); v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['deselect', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  const host = makeHost();
  v.textureCache = host.textureCache; v.ddsLoader = host.ddsLoader;
  const uploaded = new WeakMap();
  v.renderer = { properties: { get: (t) => uploaded.get(t) || {} } };
  const tex = await v.loadDdsTexture('/t/hull_diff.dds');
  uploaded.set(tex, { __webglTexture: {}, __version: tex.version });
  v.loadModuleMesh = async () => new THREE.Group();
  const plan = { modules: [{ index: 1, macro: 'struct_arg_cross_01_macro', position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } }] };

  v.loadModuleMesh = async () => { throw new Error('boom'); };
  await assert.rejects(v.loadStationPlan(plan), /boom/);
  assert.ok(!isTextureDataReleased(tex), 'nothing freed after a failed load');

  v.loadModuleMesh = async () => new THREE.Group();
  await v.loadStationPlan(plan);
  assert.ok(isTextureDataReleased(tex), 'uploaded texture data freed after the load');
  tex.needsUpdate = true; // a change after upload: version moves on, so it no longer counts as uploaded
  await v.loadDdsTexture('/t/hull_diff.dds');
  assert.ok(!isTextureDataReleased(tex) && tex.mipmaps[0].data, 'restored when requested again');
  assert.strictEqual(v.releaseUploadedTextureData(), 0, 'a texture whose current version is not uploaded keeps its data');
  console.log('  ✓ plan loads free uploaded texture data afterwards (only on success); later requests restore it');
}

console.log('\n[PASS] test_texture_release');
