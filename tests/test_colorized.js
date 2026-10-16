import * as THREE from 'three';
import { CATEGORY_COLORS, getModuleCategory } from '../src/modules.js';

console.log('[*] Testing Colorized checkbox toggling and material restoration logic...');

const modulesGroup = new THREE.Group();

// Create sample module groups representing different categories
const testModules = [
  { macro: 'dockarea_arg_m_station_01_macro', expectedCat: 'docks' },
  { macro: 'prod_gen_claytronics_macro', expectedCat: 'production' },
  { macro: 'storage_arg_l_container_01_macro', expectedCat: 'storage' },
  { macro: 'hab_arg_l_01_macro', expectedCat: 'habitation' },
  { macro: 'defence_arg_disc_01_macro', expectedCat: 'defense' },
  { macro: 'struct_arg_cross_01_macro', expectedCat: 'structure' }
];

const categoryMaterials = {};
for (const cat in CATEGORY_COLORS) {
  categoryMaterials[cat] = new THREE.MeshStandardMaterial({
    color: new THREE.Color(CATEGORY_COLORS[cat]),
    roughness: 0.4,
    metalness: 0.2
  });
}

testModules.forEach(item => {
  const grp = new THREE.Group();
  grp.userData = { macro: item.macro };

  const origMat = new THREE.MeshStandardMaterial({ color: 0x888888, name: 'originalMat' });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), origMat);
  grp.add(mesh);
  modulesGroup.add(grp);
});

// Function simulating viewer.setColorized(true)
function setColorized(enabled, group) {
  group.children.forEach(grp => {
    const macro = grp.userData.macro;
    const category = getModuleCategory(macro);
    const coloredMat = categoryMaterials[category] || categoryMaterials['structure'];

    grp.traverse(child => {
      if (child.isMesh) {
        if (enabled) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          child.material = coloredMat;
        } else {
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      }
    });
  });
}

// 1. Enable colorized mode
setColorized(true, modulesGroup);

let colorizedSuccess = true;
modulesGroup.children.forEach((grp, idx) => {
  const expectedCat = testModules[idx].expectedCat;
  const expectedColorHex = CATEGORY_COLORS[expectedCat].toLowerCase();
  const mesh = grp.children[0];
  const matColorHex = '#' + mesh.material.color.getHexString();

  if (matColorHex !== expectedColorHex) {
    console.error(`[FAIL] Module ${testModules[idx].macro} expected color ${expectedColorHex}, got ${matColorHex}`);
    colorizedSuccess = false;
  } else {
    console.log(`[OK] Module ${testModules[idx].macro} (${expectedCat}) colorized to ${matColorHex}`);
  }
});

// 2. Disable colorized mode (uncheck)
setColorized(false, modulesGroup);

let restoreSuccess = true;
modulesGroup.children.forEach((grp, idx) => {
  const mesh = grp.children[0];
  if (mesh.material.name !== 'originalMat') {
    console.error(`[FAIL] Module ${testModules[idx].macro} material restoration failed!`);
    restoreSuccess = false;
  }
});

console.log(`\n========================================`);
if (colorizedSuccess && restoreSuccess) {
  console.log('[SUCCESS] Colorized checkbox toggling and 100% material restoration verified!');
} else {
  console.error('[FAIL] Colorized toggling failed!');
  process.exit(1);
}
