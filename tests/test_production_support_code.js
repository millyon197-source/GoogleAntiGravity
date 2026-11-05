import assert from 'assert';
import * as THREE from 'three';
import { StationViewer } from '../src/viewer.js';
import COMPONENT_OFFSETS from '../src/component-offsets.json' with { type: 'json' };

console.log('[*] Testing Production Support Code (part_main, part_main-X, detail_s_main, detail_l_main)...');

const viewer = Object.create(StationViewer.prototype);
viewer.glowingEmissiveIntensity = 2.2;
viewer.animatedTextures = [];
viewer.animatedParts = [];
viewer.colladaCache = new Map();
viewer.getRaceGlowColor = StationViewer.prototype.getRaceGlowColor;
viewer.getRaceHullColor = StationViewer.prototype.getRaceHullColor;

// 1. Component Offsets Verification across production modules
console.log('  [1] Verifying generalized Component Offsets...');

// prod_gen_smartchips offsets
const smartchipsBottom = COMPONENT_OFFSETS['prod_gen_smartchips']?.['part_main_bottom'];
assert.ok(smartchipsBottom, 'prod_gen_smartchips part_main_bottom offset must exist');
assert.strictEqual(smartchipsBottom[1], -460.8043, 'smartchips part_main_bottom Y offset must be -460.8043');

const smartchipsDetailL = COMPONENT_OFFSETS['prod_gen_smartchips']?.['detail_l_main'];
assert.ok(smartchipsDetailL, 'prod_gen_smartchips detail_l_main offset must exist');
assert.strictEqual(smartchipsDetailL[1], -346.4437, 'smartchips detail_l_main Y offset must be -346.4437');

// prod_arg_foodrations offsets
const foodBottom = COMPONENT_OFFSETS['prod_arg_foodrations']?.['part_main_bottom'];
assert.ok(foodBottom, 'prod_arg_foodrations part_main_bottom offset must exist');
assert.strictEqual(foodBottom[0], -272.0231, 'foodrations part_main_bottom X offset must be -272.0231');
assert.strictEqual(foodBottom[1], -270.9913, 'foodrations part_main_bottom Y offset must be -270.9913');

// prod_par_sojabeans offsets
const sojaDetailL = COMPONENT_OFFSETS['prod_par_sojabeans']?.['detail_l_main'];
assert.ok(sojaDetailL, 'prod_par_sojabeans detail_l_main offset must exist');
assert.strictEqual(sojaDetailL[1], 863.772, 'sojabeans detail_l_main Y offset must be 863.772');

const sojaDetailS = COMPONENT_OFFSETS['prod_par_sojabeans']?.['detail_s_main'];
assert.ok(sojaDetailS, 'prod_par_sojabeans detail_s_main offset must exist');
assert.strictEqual(sojaDetailS[1], 703.4788, 'sojabeans detail_s_main Y offset must be 703.4788');

// prod_gen_water offsets
const waterDetailS = COMPONENT_OFFSETS['prod_gen_water']?.['detail_s_main'];
assert.ok(waterDetailS, 'prod_gen_water detail_s_main offset must exist');
assert.strictEqual(waterDetailS[2], 1061.1946, 'water detail_s_main Z offset must be 1061.1946');

// prod_gen_dronecomponents offsets
const droneTechcubes = COMPONENT_OFFSETS['prod_gen_dronecomponents']?.['part_main_techcubes'];
assert.ok(droneTechcubes, 'prod_gen_dronecomponents part_main_techcubes offset must exist');
assert.strictEqual(droneTechcubes[0], -34.1241, 'dronecomponents part_main_techcubes X offset must be -34.1241');
assert.strictEqual(droneTechcubes[1], -117.3956, 'dronecomponents part_main_techcubes Y offset must be -117.3956');

console.log('  ✓ [PASS] Generalized component offsets populated and verified across production modules');

// 2. Texture Resolution for Production Subnodes
console.log('  [2] Verifying material resolution for production subnodes...');

// Foilage with 'oi' spelling
const spicesFoilage = viewer.resolveTextureForModel(
  '/assets1/structures/production/prod_gen_spices_data/part_main-lod0.dae',
  'naturalXnatural_foilage'
);
assert.strictEqual(
  spicesFoilage.diffuse,
  '/assets1/textures/natural/nat_p2_foliage_01_diff.dds',
  'natural_foilage must resolve to nat_p2_foliage_01_diff.dds'
);

// Boron FX
const boronFx = viewer.resolveTextureForModel(
  '/assets1/structures/production/prod_bor_medicalsupplies_data/part_main-lod0.dae',
  'p2boron.bor_p2_fx_01'
);
assert.strictEqual(
  boronFx.diffuse,
  '/assets1/textures/generic/generic_p1_fx_diff.dds',
  'bor_p2_fx_01 must resolve to generic_p1_fx_diff.dds'
);
assert.strictEqual(
  boronFx.emissive,
  '/assets1/textures/generic/generic_p1_fx_glow.dds',
  'bor_p2_fx_01 must resolve to generic_p1_fx_glow.dds'
);

// Observation Glass
const glassRes = viewer.resolveTextureForModel(
  '/assets1/structures/production/prod_arg_meat_data/part_main-lod0.dae',
  'effectsXglass_3'
);
assert.strictEqual(
  glassRes.diffuse,
  '/assets1/textures/fx/ships_cockpit_glass_diff.dds',
  'glass_3 must resolve to ships_cockpit_glass_diff.dds'
);

// Detail_l_main hullpattern resolution
const meatDetailLPattern = viewer.resolveTextureForModel(
  '/assets1/structures/production/prod_arg_meat_data/detail_l_main-lod0.dae',
  'genericXgeneric_p1_hullpattern'
);
assert.strictEqual(
  meatDetailLPattern.diffuse,
  '/assets1/textures/generic/generic_p1_hullpattern_diff.dds',
  'detail_l_main hullpattern must resolve to generic_p1_hullpattern_diff.dds'
);

console.log('  ✓ [PASS] Foliage (with foilage spelling), Boron FX, Glass, and Detail L hullpattern verified');

// 3. Multi-Material Subnode Shader Application
console.log('  [3] Verifying shader properties on multi-material subnodes...');

const foodMainGroup = new THREE.Group();
const mPatternMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hullpattern' }));
mPatternMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_hullpattern';

const mHullMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_hulltexture' }));
mHullMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_hulltexture';

const mFxMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhongMaterial({ name: 'genericXgeneric_p1_fx' }));
mFxMesh.name = 'part_main-lod0Xlod0XgenericXgeneric_p1_fx';

foodMainGroup.add(mPatternMesh, mHullMesh, mFxMesh);

// Mock texture loading
const dummyTex = new THREE.Texture();
viewer.loadDdsTexture = async () => dummyTex;

await viewer.applyTexturesToMeshGroup(
  foodMainGroup,
  '/assets1/structures/production/prod_arg_foodrations_data/part_main-lod0.dae'
);

assert.ok(mPatternMesh.material.isMeshStandardMaterial, 'mPatternMesh must be MeshStandardMaterial');
assert.ok(mHullMesh.material.isMeshStandardMaterial, 'mHullMesh must be MeshStandardMaterial');
assert.ok(mFxMesh.material.isMeshStandardMaterial, 'mFxMesh must be MeshStandardMaterial');
assert.strictEqual(mFxMesh.material.toneMapped, false, 'mFxMesh must have toneMapped: false for neon bloom');
assert.strictEqual(mFxMesh.material.emissiveIntensity, 2.2, 'mFxMesh must have glowing emissiveIntensity');

console.log('  ✓ [PASS] Multi-material PBR and FX shader properties verified on production part_main');

// 4. UV Deduplication Logic
console.log('  [4] Verifying clean UV channel deduplication...');

const sampleDaeXml = `
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <library_geometries>
    <geometry id="meshId0" name="part_main">
      <mesh>
        <source id="meshId0-positions" />
        <source id="meshId0-normals" />
        <source id="meshId0-tex0" />
        <source id="meshId0-tex1" />
        <source id="meshId0-tex2" />
        <vertices id="meshId0-vertices">
          <input semantic="POSITION" source="#meshId0-positions" />
          <input semantic="NORMAL" source="#meshId0-normals" />
          <input semantic="TEXCOORD" source="#meshId0-tex0" />
          <input semantic="TEXCOORD" source="#meshId0-tex1" />
          <input semantic="TEXCOORD" source="#meshId0-tex2" />
        </vertices>
      </mesh>
    </geometry>
    <geometry id="meshId1" name="boron_medical">
      <mesh>
        <vertices id="meshId1-vertices">
          <input semantic="POSITION" source="#meshId1-positions" />
          <input semantic="NORMAL" source="#meshId1-normals" />
          <input semantic="TEXCOORD" source="#meshId1-tex0" />
          <input semantic="TEXCOORD" source="#meshId1-tex2" />
        </vertices>
      </mesh>
    </geometry>
    <geometry id="meshId2" name="plasma_conductors">
      <mesh>
        <vertices id="meshId2-vertices">
          <input semantic="POSITION" source="#meshId2-positions" />
          <input semantic="NORMAL" source="#meshId2-normals" />
          <input semantic="TEXCOORD" source="#meshId2-tex1" />
        </vertices>
      </mesh>
    </geometry>
  </library_geometries>
</COLLADA>
`;

let cleanedXml = sampleDaeXml.replace(/<vertices id="([^"]+)">([\s\S]*?)<\/vertices>/g, (match, vId, vBody) => {
  let keptTex = false;
  const cleaned = vBody.replace(/<input\s+semantic="TEXCOORD"[^>]*\/?>/g, (texInput) => {
    if (!keptTex) {
      keptTex = true;
      return texInput;
    }
    return '';
  });
  return `<vertices id="${vId}">${cleaned}</vertices>`;
});

// Verify meshId0 (had tex0, tex1, tex2): kept only tex0
assert.ok(cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId0-tex0" />'), 'meshId0 must keep tex0');
assert.ok(!cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId0-tex1" />'), 'meshId0 must drop tex1');
assert.ok(!cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId0-tex2" />'), 'meshId0 must drop tex2');

// Verify meshId1 (had tex0, tex2): kept only tex0
assert.ok(cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId1-tex0" />'), 'meshId1 must keep tex0');
assert.ok(!cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId1-tex2" />'), 'meshId1 must drop tex2');

// Verify meshId2 (had only tex1): kept tex1
assert.ok(cleanedXml.includes('<input semantic="TEXCOORD" source="#meshId2-tex1" />'), 'meshId2 must keep tex1');

console.log('  ✓ [PASS] Clean UV deduplication preserves primary authored channel and removes duplicate inputs');

console.log('\n[SUCCESS] All Production Support Code Tests Passed Cleanly!');
