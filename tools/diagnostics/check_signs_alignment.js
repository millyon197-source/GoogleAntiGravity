import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;

import * as THREE from 'three';
import { StationViewer } from '../../src/viewer.js';

const viewer = Object.create(StationViewer.prototype);
const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
viewer.colladaLoader = new ColladaLoader();
viewer.colladaCache = new Map();
viewer.loadColladaModel = StationViewer.prototype.loadColladaModel;

const arrowsScene = await viewer.loadColladaModel('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_arrows-lod0.dae');
const crossScene = await viewer.loadColladaModel('/assets1/structures/connectionmodules/struct_arg_cross_01_data/anim_cross-lod0.dae');

let arrowMesh, crossMesh;
arrowsScene.traverse(c => { if (c.isMesh) arrowMesh = c; });
crossScene.traverse(c => { if (c.isMesh) crossMesh = c; });

const aPos = arrowMesh.geometry.attributes.position;
const cPos = crossMesh.geometry.attributes.position;

function getCenter(posAttr, quads) {
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (const q of quads) {
    for (let k = 0; k < 6; k++) {
      const idx = q * 6 + k;
      cx += posAttr.getX(idx);
      cy += posAttr.getY(idx);
      cz += posAttr.getZ(idx);
      count++;
    }
  }
  return { x: cx / count, y: cy / count, z: cz / count };
}

const pairs = [
  { name: 'Sign 1 (Cross)', arrowQuads: [36, 37], bgName: 'bg_cross', crossQuads: [10, 11, 12] },
  { name: 'Sign 2 (Info)', arrowQuads: [38, 39], bgName: 'bg_info', crossQuads: [13, 14, 15] },
  { name: 'Sign 3 (Food)', arrowQuads: [40, 41], bgName: 'bg_food', crossQuads: [16, 17, 18] },
  { name: 'Sign 4 (Tools)', arrowQuads: [42, 43], bgName: 'bg_tools', crossQuads: [19, 20, 21] }
];

console.log('Comparing 3D positions of the 4 Physical Signs vs their 4 Backing Matrix Screens:');
for (const p of pairs) {
  const aCenter = getCenter(aPos, p.arrowQuads);
  const cCenter = getCenter(cPos, p.crossQuads);
  const dx = aCenter.x - cCenter.x;
  const dy = aCenter.y - cCenter.y;
  const dz = aCenter.z - cCenter.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  console.log(`\n${p.name} vs ${p.bgName}:`);
  console.log(`  Foreground Sign Center: (${aCenter.x.toFixed(2)}, ${aCenter.y.toFixed(2)}, ${aCenter.z.toFixed(2)})`);
  console.log(`  Background Matrix Center: (${cCenter.x.toFixed(2)}, ${cCenter.y.toFixed(2)}, ${cCenter.z.toFixed(2)})`);
  console.log(`  Delta (dx, dy, dz): (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}) -> Distance: ${dist.toFixed(2)}m`);
}
