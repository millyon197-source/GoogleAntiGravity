const fs = require('fs');

function inspectShieldGeo(file) {
  console.log('=== Geo:', file, '===');
  const txt = fs.readFileSync(file, 'utf8');
  const geometries = txt.match(/<geometry[^>]*>[\s\S]*?<\/geometry>/g) || [];
  for (const g of geometries) {
    const id = (g.match(/id="([^"]+)"/) || [])[1];
    const sources = g.match(/<source id="([^"]+)"/g) || [];
    const vtx = g.match(/<vertices[\s\S]*?<\/vertices>/);
    console.log(`Geometry ${id}:`);
    console.log('  sources:', sources.map(s => s.match(/"([^"]+)"/)[1]).join(', '));
    console.log('  vertices:', vtx ? vtx[0].replace(/\s+/g, ' ') : 'none');
  }
}

inspectShieldGeo('assets/structures/production/prod_gen_advancedelectronics_data/fx_shield-lod0.dae');
