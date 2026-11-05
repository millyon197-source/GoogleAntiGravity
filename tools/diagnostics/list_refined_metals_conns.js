import fs from 'fs';

const xml = fs.readFileSync('assets/structures/production/prod_gen_refinedmetals.xml', 'utf8');
const conns = xml.split(/<connection\s+/);

for (const c of conns) {
  const nameMatch = c.match(/name="([^"]+)"/);
  const tagsMatch = c.match(/tags="([^"]+)"/);
  const partMatch = c.match(/<part\s+name="([^"]+)"/);
  const refMatch = c.match(/ref="([^"]+)"/);
  const posMatch = c.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/);

  if (nameMatch) {
    const name = nameMatch[1];
    const tags = tagsMatch ? tagsMatch[1] : '';
    const part = partMatch ? partMatch[1] : (refMatch ? refMatch[1] : '');
    const pos = posMatch ? [posMatch[1], posMatch[2], posMatch[3]] : null;
    if (tags.includes('snap') || tags.includes('part') || tags.includes('connection')) {
      console.log(`Connection: ${name.padEnd(25)} tags: ${tags.padEnd(20)} part: ${part.padEnd(25)} pos: ${pos ? pos.join(',') : 'none'}`);
    }
  }
}
