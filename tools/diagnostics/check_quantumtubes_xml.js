import fs from 'fs';

const xml = fs.readFileSync('assets/structures/production/prod_gen_quantumtubes.xml', 'utf8');
const conns = xml.split(/<connection\s+/);
for (const c of conns) {
  if (c.includes('part_main') || c.includes('tags="snap')) {
    console.log(c.substring(0, 600));
  }
}
