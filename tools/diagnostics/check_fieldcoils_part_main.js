import fs from 'fs';

const xml = fs.readFileSync('assets/structures/production/prod_gen_fieldcoils.xml', 'utf8');
const conns = xml.split(/<connection\s+/);
for (const c of conns) {
  if (c.includes('part_main')) {
    console.log(c.substring(0, 500));
  }
}
