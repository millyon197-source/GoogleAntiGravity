import fs from 'fs';
import path from 'path';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';
import PART_MAIN_OFFSETS from '../../src/part-main-offsets.json' with { type: 'json' };

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

const uniqueMacros = [...new Set(plan.modules.map(m => m.macro))];

const report = [];

for (const macro of uniqueMacros) {
  const baseName = macro.replace(/_macro$/, '');
  const hasSnap = !!(SNAP_POINTS_DB[baseName] || SNAP_POINTS_DB[macro]);
  const hasPartMainOffset = !!PART_MAIN_OFFSETS[macro];
  
  // Check if mesh file exists in assets or models
  // Let's check where meshes live
  const glbPath = path.join('public', 'models', `${baseName}.glb`);
  const binPath = path.join('public', 'assets', 'models', baseName, 'part_main-lod0.bin');
  const gltfPath = path.join('public', 'assets', 'models', `${baseName}.gltf`);
  
  const hasGlb = fs.existsSync(glbPath);
  const hasBin = fs.existsSync(binPath);
  const hasGltf = fs.existsSync(gltfPath);

  report.push({
    macro,
    count: plan.modules.filter(m => m.macro === macro).length,
    hasSnap,
    hasPartMainOffset,
    meshStatus: hasGlb ? 'glb' : hasBin ? 'bin' : hasGltf ? 'gltf' : 'MISSING'
  });
}

console.log(JSON.stringify(report, null, 2));
