import fs from 'fs';

const xml = fs.readFileSync('assets/structures/production/prod_arg_foodrations.xml', 'utf8');
const conns = xml.split(/<connection\s+/);
for (const c of conns) {
  if (c.includes('tags="part') || c.includes("tags='part")) {
    const name = c.match(/name="([^"]+)"/)?.[1];
    const part = c.match(/<part\s+name="([^"]+)"/)?.[1];
    const pos = c.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
    console.log(name, part, pos ? [pos[1], pos[2], pos[3]].join(',') : 'none');
  }
}
