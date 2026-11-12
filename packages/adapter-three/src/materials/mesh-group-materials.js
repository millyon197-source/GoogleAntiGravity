import * as THREE from 'three';
import { resolveTextureForModel } from '../textures/texture-resolver.js';
import { getRaceGlowColor, getRaceHullColor } from '../textures/race-colors.js';
import { loadPartUvAnimations } from './uv-animations.js';

/**
 * @typedef {Object} MeshGroupMaterialHost
 * @property {(url: string) => Promise<THREE.Texture|null>} loadDdsTexture Texture loader (overridable in tests).
 * @property {number} [glowingEmissiveIntensity] Current glow intensity setting (default 2.2).
 * @property {Array<{texture: THREE.Texture, speedX: number, speedY: number}>} animatedTextures UV-scroll registry read by the render loop.
 * @property {Array<Object>} animatedParts Mesh/part animation registry read by the render loop.
 * @property {() => void} [renderScene] Redraw callback used by interactive material state switches.
 */

/**
 * Replaces the materials of every mesh in a loaded Collada group with X4-styled
 * MeshStandardMaterials: resolves and loads DDS textures per material, classifies the
 * component (hull, decal, glow/FX, forcefield, billboard, water, ...) to set blending,
 * transparency, emissive and shadow behaviour, and registers UV-scroll / part animations
 * on the host registries.
 * @param {MeshGroupMaterialHost} host
 * @param {THREE.Object3D} group Loaded model scene/group (modified in place).
 * @param {string} url Model URL the group was loaded from.
 * @param {number} [moduleIndex] Index of the owning station module, when known.
 * @returns {Promise<void>}
 */
export async function applyTexturesToMeshGroup(host, group, url, moduleIndex) {
  if (!group) return;
  if (!host.animatedTextures) host.animatedTextures = [];
  const canAnimate = (moduleIndex === undefined || moduleIndex === null || typeof host.shouldAnimateModule !== 'function')
    ? true
    : host.shouldAnimateModule(moduleIndex);
  const promises = [];
  const partBase = (url ? url.split('/').pop().split('\\').pop().replace(/-lod\d+\.dae$/i, '').replace(/\.dae$/i, '') : '').toLowerCase();
  const urlLower = (url || '').toLowerCase();
  group.traverse(child => {
    if (child.isMesh) {
      const childLower = (child.name || '').toLowerCase();
      const isDamageArea = childLower.includes('damagearea') || urlLower.includes('damagearea') || (child.parent && (child.parent.name || '').toLowerCase().includes('damagearea'));
      if (isDamageArea) {
        child.visible = false;
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { m.visible = false; });
        }
        return;
      }

      const isBBox = childLower.includes('collision') || childLower.includes('bbox') || childLower.includes('geometryinvisible') || urlLower.includes('geometryinvisible');
      if (isBBox) {
        child.visible = false;
        return;
      }

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        const isForcefield = partBase.includes('forcefield') || childLower.includes('forcefield') || (mat && mat.name && mat.name.toLowerCase().includes('forcefield')) ||
                             partBase.includes('shieldfx') || childLower.includes('shieldfx') ||
                             partBase.startsWith('fx_shield') || childLower.startsWith('fx_shield') ||
                             partBase.includes('gate_haze') ||
                             (mat && mat.name && mat.name.toLowerCase().includes('pattern_hex'));
        const isHaze = partBase.includes('haze') || childLower.includes('haze') || (mat && mat.name && mat.name.toLowerCase().includes('haze'));
        const isLightCone = partBase.includes('lightcone') || childLower.includes('lightcone') || (mat && mat.name && mat.name.toLowerCase().includes('lightcone')) ||
                            partBase.includes('flare') || childLower.includes('flare') || (mat && mat.name && mat.name.toLowerCase().includes('flare'));
        const isSmoke = partBase.includes('smoke') || childLower.includes('smoke') || (mat && mat.name && mat.name.toLowerCase().includes('smoke')) ||
                        partBase.includes('fume') || childLower.includes('fume') || (mat && mat.name && mat.name.toLowerCase().includes('fume')) ||
                        partBase.includes('gas') || childLower.includes('gas') || (mat && mat.name && mat.name.toLowerCase().includes('gas'));
        const isLava = partBase.includes('lava') || childLower.includes('lava') || (mat && mat.name && mat.name.toLowerCase().includes('lava'));
        const isFire = partBase.includes('fire') || childLower.includes('fire') || (mat && mat.name && mat.name.toLowerCase().includes('fire')) || partBase.includes('hotarea') || childLower.includes('hotarea');
        const isVapor = partBase.includes('vapor') || childLower.includes('vapor') || (mat && mat.name && mat.name.toLowerCase().includes('vapor'));
        const isMud = partBase.includes('anim_mud') || childLower.includes('anim_mud');
        const isEscalator = partBase.includes('escalator') || childLower.includes('escalator') || partBase.includes('conveyor') || (mat && mat.name && mat.name.toLowerCase().includes('conveyor'));
        const isDetailL = partBase.includes('detail_l_main') || childLower.includes('detail_l_main');
        const isDetailM = partBase.includes('detail_m_main') || childLower.includes('detail_m_main');
        const isDetailS = partBase.includes('detail_s_main') || childLower.includes('detail_s_main');
        const isDamageArea = childLower.includes('damagearea') || urlLower.includes('damagearea') || (mat && mat.name && mat.name.toLowerCase().includes('damagearea')) || (child.parent && (child.parent.name || '').toLowerCase().includes('damagearea'));
        const isPoslight = !isDamageArea && (partBase.includes('poslight') || childLower.includes('poslight') || (mat && mat.name && mat.name.toLowerCase().includes('poslight')) || (mat && mat.name && (mat.name.toLowerCase().includes('gradient_colour') || mat.name.toLowerCase().includes('gradientcolour') || mat.name.toLowerCase().includes('gradient_color') || mat.name.toLowerCase().includes('gradientcolor'))));
        const isBubbles = partBase.includes('bubble') || childLower.includes('bubble') || (mat && mat.name && mat.name.toLowerCase().includes('bubble'));
        const isHexShield = (mat && mat.name && mat.name.toLowerCase().includes('pattern_hex')) || partBase.startsWith('fx_shield') || childLower.startsWith('fx_shield');
        const isAnimCross = partBase.includes('anim_cross') || childLower.includes('anim_cross');
        const isCrossModule = urlLower.includes('cross') || urlLower.includes('connectionmodules');
        const isCrossAnimArrows = isCrossModule && (partBase.includes('anim_arrows') || childLower.includes('anim_arrows'));
        const hasValidDiffuse = mat && mat.isMeshStandardMaterial && mat.map && (
          (mat.map.image && (mat.map.image.width > 0 || mat.map.image.videoWidth > 0)) ||
          (mat.map.mipmaps && mat.map.mipmaps.length > 0)
        );
        if (hasValidDiffuse && !isForcefield && !isHaze && !isLightCone && !isEscalator && !isDetailL && !isDetailM && !isDetailS && !isPoslight && !isBubbles && !isHexShield && !isSmoke && !isLava && !isFire && !isVapor && !isCrossAnimArrows && !isAnimCross) continue; // Already has diffuse map
        promises.push((async () => {
          const rawMatName = mat ? (mat.name || '') : '';
          const matName = (rawMatName && rawMatName !== 'theresonlyone') ? rawMatName : (child.name || '');
          const texUrls = resolveTextureForModel(url, matName);
          if (texUrls.diffuse) {
            const [diffuseTex, normalTex, roughnessTex, metalnessTex, emissiveTex] = await Promise.all([
              host.loadDdsTexture(texUrls.diffuse),
              texUrls.normal ? host.loadDdsTexture(texUrls.normal) : null,
              texUrls.roughness ? host.loadDdsTexture(texUrls.roughness) : null,
              texUrls.metalness ? host.loadDdsTexture(texUrls.metalness) : null,
              texUrls.emissive ? host.loadDdsTexture(texUrls.emissive) : null
            ]);

            if (diffuseTex) {
              const isAlpha = partBase.includes('alpha') || matName.toLowerCase().includes('alpha') || (child.name || '').toLowerCase().includes('alpha');
              const isFoliage = partBase.includes('foliage') || matName.toLowerCase().includes('foliage') || partBase.includes('foilage') || matName.toLowerCase().includes('foilage');
              const isGlass = partBase.includes('glass') || matName.toLowerCase().includes('glass');
              const isWater = partBase.includes('part_water') || matName.toLowerCase().includes('water');
              const isFxGlow = partBase.includes('fx_glow') || (child.name || '').toLowerCase().includes('fx_glow') || matName.toLowerCase().includes('fx_glow');
              const isWindowfont = partBase.includes('windowfont') || (child.name || '').toLowerCase().includes('windowfont') || matName.toLowerCase().includes('windowfont');
              const isDecal = partBase.includes('decal') || (child.name || '').toLowerCase().includes('decal') || matName.toLowerCase().includes('decal') ||
                              isWindowfont || partBase.includes('font') || (child.name || '').toLowerCase().includes('font') || matName.toLowerCase().includes('font');
              const isLightCone = partBase.includes('lightcone') || matName.toLowerCase().includes('lightcone') || (child.name || '').toLowerCase().includes('lightcone') ||
                                  partBase.includes('flare') || matName.toLowerCase().includes('flare');
              const isSmoke = partBase.includes('smoke') || (child.name || '').toLowerCase().includes('smoke') || matName.toLowerCase().includes('smoke') ||
                              partBase.includes('fume') || (child.name || '').toLowerCase().includes('fume') || matName.toLowerCase().includes('fume') ||
                              partBase.includes('gas') || (child.name || '').toLowerCase().includes('gas') || matName.toLowerCase().includes('gas');
              const isLava = partBase.includes('lava') || (child.name || '').toLowerCase().includes('lava') || matName.toLowerCase().includes('lava');
              const isFire = partBase.includes('fire') || (child.name || '').toLowerCase().includes('fire') || matName.toLowerCase().includes('fire') || partBase.includes('hotarea') || (child.name || '').toLowerCase().includes('hotarea');
              const isVapor = partBase.includes('vapor') || (child.name || '').toLowerCase().includes('vapor') || matName.toLowerCase().includes('vapor');
              const isMud = partBase.includes('anim_mud') || (child.name || '').toLowerCase().includes('anim_mud');
              const isLightConeOrGlow = isFxGlow || isForcefield || isHaze || isBubbles || isLightCone ||
                                        partBase.includes('fx_lightcone') || matName.toLowerCase().includes('fx_lightcone');
              const isDetailMain = partBase.includes('detail_s_main') || partBase.includes('detail_m_main') || partBase.includes('detail_l_main') ||
                                   (child.name || '').toLowerCase().includes('detail_s_main') || (child.name || '').toLowerCase().includes('detail_m_main') || (child.name || '').toLowerCase().includes('detail_l_main');
              const isDockOrDefense = urlLower.includes('dock') || urlLower.includes('defence') || urlLower.includes('defense');
              const hasFx = matName.toLowerCase().includes('fx') || (child.name || '').toLowerCase().includes('fx') || (partBase.includes('detail_s_main') && matName.toLowerCase().includes('lightcone'));
              const isDetailFx = !isDecal && isDetailMain && hasFx;
              const isDockDetailFx = isDetailFx && isDockOrDefense;
              const isNonDockDetailFx = isDetailFx && !isDockOrDefense;
              const isPartMainFx = !isDecal && (partBase.includes('part_main') || (child.name || '').toLowerCase().includes('part_main')) &&
                                   (matName.toLowerCase().includes('fx') || (child.name || '').toLowerCase().includes('fx'));
              const isGenericFx = !isDecal && (matName.toLowerCase().includes('generic_p1_fx') || matName.toLowerCase().includes('gen_p2_fx') || (matName.toLowerCase().includes('fx') && Boolean(texUrls.emissive))) && !isLightConeOrGlow;
              const isAnimCross = partBase.includes('anim_cross') || childLower.includes('anim_cross');
              const isAnimArrows = partBase.includes('anim_arrows') || childLower.includes('anim_arrows');
              const isBillboardDisplay = (urlLower.includes('habitat') || urlLower.includes('hab_') || urlLower.includes('cross') || urlLower.includes('pier') || urlLower.includes('dock') || urlLower.includes('welfare') || urlLower.includes('venture') || urlLower.includes('landmark')) &&
                (isAnimArrows || matName.toLowerCase().includes('billboard')) && !isAnimCross;
              const isHabitatBillboard = (urlLower.includes('habitat') || urlLower.includes('hab_')) &&
                (isAnimArrows || matName.toLowerCase().includes('billboard')) && !isAnimCross;
              const isAdTrim = (isAnimArrows || isAnimCross || matName.toLowerCase().includes('billboardtrims') || matName.toLowerCase().includes('billboard')) && !isBillboardDisplay;
              const isLiquidStorageTank = (urlLower.includes('storage') && urlLower.includes('liquid') && (matName.toLowerCase().includes('multimat') || (child.name || '').toLowerCase().includes('multimat')));
              const isGlowingLight = isLightConeOrGlow || isEscalator || isGenericFx || isDetailFx || isPartMainFx || isAdTrim || isBillboardDisplay || (isDecal && texUrls.emissive) || partBase.includes('poslight') || (child.name || '').toLowerCase().includes('poslight') || matName.toLowerCase().includes('poslight') ||
                                     (texUrls.emissive && partBase.includes('anim_arm'));

              const glowColor = getRaceGlowColor(url + ' ' + matName);
              const hullColor = getRaceHullColor(url + ' ' + matName);
              const adTrimColor = new THREE.Color(0x00F5FF);
              const adDisplayColor = new THREE.Color(0xFFFFFF);
              const poslightGlowColor = new THREE.Color(0xFFB703);
              const forcefieldColor = new THREE.Color(0x00F0FF);
              const liquidTankColor = new THREE.Color(0x3B82C4);

              const hasVertexColors = Boolean(child.geometry && child.geometry.attributes && child.geometry.attributes.color);
              const newMat = new THREE.MeshStandardMaterial({
                vertexColors: hasVertexColors,
                color: (isLightConeOrGlow || isPoslight || isHexShield || isSmoke || isLava || isFire || isVapor) ? 0x000000 : (isWater ? 0x2288aa : (isLiquidStorageTank ? liquidTankColor : (isForcefield ? forcefieldColor : (isDecal || isAdTrim || isBillboardDisplay ? 0xffffff : (diffuseTex ? hullColor : 0x8D99AE))))),
                map: (isLightCone && !isForcefield) ? null : diffuseTex,
                normalMap: (isLightConeOrGlow || isSmoke || isLava || isFire || isVapor) ? null : (normalTex || null),
                normalScale: new THREE.Vector2(1, -1),
                roughnessMap: roughnessTex || null,
                roughness: (isLightConeOrGlow || isSmoke || isLava || isFire || isVapor) ? 1.0 : (isWater ? 0.08 : (isLiquidStorageTank ? (roughnessTex ? 0.35 : 0.38) : (roughnessTex ? 0.55 : 0.6))),
                metalnessMap: metalnessTex || null,
                metalness: (isLightConeOrGlow || isSmoke || isLava || isFire || isVapor) ? 0.0 : (isWater ? 0.1 : (isLiquidStorageTank ? (metalnessTex ? 0.75 : 0.7) : (metalnessTex ? 0.35 : 0.2))),
                emissiveMap: emissiveTex || ((isLightConeOrGlow || isAdTrim || isBillboardDisplay || isSmoke || isLava || isFire) ? diffuseTex : null),
                emissive: (emissiveTex || (isLightConeOrGlow && diffuseTex) || (isAdTrim && diffuseTex) || (isBillboardDisplay && diffuseTex) || (isSmoke && diffuseTex) || (isLava && diffuseTex) || (isFire && diffuseTex))
                  ? (isAnimCross ? adDisplayColor : (isBillboardDisplay ? adDisplayColor : (isLava ? new THREE.Color(0xff4500) : (isFire ? new THREE.Color(0xff6600) : (isHexShield ? new THREE.Color(0x33ccff) : (isSmoke ? new THREE.Color(0xcccccc) : (isPoslight ? poslightGlowColor : (isAdTrim ? adTrimColor : (isForcefield ? forcefieldColor : (isGlowingLight ? glowColor : new THREE.Color(0x000000)))))))))))
                  : (isWater ? new THREE.Color(0x001122) : new THREE.Color(0x000000)),
                emissiveIntensity: (emissiveTex || (isLightConeOrGlow && diffuseTex) || (isAdTrim && diffuseTex) || (isBillboardDisplay && diffuseTex) || (isSmoke && diffuseTex) || (isLava && diffuseTex) || (isFire && diffuseTex))
                  ? (isAnimCross ? 1.2 : (isBillboardDisplay ? 1.0 : (isLava ? 3.5 : (isFire ? 2.8 : (isHexShield ? 3.5 : (isAdTrim ? 2.5 : (isSmoke ? 0.6 : (isLightCone ? 0.35 : (isBubbles ? 1.5 : (isHaze ? (host.glowingEmissiveIntensity || 2.2) * 0.8 : (isForcefield ? 2.0 : (isLightConeOrGlow ? (host.glowingEmissiveIntensity || 2.2) * 1.5 : (isGlowingLight ? (host.glowingEmissiveIntensity || 2.2) : 0.0)))))))))))))
                  : 0.0,
                blending: (isLightConeOrGlow || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor) ? THREE.AdditiveBlending : THREE.NormalBlending,
                toneMapped: (isLava || isFire) ? false : ((isLightCone || isBubbles || isSmoke || isVapor) ? true : (isHexShield ? false : (isGlowingLight ? false : true))),
                transparent: isAlpha || isFoliage || isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor || isAnimCross || isBillboardDisplay || isAnimArrows,
                opacity: isVapor ? 0.4 : (isFire ? 0.85 : (isSmoke ? 0.35 : (isLightCone ? 0.25 : (isHexShield ? 0.2 : (isBubbles ? 0.8 : (isHaze ? 0.35 : (isForcefield ? 0.65 : (isPoslight ? 0.9 : (isLightConeOrGlow ? 0.85 : (isWater ? 0.8 : (isAnimCross ? 0.95 : 1.0))))))))))),
                alphaTest: isAnimCross ? 0.2 : ((isBillboardDisplay || isAnimArrows) ? 0.05 : (isDecal ? 0.1 : ((isAlpha || isFoliage) && !isLightConeOrGlow && !isSmoke && !isLava && !isFire && !isVapor ? 0.35 : 0.0))),
                depthWrite: (isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor || isAnimCross || isBillboardDisplay || isAnimArrows) ? false : true,
                polygonOffset: isDecal || isAnimCross,
                polygonOffsetFactor: (isDecal || isAnimCross) ? -1 : 0,
                polygonOffsetUnits: (isDecal || isAnimCross) ? -1 : 0,
                visible: !isFxGlow && !isDamageArea,
                side: THREE.DoubleSide
              });

              if (isCrossAnimArrows && !child.userData.scanlineVOffset) {
                child.userData.scanlineVOffset = { value: 0.0 };
              }

              if (hasVertexColors || isAnimArrows || isLightCone) {
                newMat.onBeforeCompile = (shader) => {
                  let emissiveChunk = '#include <emissivemap_fragment>';
                  if (hasVertexColors) {
                    emissiveChunk += `
                      #if defined( USE_COLOR_ALPHA )
                        totalEmissiveRadiance *= vColor.rgb;
                      #elif defined( USE_COLOR )
                        totalEmissiveRadiance *= vColor.rgb;
                      #endif`;
                  }
                  if (isLightCone) {
                    emissiveChunk += `
                      #ifdef USE_EMISSIVEMAP
                        // Softly attenuate low-level compression noise and non-zero borders to absolute zero
                        // Eliminates visible polygon plane edges while preserving the luminous light beam
                        float coneLuma = max(emissiveColor.r, max(emissiveColor.g, emissiveColor.b));
                        float coneFade = smoothstep(0.06, 0.30, coneLuma);
                        totalEmissiveRadiance *= coneFade;
                        diffuseColor.a *= coneFade;
                      #endif`;
                  }
                  shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    emissiveChunk
                  );
                  if (isAnimArrows) {
                    shader.fragmentShader = shader.fragmentShader.replace(
                      '#include <map_fragment>',
                      `#include <map_fragment>
                      #if defined( USE_MAP )
                        // The black background in anim_arrows is transparent so the neon glow and anim_cross stencil show through
                        float arrowLuma = max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b));
                        diffuseColor.a *= smoothstep(0.02, 0.15, arrowLuma);
                      #endif`
                    );
                  }
                  if (isCrossAnimArrows && child.userData.scanlineVOffset) {
                    if (shader.uniforms) {
                      shader.uniforms.uCrossScanlineV = child.userData.scanlineVOffset;
                    }
                    shader.fragmentShader = 'uniform float uCrossScanlineV;\n' + shader.fragmentShader;
                    shader.fragmentShader = shader.fragmentShader.replace(
                      '#include <dithering_fragment>',
                      `#include <dithering_fragment>
                      #if defined( USE_UV )
                        float scanlineWave = sin((vUv.y * 32.0 + uCrossScanlineV) * 3.14159265);
                        float scanlineFactor = 0.92 + 0.08 * scanlineWave;
                        gl_FragColor.rgb *= scanlineFactor;
                      #endif`
                    );
                  }
                };
                newMat.customProgramCacheKey = () =>
                  (isAnimArrows ? 'anim_arrows_cutout' : 'standard') +
                  (hasVertexColors ? '_vcolor' : '') +
                  (isCrossAnimArrows ? '_cross' : '') +
                  (isLightCone ? '_lightcone' : '');
              }
              newMat.name = matName;

              if (Array.isArray(child.material)) {
                child.material[i] = newMat;
              } else {
                child.material = newMat;
              }

              if (isAlpha || isBubbles || isHexShield) {
                const repeatTextures = [diffuseTex, normalTex, roughnessTex, metalnessTex, emissiveTex].filter(Boolean);
                for (const tex of repeatTextures) {
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  if (isAlpha || isBubbles) {
                    tex.repeat.set(1, -1);
                    tex.offset.set(0, 1);
                  }
                  tex.needsUpdate = true;
                }
              }

              if (isDecal) {
                child.castShadow = false;
                child.receiveShadow = true;
              }

              if (isDecal || isNonDockDetailFx || ((partBase.includes('detail_l_main') || (child.name || '').toLowerCase().includes('detail_l_main')) && matName.toLowerCase().includes('hulltexture'))) {
                // Static decals, windowfont, and station structural lights/detail_l/detail_s/detail_m meshes must have dedicated non-scrolling UVs
                const isDetailLMainFx = (partBase.includes('detail_l_main') || (child.name || '').toLowerCase().includes('detail_l_main')) &&
                                        (matName.toLowerCase().includes('generic_p1_fx') || matName.toLowerCase().includes('fx'));
                const isActualDecal = !isWindowfont && (partBase.includes('decal') || (child.name || '').toLowerCase().includes('decal') || matName.toLowerCase().includes('decal'));
                const needsVFlip = isDetailLMainFx || isActualDecal;
                ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
                  if (newMat[prop]) {
                    newMat[prop] = newMat[prop].clone();
                    if (needsVFlip) {
                      newMat[prop].wrapS = THREE.RepeatWrapping;
                      newMat[prop].wrapT = THREE.RepeatWrapping;
                      newMat[prop].repeat.set(1, -1);
                      newMat[prop].offset.set(0, 1);
                    } else {
                      newMat[prop].offset.set(0, 0);
                    }
                    newMat[prop].needsUpdate = true;
                  }
                });
              }

              const registerAnimTex = (prop, speedX, speedY) => {
                if (!canAnimate) return;
                if (!newMat[prop]) return;
                const origTex = newMat[prop];
                let animTex = origTex;
                if (isMud) {
                  animTex = origTex.clone();
                  newMat[prop] = animTex;
                }
                animTex.wrapS = THREE.RepeatWrapping;
                animTex.wrapT = THREE.RepeatWrapping;
                animTex.needsUpdate = true;
                host.animatedTextures.push({
                  texture: animTex,
                  speedX,
                  speedY,
                  moduleIndex
                });
              };

              if (isForcefield && !isLightCone && diffuseTex) {
                registerAnimTex('map', 0.04, 0.015);
              }

              if (canAnimate && isBubbles && (diffuseTex || emissiveTex)) {
                const texturesToAnimate = [diffuseTex, emissiveTex].filter(Boolean);
                for (const tex of texturesToAnimate) {
                  if (!host.animatedTextures.some(a => a.texture === tex)) {
                    host.animatedTextures.push({
                      texture: tex,
                      speedX: 0.15,
                      speedY: 0.0,
                      moduleIndex
                    });
                  }
                }
              }

              if (isSmoke && (diffuseTex || emissiveTex)) {
                registerAnimTex('map', 0.04, 0.12);
                registerAnimTex('emissiveMap', 0.04, 0.12);
              }

              if (isLava && (diffuseTex || emissiveTex)) {
                registerAnimTex('map', 0.08, 0.0);
                registerAnimTex('emissiveMap', 0.08, 0.0);
              }

              if (isFire && (diffuseTex || emissiveTex)) {
                registerAnimTex('map', 0.05, 0.15);
                registerAnimTex('emissiveMap', 0.05, 0.15);
              }

              if (isVapor && (diffuseTex || emissiveTex)) {
                registerAnimTex('map', 0.02, 0.10);
                registerAnimTex('emissiveMap', 0.02, 0.10);
              }

              if (isMud && diffuseTex) {
                registerAnimTex('map', 0.02, 0.02);
              }

              if (isEscalator) {
                registerAnimTex('map', 0.0, 0.8);
                registerAnimTex('normalMap', 0.0, 0.8);
                registerAnimTex('roughnessMap', 0.0, 0.8);
                registerAnimTex('metalnessMap', 0.0, 0.8);
                registerAnimTex('emissiveMap', 0.0, 0.8);
              }

              if (isDockDetailFx && diffuseTex) {
                registerAnimTex('map', -0.35, 0.0);
                registerAnimTex('emissiveMap', -0.35, 0.0);
              }

              const isPoslightMesh = !isDamageArea && (partBase.includes('poslight') || (child.name || '').toLowerCase().includes('poslight') || matName.toLowerCase().includes('poslight') || matName.toLowerCase().includes('gradient_colour') || matName.toLowerCase().includes('gradientcolour') || matName.toLowerCase().includes('gradient_color') || matName.toLowerCase().includes('gradientcolor'));
              if (isDamageArea) {
                child.visible = false;
                child.castShadow = false;
                child.receiveShadow = false;
              }
              if (isPoslightMesh) {
                child.castShadow = false;
                child.receiveShadow = false;
                if (diffuseTex) {
                  registerAnimTex('map', -0.3, 0.0);
                  registerAnimTex('emissiveMap', -0.3, 0.0);
                }
              }

              // Connection modules (cross, base, vertical) count as "billboard displays" by URL but play the
              // same X4 arrow toggle; habitat/pier/dock displays keep their own handling
              const isAdTrimMesh = !isDamageArea && partBase.includes('anim_arrows') && (!isBillboardDisplay || urlLower.includes('cross') || urlLower.includes('connectionmodules'));
              if (isAdTrimMesh && (diffuseTex || emissiveTex)) {
                // X4's own UV animation for the part, from its component XML. For anim_arrows, map
                // channel 1 (the sign atlas) toggles u_offset between 0 and 0.25: the icons switch
                // between a pair of atlas cells. A continuous scroll here slid the whole atlas past.
                const uvAnim = await loadPartUvAnimations(url, partBase);
                const atlasTracks = uvAnim && uvAnim.channels[1];
                if (canAnimate && atlasTracks) {
                  // Own copy of the atlas texture: its offset must not move other parts sharing it
                  const copies = new Map();
                  for (const prop of ['map', 'emissiveMap']) {
                    const tex = newMat[prop];
                    if (!tex) continue;
                    if (!copies.has(tex)) {
                      const copy = tex.clone();
                      copy.wrapS = THREE.RepeatWrapping;
                      copy.wrapT = THREE.RepeatWrapping;
                      copy.needsUpdate = true;
                      copies.set(tex, copy);
                      host.animatedTextures.push({ texture: copy, uvTracks: atlasTracks, loopFrames: uvAnim.loopFrames, moduleIndex });
                    }
                    newMat[prop] = copies.get(tex);
                  }
                }
              }

              // Habitat Station Billboards: Static foreground advertisement poster with animated background matrix
              if (isHabitatBillboard && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                const vertCount = child.geometry.attributes.position.count;
                const quadCount = Math.floor(vertCount / 6);
                if (quadCount >= 24 && !child.userData._habitatBillboardPartitioned) {
                  child.userData._habitatBillboardPartitioned = true;
                  const pos = child.geometry.attributes.position.array;
                  const norm = child.geometry.attributes.normal ? child.geometry.attributes.normal.array : null;
                  const uv = child.geometry.attributes.uv ? child.geometry.attributes.uv.array : null;
                  const col = child.geometry.attributes.color ? child.geometry.attributes.color.array : null;

                  const frontIndices = [];
                  const bgIndices = [];
                  for (let q = 0; q < quadCount; q++) {
                    // Multi-layered habitat billboard displays:
                    // Even quads 0..22 are Front advert posters; odd 1..23 and 24..35 are Back/Mid matrix screens
                    const isFront = (q < 24 && q % 2 === 0);
                    const target = isFront ? frontIndices : bgIndices;
                    for (let k = 0; k < 6; k++) {
                      target.push(q * 6 + k);
                    }
                  }

                  const createSubGeom = (indices) => {
                    const sub = new THREE.BufferGeometry();
                    const subPos = new Float32Array(indices.length * 3);
                    const subNorm = norm ? new Float32Array(indices.length * 3) : null;
                    const subUv = uv ? new Float32Array(indices.length * 2) : null;
                    const subCol = col ? new Float32Array(indices.length * 4) : null;
                    for (let j = 0; j < indices.length; j++) {
                      const sIdx = indices[j];
                      subPos[j * 3] = pos[sIdx * 3];
                      subPos[j * 3 + 1] = pos[sIdx * 3 + 1];
                      subPos[j * 3 + 2] = pos[sIdx * 3 + 2];
                      if (subNorm) {
                        subNorm[j * 3] = norm[sIdx * 3];
                        subNorm[j * 3 + 1] = norm[sIdx * 3 + 1];
                        subNorm[j * 3 + 2] = norm[sIdx * 3 + 2];
                      }
                      if (subUv) {
                        subUv[j * 2] = uv[sIdx * 2];
                        subUv[j * 2 + 1] = uv[sIdx * 2 + 1];
                      }
                      if (subCol) {
                        subCol[j * 4] = col[sIdx * 4];
                        subCol[j * 4 + 1] = col[sIdx * 4 + 1];
                        subCol[j * 4 + 2] = col[sIdx * 4 + 2];
                        subCol[j * 4 + 3] = col[sIdx * 4 + 3];
                      }
                    }
                    sub.setAttribute('position', new THREE.BufferAttribute(subPos, 3));
                    if (subNorm) sub.setAttribute('normal', new THREE.BufferAttribute(subNorm, 3));
                    if (subUv) sub.setAttribute('uv', new THREE.BufferAttribute(subUv, 2));
                    if (subCol) sub.setAttribute('color', new THREE.BufferAttribute(subCol, 4));
                    return sub;
                  };

                  const frontGeom = createSubGeom(frontIndices);
                  const bgGeom = createSubGeom(bgIndices);

                  child.geometry.dispose();
                  child.geometry = frontGeom;

                  // Load animated background matrix texture (ads_bg_trims.dds)
                  host.loadDdsTexture('/assets1/textures/ad_signs/ads_bg_trims.dds').then(bgTex => {
                    if (!bgTex) return;
                    bgTex.wrapS = THREE.RepeatWrapping;
                    bgTex.wrapT = THREE.RepeatWrapping;
                    bgTex.needsUpdate = true;

                    const bgMat = new THREE.MeshStandardMaterial({
                      color: 0xffffff,
                      map: bgTex,
                      emissiveMap: bgTex,
                      emissive: new THREE.Color(0x33ccff),
                      emissiveIntensity: 1.0,
                      roughness: 0.5,
                      metalness: 0.1,
                      transparent: true,
                      opacity: 0.85,
                      side: THREE.DoubleSide,
                      depthWrite: false
                    });
                    bgMat.name = matName + '_bg';

                    const bgMesh = new THREE.Mesh(bgGeom, bgMat);
                    bgMesh.name = child.name + '_bg';
                    if (child.parent) {
                      child.parent.add(bgMesh);
                    } else {
                      child.add(bgMesh);
                    }

                    // Continuous vertical scrolling animation matching mapchannel 3
                    if (canAnimate) {
                      host.animatedTextures.push({
                        texture: bgTex,
                        speedX: 0.0,
                        speedY: -0.35,
                        moduleIndex
                      });
                    }
                  });
                }
              }

              // Connection Cross Module Billboards & Background Matrix Screens: struct_arg_cross_01
              const isCrossModule = urlLower.includes('cross') || urlLower.includes('connectionmodules');
              if (isCrossModule && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                const vertCount = child.geometry.attributes.position.count;
                const quadCount = Math.floor(vertCount / 6);
                const isCrossAnimArrows = (partBase.includes('anim_arrows') || childLower.includes('anim_arrows')) && quadCount >= 36;
                const isCrossAnimCross = (partBase.includes('anim_cross') || childLower.includes('anim_cross')) && quadCount >= 10;

                if (isCrossAnimArrows && (!child.userData._crossArrowsPartitioned || !child.userData.setBillboardState || !child.userData.isolatedBillboards || !child.userData.isolatedBillboards.billboard_cross?.isMesh)) {
                  child.userData._crossArrowsPartitioned = true;
                  // Isolate station billboards: Quads 36..43 (Medical Cross, Info, Food, Tools)
                  const pos = child.geometry.attributes.position.array;
                  const norm = child.geometry.attributes.normal ? child.geometry.attributes.normal.array : null;
                  const uv = (child.userData.rawUvs && child.userData.rawUvs.tex0) || (child.geometry.attributes.uv ? child.geometry.attributes.uv.array : null);
                  const rawTex2 = child.userData.rawUvs ? child.userData.rawUvs.tex2 : null;
                  const col = child.geometry.attributes.color ? child.geometry.attributes.color.array : null;
                  const colStride = child.geometry.attributes.color ? child.geometry.attributes.color.itemSize : 4;

                  const createQuadGeom = (quadIndices, uvCell) => {
                    const indices = [];
                    for (const q of quadIndices) {
                      for (let k = 0; k < 6; k++) indices.push(q * 6 + k);
                    }
                    const sub = new THREE.BufferGeometry();
                    const subPos = new Float32Array(indices.length * 3);
                    const subNorm = norm ? new Float32Array(indices.length * 3) : null;
                    const subUv = new Float32Array(indices.length * 2);
                    const subUv2 = rawTex2 ? new Float32Array(indices.length * 2) : null;
                    const subCol = col ? new Float32Array(indices.length * colStride) : null;
                    for (let j = 0; j < indices.length; j++) {
                      const sIdx = indices[j];
                      subPos[j * 3] = pos[sIdx * 3];
                      subPos[j * 3 + 1] = pos[sIdx * 3 + 1];
                      subPos[j * 3 + 2] = pos[sIdx * 3 + 2];
                      if (subNorm) {
                        subNorm[j * 3] = norm[sIdx * 3];
                        subNorm[j * 3 + 1] = norm[sIdx * 3 + 1];
                        subNorm[j * 3 + 2] = norm[sIdx * 3 + 2];
                      }
                      if (uvCell) {
                        const [uMin, uMax, vMin, vMax] = uvCell;
                        const kMod = j % 6;
                        if (kMod === 0 || kMod === 5) { subUv[j * 2] = uMax; subUv[j * 2 + 1] = vMax; }
                        else if (kMod === 1) { subUv[j * 2] = uMax; subUv[j * 2 + 1] = vMin; }
                        else if (kMod === 2 || kMod === 3) { subUv[j * 2] = uMin; subUv[j * 2 + 1] = vMin; }
                        else if (kMod === 4) { subUv[j * 2] = uMin; subUv[j * 2 + 1] = vMax; }
                      } else if (uv) {
                        subUv[j * 2] = uv[sIdx * 2];
                        subUv[j * 2 + 1] = uv[sIdx * 2 + 1];
                      }
                      if (subUv2 && rawTex2) {
                        subUv2[j * 2] = rawTex2[sIdx * 2];
                        subUv2[j * 2 + 1] = rawTex2[sIdx * 2 + 1];
                      }
                      if (subCol) {
                        for (let c = 0; c < colStride; c++) {
                          subCol[j * colStride + c] = col[sIdx * colStride + c];
                        }
                      }
                    }
                    sub.setAttribute('position', new THREE.BufferAttribute(subPos, 3));
                    if (subNorm) sub.setAttribute('normal', new THREE.BufferAttribute(subNorm, 3));
                    sub.setAttribute('uv', new THREE.BufferAttribute(subUv, 2));
                    if (subUv2) sub.setAttribute('uv2', new THREE.BufferAttribute(subUv2, 2));
                    if (subCol) sub.setAttribute('color', new THREE.BufferAttribute(subCol, colStride));
                    return sub;
                  };

                  // Define all 8 billboard sub-meshes on struct_arg_cross_01:
                  // 1. Cross (Medical / Clinic) - Quad 36
                  // 2. Capsule (Pharmacy / Pill) - Quad 37
                  // 3. Info (Information) - Quad 38
                  // 4. Shopping Cart (Retail / Store) - Quad 39
                  // 5. Food (Burger & Drink) - Quad 40
                  // 6. Bed (Hotel / Lodging) - Quad 41
                  // 7. Tools (Repair / Maintenance) - Quad 42
                  // 8. Law (Scales of Justice / Security) - Quad 43
                  const billboardDefs = [
                    { name: 'billboard_cross', quads: [36, 37], uvCell: [0.00, 0.25, 0.50, 0.75] },
                    { name: 'billboard_capsule', quads: [36, 37], uvCell: [0.25, 0.50, 0.50, 0.75] },
                    { name: 'billboard_info', quads: [38, 39], uvCell: [0.75, 1.00, 0.50, 0.75] },
                    { name: 'billboard_shopping_cart', quads: [38, 39], uvCell: [0.00, 0.25, 0.75, 1.00] },
                    { name: 'billboard_food', quads: [40, 41], uvCell: [0.50, 0.75, 0.50, 0.75] },
                    { name: 'billboard_bed', quads: [40, 41], uvCell: [0.25, 0.50, 0.75, 1.00] },
                    { name: 'billboard_tools', quads: [42, 43], uvCell: [0.75, 1.00, 0.75, 1.00] },
                    { name: 'billboard_law', quads: [42, 43], uvCell: [0.50, 0.75, 0.75, 1.00] }
                  ];

                  child.userData.isolatedBillboards = {};
                  for (const def of billboardDefs) {
                    let bMesh = child.getObjectByName(def.name);
                    if (!bMesh) {
                      const bGeom = createQuadGeom(def.quads, def.uvCell);
                      const bMat = child.material.clone();
                      if (child.material.onBeforeCompile) bMat.onBeforeCompile = child.material.onBeforeCompile;
                      if (child.material.customProgramCacheKey) bMat.customProgramCacheKey = child.material.customProgramCacheKey;
                      bMat.transparent = true;
                      bMat.depthWrite = false;
                      bMat.alphaTest = 0.05;
                      bMat.side = THREE.DoubleSide;
                      bMesh = new THREE.Mesh(bGeom, bMat);
                      bMesh.name = def.name;
                      bMesh.renderOrder = 2;
                      child.add(bMesh);
                    }
                    child.userData.isolatedBillboards[def.name] = bMesh;
                  }

                  // Restrict base arrow mesh draw range so it only renders the 36 entrance chevron arrows
                  // and does NOT render quads 36..43 as un-isolated duplicate billboards
                  child.geometry.setDrawRange(0, 36 * 6);

                  // Convenient aliases
                  child.userData.isolatedBillboards.cross = child.userData.isolatedBillboards.billboard_cross;
                  child.userData.isolatedBillboards.capsule = child.userData.isolatedBillboards.billboard_capsule;
                  child.userData.isolatedBillboards.info = child.userData.isolatedBillboards.billboard_info;
                  child.userData.isolatedBillboards.shopping_cart = child.userData.isolatedBillboards.billboard_shopping_cart;
                  child.userData.isolatedBillboards.cart = child.userData.isolatedBillboards.billboard_shopping_cart;
                  child.userData.isolatedBillboards.food = child.userData.isolatedBillboards.billboard_food;
                  child.userData.isolatedBillboards.burger = child.userData.isolatedBillboards.billboard_food;
                  child.userData.isolatedBillboards.bed = child.userData.isolatedBillboards.billboard_bed;
                  child.userData.isolatedBillboards.tools = child.userData.isolatedBillboards.billboard_tools;
                  child.userData.isolatedBillboards.law = child.userData.isolatedBillboards.billboard_law;

                  // 4 physical double-sided billboard signs floating beside arg_cross_01
                  child.userData.isolatedBillboards.sign1 = child.userData.isolatedBillboards.billboard_cross;
                  child.userData.isolatedBillboards.sign2 = child.userData.isolatedBillboards.billboard_info;
                  child.userData.isolatedBillboards.sign3 = child.userData.isolatedBillboards.billboard_food;
                  child.userData.isolatedBillboards.sign4 = child.userData.isolatedBillboards.billboard_tools;
                  child.userData.isolatedBillboards.physicalSigns = [
                    {
                      signIndex: 1,
                      name: 'Sign 1 (Medical Cross / Capsule)',
                      quads: [36, 37],
                      mesh: child.userData.isolatedBillboards.billboard_cross,
                      stateA: child.userData.isolatedBillboards.billboard_cross,
                      stateB: child.userData.isolatedBillboards.billboard_capsule,
                      backingName: 'bg_cross',
                      backingQuads: [10, 11, 12],
                      backingMesh: null
                    },
                    {
                      signIndex: 2,
                      name: 'Sign 2 (Info / Shopping Cart)',
                      quads: [38, 39],
                      mesh: child.userData.isolatedBillboards.billboard_info,
                      stateA: child.userData.isolatedBillboards.billboard_info,
                      stateB: child.userData.isolatedBillboards.billboard_shopping_cart,
                      backingName: 'bg_info',
                      backingQuads: [13, 14, 15],
                      backingMesh: null
                    },
                    {
                      signIndex: 3,
                      name: 'Sign 3 (Food / Bed)',
                      quads: [40, 41],
                      mesh: child.userData.isolatedBillboards.billboard_food,
                      stateA: child.userData.isolatedBillboards.billboard_food,
                      stateB: child.userData.isolatedBillboards.billboard_bed,
                      backingName: 'bg_food',
                      backingQuads: [16, 17, 18],
                      backingMesh: null
                    },
                    {
                      signIndex: 4,
                      name: 'Sign 4 (Tools / Law)',
                      quads: [42, 43],
                      mesh: child.userData.isolatedBillboards.billboard_tools,
                      stateA: child.userData.isolatedBillboards.billboard_tools,
                      stateB: child.userData.isolatedBillboards.billboard_law,
                      backingName: 'bg_tools',
                      backingQuads: [19, 20, 21],
                      backingMesh: null
                    }
                  ];

                  // Check if anim_cross backing matrix screens already exist in the same hierarchy
                  let crossSearchRoot = child;
                  while (crossSearchRoot.parent) crossSearchRoot = crossSearchRoot.parent;
                  let crossBgObj = null;
                  crossSearchRoot.traverse(n => {
                    if (n.isMesh && n.userData?.isolatedBackgrounds) crossBgObj = n;
                  });
                  if (crossBgObj && crossBgObj.userData.isolatedBackgrounds) {
                    for (const sign of child.userData.isolatedBillboards.physicalSigns) {
                      const bg = crossBgObj.userData.isolatedBackgrounds[sign.backingName];
                      if (bg) {
                        sign.backingMesh = bg;
                        if (!bg.userData) bg.userData = {};
                        bg.userData.physicalSign = sign;
                        bg.userData.foregroundMesh = sign.stateA;
                      }
                    }
                    child.userData.isolatedBackgrounds = crossBgObj.userData.isolatedBackgrounds;
                    crossBgObj.userData.physicalSigns = child.userData.isolatedBillboards.physicalSigns;
                  }

                  // Ensure Float32Array buffers for billboard UV states A and B
                  if (!child.userData.billboardStateAUvs || !(child.userData.billboardStateAUvs instanceof Float32Array)) {
                    let arrA = null;
                    if (child.userData.billboardStateAUvs && typeof child.userData.billboardStateAUvs === 'object') {
                      const rawA = child.userData.billboardStateAUvs;
                      const lenA = Object.keys(rawA).length;
                      if (lenA >= vertCount * 2) {
                        arrA = new Float32Array(lenA);
                        for (let i = 0; i < lenA; i++) arrA[i] = rawA[i];
                      }
                    }
                    if (!arrA) {
                      arrA = new Float32Array(vertCount * 2);
                      const curUvs = child.geometry.attributes.uv ? child.geometry.attributes.uv.array : null;
                      if (curUvs) arrA.set(curUvs);
                    }
                    child.userData.billboardStateAUvs = arrA;
                  }

                  if (!child.userData.billboardStateBUvs || !(child.userData.billboardStateBUvs instanceof Float32Array)) {
                    let arrB = null;
                    if (child.userData.billboardStateBUvs && typeof child.userData.billboardStateBUvs === 'object') {
                      const rawB = child.userData.billboardStateBUvs;
                      const lenB = Object.keys(rawB).length;
                      if (lenB >= vertCount * 2) {
                        arrB = new Float32Array(lenB);
                        for (let i = 0; i < lenB; i++) arrB[i] = rawB[i];
                      }
                    }
                    if (!arrB) {
                      arrB = new Float32Array(vertCount * 2);
                      const curUvs = child.geometry.attributes.uv ? child.geometry.attributes.uv.array : null;
                      if (curUvs) arrB.set(curUvs);
                    }
                    child.userData.billboardStateBUvs = arrB;
                  }

                  // 4 pairs of double-sided quads for the 4 signs:
                  // Sign 1 (Quads 36 & 37): Cross <-> Capsule
                  // Sign 2 (Quads 38 & 39): Info <-> Shopping Cart
                  // Sign 3 (Quads 40 & 41): Food <-> Bed
                  // Sign 4 (Quads 42 & 43): Tools <-> Law
                  const signPairs = [
                    { quads: [36, 37], cellA: [0.00, 0.25, 0.50, 0.75], cellB: [0.25, 0.50, 0.50, 0.75] },
                    { quads: [38, 39], cellA: [0.75, 1.00, 0.50, 0.75], cellB: [0.00, 0.25, 0.75, 1.00] },
                    { quads: [40, 41], cellA: [0.50, 0.75, 0.50, 0.75], cellB: [0.25, 0.50, 0.75, 1.00] },
                    { quads: [42, 43], cellA: [0.75, 1.00, 0.75, 1.00], cellB: [0.50, 0.75, 0.75, 1.00] },
                  ];
                  const assignCell = (targetArr, qNum, cell) => {
                    const [uMin, uMax, vMin, vMax] = cell;
                    for (let v = 0; v < 6; v++) {
                      const k = qNum * 6 + v;
                      const kMod = v % 6;
                      if (kMod === 0 || kMod === 5) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMax; }
                      else if (kMod === 1) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMin; }
                      else if (kMod === 2 || kMod === 3) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMin; }
                      else if (kMod === 4) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMax; }
                    }
                  };
                  for (const sp of signPairs) {
                    for (const q of sp.quads) {
                      assignCell(child.userData.billboardStateAUvs, q, sp.cellA);
                      assignCell(child.userData.billboardStateBUvs, q, sp.cellB);
                    }
                  }

                  if (!child.userData.currentBillboardState) {
                    child.userData.currentBillboardState = 'A';
                  }

                  child.userData.setBillboardState = (state, isManual = true) => {
                    if (state === 'auto') {
                      child.userData.manualBillboardState = null;
                      return;
                    }
                    if (isManual) {
                      child.userData.manualBillboardState = state;
                    } else if (child.userData.manualBillboardState) {
                      return;
                    }
                    const target = (state === 'B') ? child.userData.billboardStateBUvs : child.userData.billboardStateAUvs;
                    if (target && child.geometry && child.geometry.attributes.uv) {
                      child.geometry.attributes.uv.array.set(target);
                      child.geometry.attributes.uv.needsUpdate = true;
                    }
                    const isA = (state === 'A');
                    const isB = (state === 'B');
                    const ib = child.userData.isolatedBillboards;
                    if (ib) {
                      if (ib.billboard_cross) ib.billboard_cross.visible = isA;
                      if (ib.billboard_capsule) ib.billboard_capsule.visible = isB;
                      if (ib.billboard_info) ib.billboard_info.visible = isA;
                      if (ib.billboard_shopping_cart) ib.billboard_shopping_cart.visible = isB;
                      if (ib.billboard_food) ib.billboard_food.visible = isA;
                      if (ib.billboard_bed) ib.billboard_bed.visible = isB;
                      if (ib.billboard_tools) ib.billboard_tools.visible = isA;
                      if (ib.billboard_law) ib.billboard_law.visible = isB;
                      if (ib.physicalSigns) {
                        for (const sign of ib.physicalSigns) {
                          sign.mesh = isA ? sign.stateA : sign.stateB;
                        }
                      }
                    }
                    child.userData.currentBillboardState = state;
                    if (typeof host.renderScene === 'function') {
                      host.renderScene();
                    }
                  };

                  // Apply initial billboard state visibility to isolated billboard sub-meshes
                  child.userData.setBillboardState(child.userData.currentBillboardState || 'A', false);

                  if (group && group.userData) {
                    group.userData.setBillboardState = (state) => {
                      group.traverse(obj => {
                        if (obj !== group && obj.userData && typeof obj.userData.setBillboardState === 'function') {
                          obj.userData.setBillboardState(state);
                        }
                      });
                    };
                  }

                  // Egosoft UV animation on mapchannel 1 (200-frame cycle @ 30 fps = 6.6667s):
                  // Frames 0..95: State A (Cross, Info, Food, Tools)
                  // Frames 95..100: Transition to State B
                  // Frames 100..195: State B (Capsule, Shopping Cart, Bed, Law)
                  // Frames 195..200: Transition back to State A
                  // MapChannel 3 scanline scroll: v_offset sweeps +4 to -4 across the 200 frames
                  if (canAnimate) {
                    if (!host.animatedParts) host.animatedParts = [];
                    host.animatedParts.push({
                      object: child,
                      moduleIndex,
                      update: (time) => {
                        const cycleTime = time % 6.6667;
                        const targetState = (cycleTime >= 3.25 && cycleTime < 6.583) ? 'B' : 'A';
                        if (!child.userData.manualBillboardState && targetState !== child.userData.currentBillboardState) {
                          if (typeof child.userData.setBillboardState === 'function') {
                            child.userData.setBillboardState(targetState, false);
                          }
                        }
                        if (child.userData.scanlineVOffset) {
                          const scanlineProgress = cycleTime / 6.6667;
                          child.userData.scanlineVOffset.value = 4.0 - scanlineProgress * 8.0;
                        }
                      }
                    });
                  }
                }

                if (isCrossAnimCross && (!child.userData._crossBgPartitioned || !child.userData.isolatedBackgrounds || !child.userData.isolatedBackgrounds.bg_cross || !child.userData.isolatedBackgrounds.bg_cross.isMesh)) {
                  child.userData._crossBgPartitioned = true;
                  // Restrict base anim_cross draw range immediately to quads 0..9 (chevron backings) so it does
                  // not render quads 10..21 with the parent trim texture (ads_billboardtrims_01_diff.dds)
                  // which causes Z-fighting and degradation over the matrix screens
                  child.geometry.setDrawRange(0, 10 * 6);

                  // Quads 10..21 are the billboard background matrix screens directly behind the 4 billboards
                  const pos = child.geometry.attributes.position.array;
                  const norm = child.geometry.attributes.normal ? child.geometry.attributes.normal.array : null;
                  const uv = (child.userData.rawUvs && child.userData.rawUvs.tex2) || (child.geometry.attributes.uv ? child.geometry.attributes.uv.array : null);
                  const col = child.geometry.attributes.color ? child.geometry.attributes.color.array : null;
                  const colStride = child.geometry.attributes.color ? child.geometry.attributes.color.itemSize : 4;

                  const createQuadGeom = (quadIndices) => {
                    const indices = [];
                    for (const q of quadIndices) {
                      for (let k = 0; k < 6; k++) indices.push(q * 6 + k);
                    }
                    const sub = new THREE.BufferGeometry();
                    const subPos = new Float32Array(indices.length * 3);
                    const subNorm = norm ? new Float32Array(indices.length * 3) : null;
                    const subUv = new Float32Array(indices.length * 2);
                    const subCol = col ? new Float32Array(indices.length * colStride) : null;
                    for (let j = 0; j < indices.length; j++) {
                      const sIdx = indices[j];
                      subPos[j * 3] = pos[sIdx * 3];
                      subPos[j * 3 + 1] = pos[sIdx * 3 + 1];
                      subPos[j * 3 + 2] = pos[sIdx * 3 + 2];
                      if (subNorm) {
                        subNorm[j * 3] = norm[sIdx * 3];
                        subNorm[j * 3 + 1] = norm[sIdx * 3 + 1];
                        subNorm[j * 3 + 2] = norm[sIdx * 3 + 2];
                      }
                      if (uv) {
                        subUv[j * 2] = uv[sIdx * 2];
                        subUv[j * 2 + 1] = uv[sIdx * 2 + 1];
                      }
                      if (subCol) {
                        for (let c = 0; c < colStride; c++) {
                          subCol[j * colStride + c] = col[sIdx * colStride + c];
                        }
                      }
                    }
                    sub.setAttribute('position', new THREE.BufferAttribute(subPos, 3));
                    if (subNorm) sub.setAttribute('normal', new THREE.BufferAttribute(subNorm, 3));
                    sub.setAttribute('uv', new THREE.BufferAttribute(subUv, 2));
                    if (subCol) sub.setAttribute('color', new THREE.BufferAttribute(subCol, colStride));
                    return sub;
                  };

                  const createBackgrounds = (bgTex) => {
                    if (bgTex) {
                      bgTex.wrapS = THREE.RepeatWrapping;
                      bgTex.wrapT = THREE.RepeatWrapping;
                      bgTex.needsUpdate = true;
                    }

                    // As X4 draws them (p1ads ads_p1_billboardtrims_*, shader p1_complex_unlit, ADDITIVE):
                    // each screen is its vertex colour (green, orange, teal...) times the scrolling
                    // gradient_wave layer read through UV set 2, added onto the scene, unlit. The edge
                    // strips fade to black through their vertex colours.
                    const bgMat = new THREE.MeshBasicMaterial({
                      vertexColors: Boolean(col),
                      color: 0xffffff,
                      map: bgTex || null,
                      blending: THREE.AdditiveBlending,
                      transparent: true,
                      side: THREE.DoubleSide,
                      depthWrite: false,
                      toneMapped: false
                    });
                    bgMat.name = matName + '_cross_bg';

                    const bgDefs = [
                      { name: 'bg_cross', quads: [10, 11, 12] },
                      { name: 'bg_info', quads: [13, 14, 15] },
                      { name: 'bg_food', quads: [16, 17, 18] },
                      { name: 'bg_tools', quads: [19, 20, 21] }
                    ];

                    // Not every anim_cross has all 22 quads (struct_arg_base_03 has 14): reading
                    // quads past the end filled panels with NaN vertices. Use only quads that exist
                    // and skip panels that have none (callers already handle a missing panel).
                    const quadCount = Math.floor((child.geometry.attributes.position?.count || 0) / 6);
                    child.userData.isolatedBackgrounds = {};
                    for (const def of bgDefs) {
                      const quads = def.quads.filter(q => q < quadCount);
                      let bMesh = child.getObjectByName(def.name);
                      if (!bMesh || !bMesh.isMesh) {
                        if (quads.length === 0) continue;
                        if (bMesh) child.remove(bMesh);
                        const bGeom = createQuadGeom(quads);
                        bMesh = new THREE.Mesh(bGeom, bgMat);
                        bMesh.name = def.name;
                        bMesh.renderOrder = 1;
                        child.add(bMesh);
                      }
                      child.userData.isolatedBackgrounds[def.name] = bMesh;
                    }

                    // Check if anim_arrows physicalSigns already exist in the same hierarchy
                    let arrowSearchRoot = child;
                    while (arrowSearchRoot.parent) arrowSearchRoot = arrowSearchRoot.parent;
                    let arrowMeshObj = null;
                    arrowSearchRoot.traverse(n => {
                      if (n.isMesh && n.userData?.isolatedBillboards?.physicalSigns) arrowMeshObj = n;
                    });
                    if (arrowMeshObj && arrowMeshObj.userData.isolatedBillboards.physicalSigns) {
                      for (const sign of arrowMeshObj.userData.isolatedBillboards.physicalSigns) {
                        const bg = child.userData.isolatedBackgrounds[sign.backingName];
                        if (bg) {
                          sign.backingMesh = bg;
                          if (!bg.userData) bg.userData = {};
                          bg.userData.physicalSign = sign;
                          bg.userData.foregroundMesh = sign.stateA;
                        }
                      }
                      arrowMeshObj.userData.isolatedBackgrounds = child.userData.isolatedBackgrounds;
                      child.userData.physicalSigns = arrowMeshObj.userData.isolatedBillboards.physicalSigns;
                    }

                    // The gradient layer scrolls with anim_cross's own UV animation (component XML, map
                    // channel 3), in step with the arrow reveal (applyArrowReveal) that uses the same layer
                    if (canAnimate && bgTex && !host.animatedTextures.some(a => a.texture === bgTex && a.moduleIndex === moduleIndex)) {
                      const entry = { texture: bgTex, speedX: 0.0, speedY: -0.35, moduleIndex };
                      host.animatedTextures.push(entry);
                      loadPartUvAnimations(url, partBase).then(uvAnim => {
                        const tracks = uvAnim && uvAnim.channels[3];
                        if (tracks) Object.assign(entry, { uvTracks: tracks, loopFrames: uvAnim.loopFrames, speedY: 0 });
                      }, () => {});
                    }
                  };

                  promises.push(
                    host.loadDdsTexture('/assets1/textures/fx/gradient_wave_01_diff.dds')
                      .then(bgTex => {
                        createBackgrounds(bgTex);
                      })
                      .catch(() => {
                        createBackgrounds(null);
                      })
                  );
                }
              }

              if (isLightConeOrGlow) {
                child.castShadow = false;
                child.receiveShadow = false;
                if (isFxGlow) {
                  child.visible = false;
                }
                if (!isBubbles && !isLightCone && !child.getObjectByName('fx_point_light') && !(child.parent && child.parent.getObjectByName('fx_point_light'))) {
                  let lightDistance = 400;
                  const lightPos = new THREE.Vector3(0, 0, 0);
                  if (child.geometry) {
                    if (!child.geometry.boundingSphere) {
                      try { child.geometry.computeBoundingSphere(); } catch (_) {}
                    }
                    if (child.geometry.boundingSphere) {
                      lightPos.copy(child.geometry.boundingSphere.center);
                      lightDistance = Math.max(300, child.geometry.boundingSphere.radius * 2.5);
                    }
                  }
                  const curIntensity = ((host.glowingEmissiveIntensity !== undefined ? host.glowingEmissiveIntensity : 2.2) / 2.2) * 1.8;
                  const pointLight = new THREE.PointLight(glowColor, curIntensity, lightDistance, 2);
                  pointLight.position.copy(lightPos);
                  pointLight.name = 'fx_point_light';
                  if (isFxGlow && child.parent) {
                    pointLight.position.add(child.position);
                    child.parent.add(pointLight);
                  } else {
                    child.add(pointLight);
                  }
                }
              }
            }
          }
        })());
      }
    }
  });
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
