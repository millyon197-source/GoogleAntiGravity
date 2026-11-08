import * as THREE from 'three';
import { getRaceGlowColor } from '../textures/race-colors.js';

const consoleLog = (msg, type = 'log') => (type === 'warn' ? console.warn(msg) : type === 'error' ? console.error(msg) : console.log(msg));

/**
 * @typedef {Object} ModuleMeshHost
 * @property {(macro: string) => {baseName: string, folderPath: string|null, defaultFiles: string[]}} resolveModuleAssetEntry
 * @property {(index: number, macro: string) => string[]} getModuleActiveComponentFiles Active component files for a module.
 * @property {(url: string) => Promise<THREE.Object3D>} loadColladaModel
 * @property {(binUrl: string, jsonUrl: string) => Promise<THREE.Group>} loadBinaryModel
 * @property {(daeUrl: string) => Promise<THREE.Object3D|null>} [loadCachedScene] Prebuilt scene for a
 *   part normally loaded from its .dae (tools/generate-scene-cache.js), or null when there is none.
 * @property {(group: THREE.Object3D, url: string, moduleIndex?: number) => Promise<void>} applyTexturesToMeshGroup
 * @property {number} [glowingEmissiveIntensity] Current glow intensity setting (default 2.2).
 * @property {Array<Object>} animatedParts Mesh/part animation registry read by the render loop.
 */

/**
 * @typedef {Object} ModuleMeshOptions
 * @property {Record<string, number[]>} [partMainOffsets] Per-module part_main placement offsets.
 * @property {Record<string, Object>} [componentOffsets] Per-component placement offsets.
 * @property {(msg: string, type?: 'log'|'warn'|'error') => void} [log] Diagnostic logger.
 */

/**
 * Loads and assembles all component meshes for one station module: resolves its DAE
 * components, loads each (binary fast path or Collada), applies materials, positions
 * components using the offset tables, and registers part animations on the host.
 * @param {ModuleMeshHost} host
 * @param {{ index: number, macro: string }} mod Station module descriptor.
 * @param {ModuleMeshOptions} [options]
 */
export async function loadModuleMesh(host, mod, { partMainOffsets = {}, componentOffsets = {}, log = consoleLog } = {}) {
  const { baseName, folderPath } = host.resolveModuleAssetEntry(mod.macro);
  const activeFiles = host.getModuleActiveComponentFiles(mod.index, mod.macro);
  const uniqueUrls = folderPath ? activeFiles.map(f => `${folderPath}/${f}`) : [];

 //   log(`[*] DAE urls for ${mod.macro} (baseName: ${baseName}): found ${urls.length} URLs )`, 'log');

  if (uniqueUrls.length === 0) {
    return null;
  }

  const loadedScenes = [];
  for (const url of uniqueUrls) {
    try {
      let sceneTemplate = null;
      const binUrl = url.replace(/\.dae$/i, '.bin');
      const jsonUrl = url.replace(/\.dae$/i, '.json');
      const partBase = url.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();

      const uLower = url.toLowerCase();
      const needsCollada =
          partBase.startsWith('fx') ||
          partBase.startsWith('anim') ||
          partBase.includes('billboard') ||
          partBase.includes('ads') ||
          partBase.includes('sign') ||
          uLower.includes('billboard') ||
          uLower.includes('ad_signs') ||
          uLower.includes('/fx_') ||
          uLower.includes('\\fx_') ||
          uLower.includes('/anim_') ||
          uLower.includes('\\anim_') ||
          uLower.includes('detail_m_main') ||
          uLower.includes('detail_l_main') ||
          uLower.includes('detail_s_main') ||
          uLower.includes('simon') ||
          (uLower.includes('part_main') && (uLower.includes('/production/') || uLower.includes('structures\\production')));

      if (needsCollada) {
        // fx*, anim*, billboards/signs, detail_m/l/s_main, simon and production part_main components have
        // distinct subnodes (hull, fx, alpha, lightcones, foliage) and authored colour/UV channels that the
        // .bin format does not keep, so they always come from the .dae: from the prebuilt scene cache
        // when there is one, otherwise parsed by ColladaLoader.
        sceneTemplate = (host.loadCachedScene ? await host.loadCachedScene(url) : null) || await host.loadColladaModel(url);
      } else {
        try {
          // Fast path: Vulkan-aligned binary blob
          sceneTemplate = await host.loadBinaryModel(binUrl, jsonUrl);
        } catch (binErr) {
          log(`[!] No usable .bin for ${url} (${binErr.message}); loading the .dae instead`, 'warn');
          sceneTemplate = await host.loadColladaModel(url);
        }
      }

      if (sceneTemplate) {
        const scene = sceneTemplate.clone();
        scene.traverse(child => {
          if (child.userData) {
            if (child.userData.isolatedBillboards && !child.userData.isolatedBillboards.billboard_cross?.isMesh) {
              delete child.userData.isolatedBillboards;
              delete child.userData._crossArrowsPartitioned;
            }
            if (child.userData.isolatedBackgrounds && !child.userData.isolatedBackgrounds.bg_cross?.isMesh) {
              delete child.userData.isolatedBackgrounds;
              delete child.userData._crossBgPartitioned;
            }
            if (child.userData.physicalSigns) {
              delete child.userData.physicalSigns;
            }
          }
        });
        scene.scale.set(1, 1, 1);
        scene.name = partBase;
        scene.userData.partName = partBase;
        if (mod && mod.index !== undefined) {
          scene.userData.moduleIndex = mod.index;
        }

        // Apply connection offsets for child parts with non-zero connection transforms
        const urlLower = url.toLowerCase();
        if (urlLower.includes('dockarea_arg_m_02_tradestation_01')) {
          if (urlLower.includes('anim_hatch_01')) {
            scene.position.set(-466.9438, 58.5607, -0.07168579);
            scene.quaternion.set(0, 0.7071068, 0, -0.7071067);
          } else if (urlLower.includes('anim_hatch_02')) {
            scene.position.set(467.2225, 58.57285, -0.07168579);
            scene.quaternion.set(0, 0.7071068, 0, -0.7071067);
          }
        } else {
          let off = componentOffsets[baseName]?.[partBase];
          if (!off && urlLower.includes('hab_arg_l_01')) {
            off = componentOffsets['hab_arg_l_01']?.[partBase];
          }
          if (off) {
            if (Array.isArray(off)) {
              scene.position.set(off[0], off[1], off[2]);
              if (off.length >= 7) {
                scene.quaternion.set(off[3], off[4], off[5], off[6]);
              }
            } else if (off.position) {
              scene.position.set(off.position[0], off.position[1], off.position[2]);
              if (off.quaternion) {
                scene.quaternion.set(off.quaternion[0], off.quaternion[1], off.quaternion[2], off.quaternion[3]);
              }
            }
          }
        }
        await host.applyTexturesToMeshGroup(scene, url, mod?.index);
        scene.userData.setBillboardState = (state) => {
          scene.traverse(child => {
            if (child !== scene && child.userData && typeof child.userData.setBillboardState === 'function') {
              child.userData.setBillboardState(state);
            }
          });
        };
        scene.traverse(child => {
          if (child.isMesh) {
            // Ensure geometry has proper normals for lighting if not already authored
            if (child.geometry && !child.geometry.attributes.normal) {
              try {
                child.geometry.computeVertexNormals();
              } catch (geomErr) {
                // Ignore geometry calculation errors
              }
            }

            // Enable shadow casting/receiving
            child.castShadow = true;
            child.receiveShadow = true;

            const childName = (child.name || '').toLowerCase();
            const parentName = (child.parent && child.parent.name || '').toLowerCase();
            const urlLower = (url || '').toLowerCase();
            const isDamageArea = childName.includes('damagearea') || 
                                 parentName.includes('damagearea') || 
                                 urlLower.includes('damagearea') ||
                                 childName.includes('triggerpart') ||
                                 urlLower.includes('triggerpart');
            const isBBox = childName.includes('bbox') || 
                           childName.includes('boundingbox') || 
                           childName.includes('bounding_box') || 
                           childName.includes('collision') ||
                           childName.includes('collision_box') ||
                           childName.includes('collisionbox') ||
                           childName.includes('geometryinvisible') ||
                           urlLower.includes('geometryinvisible') ||
                           isDamageArea ||
                           parentName.includes('bbox') ||
                           parentName.includes('boundingbox') ||
                           parentName.includes('bounding_box') ||
                           parentName.includes('collision');
            const isFxGlow = childName.includes('fx_glow') || urlLower.includes('fx_glow');
            const isForcefield = childName.includes('forcefield') || urlLower.includes('forcefield') ||
                                 childName.includes('shieldfx') || urlLower.includes('shieldfx') ||
                                 ((childName.includes('shield') || urlLower.includes('shield')) && !urlLower.includes('blast') && !childName.includes('blast'));
            const isHaze = childName.includes('haze') || urlLower.includes('haze');
            const isLightCone = childName.includes('lightcone') || urlLower.includes('lightcone');
            const isBubbles = childName.includes('bubble') || urlLower.includes('bubble');
            const isPoslight = childName.includes('poslight') || urlLower.includes('poslight');
            const isSmoke = childName.includes('smoke') || urlLower.includes('smoke') ||
                            childName.includes('fume') || urlLower.includes('fume') ||
                            childName.includes('gas') || urlLower.includes('gas');
            const isVapor = childName.includes('vapor') || urlLower.includes('vapor');
            const isFire = childName.includes('fire') || urlLower.includes('fire') || childName.includes('hotarea') || urlLower.includes('hotarea');
            const isDecal = childName.includes('decal') || urlLower.includes('decal') ||
                            childName.includes('windowfont') || urlLower.includes('windowfont') ||
                            childName.includes('font') || urlLower.includes('font');

            if (isBBox || isFxGlow || isDamageArea) {
              child.visible = false;    
              child.castShadow = false;
              child.receiveShadow = false;
            }

            if (isForcefield || isHaze || isLightCone || isBubbles || isPoslight || isSmoke || isFire || isVapor) {
              child.castShadow = false;
              child.receiveShadow = false;
            }

            if (isDecal) {
              child.castShadow = false;
              child.receiveShadow = true;
            }

            // Process materials (handles both single material and array of materials)
            const processMaterial = (mat) => {
              if (isDamageArea) {
                return new THREE.MeshStandardMaterial({
                  color: 0xFF2222,
                  roughness: 0.8,
                  metalness: 0.1,
                  opacity: 0.15,
                  transparent: true,
                  wireframe: true,
                  visible: false,
                  side: THREE.DoubleSide
                });
              }

              if (!mat) {
                return new THREE.MeshStandardMaterial({
                  color: isBBox ? 0x00F5FF : 0x8D99AE,
                  roughness: isBBox ? 0.8 : 0.6,
                  metalness: isBBox ? 0.1 : 0.2,
                  opacity: isBBox ? 0.15 : 1.0,
                  transparent: isBBox ? true : false,
                  wireframe: isBBox ? true : false,
                  visible: !isFxGlow && !isDamageArea,
                  side: THREE.DoubleSide
                });
              }

              if (isBBox) {
                return new THREE.MeshStandardMaterial({
                  color: 0x00F5FF,
                  roughness: 0.8,
                  metalness: 0.1,
                  opacity: 0.15,
                  transparent: true,
                  wireframe: true,
                  visible: true,
                  side: THREE.DoubleSide,
                  emissive: new THREE.Color(0x002233)
                });
              }

              // If already a MeshStandardMaterial (e.g. from loadBinaryModel or applyTexturesToMeshGroup), preserve it directly
              if (mat.isMeshStandardMaterial && (mat.map || mat.emissiveMap || mat.blending === THREE.AdditiveBlending)) {
                if (isFxGlow) {
                  mat.visible = false;
                }
                return mat;
              }
              
              // Check if the original color is black or too dark
              const baseColor = new THREE.Color(0x8D99AE); // default metal grey
              if (mat.color) {
                // If the color is not pure black or extremely dark, preserve it
                if (mat.color.r > 0.02 || mat.color.g > 0.02 || mat.color.b > 0.02) {
                  baseColor.copy(mat.color);
                }
              }
              
              // Force convert any material type to MeshStandardMaterial to guarantee lighting response
              const isLightConeOrVolumetric = isForcefield || isHaze || isLightCone || isBubbles || isPoslight;
              const newMat = new THREE.MeshStandardMaterial({
                color: isLightConeOrVolumetric ? 0x000000 : (mat.map ? (mat.color || new THREE.Color(0xffffff)) : baseColor),
                map: isLightConeOrVolumetric ? null : (mat.map || null),
                normalMap: isLightConeOrVolumetric ? null : (mat.normalMap || null),
                normalScale: mat.normalScale || new THREE.Vector2(1, -1), // Convert DirectX normal maps (Green Down) to Three.js OpenGL (Green Up)
                roughnessMap: mat.roughnessMap || null,
                metalnessMap: mat.metalnessMap || null,
                emissiveMap: mat.emissiveMap || null,
                bumpMap: mat.bumpMap || null,
                roughness: isLightConeOrVolumetric ? 1.0 : (mat.roughness !== undefined ? mat.roughness : 0.6),
                metalness: isLightConeOrVolumetric ? 0.0 : (mat.metalness !== undefined ? mat.metalness : 0.2),
                opacity: isHaze ? 0.35 : (isForcefield ? 0.65 : (isLightCone ? 0.85 : (isBubbles ? 0.95 : (isPoslight ? 0.9 : (mat.opacity !== undefined ? mat.opacity : 1.0))))),
                transparent: isDecal || isLightConeOrVolumetric || mat.transparent || false,
                alphaTest: isDecal ? 0.1 : (isLightConeOrVolumetric ? 0.0 : (mat.alphaTest !== undefined ? mat.alphaTest : 0.0)),
                depthWrite: (isDecal || isLightConeOrVolumetric) ? false : (mat.depthWrite !== undefined ? mat.depthWrite : true),
                polygonOffset: isDecal,
                polygonOffsetFactor: isDecal ? -1 : 0,
                polygonOffsetUnits: isDecal ? -1 : 0,
                wireframe: false,
                side: THREE.DoubleSide,
                visible: !isFxGlow && !isDamageArea,
                blending: isLightConeOrVolumetric ? THREE.AdditiveBlending : (mat.blending !== undefined ? mat.blending : THREE.NormalBlending),
                toneMapped: (isLightConeOrVolumetric || isDecal) ? false : (mat.toneMapped !== undefined ? mat.toneMapped : true),
                emissive: isPoslight ? new THREE.Color(0xffffff) : (isLightConeOrVolumetric ? getRaceGlowColor(urlLower) : (mat.emissive || new THREE.Color(0x000000))),
                emissiveIntensity: isHaze ? (host.glowingEmissiveIntensity || 2.2) * 0.8 : (isForcefield ? (host.glowingEmissiveIntensity || 2.2) * 1.5 : (isLightCone ? (host.glowingEmissiveIntensity || 2.2) * 1.5 : (isBubbles ? 4.5 : (mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : (mat.emissiveMap ? 1.0 : 0.0)))))
              });

              // If old material had vertex colors enabled, only keep it if geometry actually supports it
              if (mat.vertexColors && child.geometry && child.geometry.attributes.color) {
                newMat.vertexColors = true;
              } else {
                newMat.vertexColors = false;
              }

              newMat.name = mat.name || '';

              return newMat;
            };

            if (Array.isArray(child.material)) {
              child.material = child.material.map(processMaterial);
            } else if (child.material) {
              child.material = processMaterial(child.material);
            }
          }
        });
        loadedScenes.push(scene);

        if (partBase.includes('anim_crane_holder') || partBase.includes('anim_arm')) {
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              scene.position.z = Math.sin(time * 0.25) * 450;
            }
          });
        } else if (partBase.includes('anim_vent')) {
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              scene.rotation.x = Math.sin(time * 1.5) * 0.25;
            }
          });
        } else if ((url.toLowerCase().includes('anim_centrifuge') ||
                    url.toLowerCase().includes('anim_rotor') ||
                    url.toLowerCase().includes('anim_rotator') ||
                    url.toLowerCase().includes('anim_fan') ||
                    url.toLowerCase().includes('anim_stomp_wheels')) &&
                   (partBase.includes('anim_centrifuge') ||
                    partBase.includes('anim_rotor') ||
                    partBase.includes('anim_rotator') ||
                    partBase.includes('anim_fan') ||
                    partBase.includes('anim_stomp_wheels'))) {
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              // Continuous industrial rotation (0.157 rad/s)
              scene.rotation.z = (time * (Math.PI * 2 / 40)) % (Math.PI * 2);
            }
          });
        } else if (url.toLowerCase().includes('anim_stomp') && partBase.startsWith('anim_stomp') && !partBase.includes('wheels')) {
          const basePosY = scene.position.y;
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              // Hydraulic stamping machine motion: downward crush and retract
              const phase = (time * 2.2) % (Math.PI * 2);
              const crush = Math.pow(Math.sin(phase), 4);
              scene.position.y = basePosY - crush * 8.0;
            }
          });
        } else if (url.toLowerCase().includes('anim_alge') && partBase.includes('anim_alge')) {
          const baseRotZ = scene.rotation.z;
          const algeOffset = (partBase.length * 1.3) % Math.PI;
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              // Harmonic bio-flora swaying underwater
              scene.rotation.z = baseRotZ + Math.sin(time * 1.2 + algeOffset) * 0.05;
            }
          });
        } else if (url.toLowerCase().includes('detail_xs_simon')) {
          const simonConfigs = {
            'detail_xs_simon_01': { delta: [-334.78, 0.08, -11.66], period: 80.0 },
            'detail_xs_simon_02': { delta: [120.0, 8.0, -80.0], period: 66.7 },
            'detail_xs_simon_03': { delta: [-60.0, 5.0, 40.0], period: 20.0 },
            'detail_xs_simon_04': { delta: [334.77, -0.13, -200.77], period: 53.3 },
            'detail_xs_simon_05': { delta: [-150.0, -6.0, 70.0], period: 40.0 },
            'detail_xs_simon_06': { delta: [110.0, 10.0, 90.0], period: 48.3 },
            'detail_xs_simon_07': { delta: [-140.0, -8.0, -60.0], period: 33.3 },
            'detail_xs_simon_08': { delta: [-95.10, 33.86, -453.09], period: 60.0 },
            'detail_xs_simon_09': { delta: [-80.0, 12.0, 120.0], period: 56.7 },
            'detail_xs_simon_10': { delta: [-120.0, -10.0, 150.0], period: 66.7 },
            'detail_xs_simon_12': { delta: [258.41, 18.87, -0.91], period: 60.0 },
            'detail_xs_simon_18': { delta: [-332.63, 84.43, -248.36], period: 60.0 }
          };
          const cfg = simonConfigs[partBase] || { delta: [60.0, 5.0, 40.0], period: 40.0 };
          const basePos = scene.position.clone();
          const baseRot = scene.rotation.clone();
          host.animatedParts.push({
            object: scene,
            moduleIndex: mod?.index,
            update: (time) => {
              const phase = (time * (Math.PI * 2 / cfg.period)) % (Math.PI * 2);
              const u = (1 - Math.cos(phase)) * 0.5;
              scene.position.x = basePos.x + u * cfg.delta[0];
              scene.position.y = basePos.y + u * cfg.delta[1] + Math.sin(time * 2.2) * 1.2;
              scene.position.z = basePos.z + u * cfg.delta[2];
              scene.rotation.z = baseRot.z + Math.sin(phase) * 0.08;
              scene.rotation.x = baseRot.x + Math.sin(time * 2.8) * 0.03;
            }
          });
        }
      }
    } catch (e) {
      log(`  [-] Failed to load ${url}: ${e.message || e}`, 'warn');
      // Ignore and check next path
    }
  }

  if (loadedScenes.length === 0) {
    return null;
  }

  const offset = partMainOffsets[baseName];

  const meshGroup = new THREE.Group();
  meshGroup.name = 'module_mesh_group';

  // Advanced electronics hierarchy: attach capsule holders and shields to rotating centrifuge
  if (baseName.includes('prod_gen_advancedelectronics')) {
    const centrifugeChildren = new Set([
      'anim_capsuleholder11',
      'anim_capsuleholder12',
      'anim_capsuleholder13',
      'anim_capsuleholder14',
      'anim_capsuleholder15',
      'anim_capsuleholder16',
      'anim_capsuleshield',
      'anim_holdershield'
    ]);

    let centrifugeScene = loadedScenes.find(s => (s.userData.partName || s.name) === 'anim_centrifuge');
    if (!centrifugeScene && loadedScenes.some(s => centrifugeChildren.has(s.userData.partName || s.name))) {
      centrifugeScene = new THREE.Group();
      centrifugeScene.name = 'anim_centrifuge';
      centrifugeScene.userData.partName = 'anim_centrifuge';
      const centOff = componentOffsets['prod_gen_advancedelectronics']?.['anim_centrifuge'] || [110.487, 2.7689, 0.7379];
      centrifugeScene.position.set(centOff[0], centOff[1], centOff[2]);
      host.animatedParts.push({
        object: centrifugeScene,
        moduleIndex: mod?.index,
        update: (time) => {
          centrifugeScene.rotation.z = (time * (Math.PI * 2 / 40)) % (Math.PI * 2);
        }
      });
      meshGroup.add(centrifugeScene);
    }

    const simonContainerParents = {
      'detail_s_simon_container_01': 'detail_xs_simon_01',
      'detail_s_simon_container_02': 'detail_xs_simon_02',
      'detail_s_simon_container_03': 'detail_xs_simon_03',
      'detail_s_simon_container_04': 'detail_xs_simon_04',
      'detail_s_simon_container_05': 'detail_xs_simon_05',
      'detail_s_simon_container_06': 'detail_xs_simon_06',
      'detail_s_simon_container_07': 'detail_xs_simon_07',
      'detail_s_simon_container_08': 'detail_xs_simon_08',
      'detail_s_simon_container_09': 'detail_xs_simon_09',
      'detail_s_simon_container_10': 'detail_xs_simon_10',
      'detail_s_simon_container_12': 'detail_xs_simon_12',
      'detail_s_simon_container_18': 'detail_xs_simon_18'
    };

    for (const scene of loadedScenes) {
      const pName = scene.userData.partName || scene.name;
      if (centrifugeChildren.has(pName)) {
        if (centrifugeScene) {
          centrifugeScene.add(scene);
        } else {
          meshGroup.add(scene);
        }
      } else if (simonContainerParents[pName]) {
        const parentBotName = simonContainerParents[pName];
        const parentBot = loadedScenes.find(s => (s.userData.partName || s.name) === parentBotName);
        if (parentBot) {
          parentBot.add(scene);
        } else {
          meshGroup.add(scene);
        }
      } else {
        meshGroup.add(scene);
      }
    }
  } else {
    for (const scene of loadedScenes) {
      meshGroup.add(scene);
    }
  }

  if (offset) {
    meshGroup.position.set(-offset[0], offset[1], offset[2]);
  }

  const moduleRoot = new THREE.Group();
  moduleRoot.add(meshGroup);

  // Cross-link billboard physical signs and dedicated anim_cross backing matrix screens
  let crossArrowMesh = null;
  let crossBgMesh = null;
  moduleRoot.traverse(child => {
    if (child.isMesh) {
      if (child.userData?.isolatedBillboards?.physicalSigns) crossArrowMesh = child;
      if (child.userData?.isolatedBackgrounds) crossBgMesh = child;
    }
  });
  if (crossArrowMesh && crossBgMesh) {
    for (const sign of crossArrowMesh.userData.isolatedBillboards.physicalSigns) {
      if (crossBgMesh.userData.isolatedBackgrounds?.[sign.backingName]) {
        const bg = crossBgMesh.userData.isolatedBackgrounds[sign.backingName];
        if (bg) {
          sign.backingMesh = bg;
          if (!bg.userData) bg.userData = {};
          bg.userData.physicalSign = sign;
          bg.userData.foregroundMesh = sign.stateA;
        }
      }
    }
    crossArrowMesh.userData.isolatedBackgrounds = crossBgMesh.userData.isolatedBackgrounds;
    crossBgMesh.userData.physicalSigns = crossArrowMesh.userData.isolatedBillboards.physicalSigns;
    moduleRoot.userData.physicalSigns = crossArrowMesh.userData.isolatedBillboards.physicalSigns;
    moduleRoot.userData.isolatedBillboards = crossArrowMesh.userData.isolatedBillboards;
    moduleRoot.userData.isolatedBackgrounds = crossBgMesh.userData.isolatedBackgrounds;
  }

  moduleRoot.userData.setBillboardState = (state, isManual = true) => {
    moduleRoot.traverse(child => {
      if (child !== moduleRoot && child.userData && typeof child.userData.setBillboardState === 'function') {
        child.userData.setBillboardState(state, isManual);
      }
    });
  };
  return moduleRoot;
}
