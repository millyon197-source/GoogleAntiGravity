/**
 * anim_cross masks anim_arrows (as in X4): the arrows' toggling icons show only where the module's
 * anim_cross backings and screens are drawn. Stencil: anim_cross writes, anim_arrows tests.
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
const { applyArrowMasks, ARROW_MASK_STENCIL_REF, loadModuleMesh } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
const { materialShareKey } = await import('../packages/adapter-three/src/materials/material-sharing.js');

console.log('[*] Testing the anim_cross mask on anim_arrows...');

const part = (name, ...children) => { const g = new THREE.Group(); g.name = name; g.userData.partName = name; children.forEach(c => g.add(c)); return g; };
const mesh = (name, mat = new THREE.MeshStandardMaterial()) => { const m = new THREE.Mesh(new THREE.BoxGeometry(), mat); m.name = name; return m; };

// 1. A module with both parts
{
  const crossMesh = mesh('anim_cross_mesh', new THREE.MeshStandardMaterial({ transparent: true }));
  const screen = mesh('bg_cross', new THREE.MeshBasicMaterial({ transparent: true })); screen.renderOrder = 1;
  crossMesh.add(screen);
  const arrowsMesh = mesh('anim_arrows_mesh'); // opaque, as some trim materials are
  const sign = mesh('billboard_cross', new THREE.MeshStandardMaterial({ transparent: true })); sign.renderOrder = 2;
  arrowsMesh.add(sign);
  const hull = mesh('hull');
  const root = new THREE.Group();
  root.add(part('part_main', hull), part('anim_cross', crossMesh), part('anim_arrows', arrowsMesh));

  assert.strictEqual(applyArrowMasks(root), true);
  for (const m of [crossMesh, screen]) {
    const mat = m.material;
    assert.ok(mat.stencilWrite && mat.stencilRef === ARROW_MASK_STENCIL_REF, `${m.name} writes the mask`);
    assert.strictEqual(mat.stencilFunc, THREE.AlwaysStencilFunc);
    assert.strictEqual(mat.stencilZPass, THREE.ReplaceStencilOp);
    assert.ok(m.renderOrder <= 1, `${m.name} drawn before the arrows`);
  }
  for (const m of [arrowsMesh, sign]) {
    const mat = m.material;
    assert.ok(mat.stencilWrite && mat.stencilRef === ARROW_MASK_STENCIL_REF, `${m.name} tests the mask`);
    assert.strictEqual(mat.stencilFunc, THREE.EqualStencilFunc, `${m.name} drawn only where the mask is`);
    assert.strictEqual(mat.stencilZPass, THREE.KeepStencilOp, `${m.name} leaves the mask unchanged`);
    assert.strictEqual(mat.stencilWriteMask, 0);
    assert.strictEqual(mat.transparent, true, `${m.name} drawn in the transparent pass, after the masks`);
    assert.ok(m.renderOrder >= 3, `${m.name} drawn after the masks`);
  }
  assert.strictEqual(hull.material.stencilWrite, false, 'other parts untouched');
  assert.strictEqual(hull.renderOrder, 0);
  // Masked, masking and plain materials are never merged when materials are shared
  const plain = new THREE.MeshStandardMaterial({ transparent: true });
  const keys = [materialShareKey(arrowsMesh.material, arrowsMesh), materialShareKey(crossMesh.material, crossMesh), materialShareKey(plain, hull)];
  assert.strictEqual(new Set(keys).size, 3, 'stencil settings are part of the share key');
  console.log('  ✓ anim_cross writes the mask; anim_arrows (signs included) draws only there, after it');
}

// 2. Modules without both parts are left alone
{
  const arrowsOnly = new THREE.Group(); const m = mesh('anim_arrows_mesh'); arrowsOnly.add(part('anim_arrows', m));
  assert.strictEqual(applyArrowMasks(arrowsOnly), false);
  assert.strictEqual(m.material.stencilWrite, false, 'arrows without an anim_cross stay visible');
  console.log('  ✓ modules with arrows but no anim_cross are not masked');
}

// 3. loadModuleMesh applies it to assembled modules
{
  const fakePart = (name) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())); return g; };
  const host = {
    glowingEmissiveIntensity: 2.2, animatedParts: [],
    resolveModuleAssetEntry: () => ({ baseName: 'struct_x', folderPath: '/x/struct_x_data', defaultFiles: ['part_main-lod0.dae', 'anim_cross-lod0.dae', 'anim_arrows-lod0.dae'] }),
    getModuleActiveComponentFiles: () => ['part_main-lod0.dae', 'anim_cross-lod0.dae', 'anim_arrows-lod0.dae'],
    loadCachedScene: async (url) => fakePart(url),
    loadColladaModel: async () => { throw new Error('not expected'); },
    loadBinaryModel: async () => { throw new Error('not expected'); },
    applyTexturesToMeshGroup: async () => {}
  };
  const root = await loadModuleMesh(host, { macro: 'struct_x_macro', index: 1 }, { log: () => {} });
  const byPart = {}; root.traverse(o => { if (o.userData.partName) byPart[o.userData.partName] = o; });
  assert.strictEqual(byPart.anim_arrows.children[0].material.stencilFunc, THREE.EqualStencilFunc);
  assert.strictEqual(byPart.anim_cross.children[0].material.stencilFunc, THREE.AlwaysStencilFunc);
  assert.strictEqual(byPart.part_main.children[0].material.stencilWrite, false);
  console.log('  ✓ loadModuleMesh sets up the mask for modules that have both parts');
}

// 4. anim_cross's third UV set projected onto the arrows (the reveal reads it as 'uv3')
{
  const { projectCrossUvsOntoArrows, applyArrowReveal } = await import('../packages/adapter-three/src/models/module-mesh-loader.js');
  // anim_cross window: a 40 x 6 quad in the z=0 plane, tex2 u along x (0..2), v along y (-6..6)
  const quad = (x0, x1, y0, y1, z) => new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y0, z]);
  const crossGeo = new THREE.BufferGeometry(); crossGeo.setAttribute('position', new THREE.BufferAttribute(quad(0, 40, 0, 6, 0), 3));
  const cross = new THREE.Mesh(crossGeo, new THREE.MeshBasicMaterial());
  cross.userData.rawUvs = { tex2: new Float32Array([0, -6, 2, -6, 2, 6, 2, 6, 0, 6, 0, -6]) };
  // an arrow quad slightly in front of it (z=0.4), x 10..20, y 1.5..4.5
  const arrowGeo = new THREE.BufferGeometry(); arrowGeo.setAttribute('position', new THREE.BufferAttribute(quad(10, 20, 1.5, 4.5, 0.4), 3));
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial());
  assert.strictEqual(projectCrossUvsOntoArrows(cross, arrow), true);
  const uv3 = Array.from(arrow.geometry.attributes.uv3.array).map(x => +x.toFixed(4));
  assert.deepStrictEqual(uv3, [0.5, -3, 1, -3, 1, 3, 1, 3, 0.5, 3, 0.5, -3], "each arrow vertex gets anim_cross's tex2 at that point");
  // the transforms of both meshes are honoured
  const crossRoot = new THREE.Group(); crossRoot.position.set(100, 0, 0); crossRoot.add(cross);
  const arrowRoot = new THREE.Group(); arrowRoot.position.set(100, 0, 0); arrowRoot.add(arrow);
  arrow.geometry.deleteAttribute('uv3');
  projectCrossUvsOntoArrows(cross, arrow);
  assert.deepStrictEqual(Array.from(arrow.geometry.attributes.uv3.array).map(x => +x.toFixed(4)), uv3, 'same result when both parts are moved together');
  // without raw UVs nothing is done
  const bare = new THREE.Mesh(crossGeo, new THREE.MeshBasicMaterial());
  assert.strictEqual(projectCrossUvsOntoArrows(bare, arrow), false);
  // no loadDdsTexture: the reveal is skipped, the mask still applies
  assert.strictEqual(await applyArrowReveal({}, new THREE.Group()), 0);
  console.log("  ✓ arrow vertices get anim_cross's third UV set from the triangle they lie on");
}

console.log('\n[PASS] test_arrow_mask');
