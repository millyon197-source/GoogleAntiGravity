import fs from 'fs';

const xml = fs.readFileSync('assets/structures/production/prod_gen_refinedmetals.xml', 'utf8');
const conns = xml.split(/<connection\s+/);
for (const c of conns) {
  if (c.includes('name="Connection024"')) {
    console.log(c);
  }
}
