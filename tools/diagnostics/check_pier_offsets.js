import fs from 'fs';
const offsets = JSON.parse(fs.readFileSync('src/part-main-offsets.json', 'utf8'));
console.log('Offsets for pier_ter_harbor_02:', offsets['pier_ter_harbor_02']);
console.log('Offsets for pier_arg_harbor_02:', offsets['pier_arg_harbor_02']);
console.log('Offsets for pier_par_harbor_02:', offsets['pier_par_harbor_02']);
console.log('Offsets for pier_tel_harbor_02:', offsets['pier_tel_harbor_02']);
console.log('Offsets for pier_ter_harbor_03:', offsets['pier_ter_harbor_03']);

// Check getMeshTransformConfig in viewer.js
const v = fs.readFileSync('src/viewer.js', 'utf8');
const m = v.match(/function getMeshTransformConfig[\s\S]*?^}/m);
console.log(m ? m[0] : 'getMeshTransformConfig not found');
