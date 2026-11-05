import fs from 'fs';

const dae = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.dae', 'utf8');
const vsIndex = dae.indexOf('<visual_scene');
if (vsIndex !== -1) {
  console.log(dae.substring(vsIndex, vsIndex + 1500));
} else {
  console.log('No visual_scene found');
}
