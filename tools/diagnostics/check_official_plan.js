import fs from 'fs';

const xml = fs.readFileSync('assets/libraries/constructionplans.xml', 'utf8');
const lines = xml.split('\n');

for (let i = 13630; i < 13730; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
