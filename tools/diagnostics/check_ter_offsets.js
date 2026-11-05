import fs from 'fs';
const offsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
const terKeys = Object.keys(offsets).filter(k => k.includes('ter'));
console.log('Terran keys in part-main-offsets.json:', terKeys);
