import fs from 'fs';

function checkXml(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const conns = xml.split(/<connection\s+/);
  console.log(`=== ${xmlPath} ===`);
  for (const c of conns) {
    if (c.includes('part_main') || c.includes('tags="snap') || c.includes("tags='snap")) {
      const name = c.match(/name="([^"]+)"/)?.[1];
      const tags = c.match(/tags="([^"]+)"/)?.[1];
      const pos = c.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);
      console.log(`  Conn: ${name} tags: ${tags} pos: ${pos ? [pos[1], pos[2], pos[3]].join(',') : 'none'}`);
    }
  }
}

checkXml('assets/structures/production/prod_gen_energycells.xml');
checkXml('assets/structures/production/prod_gen_fieldcoils.xml');
checkXml('assets/structures/production/prod_gen_quantumtubes.xml');
