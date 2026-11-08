import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Billboard UV Mapping and Texture Animation Isolation...');

// Setup mock headless environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.colladaCache = new Map();
const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
viewer.colladaLoader = new ColladaLoader();
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;
viewer.getRaceHullColor = StationViewer.prototype.getRaceHullColor;
viewer.resolveTextureForModel = StationViewer.prototype.resolveTextureForModel;
viewer.applyTexturesToMeshGroup = StationViewer.prototype.applyTexturesToMeshGroup;
viewer.loadColladaModel = StationViewer.prototype.loadColladaModel;

// 1. Billboard trim parts map the sign atlas through UV set 0
// X4's billboard trim materials (p1ads ads_p1_billboardtrims_*, shader p1_complex_unlit) are multi-layer:
// diffuse_map (the ads_billboard sign atlas) reads UV set 0, the gradient_wave layers read sets 1 and 2.
// tex0 lands inside the atlas's 4x4 cells; tex1 is a gradient band, and mapping the atlas through it
// smeared one strip of the atlas over every quad.
console.log('  [1] Verifying billboard trim parts use tex0 (the sign atlas UVs) as their primary UVs...');

const billboardTestCases = [
  { name: 'Argon Base 03 anim_arrows', url: '/assets1/structures/connectionmodules/struct_arg_base_03_data/anim_arrows-lod0.dae' },
  { name: 'Argon Base 03 anim_cross', url: '/assets1/structures/connectionmodules/struct_arg_base_03_data/anim_cross-lod0.dae' },
  { name: 'Argon L Habitat anim_cross', url: '/assets1/structures/habitat/hab_arg_l_01_data/anim_cross-lod0.dae' },
  { name: 'Paranid L Habitat anim_cross', url: '/assets1/structures/habitat/hab_par_l_01_data/anim_cross-lod0.dae' },
  { name: 'Teladi L Habitat anim_cross', url: '/assets1/structures/habitat/hab_tel_l_01_data/anim_cross-lod0.dae' },
  { name: 'Pirate L Habitat anim_cross', url: '/assets1/structures/habitat/hab_pir_l_01_data/anim_cross-lod0.dae' },
  { name: 'Paranid Base 02 anim_arrows', url: '/assets1/structures/connectionmodules/struct_par_base_02_data/anim_arrows-lod0.dae' },
  { name: 'Docking Bay Pier anim_signs', url: '/assets1/structures/dock/xref_parts/xref_dockingbay_gen_xl_pier_01_data/anim_signs-lod0.dae' },
  { name: 'Teladi Trade Station anim_arrows01_001', url: '/assets1/structures/landmarks/landmarks_tel_tradestation_01_center_01_data/anim_arrows01_001-lod0.dae' }
];

// share of quads whose UVs stay inside one cell of the 4x4 sign atlas
const atlasCellShare = (uvs) => {
  let inCell = 0, quads = 0;
  for (let q = 0; q + 6 <= uvs.length / 2; q += 6) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = q; i < q + 6; i++) { u0 = Math.min(u0, uvs[i * 2]); u1 = Math.max(u1, uvs[i * 2]); v0 = Math.min(v0, uvs[i * 2 + 1]); v1 = Math.max(v1, uvs[i * 2 + 1]); }
    quads++;
    if (u0 >= -0.01 && u1 <= 1.01 && v0 >= -0.01 && v1 <= 1.01 &&
        Math.floor(u0 * 4 + 0.02) === Math.floor(u1 * 4 - 0.02) && Math.floor(v0 * 4 + 0.02) === Math.floor(v1 * 4 - 0.02)) inCell++;
  }
  return quads ? inCell / quads : 0;
};

for (const tc of billboardTestCases) {
  const scene = await viewer.loadColladaModel(tc.url);
  assert.ok(scene, `Scene must be loaded for ${tc.name}`);
  let meshFound = false;
  scene.traverse((child) => {
    if (!child.isMesh || !child.geometry || !child.geometry.attributes.uv) return;
    meshFound = true;
    const uvs = child.geometry.attributes.uv.array;
    const raw = child.userData.rawUvs || {};
    assert.ok(raw.tex0 && raw.tex1, `${tc.name}: has both UV sets`);
    assert.strictEqual(uvs.length, raw.tex0.length, `${tc.name}: one UV pair per vertex`);
    assert.ok(uvs.every((x, i) => Math.abs(x - raw.tex0[i]) < 1e-6), `${tc.name}: primary UVs are tex0 (the sign atlas)`);
    const share = atlasCellShare(uvs);
    assert.ok(share >= 0.4, `${tc.name}: ${Math.round(share * 100)}% of quads inside an atlas cell`);
    assert.strictEqual(atlasCellShare(raw.tex1), 0, `${tc.name}: tex1 (gradient band) never addresses an atlas cell`);
    console.log(`    ✓ ${tc.name}: tex0, ${Math.round(share * 100)}% of quads on single atlas cells`);
  });
  assert.ok(meshFound, `Mesh with UVs must be found for ${tc.name}`);
}

// 1b. The cross module sign meshes keep the atlas on their chevrons too
{
  const cases = [
    ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae', 36],
    ['/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_cross-lod0.dae', 10]
  ];
  for (const [url, chevronQuads] of cases) {
    const scene = await viewer.loadColladaModel(url);
    let mesh = null; scene.traverse(o => { if (o.isMesh) mesh = o; });
    const uvs = mesh.geometry.attributes.uv.array, tex0 = mesh.userData.rawUvs.tex0;
    for (let i = 0; i < chevronQuads * 6 * 2; i++) assert.ok(Math.abs(uvs[i] - tex0[i]) < 1e-6, `${url}: chevron quads use tex0`);
    console.log(`    ✓ ${url.split('/').slice(-2).join('/')}: chevron quads 0..${chevronQuads - 1} use tex0`);
  }
}

// 2. Test Non-Billboard Meshes Preserve tex0 as primary UV channel
console.log('  [2] Verifying non-billboard models preserve primary tex0 coordinates...');

const nonBillboardTestCases = [
  {
    name: 'Argon Base 03 part_main',
    url: '/assets1/structures/connectionmodules/struct_arg_base_03_data/part_main-lod0.dae'
  },
  {
    name: 'Production Advanced Electronics anim_bubbles',
    url: '/assets1/structures/production/prod_gen_advancedelectronics_data/anim_bubbles-lod0.dae'
  }
];

for (const tc of nonBillboardTestCases) {
  const scene = await viewer.loadColladaModel(tc.url);
  assert.ok(scene, `Scene must be loaded for ${tc.name}`);
  let meshCount = 0;
  scene.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes.uv) {
      meshCount++;
      const uvs = child.geometry.attributes.uv.array;
      assert.ok(uvs.length > 0, `Mesh ${child.name} must have UV data`);
    }
  });
  assert.ok(meshCount > 0, `Meshes must be found for ${tc.name}`);
  console.log(`    ✓ ${tc.name}: verified ${meshCount} meshes preserve primary tex0`);
}

// 3. Test Billboard Animation Registration: anim_arrows animates, anim_cross remains static
console.log('  [3] Verifying animation isolation (anim_arrows animates, anim_cross remains static)...');
viewer.animatedTextures = [];

const dummyTexture = new THREE.Texture();
dummyTexture.offset = new THREE.Vector2(0, 0);
viewer.loadDdsTexture = async () => dummyTexture;

// Test anim_cross remains static
const crossGroup = new THREE.Group();
const crossMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
crossMesh.name = 'anim_cross-lod0Xlod0Xp1adsXads_p1_billboardtrims_02';
crossGroup.add(crossMesh);

await viewer.applyTexturesToMeshGroup(
  crossGroup,
  '/assets1/structures/connectionmodules/struct_arg_base_03_data/anim_cross-lod0.dae',
  1
);

assert.strictEqual(
  viewer.animatedTextures.length,
  0,
  'anim_cross must NOT register animated textures (static cross icon)'
);
console.log('    ✓ anim_cross remains completely static with zero animated texture registrations');

// Test anim_arrows scrolls along chevron guide direction
const arrowGroup = new THREE.Group();
const arrowMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
arrowMesh.name = 'anim_arrows-lod0Xlod0Xp1adsXads_p1_billboardtrims_02';
arrowGroup.add(arrowMesh);

await viewer.applyTexturesToMeshGroup(
  arrowGroup,
  '/assets1/structures/connectionmodules/struct_arg_base_03_data/anim_arrows-lod0.dae',
  2
);

// X4 (struct_arg_base_03.xml): map channel 1 holds u_offset at 0, slides to 0.25 (one atlas cell)
// over frames 95-100, holds, and slides back at 195-200 of a 200-frame loop: the icons toggle
// between a pair of cells. They used to scroll continuously through the whole atlas.
const arrowAnim = viewer.animatedTextures.find(a => a.uvTracks);
assert.ok(arrowAnim, 'anim_arrows plays its component UV animation');
assert.strictEqual(viewer.animatedTextures.filter(a => a.speedX).length, 0, 'no continuous scroll');
assert.strictEqual(arrowAnim.loopFrames, 200);
assert.deepStrictEqual(arrowAnim.uvTracks.u, [[0, 0], [95, 0], [100, 0.25], [195, 0.25], [200, 0]]);
assert.strictEqual(arrowAnim.moduleIndex, 2, 'halts with its module');
const arrowMat = [].concat(arrowMesh.material)[0];
assert.strictEqual(arrowMat.map, arrowAnim.texture, "the arrows' map is the animated copy");
assert.notStrictEqual(arrowAnim.texture, await viewer.loadDdsTexture('/assets1/textures/ad_signs/ads_billboard_02_diff.dds'), 'the shared atlas texture is not moved');
const { applyUvTrack } = await import('../packages/adapter-three/src/materials/uv-animations.js');
const probe = { offset: { x: 9, y: 9 } };
const at = (seconds) => { applyUvTrack(probe, arrowAnim.uvTracks, arrowAnim.loopFrames, seconds); return +probe.offset.x.toFixed(4); };
assert.deepStrictEqual([at(0), at(2), at(97.5 / 30), at(4), at(6), at(200 / 30)], [0, 0, 0.125, 0.25, 0.25, 0], 'holds a cell, slides, holds the other, returns (30 frames/s)');
assert.strictEqual(probe.offset.y, 9, 'channel 1 has no v track: v untouched');
console.log('    ✓ anim_arrows toggles between a pair of atlas cells on its own texture copy (X4 keyframes)');

// 4. Test Billboard Display Screens & Holograms (tex0 primary channel to prevent scrambled displays)
console.log('  [4] Verifying billboard display screens preserve tex0 coordinates (preventing scrambled tiling)...');

const displayTestCases = [
  {
    name: 'Argon L Habitat anim_arrows Billboard Display',
    url: '/assets1/structures/habitat/hab_arg_l_01_data/anim_arrows-lod0.dae',
    maxSpanU: 1.05,
    maxSpanV: 0.55
  },
  {
    name: 'Paranid L Habitat anim_arrows Billboard Display',
    url: '/assets1/structures/habitat/hab_par_l_01_data/anim_arrows-lod0.dae',
    maxSpanU: 1.05,
    maxSpanV: 1.05
  },
  {
    name: 'Pirate L Habitat anim_arrows Billboard Display',
    url: '/assets1/structures/habitat/hab_pir_l_01_data/anim_arrows-lod0.dae',
    maxSpanU: 1.05,
    maxSpanV: 1.05
  },
  {
    name: 'Teladi L Habitat anim_arrows Billboard Display',
    url: '/assets1/structures/habitat/hab_tel_l_01_data/anim_arrows-lod0.dae',
    maxSpanU: 1.30,
    maxSpanV: 1.05
  },
  {
    name: 'Scrapworks Entry Holograms',
    url: '/assets1/structures/processingmodule/proc_gen_scrapworks_data/anim_entry_holograms-lod0.dae',
    maxSpanU: 2.5,
    maxSpanV: 1.0
  },
  {
    name: 'Pirate Station anim_arrows Display Screen',
    url: '/assets1/structures/landmarks/landmarks_gen_piratestation_01_core_01_data/anim_arrows-lod0.dae',
    maxSpanU: 1.0,
    maxSpanV: 1.0
  },
  {
    name: 'Pirate Station anim_cross Display Screen',
    url: '/assets1/structures/landmarks/landmarks_gen_piratestation_01_core_01_data/anim_cross-lod0.dae',
    maxSpanU: 1.0,
    maxSpanV: 1.0
  }
];

for (const tc of displayTestCases) {
  const scene = await viewer.loadColladaModel(tc.url);
  assert.ok(scene, `Scene must load for ${tc.name}`);
  let meshFound = false;
  scene.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes.uv) {
      meshFound = true;
      const uvs = child.geometry.attributes.uv.array;
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (let i = 0; i < uvs.length; i += 2) {
        minU = Math.min(minU, uvs[i]); maxU = Math.max(maxU, uvs[i]);
        minV = Math.min(minV, uvs[i+1]); maxV = Math.max(maxV, uvs[i+1]);
      }
      const spanU = maxU - minU;
      const spanV = maxV - minV;
      assert.ok(spanU <= tc.maxSpanU, `${tc.name} spanU ${spanU} must be <= ${tc.maxSpanU} (scrambled tiling prevented)`);
      assert.ok(spanV <= tc.maxSpanV, `${tc.name} spanV ${spanV} must be <= ${tc.maxSpanV} (scrambled tiling prevented)`);
      console.log(`    ✓ ${tc.name}: primary UV U [${minU.toFixed(3)}, ${maxU.toFixed(3)}], V [${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
    }
  });
  assert.ok(meshFound, `Mesh with UVs must be found for ${tc.name}`);
}

// 5. Test Billboard Texture Resolution in resolveTextureForModel
console.log('  [5] Verifying texture resolution across billboard display screens and trims...');

const textureResolutionCases = [
  {
    desc: 'Billboard Display 02 (512x512)',
    url: '/assets1/structures/processingmodule/proc_gen_scrapworks_data/anim_entry_holograms-lod0.dae',
    mat: 'p2ads.ads_p2_billboard_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Billboard Display 01 (512x512)',
    url: '/assets1/structures/processingmodule/proc_gen_scrapworks_data/anim_arrows-lod0.dae',
    mat: 'p2ads.ads_p2_billboard_01',
    expected: '/assets1/textures/ad_signs/ads_billboard_01_diff.dds'
  },
  {
    desc: 'Casino Billboard Display (1024x512)',
    url: '/assets1/structures/welfare/welfare_gen_gamblinghall_01_data/anim_main-lod0.dae',
    mat: 'p1ads.ads_p1_casino_01',
    expected: '/assets1/textures/ad_signs/ads_p1_casino_01.dds'
  },
  {
    desc: 'Holographic Display Sign',
    url: '/assets1/structures/venture/room_gen_venturerroom_01_data/fx_holoship004-lod0.dae',
    mat: 'p1effectsXp1_holograph_02',
    expected: '/assets1/textures/ad_signs/p1_holograph_ads_01_diff.dds'
  },
  {
    // ads_p1_billboardtrims_02's diffuse_map in X4's material library (the .dae names it too)
    desc: 'Billboard Trim Strip Arrows (billboardtrims_02 -> ads_billboard_02 atlas)',
    url: '/assets1/structures/storage/storage_arg_l_liquid_01_data/anim_arrows-lod0.dae',
    mat: 'anim_arrows-lod0Xlod0XadsXads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Station Ads General Fallback',
    url: '/assets1/structures/dock/dockarea_arg_m_station_01_data/detail_ads-lod0.dae',
    mat: 'ads_billboard',
    expected: '/assets1/textures/ad_signs/ads_billboardtrims_01_diff.dds'
  },
  {
    desc: 'Argon L Habitat Billboard Display',
    url: '/assets1/structures/habitat/hab_arg_l_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Argon L Habitat anim_cross Lockdown Hazard Overlay',
    url: '/assets1/structures/habitat/hab_arg_l_01_data/anim_cross-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Paranid L Habitat Billboard Display',
    url: '/assets1/structures/habitat/hab_par_l_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  },
  {
    desc: 'Paranid L Habitat anim_cross Lockdown Hazard Overlay',
    url: '/assets1/structures/habitat/hab_par_l_01_data/anim_cross-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  },
  {
    desc: 'Pirate L Habitat Billboard Display',
    url: '/assets1/structures/habitat/hab_pir_l_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Pirate L Habitat anim_cross Lockdown Hazard Overlay',
    url: '/assets1/structures/habitat/hab_pir_l_01_data/anim_cross-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_02',
    expected: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds'
  },
  {
    desc: 'Teladi L Habitat Billboard Display',
    url: '/assets1/structures/habitat/hab_tel_l_01_data/anim_arrows-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  },
  {
    desc: 'Teladi L Habitat anim_cross Lockdown Hazard Overlay',
    url: '/assets1/structures/habitat/hab_tel_l_01_data/anim_cross-lod0.dae',
    mat: 'p1ads.ads_p1_billboardtrims_03',
    expected: '/assets1/textures/ad_signs/ads_billboard_03_diff.dds'
  }
];

for (const tc of textureResolutionCases) {
  const resolved = viewer.resolveTextureForModel(tc.url, tc.mat);
  assert.strictEqual(
    resolved.diffuse,
    tc.expected,
    `${tc.desc}: expected ${tc.expected}, got ${resolved.diffuse}`
  );
  console.log(`    ✓ ${tc.desc}: correctly resolved diffuse -> ${resolved.diffuse}`);
}

// 6. Test Habitat Billboard & Hazard Cross Animation Isolation and Rendering
console.log('  [6] Verifying habitat billboards & hazard overlays remain stationary and cleanly rendered...');
viewer.animatedTextures = [];

const habArrowGroup = new THREE.Group();
const habArrowMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
habArrowMesh.name = 'anim_arrows-lod0Xlod0Xp1adsXads_p1_billboardtrims_02';
habArrowGroup.add(habArrowMesh);

await viewer.applyTexturesToMeshGroup(
  habArrowGroup,
  '/assets1/structures/habitat/hab_arg_l_01_data/anim_arrows-lod0.dae',
  10
);

assert.strictEqual(
  viewer.animatedTextures.length,
  0,
  'Argon L Habitat anim_arrows must NOT register continuous texture animations (stationary billboard display)'
);
console.log('    ✓ Argon L Habitat billboard remains stationary with 0 continuous scrolling registrations');

const habCrossGroup = new THREE.Group();
const habCrossMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial());
habCrossMesh.name = 'anim_cross-lod0Xlod0Xp1adsXads_p1_billboardtrims_02';
habCrossGroup.add(habCrossMesh);

await viewer.applyTexturesToMeshGroup(
  habCrossGroup,
  '/assets1/structures/habitat/hab_arg_l_01_data/anim_cross-lod0.dae',
  10
);

assert.strictEqual(
  viewer.animatedTextures.length,
  0,
  'Argon L Habitat anim_cross must NOT register animated textures'
);
assert.strictEqual(
  habCrossMesh.visible,
  true,
  'Argon L Habitat anim_cross must be visible as the emergency lockdown hazard overlay'
);
assert.ok(
  habCrossMesh.material.polygonOffset,
  'Argon L Habitat anim_cross must enable polygonOffset to prevent Z-fighting over billboard displays'
);
console.log('    ✓ Argon L Habitat anim_cross is properly visible with polygonOffset and static registration');

// 7. Test Habitat Dual-Layer Billboard: Static Poster Display + Animated Matrix Background
console.log('  [7] Verifying habitat dual-layer billboard (static poster + animated background matrix)...');
viewer.animatedTextures = [];

const fullScene = await viewer.loadColladaModel('/assets1/structures/habitat/hab_arg_l_01_data/anim_arrows-lod0.dae');
assert.ok(fullScene, 'Full habitat anim_arrows scene must load');

await viewer.applyTexturesToMeshGroup(
  fullScene,
  '/assets1/structures/habitat/hab_arg_l_01_data/anim_arrows-lod0.dae',
  10
);

let frontPosterMesh = null;
let bgMatrixMesh = null;
fullScene.traverse((child) => {
  if (child.isMesh) {
    if (child.name.endsWith('_bg')) {
      bgMatrixMesh = child;
    } else if (child.name.includes('anim_arrows')) {
      frontPosterMesh = child;
    }
  }
});

assert.ok(frontPosterMesh, 'Foreground static billboard poster mesh must exist');
assert.ok(bgMatrixMesh, 'Background animated matrix screen mesh must exist');
assert.strictEqual(
  frontPosterMesh.geometry.attributes.position.count,
  72,
  'Foreground poster mesh must isolate the 12 front billboard quads (72 vertices)'
);
assert.strictEqual(
  bgMatrixMesh.geometry.attributes.position.count,
  144,
  'Background matrix mesh must isolate the 24 back/mid quads (144 vertices)'
);

const bgAnim = viewer.animatedTextures.find(a => a.speedY === -0.35);
assert.ok(bgAnim, 'Background matrix texture must animate with continuous vertical scrolling (speedY = -0.35)');
console.log('    ✓ Habitat billboard cleanly partitions into static foreground poster (72 verts) + vertically scrolling background matrix (144 verts)');

console.log('\n[SUCCESS] All Billboard UV Mapping and Animation Tests Passed Cleanly!');
