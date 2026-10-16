#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filter = process.argv[2] ? process.argv[2].toLowerCase() : '';

const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .filter(f => !filter || f.toLowerCase().includes(filter))
  .sort();

console.log(`\n==================================================`);
console.log(`  X4 Station Visualizer Test Suite`);
console.log(`  Found ${testFiles.length} test suites in tests/`);
console.log(`==================================================\n`);

let passedCount = 0;
let failedCount = 0;
const results = [];
const startTime = Date.now();

for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile);
  const testStart = Date.now();

  const proc = spawnSync(process.execPath, [filePath], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  const durationMs = Date.now() - testStart;
  const isPass = proc.status === 0;

  if (isPass) {
    passedCount++;
    console.log(`  ✓ [PASS] ${testFile} (${durationMs}ms)`);
    results.push({ file: testFile, status: 'PASS', durationMs });
  } else {
    failedCount++;
    console.error(`  ✗ [FAIL] ${testFile} (${durationMs}ms) (Exit code: ${proc.status})`);
    if (proc.stderr) {
      console.error(proc.stderr.trim().split('\n').map(l => `    | ${l}`).join('\n'));
    } else if (proc.stdout) {
      console.error(proc.stdout.trim().split('\n').slice(-10).map(l => `    | ${l}`).join('\n'));
    }
    results.push({ file: testFile, status: 'FAIL', durationMs, error: proc.stderr || proc.stdout });
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`\n--------------------------------------------------`);
console.log(`Total: ${testFiles.length} | Passed: ${passedCount} | Failed: ${failedCount} | Time: ${totalDuration}s`);
console.log(`--------------------------------------------------\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(`[SUCCESS] All test suites passed cleanly!\n`);
  process.exit(0);
}
