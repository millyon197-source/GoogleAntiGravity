function evaluateAutoGridSize(sizeX, sizeY, sizeZ) {
  const maxDim = Math.max(sizeX, sizeZ, sizeY);
  if (sizeX > 10000 || sizeY > 10000 || sizeZ > 10000) {
    return 5000;
  } else if (maxDim > 5000) {
    return 1000;
  } else {
    return 500;
  }
}

console.log('[*] Testing Bounding Envelope Major Grid Size Selection Rules:');

const testCases = [
  { name: 'Small Station (3000m x 2000m x 1500m)', sizeX: 3000, sizeY: 2000, sizeZ: 1500, expected: 500 },
  { name: 'Medium Station (7500m x 3000m x 4000m)', sizeX: 7500, sizeY: 3000, sizeZ: 4000, expected: 1000 },
  { name: 'Planar Paranid (3224m x 18810m x 8451m)', sizeX: 3224, sizeY: 18810, sizeZ: 8451, expected: 5000 },
  { name: 'EBI Trading Station (17600m x 23m x 17600m)', sizeX: 17600, sizeY: 23, sizeZ: 17600, expected: 5000 }
];

let allPassed = true;

for (const tc of testCases) {
  const result = evaluateAutoGridSize(tc.sizeX, tc.sizeY, tc.sizeZ);
  if (result === tc.expected) {
    console.log(`[OK] ${tc.name} -> Selected ${result}m Major Grid`);
  } else {
    console.error(`[FAIL] ${tc.name} expected ${tc.expected}m, got ${result}m`);
    allPassed = false;
  }
}

console.log(`\n========================================`);
if (allPassed) {
  console.log('[SUCCESS] All bounding envelope grid selection rules verified 100%!');
} else {
  console.error('[FAIL] Rule check failed.');
  process.exit(1);
}
