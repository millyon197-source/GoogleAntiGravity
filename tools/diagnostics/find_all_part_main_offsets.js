import fs from 'fs';

const dirs = [
  'assets/structures/buildmodule',
  'assets/structures/connectionmodules',
  'assets/structures/defence',
  'assets/structures/dock',
  'assets/structures/habitation',
  'assets/structures/landmarks',
  'assets/structures/processing',
  'assets/structures/production',
  'assets/structures/storage',
  'assets/structures/venture'
];

const offsetModules = [];
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith('.xml') && !f.endsWith('.sig')) {
      const txt = fs.readFileSync(d + '/' + f, 'utf8');
      const conns = txt.split(/<connection\s+/);
      for (const c of conns) {
        if (c.includes('part_main') && c.includes('tags=')) {
          const posMatch = c.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
          if (posMatch) {
            const x = parseFloat(posMatch[1]), y = parseFloat(posMatch[2]), z = parseFloat(posMatch[3]);
            if (Math.abs(x) > 1 || Math.abs(y) > 1 || Math.abs(z) > 1) {
              offsetModules.push({ file: f, path: d + '/' + f, x, y, z });
            }
          }
        }
      }
    }
  }
}

console.log('Total modules with part_main offset > 1m:', offsetModules.length);
offsetModules.forEach(o => console.log('  ', o.file, { x: o.x, y: o.y, z: o.z }));
