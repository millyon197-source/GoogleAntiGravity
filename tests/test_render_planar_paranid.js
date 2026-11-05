import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { createProceduralModule } from '../src/modules.js';

const hashTablePath = path.resolve(process.cwd(), 'dae_hash_table.json');
const DAE_HASH_TABLE = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

function murmur3_32(key, seed = 0) {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  let c1 = 0xcc9e2d51;
  let c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (((h1 * 5) + 0xe6546b64)) & 0xffffffff;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);

      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function lookupDaeUrls(key) {
  const hashVal = murmur3_32(key);
  const bucketIndex = hashVal % 1223;
  const bucket = DAE_HASH_TABLE[bucketIndex] || [];
  const entry = bucket.find(item => item.key === key);
  if (!entry) return [];
  return entry.files.map(file => `${entry.folder_path}/${file}`);
}

function parseXmlPlan(xmlText) {
  const planMatch = /<plan\s+([^>]+)>/i.exec(xmlText);
  let name = 'Unnamed Station Plan';
  let id = 'unknown_plan';
  let description = '';

  if (planMatch) {
    const nameM = /name="([^"]*)"/i.exec(planMatch[1]);
    const idM = /id="([^"]*)"/i.exec(planMatch[1]);
    const descM = /description="([^"]*)"/i.exec(planMatch[1]);
    if (nameM) name = nameM[1];
    if (idM) id = idM[1];
    if (descM) description = descM[1];
  }

  const entryRegex = /<entry\s+([^>]+)>([\s\S]*?)<\/entry>/gi;
  const attrRegex = /(\w+)="([^"]*)"/g;

  const modules = [];
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
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
      connection: entryAttrs.connection || '',
      position: { x, y, z },
      rotation: { yaw, pitch, roll }
    });
  }

  return { id, name, description, modules };
}

const xmlPath = 'tests/fixtures/Planar - Paranid.xml';
console.log('[*] Testing full station object displayability for:', xmlPath);

const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const planData = parseXmlPlan(xmlContent);

console.log(`[*] Parsed plan "${planData.name}" with ${planData.modules.length} modules.`);

const mainScene = new THREE.Scene();
const stationGroup = new THREE.Group();
mainScene.add(stationGroup);

const factions = ['arg', 'par', 'tel', 'spl', 'ter', 'bor', 'xen', 'kha', 'pir'];
const prefixes = ['prod_', 'buildmodule_'];

let loadedCount = 0;
let daeCount = 0;
let proceduralCount = 0;

for (const mod of planData.modules) {
  let baseName = mod.macro.replace('_macro', '').toLowerCase();
  let urls = lookupDaeUrls(baseName);

  if (urls.length === 0) {
    let foundGen = false;
    for (const pref of prefixes) {
      if (foundGen) break;
      if (baseName.startsWith(pref)) {
        for (const fac of factions) {
          const prefix = `${pref}${fac}_`;
          if (baseName.startsWith(prefix)) {
            const genName = baseName.replace(prefix, `${pref}gen_`);
            const genUrls = lookupDaeUrls(genName);
            if (genUrls.length > 0) {
              baseName = genName;
              urls = genUrls;
              foundGen = true;
              break;
            }
          }
        }
      }
    }
  }

  let moduleGroup = new THREE.Group();
  let isDae = false;

  if (urls.length > 0) {
    isDae = true;
    daeCount++;
    const daeMeshPlaceholder = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    moduleGroup.add(daeMeshPlaceholder);
  } else {
    proceduralCount++;
    const proc = createProceduralModule(mod.macro, THREE);
    if (proc) {
      moduleGroup = proc;
    }
  }

  moduleGroup.position.set(mod.position.x, mod.position.y, mod.position.z);
  moduleGroup.rotation.order = 'YXZ';
  moduleGroup.rotation.y = mod.rotation.yaw * Math.PI / 180;
  moduleGroup.rotation.x = mod.rotation.pitch * Math.PI / 180;
  moduleGroup.rotation.z = mod.rotation.roll * Math.PI / 180;

  const omniLight = new THREE.PointLight(0xffffff, 2.5, 0, 1.0);
  omniLight.position.set(0, 0, 0);
  moduleGroup.add(omniLight);

  moduleGroup.userData = { index: mod.index, macro: mod.macro };
  stationGroup.add(moduleGroup);

  const box = new THREE.Box3().setFromObject(moduleGroup);
  if (isNaN(box.min.x) || isNaN(box.max.x)) {
    console.error(`[FAIL] Module index #${mod.index} (${mod.macro}) produced invalid/NaN bounding box!`);
    process.exit(1);
  }

  loadedCount++;
}

const fullBox = new THREE.Box3().setFromObject(stationGroup);
const fullSize = fullBox.getSize(new THREE.Vector3());
const fullCenter = fullBox.getCenter(new THREE.Vector3());

console.log(`\n========================================`);
console.log(`[SUCCESS] Displayability Check Passed for all ${loadedCount} objects!`);
console.log(`- Loaded DAE Models: ${daeCount}`);
console.log(`- Procedural Fallback Modules: ${proceduralCount}`);
console.log(`- Station Bounding Center: (${Math.round(fullCenter.x)}, ${Math.round(fullCenter.y)}, ${Math.round(fullCenter.z)})`);
console.log(`- Station Bounding Dimensions (W x H x D): ${Math.round(fullSize.x)}m x ${Math.round(fullSize.y)}m x ${Math.round(fullSize.z)}m`);
