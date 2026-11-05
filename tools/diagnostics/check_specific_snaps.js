import fs from 'fs';

function checkXml(xmlPath) {
  if (!fs.existsSync(xmlPath)) {
    console.log('Not found:', xmlPath);
    return;
  }
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const conns = xml.split(/<connection\s+/);
  console.log('===', xmlPath, '===');
  for (const c of conns) {
    if (c.includes('tags="snap') || c.includes("tags='snap")) {
      console.log('<connection ' + c.split('</connection>')[0].trim() + '\n</connection>');
    }
  }
}

checkXml('assets/structures/connectionmodules/struct_arg_arc_01.xml');
