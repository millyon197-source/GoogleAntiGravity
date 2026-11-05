import fs from 'fs';
const search = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + f.name;
    if (f.isDirectory()) search(full);
    else if (f.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (/snap/i.test(l) && /(function|class|\bconst\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\b\w+\s*\([^)]*\)\s*\{)/.test(l)) {
          console.log(`${full}:${idx+1} ${l.trim().slice(0, 100)}`);
        }
      });
    }
  }
};
search('src');
search('packages');
