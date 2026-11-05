import fs from 'fs';
import path from 'path';

const dir = 'assets/structures/dock';
const files = fs.readdirSync(dir).filter(f => f.startsWith('pier_') && f.endsWith('.xml') && !f.endsWith('.sig'));

for (const f of files) {
  const xml = fs.readFileSync(path.join(dir, f), 'utf8');
  console.log('=== ' + f + ' ===');
  
  // Find part offsets
  const parts = xml.split('<connection').filter(s => s.includes('tags="part'));
  for (const p of parts) {
    const partName = p.match(/<part\s+name="([^"]*)"/)?.[1] || p.match(/<part\s+ref="([^"]*)"/)?.[1];
    const pos = p.match(/<position\s+x="([^"]*)"\s+y="([^"]*)"\s+z="([^"]*)"/);
    if (partName && (partName.includes('part_main') || partName.includes('bounding_box'))) {
      console.log(`  PART ${partName}: offset = ${pos ? [pos[1], pos[2], pos[3]].join(', ') : '0, 0, 0'}`);
    }
  }

  // Find snap connections
  const snaps = xml.split('<connection').filter(s => s.includes('tags="snap'));
  for (const s of snaps) {
    const name = s.match(/name="([^"]*)"/)?.[1];
    const pos = s.match(/<position\s+x="([^"]*)"\s+y="([^"]*)"\s+z="([^"]*)"/);
    const quat = s.match(/<quaternion\s+qx="([^"]*)"\s+qy="([^"]*)"\s+qz="([^"]*)"\s+qw="([^"]*)"/);
    console.log(`  SNAP ${name}: pos = [${pos ? [pos[1], pos[2], pos[3]].join(', ') : '0, 0, 0'}], quat = ${quat ? [quat[1], quat[2], quat[3], quat[4]].join(', ') : 'identity'}`);
  }
}
