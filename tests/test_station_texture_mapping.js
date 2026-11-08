import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { StationViewer } from '../src/viewer.js';

console.log('[*] Testing Station Texture Mapping & Asset Availability...');

// Test resolveTextureForModel directly via prototype
const resolveTexture = StationViewer.prototype.resolveTextureForModel;

const testCases = [
  // 1. Solar Panels (Energy Cells & Station Arrays)
  {
    name: 'Energy Cells Part Main',
    url: '/assets1/structures/production/prod_gen_energycells_data/part_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_solarpanels_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Generic Solar Panel Material',
    url: '/assets1/structures/production/prod_gen_energycells_data/part_panels-lod0.dae',
    mat: 'generic_p1_solarpanels',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_solarpanels_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },

  // 2. Agricultural & Natural Flora
  {
    name: 'Wheat Foliage',
    url: '/assets1/structures/production/prod_arg_wheat_data/detail_s_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/natural/nat_p2_foliage_01_diff.dds',
    checkChannels: ['normal', 'roughness']
  },
  {
    name: 'Wheat Underwood',
    url: '/assets1/structures/production/prod_arg_wheat_data/part_underwood-lod0.dae',
    mat: 'natural_underwood',
    expectedDiffuse: '/assets1/textures/natural/natural_underwood_01_diff.dds',
    checkChannels: ['normal']
  },
  {
    name: 'Wheat Water',
    url: '/assets1/structures/production/prod_arg_wheat_data/part_water-lod0.dae',
    mat: 'waterpattern',
    expectedDiffuse: '/assets1/textures/natural/natural_waterpattern_01_diff.dds',
    checkChannels: ['normal']
  },
  {
    name: 'Grass Pattern',
    url: '/assets1/structures/production/prod_tel_sunflowers_data/part_main-lod0.dae',
    mat: 'natural_grasspattern',
    expectedDiffuse: '/assets1/textures/natural/natural_grasspattern_01_diff.dds',
    checkChannels: ['normal', 'roughness']
  },

  // 3. Paranid Stations
  {
    name: 'Paranid Habitat Main Hull',
    url: '/assets1/structures/habitat/hab_par_l_01_data/part_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/paranid/paranid_p1_hullpattern_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Paranid FX / Lights',
    url: '/assets1/structures/habitat/hab_par_l_01_data/anim_poslights-lod0.dae',
    mat: 'paranid_p1_fx',
    expectedDiffuse: '/assets1/textures/paranid/Paranid_p1_fx_diff.dds',
    checkChannels: ['normal', 'emissive']
  },

  // 4. Terran Stations
  {
    name: 'Terran Base Main Hull',
    url: '/assets1/structures/connectionmodules/struct_ter_base_01_data/part_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/terran/ter_p2_hullpattern_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Terran FX / Lights',
    url: '/assets1/structures/connectionmodules/struct_ter_base_01_data/anim_poslights-lod0.dae',
    mat: 'ter_p2_fx_01',
    expectedDiffuse: '/assets1/textures/terran/ter_p2_fx_01_diff.dds',
    checkChannels: ['normal', 'metalness', 'emissive']
  },

  // 5. Split Stations
  {
    name: 'Split Pier Main Hull',
    url: '/assets1/structures/dock/pier_spl_harbor_01_data/part_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/split/spl_p2_hulltexture_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness', 'emissive']
  },

  // 6. Teladi Stations
  {
    name: 'Teladi Storage FX',
    url: '/assets1/structures/storage/storage_tel_l_container_01_data/anim_poslights-lod0.dae',
    mat: 'tel_p1_fx',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
    checkChannels: ['emissive']
  },

  // 7. Decals & Signage
  {
    name: 'Station Decals',
    url: '/assets1/structures/dock/dockarea_arg_m_station_01_data/fx_decals-lod0.dae',
    mat: 'paint_p1_decal_01',
    expectedDiffuse: '/assets1/textures/paint/paint_p1_decal_01_diff.dds',
    checkChannels: ['normal', 'metalness', 'emissive']
  },
  {
    name: 'Station Billboards',
    url: '/assets1/structures/dock/dockarea_arg_m_station_01_data/detail_ads-lod0.dae',
    mat: 'ads_billboard',
    expectedDiffuse: '/assets1/textures/ad_signs/ads_billboardtrims_01_diff.dds',
    checkChannels: []
  },
  {
    name: 'Illuminated Window Font Signage',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_xl_windowfont-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
    checkChannels: ['normal', 'emissive']
  },

  // 8. Standard Argon & Generic Hull
  {
    name: 'Argon Station Main Hull',
    url: '/assets1/structures/dock/dockarea_arg_m_station_01_data/part_main-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Generic Hull Pattern',
    url: '/assets1/structures/production/prod_arg_wheat_data/part_ring-lod0.dae',
    mat: 'generic_p1_hullpattern',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_hullpattern_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },

  // 9. Volumetric Light Cones & FX Glow Proxies
  {
    name: 'Standard FX Glow Proxy',
    url: '/assets1/structures/buildmodule/buildmodule_arg_equip_l_data/fx_glow-lod0.dae',
    mat: 'theresonlyone',
    expectedDiffuse: '/assets1/textures/fx/lightcones_soft.dds',
    checkChannels: ['emissive']
  },
  {
    name: 'Boron / Alien FX Lightcones',
    url: '/assets1/structures/buildmodule/buildmodule_bor_equip_l_data/fx_lightcones-lod0.dae',
    mat: 'p2fx.fx_p2_lightcones_01',
    expectedDiffuse: '/assets1/textures/fx/fx_p2_lightcones_01_diff.dds',
    checkChannels: ['emissive']
  },

  // 10. Atmospheric Forcefields & Shield Barriers
  {
    name: 'Docking Bay Forcefield Energy Barrier',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_forcefieldfx01-lod0.dae',
    mat: 'p1effectsXfx_forcefield_01',
    expectedDiffuse: '/assets1/textures/fx/p1_gate_haze_02_diff.dds',
    checkChannels: ['emissive']
  },

  // 11. Atmospheric Interior Haze Volumes
  {
    name: 'Dock Interior Atmospheric Haze Volume',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/fx_haze-lod0.dae',
    mat: 'p1effects.p1_lightcone_soft',
    expectedDiffuse: '/assets1/textures/fx/lightcones_soft.dds',
    checkChannels: ['emissive']
  },

  // 12. Station Interior Conveyor Walkways & Escalators
  {
    name: 'Dock Interior Escalator / Conveyor Walkway',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_escalator-lod0.dae',
    mat: 'generic.generic_p1_int_conveyor_01',
    expectedDiffuse: '/assets1/textures/interiors/int_conveyor_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness', 'emissive']
  },

  // 13. Dock Interior Runway Guide Lights & Elements (detail_m_main)
  {
    name: 'Dock Landing Runway Guide Lights (detail_m_main fx)',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae',
    mat: 'detail_m_main-lod0Xlod0XgenericXgeneric_p1_fx',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
    checkChannels: ['normal', 'emissive']
  },
  {
    name: 'Dock Interior Alpha Grates (detail_m_main alphatexture)',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/detail_m_main-lod0.dae',
    mat: 'detail_m_main-lod0Xlod0XgenericXgeneric_p1_alphatexture',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_alphatexture_diff.dds',
    checkChannels: ['normal']
  },

  // 14. Animated Position Lights & Nav Beacons
  {
    name: 'Dock Animated Position Lights (anim_poslights)',
    url: '/assets1/structures/dock/dockarea_arg_m_station_02_hightech_data/anim_poslights-lod0.dae',
    mat: 'p1effectsXp1_gradient_colour',
    expectedDiffuse: '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds',
    checkChannels: ['emissive']
  },

  // 15. Methane Miner Modules (Pier Harbor 04, Liquid Storage, Defense Tube/Disc)
  {
    name: 'Pier Harbor 04 Glow Runway (gradientcolour British spelling)',
    url: '/assets1/structures/dock/pier_arg_harbor_04_data/detail_s_glow_01-lod0.dae',
    mat: 'detail_s_glow_01-lod0Xlod0Xp2fxXfx_p2_gradientcolour_01',
    expectedDiffuse: '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds',
    checkChannels: ['emissive']
  },
  {
    name: 'Pier Harbor 04 Hull Texture 02 (p2generic)',
    url: '/assets1/structures/dock/pier_arg_harbor_04_data/part_main-lod0.dae',
    mat: 'part_main-lod0Xlod0Xp2genericXgen_p2_hulltexture_02',
    expectedDiffuse: '/assets1/textures/generic/gen_p2_hulltexture_02_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Pier Harbor 04 Alpha Grates (p2generic)',
    url: '/assets1/structures/dock/pier_arg_harbor_04_data/part_main-lod0.dae',
    mat: 'part_main-lod0Xlod0Xp2genericXgen_p2_alphatexture_02',
    expectedDiffuse: '/assets1/textures/generic/gen_p2_alphatexture_02_diff.dds',
    checkChannels: ['normal']
  },
  {
    name: 'Liquid Storage Main Pressurized Tanks (p1.multimat)',
    url: '/assets1/structures/storage/storage_arg_l_liquid_01_data/part_main-lod0.dae',
    mat: 'part_main-lod0Xlod0Xp1Xmultimat',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Liquid Storage Billboard Trims Arrows',
    url: '/assets1/structures/storage/storage_arg_l_liquid_01_data/anim_arrows-lod0.dae',
    mat: 'anim_arrows-lod0Xlod0XadsXads_p1_billboardtrims_02',
    // ads_p1_billboardtrims_02's diffuse_map in X4's material library (the .dae names it too)
    expectedDiffuse: '/assets1/textures/ad_signs/ads_billboard_02_diff.dds',
    checkChannels: []
  },
  {
    name: 'Defense Disc 01 Detail Hull',
    url: '/assets1/structures/defence/defence_arg_disc_01_data/detail_s_main-lod0.dae',
    mat: 'detail_s_main-lod0Xlod0Xp1genericXgeneric_p1_hulltexture_01_diff',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
    checkChannels: ['normal', 'roughness', 'metalness']
  },
  {
    name: 'Defense Tube 01 Detail Alpha Grates',
    url: '/assets1/structures/defence/defence_arg_tube_01_data/detail_m_main-lod0.dae',
    mat: 'detail_m_main-lod0Xlod0Xp1genericXgeneric_p1_alphatexture',
    expectedDiffuse: '/assets1/textures/generic/generic_p1_alphatexture_diff.dds',
    checkChannels: ['normal']
  }
];

let passCount = 0;
for (const tc of testCases) {
  const res = resolveTexture(tc.url, tc.mat);
  assert.strictEqual(res.diffuse, tc.expectedDiffuse, `Case [${tc.name}]: expected diffuse ${tc.expectedDiffuse}, got ${res.diffuse}`);

  // Verify all returned files physically exist on disk
  for (const [channel, url] of Object.entries(res)) {
    if (url) {
      const diskPath = path.resolve('.', url.replace(/^\/+/, ''));
      assert.ok(fs.existsSync(diskPath), `Case [${tc.name}]: Channel ${channel} file does not exist on disk: ${diskPath}`);
      const stat = fs.statSync(diskPath);
      assert.ok(stat.size > 0, `Case [${tc.name}]: Channel ${channel} file is 0 bytes: ${diskPath}`);
    }
  }

  for (const ch of tc.checkChannels) {
    assert.ok(res[ch], `Case [${tc.name}]: Expected channel '${ch}' to be defined`);
  }

  passCount++;
  console.log(`  ✓ [PASS] ${tc.name}`);
}

console.log(`\n[SUCCESS] All ${passCount} station texture mapping test cases passed and files verified on disk!`);
