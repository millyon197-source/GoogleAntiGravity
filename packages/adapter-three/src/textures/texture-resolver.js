/**
 * Texture resolution for X4 station model components.
 *
 * Maps a model URL (.dae/.bin component path) and an optional material name
 * to the DDS texture URLs to use for each PBR channel. Pure function: no
 * Three.js, DOM or viewer state, so it can be tested in isolation.
 *
 * @typedef {Object} ResolvedTextureUrls
 * @property {string|null} diffuse
 * @property {string|null} normal
 * @property {string|null} roughness
 * @property {string|null} metalness
 * @property {string|null} emissive
 */

/**
 * @param {string} modelUrl Component model URL (e.g. .../part_main-lod0.dae).
 * @param {string} [materialName=''] Collada material name, when known.
 * @returns {ResolvedTextureUrls}
 */
export function resolveTextureForModel(modelUrl, materialName = '') {
  if (!modelUrl && !materialName) return { diffuse: null, normal: null, roughness: null, metalness: null, emissive: null };
  const lower = (modelUrl || '').toLowerCase().replace(/\\/g, '/');
  const matLower = (materialName || '').toLowerCase();

  // 0. Volumetric Light Cones, Atmospheric Haze & FX Glow Proxies (Soft-blended light volumes)
  if (matLower.includes('lightcone') || lower.includes('lightcone') ||
      matLower.includes('fx_glow') || lower.includes('fx_glow') ||
      matLower.includes('fx_lightcone') || lower.includes('fx_lightcone') ||
      matLower.includes('flare') || lower.includes('flare') ||
      matLower.includes('decoflares') || lower.includes('decoflares') ||
      matLower.includes('haze') || lower.includes('haze')) {
    const isP2OrAlien = lower.includes('_bor_') || lower.includes('/boron/') || lower.includes('_ter_') ||
                        lower.includes('/terran/') || lower.includes('_spl_') || lower.includes('/split/') ||
                        matLower.includes('p2fx') || matLower.includes('fx_p2');
    const glowPath = isP2OrAlien
      ? '/assets1/textures/fx/fx_p2_lightcones_01_diff.dds'
      : '/assets1/textures/fx/lightcones_soft.dds';
    return {
      diffuse: glowPath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: glowPath
    };
  }

  // 0a. Volumetric Bubbles & Biological Fluid Simulation (Advanced Electronics & Bio Labs)
  if (matLower.includes('bubble') || lower.includes('bubble')) {
    const bubblePath = '/assets1/textures/fx/fx_bubbles_01_diff.dds';
    return {
      diffuse: bubblePath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: bubblePath
    };
  }

  // 0a2. Hexagonal Energy Shields & Containment Fields (Centrifuge / High Energy Fields)
  if (matLower.includes('pattern_hex') || lower.includes('fx_shield')) {
    const hexPath = '/assets1/textures/fx/pattern_hex_01.dds';
    return {
      diffuse: hexPath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: hexPath
    };
  }

  // 0b. Volumetric Forcefields, Atmospheric Shields & Gate Haze (Docking bay energy barriers)
  if (matLower.includes('forcefield') || lower.includes('forcefield') ||
      matLower.includes('shield') || lower.includes('shieldfx') || lower.includes('shield')) {
    return {
      diffuse: '/assets1/textures/fx/p1_gate_haze_02_diff.dds',
      normal: null,
      roughness: null,
      metalness: null,
      emissive: '/assets1/textures/fx/p1_gate_haze_02_diff.dds'
    };
  }

  // 0c. Station Escalators, Travelators & Conveyor Walkways (Moving walkways in dock interiors)
  if (matLower.includes('conveyor') || lower.includes('conveyor') ||
      matLower.includes('escalator') || lower.includes('escalator')) {
    return {
      diffuse: '/assets1/textures/interiors/int_conveyor_01_diff.dds',
      normal: '/assets1/textures/interiors/int_conveyor_01_normal.dds',
      roughness: '/assets1/textures/interiors/int_conveyor_01_smooth.dds',
      metalness: '/assets1/textures/interiors/int_conveyor_01_metal.dds',
      emissive: '/assets1/textures/interiors/int_conveyor_01_glow.dds'
    };
  }

  // 0d. Animated Position Lights & Nav Beacons (dock perimeter blinking and strobing lights)
  if (matLower.includes('gradient_colour') || matLower.includes('gradientcolour') || matLower.includes('gradient_color') || matLower.includes('gradientcolor') || matLower.includes('gradient_blue') ||
      ((lower.includes('anim_poslight') || lower.includes('poslights') || lower.includes('glow')) && (lower.includes('dock') || lower.includes('pier') || matLower.includes('gradient')) && !lower.includes('_par_') && !lower.includes('_ter_') && !lower.includes('_spl_') && !lower.includes('_tel_'))) {
    const gradPath = '/assets1/textures/fx/fx_p2_gradient_colour_01_diff.dds';
    return {
      diffuse: gradPath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: gradPath
    };
  }

  // 0e. Volumetric Smoke, Exhaust, Fumes, Gas & Vapors (Crystal Smoke, Missile Gas, Weed Fumes, Boron Vapors)
  if (matLower.includes('smoke') || lower.includes('smoke') ||
      matLower.includes('fume') || lower.includes('fume') ||
      matLower.includes('vapor') || lower.includes('vapor') ||
      matLower.includes('fx_gas') || lower.includes('fx_gas')) {
    const smokePath = '/assets1/textures/fx/highway_fx_smoke_01.dds';
    return {
      diffuse: smokePath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: smokePath
    };
  }

  // 0f. Molten Lava Streams, Smelting Fires & Atmospheric Dust (Refined Metals lava river, vats & heating elements)
  if (matLower.includes('lava') || lower.includes('lava')) {
    const lavaPath = '/assets1/textures/fx/fx_gradient_lava_01_diff.dds';
    return {
      diffuse: lavaPath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: lavaPath
    };
  }
  if (matLower.includes('fire') || lower.includes('fire') || lower.includes('hotarea') || lower.includes('anim_hot')) {
    const firePath = '/assets1/textures/fx/fx_fire_01_diff.dds';
    return {
      diffuse: firePath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: firePath
    };
  }
  if (matLower.includes('dust') || lower.includes('dust')) {
    const dustPath = '/assets1/textures/fx/fx_p2_dustparticles_01_diff.dds';
    return {
      diffuse: dustPath,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: dustPath
    };
  }
  if (matLower.includes('distortion') || lower.includes('distortion')) {
    const distDiff = '/assets1/textures/fx/bullet_distortion_01_mask_diff.dds';
    return {
      diffuse: distDiff,
      normal: '/assets1/textures/fx/bullet_distortion_01_normal.dds',
      roughness: null,
      metalness: null,
      emissive: distDiff
    };
  }

  // 1. Water, Ice & Environmental Fluids
  if (lower.includes('part_water') || matLower.includes('water') || matLower.includes('ice')) {
    return {
      diffuse: '/assets1/textures/natural/natural_waterpattern_01_diff.dds',
      normal: '/assets1/textures/natural/natural_waterpattern_01_normal.dds',
      roughness: null,
      metalness: null,
      emissive: null
    };
  }

  // 2. Agricultural & Natural Flora, Asteroid Ores & Soils
  if (matLower.includes('sand') || lower.includes('sand') || lower.includes('anim_mud') || matLower.includes('mud') ||
      matLower.includes('ast_') || matLower.includes('asteroid') || matLower.includes('stone') || lower.includes('anim_stones')) {
    return {
      diffuse: '/assets1/textures/natural/nat_p2_gravel_01_diff.dds',
      normal: '/assets1/textures/natural/nat_p2_gravel_01_normal.dds',
      roughness: '/assets1/textures/natural/nat_p2_gravel_01_smooth.dds',
      metalness: null,
      emissive: null
    };
  }
  if (matLower.includes('underwood')) {
    return {
      diffuse: '/assets1/textures/natural/natural_underwood_01_diff.dds',
      normal: '/assets1/textures/natural/natural_underwood_01_normal.dds',
      roughness: null,
      metalness: null,
      emissive: null
    };
  }
  if (matLower.includes('grass')) {
    return {
      diffuse: '/assets1/textures/natural/natural_grasspattern_01_diff.dds',
      normal: '/assets1/textures/natural/natural_grasspattern_01_normal.dds',
      roughness: '/assets1/textures/natural/natural_grasspattern_01_smooth.dds',
      metalness: null,
      emissive: null
    };
  }
  if (((lower.includes('detail_s_main') && (lower.includes('wheat') || lower.includes('plant') || lower.includes('agri'))) || lower.includes('foliage') || matLower.includes('foliage') || lower.includes('foilage') || matLower.includes('foilage')) && !lower.includes('dock')) {
    return {
      diffuse: '/assets1/textures/natural/nat_p2_foliage_01_diff.dds',
      normal: '/assets1/textures/natural/nat_p2_foliage_01_normal.dds',
      roughness: '/assets1/textures/natural/nat_p2_foliage_01_smooth.dds',
      metalness: null,
      emissive: null
    };
  }

  // 3. Solar Panels (Energy Cells & Station Solar Arrays)
  if (matLower.includes('solar') || lower.includes('solar') || (lower.includes('energycells') && lower.includes('part_main'))) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_solarpanels_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_solarpanels_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_solarpanels_smooth.dds',
      metalness: '/assets1/textures/generic/generic_p1_solarpanels_metal.dds',
      emissive: null
    };
  }

  // 3b. Decals, Window Fonts, Billboards & Advertising Signage (evaluated before race-specific hull fallbacks)
  if (matLower.includes('windowfont') || lower.includes('windowfont') ||
      matLower.includes('font') || lower.includes('font') ||
      matLower.includes('decal') || lower.includes('decal') || lower.includes('fx_decals')) {
    if (matLower.includes('windowfont') || lower.includes('windowfont') || matLower.includes('font') || lower.includes('font')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_fx_normal.dds',
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/generic/generic_p1_fx_glow.dds'
      };
    }
    if (matLower.includes('gen_p2') || matLower.includes('p2generic')) {
      return {
        diffuse: '/assets1/textures/generic/gen_p2_decal_01_diff.dds',
        normal: '/assets1/textures/paint/paint_p1_decal_01_normal.dds',
        roughness: null,
        metalness: '/assets1/textures/paint/paint_p1_decal_01_metal.dds',
        emissive: '/assets1/textures/generic/gen_p2_decal_01_glow.dds'
      };
    }
    if (matLower.includes('arg_p2') || matLower.includes('p2argon')) {
      return {
        diffuse: '/assets1/textures/argon/arg_p2_decal_01_diff.dds',
        normal: '/assets1/textures/paint/paint_p1_decal_01_normal.dds',
        roughness: null,
        metalness: '/assets1/textures/paint/paint_p1_decal_01_metal.dds',
        emissive: '/assets1/textures/paint/paint_p1_decal_01_glow.dds'
      };
    }
    return {
      diffuse: '/assets1/textures/paint/paint_p1_decal_01_diff.dds',
      normal: '/assets1/textures/paint/paint_p1_decal_01_normal.dds',
      roughness: null,
      metalness: '/assets1/textures/paint/paint_p1_decal_01_metal.dds',
      emissive: '/assets1/textures/paint/paint_p1_decal_01_glow.dds'
    };
  }
  if (matLower.includes('billboard') || matLower.includes('ad_') || matLower.includes('ads_') || matLower.includes('casino') || matLower.includes('p1ads') || matLower.includes('p2ads') || matLower.includes('holograph') || lower.includes('holograph') || lower.includes('billboard') || lower.includes('ads_') || lower.includes('anim_arrows') || lower.includes('anim_cross')) {
    let adDiff = '/assets1/textures/ad_signs/ads_billboardtrims_01_diff.dds';
    if (matLower.includes('casino') || lower.includes('casino')) {
      adDiff = '/assets1/textures/ad_signs/ads_p1_casino_01.dds';
    } else if (matLower.includes('holograph') || lower.includes('holograph')) {
      adDiff = '/assets1/textures/ad_signs/p1_holograph_ads_01_diff.dds';
    } else if (/billboardtrims_0?[123]/.test(matLower)) {
      // X4's material library (p1ads): the billboard trim materials' diffuse_map, read through UV set 0.
      // _01 uses the trims atlas, _02 and _03 the ads_billboard_02/03 sign atlases (anim_cross,
      // anim_arrows and anim_signs parts on cross modules, docks, piers and habitats).
      const trim = matLower.match(/billboardtrims_0?([123])/)[1];
      adDiff = trim === '1'
        ? '/assets1/textures/ad_signs/ads_billboardtrims_01_diff.dds'
        : `/assets1/textures/ad_signs/ads_billboard_0${trim}_diff.dds`;
    } else if (lower.includes('anim_cross') || matLower.includes('anim_cross')) {
      adDiff = '/assets1/textures/ad_signs/ads_billboardtrims_01_diff.dds';
    } else {
      const isDisplayModule = lower.includes('habitat') || lower.includes('hab_') || lower.includes('cross') || lower.includes('pier');
      const isTrim = (matLower.includes('billboardtrims_01') || matLower.includes('trim')) && !isDisplayModule;
      if (!isTrim) {
        if (matLower.includes('billboard_03') || matLower.includes('billboard03') || (matLower.includes('billboardtrims_03') && isDisplayModule) || lower.includes('billboard_03') || (isDisplayModule && (lower.includes('_par_') || lower.includes('_tel_')))) {
          adDiff = '/assets1/textures/ad_signs/ads_billboard_03_diff.dds';
        } else if (matLower.includes('billboard_02') || matLower.includes('billboard02') || (matLower.includes('billboardtrims_02') && isDisplayModule) || lower.includes('billboard_02') || (isDisplayModule && (lower.includes('_arg_') || lower.includes('_pir_')))) {
          adDiff = '/assets1/textures/ad_signs/ads_billboard_02_diff.dds';
        } else if (matLower.includes('billboard_01') || matLower.includes('billboard01') || lower.includes('billboard_01') || lower.includes('_bor_') || lower.includes('scrap')) {
          adDiff = '/assets1/textures/ad_signs/ads_billboard_01_diff.dds';
        }
      }
    }
    return {
      diffuse: adDiff,
      normal: null,
      roughness: null,
      metalness: null,
      emissive: adDiff
    };
  }

  // 4. Paranid Stations (Holy Order / Godrealm Modules & Habitats)
  if (lower.includes('_par_') || lower.includes('/paranid/') || matLower.includes('paranid')) {
    if (matLower.includes('fx') || lower.includes('poslight') || lower.includes('light')) {
      return {
        diffuse: '/assets1/textures/paranid/Paranid_p1_fx_diff.dds',
        normal: '/assets1/textures/paranid/paranid_p1_fx_normal.dds',
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/paranid/paranid_p1_fx_glow.dds'
      };
    }
    return {
      diffuse: '/assets1/textures/paranid/paranid_p1_hullpattern_01_diff.dds',
      normal: '/assets1/textures/paranid/paranid_p1_hullpattern_01_normal.dds',
      roughness: '/assets1/textures/paranid/paranid_p1_hullpattern_01_smooth.dds',
      metalness: '/assets1/textures/paranid/paranid_p1_hullpattern_01_metal.dds',
      emissive: null
    };
  }

  // 5. Terran Stations (Terran Protectorate / Segaris Pioneer Modules)
  if (lower.includes('_ter_') || lower.includes('/terran/') || matLower.includes('terran')) {
    if (matLower.includes('fx') || lower.includes('poslight') || lower.includes('light')) {
      return {
        diffuse: '/assets1/textures/terran/ter_p2_fx_01_diff.dds',
        normal: '/assets1/textures/terran/ter_p2_fx_01_normal.dds',
        roughness: null,
        metalness: '/assets1/textures/terran/ter_p2_fx_01_metal.dds',
        emissive: '/assets1/textures/terran/ter_p2_fx_01_glowhq.dds'
      };
    }
    return {
      diffuse: '/assets1/textures/terran/ter_p2_hullpattern_01_diff.dds',
      normal: '/assets1/textures/terran/ter_p2_hullpattern_01_normal.dds',
      roughness: '/assets1/textures/terran/ter_p2_hullpattern_01_smooth.dds',
      metalness: '/assets1/textures/terran/ter_p2_hullpattern_01_metal.dds',
      emissive: null
    };
  }

  // 6. Split Stations (Free Families / Zyarth Modules)
  if (lower.includes('_spl_') || lower.includes('/split/') || matLower.includes('split')) {
    if (matLower.includes('fx') || lower.includes('poslight') || lower.includes('light')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
        normal: null,
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/split/spl_p1_fx_01_glow.dds'
      };
    }
    return {
      diffuse: '/assets1/textures/split/spl_p2_hulltexture_01_diff.dds',
      normal: '/assets1/textures/split/spl_p2_hulltexture_01_normal.dds',
      roughness: '/assets1/textures/split/spl_p2_hulltexture_01_smooth.dds',
      metalness: '/assets1/textures/split/spl_p2_hulltexture_01_metal.dds',
      emissive: '/assets1/textures/split/spl_p2_hulltexture_01_glow.dds'
    };
  }

  // 7. Teladi Stations (Teladi Company / Ministry of Finance Modules)
  if (lower.includes('_tel_') || lower.includes('/teladi/') || matLower.includes('teladi')) {
    if (matLower.includes('fx') || lower.includes('poslight') || lower.includes('light')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
        normal: null,
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/teladi/tel_p1_fx_glow.dds'
      };
    }
  }

  // 8b. Gen P2 Station Details & Pier Elements (gen_p2_hulltexture, gen_p2_fx, gen_p2_alphatexture, gen_p2_decal)
  if (matLower.includes('p2generic') || matLower.includes('gen_p2')) {
    if (matLower.includes('alphatexture')) {
      return {
        diffuse: '/assets1/textures/generic/gen_p2_alphatexture_02_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_alphatexture_normal.dds',
        roughness: '/assets1/textures/generic/generic_p1_alphatexture_spec.dds',
        metalness: '/assets1/textures/generic/generic_p1_alphatexture_metal.dds',
        emissive: null
      };
    }
    if (matLower.includes('fx')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_fx_normal.dds',
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/generic/gen_p2_fx_01_glow.dds'
      };
    }
    if (matLower.includes('decal')) {
      return {
        diffuse: '/assets1/textures/generic/gen_p2_decal_01_diff.dds',
        normal: '/assets1/textures/paint/paint_p1_decal_01_normal.dds',
        roughness: null,
        metalness: '/assets1/textures/paint/paint_p1_decal_01_metal.dds',
        emissive: '/assets1/textures/generic/gen_p2_decal_01_glow.dds'
      };
    }
    if (matLower.includes('wreck') || lower.includes('wreck')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_wreck_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_wreck_normal.dds',
        roughness: '/assets1/textures/generic/generic_p1_wreck_metal.dds',
        metalness: '/assets1/textures/generic/generic_p1_wreck_metal.dds',
        emissive: '/assets1/textures/generic/generic_p1_wreck_glow.dds'
      };
    }
    // Hull texture (gen_p2_hulltexture_01 / 02) - Opaque hull plating has no emissive glow
    return {
      diffuse: '/assets1/textures/generic/gen_p2_hulltexture_02_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds',
      metalness: '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds',
      emissive: null
    };
  }

  // 8c. Salvaged Debris, Scraps & Ship Wrecks (Scrap Recyclers & Countermeasures)
  if (matLower.includes('wreck') || lower.includes('wreck')) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_wreck_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_wreck_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_wreck_metal.dds',
      metalness: '/assets1/textures/generic/generic_p1_wreck_metal.dds',
      emissive: '/assets1/textures/generic/generic_p1_wreck_glow.dds'
    };
  }

  // 9. Transparent Elements, Windows & Alpha Details
  if (lower.includes('detail_l_alpha') || matLower.includes('alphatexture') || lower.includes('alpha')) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_alphatexture_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_alphatexture_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_alphatexture_spec.dds',
      metalness: '/assets1/textures/generic/generic_p1_alphatexture_metal.dds',
      emissive: null
    };
  }

  // 10. Generic & Boron FX, Holograms, Gas & Nav Lights
  if (matLower.includes('generic_p1_fx') || matLower.includes('bor_p2_fx') || matLower.includes('poslight') || lower.includes('fx_light')) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_fx_normal.dds',
      roughness: null,
      metalness: null,
      emissive: '/assets1/textures/generic/generic_p1_fx_glow.dds'
    };
  }

  // 10b. Detail M, L & S Main Elements (Runway Guidance Lights, Alpha Vents, Plating & Interior FX)
  if (matLower.includes('detail_m_main') || lower.includes('detail_m_main') ||
      matLower.includes('detail_s_main') || lower.includes('detail_s_main') ||
      matLower.includes('detail_l_main') || lower.includes('detail_l_main')) {
    if (matLower.includes('lightcone')) {
      return {
        diffuse: '/assets1/textures/fx/lightcones_soft.dds',
        normal: null,
        roughness: null,
        metalness: null,
        emissive: '/assets1/textures/fx/lightcones_soft.dds'
      };
    }
    if (matLower.includes('alphatexture')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_alphatexture_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_alphatexture_normal.dds',
        roughness: '/assets1/textures/generic/generic_p1_alphatexture_spec.dds',
        metalness: '/assets1/textures/generic/generic_p1_alphatexture_metal.dds',
        emissive: null
      };
    }
    if (matLower.includes('hullpattern')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_hullpattern_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_hullpattern_normal.dds',
        roughness: '/assets1/textures/generic/generic_p1_hullpattern_spec.dds',
        metalness: '/assets1/textures/generic/generic_p1_hullpattern_metal.dds',
        emissive: null
      };
    }
    if (matLower.includes('hulltexture')) {
      return {
        diffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
        normal: '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds',
        roughness: '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds',
        metalness: '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds',
        emissive: null
      };
    }
    return {
      diffuse: '/assets1/textures/generic/generic_p1_fx_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_fx_normal.dds',
      roughness: null,
      metalness: null,
      emissive: '/assets1/textures/generic/generic_p1_fx_glow.dds'
    };
  }


  // 11. Hull Pattern (Secondary Station Panels & Plating)
  if (matLower.includes('hullpattern')) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_hullpattern_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_hullpattern_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_hullpattern_spec.dds',
      metalness: '/assets1/textures/generic/generic_p1_hullpattern_metal.dds',
      emissive: null
    };
  }

  // 11b. Station Liquid & Solid Storage Tanks (Pressurized industrial tanks - non-emissive metallic alloy)
  if (matLower.includes('multimat') || (lower.includes('storage') && lower.includes('liquid') && matLower.includes('hulltexture'))) {
    return {
      diffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds',
      metalness: '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds',
      emissive: null
    };
  }

  // 11c. Cockpit & Observation Window Glass
  if (matLower.includes('glass')) {
    return {
      diffuse: '/assets1/textures/fx/ships_cockpit_glass_diff.dds',
      normal: '/assets1/textures/fx/ships_cockpit_glass_inside_02_normal.dds',
      roughness: '/assets1/textures/fx/ships_cockpit_glass_inside_02_spec.dds',
      metalness: null,
      emissive: null
    };
  }

  // 12. Standard Station Hull Plating (Argon & Universal Industrial Base)
  if (lower.includes('anim_') || lower.includes('detail_xs_main') || lower.includes('part_main') || lower.includes('simon') || matLower.includes('hulltexture')) {
    const isGlowing = lower.includes('anim_arm') || lower.includes('poslight') || lower.includes('light') || lower.includes('fx');
    return {
      diffuse: '/assets1/textures/generic/generic_p1_hulltexture_01_diff.dds',
      normal: '/assets1/textures/generic/generic_p1_hulltexture_01_normal.dds',
      roughness: '/assets1/textures/generic/generic_p1_hulltexture_01_spec.dds',
      metalness: '/assets1/textures/generic/generic_p1_hulltexture_01_metal.dds',
      emissive: isGlowing ? '/assets1/textures/generic/generic_p1_fx_glow.dds' : null
    };
  }

  return { diffuse: null, normal: null, roughness: null, metalness: null, emissive: null };
}
