import * as THREE from 'three';
import { resolveTextureForModel } from '../textures/texture-resolver.js';
import { getRaceGlowColor, getRaceHullColor } from '../textures/race-colors.js';

/**
 * @typedef {Object} BinaryModelHost
 * @property {Map<string, Promise<THREE.Group>>} colladaCache Shared model cache keyed by URL.
 * @property {{ loadMesh: (binUrl: string, jsonUrl: string) => Promise<Object> }} meshLoader Worker-backed mesh loader.
 * @property {(url: string) => Promise<THREE.Texture|null>} loadDdsTexture Texture loader (overridable in tests).
 * @property {number} [glowingEmissiveIntensity] Current glow intensity setting (default 2.2).
 * @property {Array<{texture: THREE.Texture, speedX: number, speedY: number}>} animatedTextures UV-scroll registry read by the render loop.
 */

/**
 * Loads a Vulkan-aligned .bin mesh via the worker and builds a textured, classified THREE.Group.
 * The result promise is cached per binUrl in host.colladaCache.
 * @param {BinaryModelHost} host
 * @param {string} binUrl
 * @param {string} jsonUrl
 * @returns {Promise<THREE.Group>}
 */
export function loadBinaryModel(host, binUrl, jsonUrl) {
  if (host.colladaCache.has(binUrl)) {
    return host.colladaCache.get(binUrl);
  }
  const loadPromise = (async () => {
    const meshData = await host.meshLoader.loadMesh(binUrl, jsonUrl);

    const geometry = new THREE.BufferGeometry();
    const strideFloats = 8;
    const interleavedBuffer = new THREE.InterleavedBuffer(meshData.vertexBuffer, strideFloats);

    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0, false));
    geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 3, false));
    geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 6, false));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indexBuffer, 1));

    if (meshData.metadata && meshData.metadata.boundingBox) {
      const min = meshData.metadata.boundingBox.min;
      const max = meshData.metadata.boundingBox.max;
      geometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(min[0], min[1], min[2]),
        new THREE.Vector3(max[0], max[1], max[2])
      );
      geometry.boundingSphere = new THREE.Sphere();
      geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
    } else {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }

    const partBase = (binUrl ? binUrl.split('/').pop().split('\\').pop().replace(/-lod\d+\.bin$/i, '').replace(/\.bin$/i, '') : '').toLowerCase();
    const isWater = partBase.includes('part_water');
    const isAlpha = partBase.includes('alpha');
    const isFoliage = partBase.includes('foliage') || (binUrl.toLowerCase().includes('wheat') && partBase.includes('detail_s_main'));
    const isFxGlow = partBase.includes('fx_glow');
    const isForcefield = partBase.includes('forcefield') || partBase.startsWith('fx_shield') || partBase.includes('shieldfx') || partBase.includes('gate_haze');
    const isHaze = partBase.includes('haze');
    const isEscalator = partBase.includes('escalator') || partBase.includes('conveyor');
    const isDecal = partBase.includes('decal') || partBase.includes('font') || partBase.includes('windowfont');
    const isDetailM = !isDecal && partBase.includes('detail_m_main') && (binUrl.toLowerCase().includes('dock') || binUrl.toLowerCase().includes('defence') || binUrl.toLowerCase().includes('defense'));
    const isDetailS = !isDecal && partBase.includes('detail_s_main') && (binUrl.toLowerCase().includes('dock') || binUrl.toLowerCase().includes('defence') || binUrl.toLowerCase().includes('defense'));
    const isBubbles = partBase.includes('bubble');
    const isHexShield = partBase.startsWith('fx_shield') || partBase.includes('pattern_hex');
    const isPoslight = !isDecal && (partBase.includes('poslight') || partBase.includes('gradient_colour') || partBase.includes('gradientcolour') || partBase.includes('gradient_color') || partBase.includes('gradientcolor'));
    const isAnimCross = partBase.includes('anim_cross');
    const isAnimArrows = partBase.includes('anim_arrows') || binUrl.toLowerCase().includes('anim_arrows');
    const isBillboardDisplay = (binUrl.toLowerCase().includes('habitat') || binUrl.toLowerCase().includes('hab_') || binUrl.toLowerCase().includes('cross') || binUrl.toLowerCase().includes('pier') || binUrl.toLowerCase().includes('dock') || binUrl.toLowerCase().includes('welfare') || binUrl.toLowerCase().includes('venture') || binUrl.toLowerCase().includes('landmark')) &&
      (isAnimArrows || binUrl.toLowerCase().includes('billboard')) && !isAnimCross;
    const isHabitatBillboard = (binUrl.toLowerCase().includes('habitat') || binUrl.toLowerCase().includes('hab_')) &&
      (isAnimArrows || binUrl.toLowerCase().includes('billboard')) && !isAnimCross;
    const isAdTrim = (isAnimArrows || isAnimCross || binUrl.toLowerCase().includes('billboard')) && !isBillboardDisplay;
    const isLiquidStorageTank = binUrl.toLowerCase().includes('storage') && binUrl.toLowerCase().includes('liquid') && partBase.includes('part_main');
    const isLightCone = partBase.includes('lightcone') || partBase.includes('fx_lightcone');
    const isLightConeOrGlow = isFxGlow || isForcefield || isHaze || isBubbles || isLightCone;
    const isDamageArea = partBase.includes('damagearea') || partBase.includes('triggerpart');
    const isBBox = partBase.includes('geometryinvisible') || partBase.includes('bbox') || partBase.includes('collision');
    
    const texUrls = resolveTextureForModel(binUrl);
    const isGlowingLight = isLightConeOrGlow || isEscalator || isDetailM || isDetailS || isAdTrim || isBillboardDisplay || (isDecal && texUrls.emissive) || partBase.includes('poslight') || partBase.includes('light') ||
                           partBase.includes('beacon') || partBase.includes('fx');

    const glowColor = getRaceGlowColor(binUrl);
    const hullColor = getRaceHullColor(binUrl);
    const adTrimColor = new THREE.Color(0x00F5FF);
    const poslightGlowColor = new THREE.Color(0xFFB703);
    const forcefieldColor = new THREE.Color(0x00F0FF);
    const liquidTankColor = new THREE.Color(0x3B82C4);

    let texture = null;
    let normalTexture = null;
    let roughnessTexture = null;
    let metalnessTexture = null;
    let emissiveTexture = null;

    if (texUrls.diffuse) {
      try { texture = await host.loadDdsTexture(texUrls.diffuse); } catch (_) {}
    }
    if (texUrls.normal) {
      try { normalTexture = await host.loadDdsTexture(texUrls.normal); } catch (_) {}
    }
    if (texUrls.roughness) {
      try { roughnessTexture = await host.loadDdsTexture(texUrls.roughness); } catch (_) {}
    }
    if (texUrls.metalness) {
      try { metalnessTexture = await host.loadDdsTexture(texUrls.metalness); } catch (_) {}
    }
    if (texUrls.emissive) {
      try { emissiveTexture = await host.loadDdsTexture(texUrls.emissive); } catch (_) {}
    }

    const hasVertexColors = Boolean(geometry && geometry.attributes && geometry.attributes.color);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: hasVertexColors,
      color: (isLightConeOrGlow || isPoslight || isHexShield) ? 0x000000 : (isWater ? 0x2288aa : (isLiquidStorageTank ? liquidTankColor : (isForcefield ? forcefieldColor : (isDecal || isAdTrim || isBillboardDisplay ? 0xffffff : (texture ? hullColor : 0x8D99AE))))),
      map: (isLightCone && !isForcefield) ? null : texture,
      normalMap: isLightConeOrGlow ? null : (normalTexture || null),
      normalScale: new THREE.Vector2(1, -1), // Convert DirectX normal maps (Green Down) to OpenGL (Green Up)
      roughnessMap: roughnessTexture || null,
      roughness: isLightConeOrGlow ? 1.0 : (isWater ? 0.08 : (isLiquidStorageTank ? (roughnessTexture ? 0.35 : 0.38) : (roughnessTexture ? 0.55 : 0.6))),
      metalnessMap: metalnessTexture || null,
      metalness: isLightConeOrGlow ? 0.0 : (isWater ? 0.1 : (isLiquidStorageTank ? (metalnessTexture ? 0.75 : 0.7) : (metalnessTexture ? 0.35 : 0.2))),
      emissiveMap: emissiveTexture || ((isLightConeOrGlow || isAdTrim || isBillboardDisplay) ? texture : null),
      emissive: (emissiveTexture || (isLightConeOrGlow && texture) || (isAdTrim && texture) || (isBillboardDisplay && texture))
        ? (isBillboardDisplay ? new THREE.Color(0xffffff) : (isHexShield ? new THREE.Color(0x33ccff) : (isPoslight ? poslightGlowColor : (isAdTrim ? adTrimColor : (isForcefield ? forcefieldColor : (isGlowingLight ? glowColor : new THREE.Color(0x000000)))))))
        : (isWater ? new THREE.Color(0x001122) : new THREE.Color(0x000000)),
      emissiveIntensity: (emissiveTexture || (isLightConeOrGlow && texture) || (isAdTrim && texture) || (isBillboardDisplay && texture))
        ? (isBillboardDisplay ? 1.0 : (isHexShield ? 3.5 : (isAdTrim ? 2.5 : (isLightCone ? 0.35 : (isBubbles ? 1.5 : (isHaze ? (host.glowingEmissiveIntensity || 2.2) * 0.8 : (isForcefield ? 2.0 : (isLightConeOrGlow ? (host.glowingEmissiveIntensity || 2.2) * 1.5 : (isGlowingLight ? (host.glowingEmissiveIntensity || 2.2) : 0.0)))))))))
        : 0.0,
      blending: (isLightConeOrGlow || isHexShield || isPoslight || isForcefield) ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: (isLightCone || isBubbles) ? true : (isHexShield ? false : (isGlowingLight ? false : true)),
      transparent: isAlpha || isFoliage || isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isAnimCross || isBillboardDisplay || isAnimArrows,
      opacity: isLightCone ? 0.25 : (isHexShield ? 0.2 : (isBubbles ? 0.8 : (isHaze ? 0.35 : (isForcefield ? 0.65 : (isPoslight ? 0.9 : (isLightConeOrGlow ? 0.85 : (isWater ? 0.8 : (isAnimCross ? 0.95 : 1.0)))))))),
      alphaTest: isAnimCross ? 0.2 : ((isBillboardDisplay || isAnimArrows) ? 0.05 : (isDecal ? 0.1 : ((isAlpha || isFoliage) && !isLightConeOrGlow ? 0.35 : 0.0))),
      depthWrite: (isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isAnimCross || isBillboardDisplay || isAnimArrows) ? false : true,
      polygonOffset: isDecal || isAnimCross,
      polygonOffsetFactor: (isDecal || isAnimCross) ? -1 : 0,
      polygonOffsetUnits: (isDecal || isAnimCross) ? -1 : 0,
      visible: !isFxGlow && !isBBox && !isDamageArea,
      side: THREE.DoubleSide
    });

    if (hasVertexColors || isAnimArrows || isLightCone) {
      material.onBeforeCompile = (shader) => {
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
              float coneLuma = max(texelEmissive.r, max(texelEmissive.g, texelEmissive.b));
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
      };
      material.customProgramCacheKey = () =>
        (isAnimArrows ? 'anim_arrows_cutout' : 'standard') +
        (hasVertexColors ? '_vcolor' : '') +
        (isLightCone ? '_lightcone' : '');
    }

    if (isAlpha || isBubbles || isHexShield) {
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
        if (material[prop]) {
          material[prop] = material[prop].clone();
          material[prop].wrapS = THREE.RepeatWrapping;
          material[prop].wrapT = THREE.RepeatWrapping;
          if (isAlpha || isBubbles) {
            material[prop].repeat.set(1, -1);
            material[prop].offset.set(0, 1);
          }
          material[prop].needsUpdate = true;
        }
      });
    }

    const registerAnimBinaryTex = (prop, speedX, speedY) => {
      if (typeof host.shouldAnimateModule === 'function' && !host.shouldAnimateModule()) return;
      if (!material[prop]) return;
      const origTex = material[prop];
      const clonedTex = origTex.clone();
      clonedTex.wrapS = THREE.RepeatWrapping;
      clonedTex.wrapT = THREE.RepeatWrapping;
      clonedTex.needsUpdate = true;
      material[prop] = clonedTex;
      host.animatedTextures.push({
        texture: clonedTex,
        speedX,
        speedY
      });
    };

    if (isWater && texture) {
      registerAnimBinaryTex('map', -0.03, 0.0);
    }

    if (isForcefield && texture) {
      registerAnimBinaryTex('map', 0.04, 0.015);
    }

    if (isBubbles && (texture || emissiveTexture)) {
      registerAnimBinaryTex('map', 0.15, 0.0);
      registerAnimBinaryTex('emissiveMap', 0.15, 0.0);
    }

    if (isEscalator) {
      registerAnimBinaryTex('map', 0.0, 0.8);
      registerAnimBinaryTex('normalMap', 0.0, 0.8);
      registerAnimBinaryTex('roughnessMap', 0.0, 0.8);
      registerAnimBinaryTex('metalnessMap', 0.0, 0.8);
      registerAnimBinaryTex('emissiveMap', 0.0, 0.8);
    }

    if ((isDetailM || isDetailS) && (texture || emissiveTexture)) {
      registerAnimBinaryTex('map', -0.35, 0.0);
      registerAnimBinaryTex('emissiveMap', -0.35, 0.0);
    }

    if (isPoslight && (texture || emissiveTexture)) {
      registerAnimBinaryTex('map', -0.3, 0.0);
      registerAnimBinaryTex('emissiveMap', -0.3, 0.0);
    }

    const isDetailL = partBase.includes('detail_l_main');
    const isDetailMNonAnim = partBase.includes('detail_m_main') && !(binUrl.toLowerCase().includes('dock') || binUrl.toLowerCase().includes('defence') || binUrl.toLowerCase().includes('defense'));
    const isDetailSNonAnim = partBase.includes('detail_s_main') && !(binUrl.toLowerCase().includes('dock') || binUrl.toLowerCase().includes('defence') || binUrl.toLowerCase().includes('defense'));
    if (isDecal || isDetailL || isDetailMNonAnim || isDetailSNonAnim) {
      const isDetailLFx = isDetailL && Boolean(material.name && (material.name.toLowerCase().includes('generic_p1_fx') || material.name.toLowerCase().includes('fx')));
      const isActualDecal = !partBase.includes('windowfont') && partBase.includes('decal');
      const needsVFlip = isDetailLFx || isActualDecal;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
        if (material[prop]) {
          material[prop] = material[prop].clone();
          if (needsVFlip) {
            material[prop].wrapS = THREE.RepeatWrapping;
            material[prop].wrapT = THREE.RepeatWrapping;
            material[prop].repeat.set(1, -1);
            material[prop].offset.set(0, 1);
          } else {
            material[prop].offset.set(0, 0);
          }
          material[prop].needsUpdate = true;
        }
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = !isLightConeOrGlow && !isDecal;
    mesh.receiveShadow = !isLightConeOrGlow;
    if (isFxGlow) {
      mesh.visible = false;
    }

    const group = new THREE.Group();
    group.add(mesh);

    if (isLightConeOrGlow && !isBubbles && !isLightCone) {
      let lightDistance = 400;
      const lightPos = new THREE.Vector3(0, 0, 0);
      if (geometry.boundingSphere) {
        lightPos.copy(geometry.boundingSphere.center);
        lightDistance = Math.max(300, geometry.boundingSphere.radius * 2.5);
      }
      const curIntensity = ((host.glowingEmissiveIntensity !== undefined ? host.glowingEmissiveIntensity : 2.2) / 2.2) * 1.8;
      const pointLight = new THREE.PointLight(glowColor, curIntensity, lightDistance, 2);
      pointLight.position.copy(lightPos);
      pointLight.name = 'fx_point_light';
      if (isFxGlow) {
        group.add(pointLight);
      } else {
        mesh.add(pointLight);
      }
    }

    return group;
  })();

  host.colladaCache.set(binUrl, loadPromise);
  return loadPromise;
}
