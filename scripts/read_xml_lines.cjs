const fs = require('fs');
const content = fs.readFileSync('assets/structures/production/prod_gen_advancedelectronics.xml', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(1365, 1400).join('\n'));
