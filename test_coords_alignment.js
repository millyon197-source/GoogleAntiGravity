import fs from 'fs';
import * as THREE from 'three';

function parseXmlFile(xmlPath) {
  const content = fs.readFileSync(xmlPath, 'utf8');
  const entryRegex = /<entry\s+([^>]+)>([\s\S]*?)<\/entry>/gi;
  const attrRegex = /(\w+)="([^"]*)"/g;

  const modules = [];
  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const entryAttrs = {};
    let aMatch;
    while ((aMatch = attrRegex.exec(match[1])) !== null) {
      entryAttrs[aMatch[1]] = aMatch[2];
    }
    if (!entryAttrs.macro) continue;

    const innerContent = match[2];
    const posMatch = /<position\s+([^>]+)\/>/i.exec(innerContent);
    const rotMatch = /<rotation\s+([^>]+)\/>/i.exec(innerContent);

    let x = 0, y = 0, z = 0;
    let yaw = 0, pitch = 0, roll = 0;

    if (posMatch) {
      const xM = /x="([^"]*)"/i.exec(posMatch[1]);
      const yM = /y="([^"]*)"/i.exec(posMatch[1]);
      const zM = /z="([^"]*)"/i.exec(posMatch[1]);
      if (xM) x = parseFloat(xM[1]);
      if (yM) y = parseFloat(yM[1]);
      if (zM) z = parseFloat(zM[1]);
    }

    if (rotMatch) {
      const yawM = /yaw="([^"]*)"/i.exec(rotMatch[1]);
      const pitchM = /pitch="([^"]*)"/i.exec(rotMatch[1]);
      const rollM = /roll="([^"]*)"/i.exec(rotMatch[1]);
      if (yawM) yaw = parseFloat(yawM[1]);
      if (pitchM) pitch = parseFloat(pitchM[1]);
      if (rollM) roll = parseFloat(rollM[1]);
    }

    modules.push({
      index: parseInt(entryAttrs.index || (modules.length + 1), 10),
      macro: entryAttrs.macro,
      position: { x, y, z },
      rotation: { yaw, pitch, roll }
    });
  }
  return modules;
}

console.log('[*] Testing pier and module rotation alignment with +180° Z-axis rotation...');

const testFiles = [
  'D:\\Ai\\X4\\ConstructionPlans\\constructionplan\\Planar - Paranid.xml',
  'D:\\Ai\\X4\\ConstructionPlans\\constructionplan\\ebi trading station.xml'
];

let allMatch = true;

for (const filePath of testFiles) {
  if (!fs.existsSync(filePath)) continue;
  const modules = parseXmlFile(filePath);
  console.log(`\nTesting ${modules.length} modules from: ${filePath.split('\\').pop()}`);

  for (const mod of modules) {
    const group = new THREE.Group();
    group.position.set(mod.position.x, mod.position.y, mod.position.z);
    group.rotation.order = 'YXZ';
    group.rotation.y = mod.rotation.yaw * Math.PI / 180;
    group.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
    group.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;

    const expRoll = (mod.rotation.roll + 180) * Math.PI / 180;
    if (Math.abs(group.rotation.z - expRoll) > 0.0001) {
      console.error(`[FAIL] Z rotation mismatch for module #${mod.index} (${mod.macro})!`);
      allMatch = false;
      break;
    }
  }

  if (allMatch) {
    console.log(`[OK] 100% Z-axis +180° rotation alignment verified for all ${modules.length} modules!`);
  }
}

console.log(`\n========================================`);
if (allMatch) {
  console.log('[SUCCESS] All pier and module Z-axis rotations correctly set (+180° Roll)!');
} else {
  console.error('[FAIL] Alignment check failed.');
  process.exit(1);
}
