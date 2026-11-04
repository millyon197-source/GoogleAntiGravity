import {
  HASH_TABLE_SIZE,
  MODULE_BOUNDS_TABLE,
  lookupModuleBounds,
  MODULE_BOUNDS_REGISTRY
} from '../src/module-bounds-hashtable.js';
import { SAMPLES } from '../src/samples.js';

console.log(`Checking Hash Table Size: ${HASH_TABLE_SIZE}`);
if (HASH_TABLE_SIZE !== 503 || MODULE_BOUNDS_TABLE.length !== 503) {
  throw new Error(`Expected size 503, got ${MODULE_BOUNDS_TABLE.length}`);
}

const filled = MODULE_BOUNDS_TABLE.filter(x => x !== null);
console.log(`Filled slots count: ${filled.length}`);
if (filled.length !== 248) {
  throw new Error(`Expected 248 entries, got ${filled.length}`);
}

// Extract modules from All Modules Showcase
const xml = SAMPLES.allModulesPlan;
const entryRegex = /<entry\s+index="(\d+)"\s+macro="([^"]+)">/g;
let match;
const expectedMacros = [];
while ((match = entryRegex.exec(xml)) !== null) {
  expectedMacros.push({
    index: parseInt(match[1], 10),
    macro: match[2]
  });
}

console.log(`Extracted ${expectedMacros.length} modules from All Modules Showcase.`);

// Verify each module via lookupModuleBounds and MODULE_BOUNDS_REGISTRY
let successCount = 0;
for (const item of expectedMacros) {
  const direct = lookupModuleBounds(item.macro);
  const viaProxy = MODULE_BOUNDS_REGISTRY[item.macro];

  if (!direct || !viaProxy) {
    throw new Error(`Lookup failed for macro: ${item.macro}`);
  }

  if (direct.key !== item.macro || direct.macro !== item.macro) {
    throw new Error(`Macro mismatch for ${item.macro}`);
  }

  if (!direct.boundingBox || !direct.boundingBox.min || !direct.boundingBox.max || !direct.boundingBox.size) {
    throw new Error(`Bounding box missing fields for ${item.macro}`);
  }

  // Also verify lookup without '_macro' suffix works
  const stripped = item.macro.replace(/_macro$/, '');
  const strippedLookup = lookupModuleBounds(stripped);
  if (!strippedLookup) {
    throw new Error(`Lookup failed for stripped macro name: ${stripped}`);
  }

  successCount++;
}

// Verify that the stored table was shrunk by removing macro and min/max
for (const entry of filled) {
  if ('macro' in entry) {
    throw new Error(`Raw entry still has redundant 'macro' field: ${entry.key}`);
  }
  if ('min' in entry.boundingBox || 'max' in entry.boundingBox) {
    throw new Error(`Raw entry boundingBox still contains 'min' or 'max': ${entry.key}`);
  }
}
console.log('Confirmed: Raw table entries have removed redundant macro and min/max fields.');

console.log(`All ${successCount} modules verified successfully!`);
const sample = MODULE_BOUNDS_REGISTRY['struct_arg_base_01_macro'];
console.log('Sample entry #1 (lookup):', {
  key: sample.key,
  macro: sample.macro,
  name: sample.name,
  index: sample.index,
  hash: sample.hash,
  boundingBox: {
    size: sample.boundingBox.size,
    min: sample.boundingBox.min,
    max: sample.boundingBox.max
  }
});
const rawSample = MODULE_BOUNDS_TABLE.find(x => x && x.key === 'struct_arg_base_01_macro');
console.log('Sample raw table entry (stored in JSON):', rawSample);

// Verify pier_arg_harbor_04_macro
const pierSample = lookupModuleBounds('pier_arg_harbor_04_macro');
if (!pierSample || pierSample.boundingBox.size[0] !== 260 || pierSample.boundingBox.size[1] !== 100 || pierSample.boundingBox.size[2] !== 230) {
  throw new Error('Verification failed for pier_arg_harbor_04_macro');
}
console.log('pier_arg_harbor_04_macro verified:', pierSample.boundingBox.size);

