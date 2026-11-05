import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  analyzePlanarParanid,
  analyzeSpine,
  analyzeProduction,
  analyzeDeltas,
  analyzeLevel
} from '../src/layout/index.js';

console.log('--- Testing Layout Analysis Tools ---');

const samplePath = 'tests/fixtures/Planar - Paranid.xml';

if (fs.existsSync(samplePath)) {
  const xml = fs.readFileSync(samplePath, 'utf8');

  // Test analyzePlanarParanid
  const pResult = analyzePlanarParanid(xml);
  assert.strictEqual(pResult.totalModules, 567, 'Expected 567 modules in Planar - Paranid');
  assert.strictEqual(pResult.catY.production.count, 156, 'Expected 156 production modules');
  assert.strictEqual(pResult.catY.habitation.count, 46, 'Expected 46 habitation modules');
  console.log('✓ analyzePlanarParanid passed');

  // Test analyzeSpine
  const sResult = analyzeSpine(xml);
  assert.strictEqual(sResult.spineModules.length, 18, 'Expected 18 modules on main vertical spine');
  assert.ok(sResult.otherSpines['X=-1391, Z=856'] >= 20, 'Expected major structural column at X=-1391, Z=856');
  console.log('✓ analyzeSpine passed');

  // Test analyzeProduction
  const prResult = analyzeProduction(xml);
  assert.strictEqual(prResult.prods.length, 156, 'Expected 156 production modules');
  assert.strictEqual(prResult.sortedYs.length, 31, 'Expected 31 unique production Y tiers');
  console.log('✓ analyzeProduction passed');

  // Test analyzeDeltas
  const dResult = analyzeDeltas(xml);
  assert.strictEqual(dResult.levels.length, 65, 'Expected 65 unique Y levels');
  console.log('✓ analyzeDeltas passed');

  // Test analyzeLevel
  const lResult = analyzeLevel(xml, -4570, 100);
  assert.strictEqual(lResult.levelMods.length, 14, 'Expected 14 modules on Y=-4570 level');
  console.log('✓ analyzeLevel passed');
} else {
  console.log('Skipping layout tests (sample blueprint file not found at path)');
}

console.log('All layout analysis tests passed!');
