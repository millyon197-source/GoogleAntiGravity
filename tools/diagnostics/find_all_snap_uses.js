import fs from 'fs';
const search = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + f.name;
    if (f.isDirectory() && !full.includes('node_modules')) search(full);
    else if (f.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (/snap/i.test(l) && !/module_snaps_group|snap_dot_|snapDots|snapPointGeometry|snapPointMaterial|showSnapPoints|toggleSnapPoints/i.test(l)) {
          console.log(`${full}:${idx+1} ${l.trim().slice(0, 110)}`);
        }
      });
    }
  }
};
search('src');
