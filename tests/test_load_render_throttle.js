/**
 * While a plan loads, renderScene spaces frames out instead of redrawing the whole scene every time
 * it is asked (the texturing code asks once per cross module, the animation loop every frame): a
 * 585-module plan spent 119 of 139 s drawing. Outside loads every call draws, and the finished
 * station is drawn once at the end of a load when a frame was skipped.
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
const { StationViewer } = await import('../src/viewer.js');

console.log('[*] Testing frame throttling during plan loads...');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end) { /* a frame */ } };

function makeViewer(frameMs) {
  const v = Object.create(StationViewer.prototype);
  v.scene = new THREE.Scene();
  v.camera = new THREE.PerspectiveCamera();
  v.modulesGroup = new THREE.Group();
  v.scene.add(v.modulesGroup);
  v.hiddenMacros = new Set();
  for (const name of ['clear', 'clearFilterHighlights', 'fitCameraToStation', 'restoreFullPlanGrid', 'updatePlotBoxViolations', 'buildModuleSnapPoints']) v[name] = () => {};
  v.getModuleInitialSize = () => new THREE.Vector3(1, 1, 1);
  v.frames = [];
  v.composer = { render: () => { v.frames.push({ at: performance.now(), loading: v.planLoading === true, modules: v.modulesGroup.children.length }); busy(frameMs); } };
  v.bloomEnabled = true;
  return v;
}
const plan = (n) => ({ modules: Array.from({ length: n }, (_, i) => ({ index: i + 1, macro: 'struct_arg_cross_01_macro', position: { x: i * 5000, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } })) });

// 1. Requests during a load: each module asks for a redraw (as the cross-sign texturing does)
{
  const v = makeViewer(20);
  let asked = 0;
  v.loadModuleMesh = async () => { asked++; v.renderScene(); await sleep(60); return new THREE.Group(); };
  const t = performance.now();
  await v.loadStationPlan(plan(80));
  const elapsed = performance.now() - t;
  const during = v.frames.filter(f => f.loading);
  assert.strictEqual(asked, 80, 'every module asked for a frame');
  assert.ok(during.length >= 2 && during.length < 12, `frames spaced out during the load (${during.length} drawn for 80 requests)`);
  for (let i = 1; i < during.length; i++) assert.ok(during[i].at - during[i - 1].at >= 240, 'at least 250 ms (or 4 frame times) between frames');
  assert.ok(during.length * 20 <= elapsed * 0.3, 'drawing takes a small share of the load');
  const last = v.frames[v.frames.length - 1];
  assert.ok(!last.loading && last.modules === 80, 'the finished station is drawn once at the end');
  assert.strictEqual(v.planLoading, false);
  console.log(`  ✓ ${during.length} frames drawn for 80 redraw requests during the load, then the finished station`);
}

// 2. Slow frames are spaced further apart (4 frame times)
{
  const v = makeViewer(120);
  v.loadModuleMesh = async () => { v.renderScene(); await sleep(150); return new THREE.Group(); };
  await v.loadStationPlan(plan(40));
  const during = v.frames.filter(f => f.loading);
  assert.ok(during.length >= 2, `several frames during the load (${during.length})`);
  for (let i = 1; i < during.length; i++) assert.ok(during[i].at - during[i - 1].at >= 4 * 120 + 100, 'gap of four frame times after a slow frame');
  console.log(`  ✓ slow frames (120 ms) are at least four frame times apart during a load (${during.length} drawn)`);
}

// 3. Outside a load every request draws; a failed load still ends the throttling
{
  const v = makeViewer(1);
  v.renderScene(); v.renderScene(); v.renderScene();
  assert.strictEqual(v.frames.length, 3, 'no throttling outside a load');
  v.loadModuleMesh = async (mod) => { v.renderScene(); if (mod.index === 3) throw new Error('boom'); return new THREE.Group(); };
  await assert.rejects(v.loadStationPlan(plan(5)), /boom/);
  assert.strictEqual(v.planLoading, false, 'throttling ends when a load fails');
  const before = v.frames.length;
  v.renderScene(); v.renderScene();
  assert.strictEqual(v.frames.length, before + 2, 'every request draws again after the failed load');
  console.log('  ✓ no throttling outside loads, including after a failed load');
}

console.log('\n[PASS] test_load_render_throttle');
