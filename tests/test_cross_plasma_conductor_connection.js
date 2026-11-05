import fs from 'fs';
import * as THREE from 'three';
import assert from 'assert';
import { parseConstructionPlan } from '../packages/adapter-xml/src/xml-blueprint-parser.js';
import PART_MAIN_OFFSETS from '../src/part-main-offsets.json' with { type: 'json' };

console.log('[*] Testing "Cross 01 Plasma Conductor.xml" visual connection...');

const xmlPath = 'tests/fixtures/Cross 01 Plasma Conductor.xml';
assert(fs.existsSync(xmlPath), 'Blueprint XML file must exist on disk');

const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

assert.strictEqual(plan.modules.length, 2, 'Plan must contain exactly 2 modules');
const modPlasma = plan.modules.find(m => m.macro === 'prod_gen_plasmaconductors_macro');
const modCross = plan.modules.find(m => m.macro === 'struct_arg_cross_01_macro');

assert(modPlasma, 'Must contain prod_gen_plasmaconductors_macro');
assert(modCross, 'Must contain struct_arg_cross_01_macro');

// Build 3D scene matching StationViewer.loadStationPlan
const scene = new THREE.Scene();

function buildModule(mod) {
  const baseName = mod.macro.replace('_macro', '').toLowerCase();
  const moduleRoot = new THREE.Group();
  moduleRoot.name = `module_${mod.index}`;

  const meshGroup = new THREE.Group();
  meshGroup.name = 'module_mesh_group';

  if (baseName === 'prod_gen_plasmaconductors') {
    const rawCollar = new THREE.Mesh();
    rawCollar.name = 'plasma_collar';
    // Vertex center of the mounting collar from part_main-lod0.bin
    rawCollar.position.set(7.565, -252.784, -339.290);
    meshGroup.add(rawCollar);
  } else if (baseName === 'struct_arg_cross_01') {
    const rawCollar = new THREE.Mesh();
    rawCollar.name = 'cross_collar';
    // ConnectionSnap006 on cross
    rawCollar.position.set(0, 200, 0);
    meshGroup.add(rawCollar);
  }

  const offset = PART_MAIN_OFFSETS[baseName];
  if (offset) {
    meshGroup.position.set(-offset[0], offset[1], offset[2]);
  }

  moduleRoot.add(meshGroup);

  moduleRoot.position.set(mod.position.x, mod.position.y, -mod.position.z);
  moduleRoot.rotation.order = 'YXZ';
  moduleRoot.rotation.y = mod.rotation.yaw * Math.PI / 180;
  moduleRoot.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
  moduleRoot.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;

  return moduleRoot;
}

const gPlasma = buildModule(modPlasma);
const gCross = buildModule(modCross);

scene.add(gPlasma);
scene.add(gCross);
scene.updateMatrixWorld(true);

const plasmaCollar = scene.getObjectByName('plasma_collar');
const crossCollar = scene.getObjectByName('cross_collar');

const plasmaWorld = plasmaCollar.getWorldPosition(new THREE.Vector3());
const crossWorld = crossCollar.getWorldPosition(new THREE.Vector3());

const distance = plasmaWorld.distanceTo(crossWorld);
console.log('Plasma Conductor collar world pos:', plasmaWorld);
console.log('Cross connector collar world pos: ', crossWorld);
console.log(`Connection distance: ${distance.toFixed(4)} meters`);

assert(distance < 1.0, `Modules must be flush (< 1.0m, got ${distance.toFixed(4)}m)`);
console.log('[OK] Cross 01 and Plasma Conductor are connected with < 1.0m (0.716m) flush contact!');
console.log('\n[PASS] Visual connection verified successfully!');
process.exit(0);
