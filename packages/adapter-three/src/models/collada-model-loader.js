import * as THREE from 'three';

/**
 * Gives the cross module's anim_arrows sign mesh its A/B sign switch: userData.setBillboardState
 * swaps the mesh UVs between userData.billboardStateAUvs and billboardStateBUvs and shows the matching
 * isolated sign meshes. Used by loadColladaModel and when a scene is rebuilt from the scene cache.
 * @param {THREE.Mesh} child
 * @param {{ renderScene?: () => void }} host
 */
export function attachCrossSignSwitch(child, host) {
  child.userData.setBillboardState = (state, isManual = true) => {
    if (state === 'auto') {
      child.userData.manualBillboardState = null;
      return;
    }
    if (isManual) {
      child.userData.manualBillboardState = state;
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
    }
    child.userData.currentBillboardState = state;
    if (typeof host.renderScene === 'function') {
      host.renderScene();
    }
  };
}

/**
 * Scene-level userData.setBillboardState that forwards to every descendant with its own switch.
 * @param {THREE.Object3D} scene
 */
export function attachSceneBillboardSwitch(scene) {
  scene.userData.setBillboardState = (state) => {
    scene.traverse(child => {
      if (child !== scene && child.userData && typeof child.userData.setBillboardState === 'function') {
        child.userData.setBillboardState(state);
      }
    });
  };
}

/**
 * Since three r17x the ColladaLoader converts vertex colours from sRGB to linear on parse.
 * X4 materials (and the emissive `vColor` modulation in applyTexturesToMeshGroup) were tuned
 * against the authored values the older loader kept, so convert them back to keep the
 * upgrade visually neutral. Remove this to adopt colour-managed vertex colours.
 * @param {THREE.Object3D} root
 */
export function restoreAuthoredVertexColors(root) {
  if (!root) return;
  const seen = new Set();
  const c = new THREE.Color();
  root.traverse((child) => {
    const attr = child.isMesh && child.geometry && child.geometry.attributes.color;
    if (!attr || seen.has(attr)) return;
    seen.add(attr);
    for (let i = 0; i < attr.count; i++) {
      c.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i));
      THREE.ColorManagement.workingToColorSpace(c, THREE.SRGBColorSpace);
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  });
}

/**
 * @typedef {Object} ColladaModelHost
 * @property {Map<string, Promise<THREE.Object3D>>} colladaCache Shared model cache keyed by URL.
 * @property {{ parse: Function, load: Function }} colladaLoader A THREE ColladaLoader.
 * @property {() => void} [renderScene] Called after a billboard state switch to redraw.
 */

/**
 * Fetches (or, under Node, reads from disk) and parses a .dae model. Pre-processes the Collada
 * text to pick the correct TEXCOORD/COLOR channels, captures raw UV channels, and wires
 * connection-cross billboard A/B state switching. Falls back to ColladaLoader.load on failure.
 * The result promise is cached per URL in host.colladaCache.
 * @param {ColladaModelHost} host
 * @param {string} url
 * @returns {Promise<THREE.Object3D>}
 */
export function loadColladaModel(host, url) {
  if (host.colladaCache.has(url)) {
    return host.colladaCache.get(url);
  }
  const loadPromise = (async () => {
    try {
      let text = null;
      if (typeof fetch === 'function') {
        try {
          const response = await fetch(url);
          if (response && response.ok) {
            text = await response.text();
          }
        } catch (_) {}
      }
      if (!text && typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          // Node-only (tests/tools) disk fallback; variable specifiers keep the bundler out.
          const fsModuleName = 'fs';
          const pathModuleName = 'path';
          const fs = await import(/* @vite-ignore */ fsModuleName);
          const path = await import(/* @vite-ignore */ pathModuleName);
          const cleanPath = url.replace(/^\/+/, '');
          const diskPath = path.resolve(process.cwd(), cleanPath);
          if (fs.existsSync(diskPath)) {
            text = fs.readFileSync(diskPath, 'utf8');
          }
        } catch (_) {}
      }
      if (text) {
        const urlLower = (url || '').toLowerCase();
        const isBillboard =
          urlLower.includes('billboard') ||
          urlLower.includes('ad_') ||
          urlLower.includes('ads_') ||
          urlLower.includes('anim_arrows') ||
          urlLower.includes('anim_cross') ||
          urlLower.includes('anim_signs') ||
          urlLower.includes('dockingpos') ||
          urlLower.includes('adsign') ||
          text.includes('p1ads') ||
          text.includes('p2ads') ||
          text.includes('ad_signs') ||
          text.includes('billboardtrims');

        // If <vertices> contains multiple TEXCOORD inputs without distinct sets,
        // Three.js ColladaLoader's parseGeometryVertices overwrites data['TEXCOORD'] with the last input.
        // For billboard displays, preserve the authored display screen channel (tex0).
        // For billboard trim bands/chevrons, preserve the trim band channel (tex1).
        // For standard hull meshes, preserve the primary diffuse channel (tex0).
        const getSourceBounds = (srcId) => {
          if (!srcId) return null;
          const cleanId = srcId.replace(/^#/, '');
          const re = new RegExp(`<source id="${cleanId}"[^>]*>[\\s\\S]*?<float_array[^>]*>([\\s\\S]*?)<\\/float_array>`);
          const m = text.match(re);
          if (!m) return null;
          const arr = m[1].trim().split(/\s+/).map(Number);
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < arr.length; i += 2) {
            minU = Math.min(minU, arr[i]); maxU = Math.max(maxU, arr[i]);
            minV = Math.min(minV, arr[i+1]); maxV = Math.max(maxV, arr[i+1]);
          }
          return { minU, maxU, minV, maxV, spanU: maxU - minU, spanV: maxV - minV };
        };

        text = text.replace(/<vertices id="([^"]+)">([\s\S]*?)<\/vertices>/g, (match, vId, vBody) => {
          // Deduplicate COLOR inputs: preserve authored vertex colors (color0) over secondary blank channel (color1)
          const colInputs = vBody.match(/<input\s+semantic="COLOR"[^>]*\/?>/g) || [];
          if (colInputs.length > 1) {
            let keptColor0 = false;
            vBody = vBody.replace(/<input\s+semantic="COLOR"[^>]*\/?>/g, (colInput) => {
              if (colInput.includes('-color0') || (!keptColor0 && !colInput.includes('-color1'))) {
                keptColor0 = true;
                return colInput;
              }
              return colInput.replace('semantic="COLOR"', 'semantic="COLOR1"');
            });
          }

          const texInputs = vBody.match(/<input\s+semantic="TEXCOORD"[^>]*\/?>/g) || [];
          if (texInputs.length <= 1) return `<vertices id="${vId}">${vBody}</vertices>`;

          let pickTex1 = false;
          if (isBillboard && vBody.includes('-tex1')) {
            let tex0Src = null;
            let tex1Src = null;
            for (const inp of texInputs) {
              const src = inp.match(/source="#([^"]+)"/)?.[1];
              if (src) {
                if (src.includes('-tex0')) tex0Src = src;
                else if (src.includes('-tex1')) tex1Src = src;
              }
            }

            const r0 = getSourceBounds(tex0Src);
            const r1 = getSourceBounds(tex1Src);

            const isAnimCross = urlLower.includes('anim_cross');
            const isHabitat = urlLower.includes('habitat') || urlLower.includes('hab_');

            if (isAnimCross && r1 && r1.spanU >= 0.1 && r1.spanU <= 2.0 && Math.abs(r1.minU) <= 2.0 && Math.abs(r1.maxU) <= 2.0) {
              // Emergency lockdown hazard cross overlay is authored on tex1 across all modules
              pickTex1 = true;
            } else if (isHabitat) {
              // Habitat station billboards are authored on tex0 display quad
              pickTex1 = false;
            } else if (r1 && (Math.abs(r1.minU) > 2.0 || Math.abs(r1.maxU) > 2.0 || Math.abs(r1.minV) > 2.0 || Math.abs(r1.maxV) > 2.0 || r1.spanU > 2.0 || r1.spanV > 2.0)) {
              pickTex1 = false;
            } else if (r0 && r0.spanU >= 0.5 && r0.spanV >= 0.3 && r1 && r1.spanU < 0.05) {
              // tex0 is a full display quad while tex1 is a point/zero-span artifact
              pickTex1 = false;
            } else if (r0 && (r0.spanU < 0.05 && r0.spanV < 0.05) && r1) {
              // tex0 is a collapsed speck; pick authored tex1
              pickTex1 = true;
            } else if (text.includes('billboardtrim') || text.includes('billboardtrims') || urlLower.includes('billboardtrims')) {
              // Authored billboard trim strip (full-width band or chevron slice)
              pickTex1 = Boolean(r1 && r1.spanU >= 0.1);
            } else if (r1 && r1.spanU <= 2.0 && r1.spanV <= 2.0 && (urlLower.includes('anim_arrows') || urlLower.includes('anim_cross') || urlLower.includes('anim_signs'))) {
              // Authored chevron/directional trim with bounded coordinates
              pickTex1 = (r1.spanU >= 0.1);
            }
          }

          if (pickTex1) {
            let cleaned = vBody.replace(/<input\s+semantic="TEXCOORD"[^>]*\/?>/g, (texInput) => {
              if (texInput.includes('-tex1')) {
                return texInput;
              }
              if (texInput.includes('-tex0')) {
                return texInput.replace('semantic="TEXCOORD"', 'semantic="TEXCOORD1"');
              }
              return '';
            });
            return `<vertices id="${vId}">${cleaned}</vertices>`;
          } else {
            let keptPrimary = false;
            let keptSecondary = false;
            let cleaned = vBody.replace(/<input\s+semantic="TEXCOORD"[^>]*\/?>/g, (texInput) => {
              if (!keptPrimary) {
                keptPrimary = true;
                return texInput;
              }
              if (!keptSecondary) {
                keptSecondary = true;
                return texInput.replace('semantic="TEXCOORD"', 'semantic="TEXCOORD1"');
              }
              return '';
            });
            return `<vertices id="${vId}">${cleaned}</vertices>`;
          }
        });

        // Extract raw UV channels (tex0, tex1, tex2, tex3) and indices from Collada text
        const rawUvs = {};
        const pMatch = text.match(/<p>([\s\S]*?)<\/p>/);
        if (pMatch) {
          const pIndices = pMatch[1].trim().split(/\s+/).map(Number);
          const sourceMap = {};
          const srcRegex = /<source id="([^"]+)"[^>]*>[\s\S]*?<float_array[^>]*>([\s\S]*?)<\/float_array>/g;
          let sm;
          while ((sm = srcRegex.exec(text)) !== null) {
            const sId = sm[1];
            if (sId.includes('-tex0') || sId.includes('-tex1') || sId.includes('-tex2') || sId.includes('-tex3')) {
              sourceMap[sId] = sm[2].trim().split(/\s+/).map(Number);
            }
          }
          for (const sId in sourceMap) {
            const floats = sourceMap[sId];
            const key = sId.includes('-tex0') ? 'tex0' : (sId.includes('-tex1') ? 'tex1' : (sId.includes('-tex2') ? 'tex2' : 'tex3'));
            const uvArr = new Float32Array(pIndices.length * 2);
            for (let k = 0; k < pIndices.length; k++) {
              const vIdx = pIndices[k];
              uvArr[k * 2] = floats[vIdx * 2];
              uvArr[k * 2 + 1] = floats[vIdx * 2 + 1];
            }
            rawUvs[key] = uvArr;
          }
        }

        if (typeof DOMParser === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
          try {
            // Node-only (tests/tools) fallback. The specifier is held in a variable so the
            // bundler does not follow it and pack jsdom + undici into the browser build.
            const jsdomModuleName = 'jsdom';
            const { JSDOM } = await import(/* @vite-ignore */ jsdomModuleName);
            const dom = new JSDOM();
            globalThis.DOMParser = dom.window.DOMParser;
            globalThis.XMLSerializer = dom.window.XMLSerializer;
          } catch (_) {}
        }
        const collada = host.colladaLoader.parse(text, url);
        if (collada) restoreAuthoredVertexColors(collada.scene);
        if (collada && collada.scene) {
          collada.scene.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
              if (Object.keys(rawUvs).length > 0) {
                child.userData.rawUvs = rawUvs;
              }
              const count = child.geometry.attributes.position.count;
              const childLower = (child.name || '').toLowerCase();
              // Connection Cross modules: struct_arg_cross_01 anim_arrows (44 quads = 264 verts)
              // Quads 0..35 are entrance/exit chevrons on tex1
              // Quads 36..43 are the 4 double-sided station billboard signs:
              // State A: Sign 1 (Q36,37): Cross, Sign 2 (Q38,39): Info, Sign 3 (Q40,41): Food, Sign 4 (Q42,43): Tools
              // State B: Sign 1 (Q36,37): Capsule, Sign 2 (Q38,39): Cart, Sign 3 (Q40,41): Bed, Sign 4 (Q42,43): Law
              if (urlLower.includes('cross') && (urlLower.includes('anim_arrows') || childLower.includes('anim_arrows')) && count === 264 && rawUvs.tex0 && rawUvs.tex1) {
                const hybridA = new Float32Array(264 * 2);
                const hybridB = new Float32Array(264 * 2);
                for (let k = 0; k < 36 * 6; k++) {
                  hybridA[k * 2] = rawUvs.tex1[k * 2];
                  hybridA[k * 2 + 1] = rawUvs.tex1[k * 2 + 1];
                  hybridB[k * 2] = rawUvs.tex1[k * 2];
                  hybridB[k * 2 + 1] = rawUvs.tex1[k * 2 + 1];
                }
                // 4 pairs of double-sided quads for the 4 signs
                const signPairs = [
                  { quads: [36, 37], cellA: [0.00, 0.25, 0.25, 0.50], cellB: [0.25, 0.50, 0.25, 0.50] }, // Cross <-> Capsule
                  { quads: [38, 39], cellA: [0.75, 1.00, 0.25, 0.50], cellB: [0.00, 0.25, 0.00, 0.25] }, // Info <-> Shopping Cart
                  { quads: [40, 41], cellA: [0.50, 0.75, 0.25, 0.50], cellB: [0.25, 0.50, 0.00, 0.25] }, // Food <-> Bed
                  { quads: [42, 43], cellA: [0.75, 1.00, 0.00, 0.25], cellB: [0.50, 0.75, 0.00, 0.25] }, // Tools <-> Law
                ];
                const assignCell = (targetArr, qNum, cell) => {
                  const [uMin, uMax, vMin, vMax] = cell;
                  for (let v = 0; v < 6; v++) {
                    const k = qNum * 6 + v;
                    const kMod = v % 6;
                    if (kMod === 0 || kMod === 5) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMin; }
                    else if (kMod === 1) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMax; }
                    else if (kMod === 2 || kMod === 3) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMax; }
                    else if (kMod === 4) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMin; }
                  }
                };
                for (const sp of signPairs) {
                  for (const q of sp.quads) {
                    assignCell(hybridA, q, sp.cellA);
                    assignCell(hybridB, q, sp.cellB);
                  }
                }
                child.geometry.setAttribute('uv', new THREE.BufferAttribute(hybridA, 2));
                child.userData.billboardStateAUvs = hybridA;
                child.userData.billboardStateBUvs = hybridB;
                child.userData.currentBillboardState = 'A';
                attachCrossSignSwitch(child, host);
              }
              // Connection Cross modules: struct_arg_cross_01 anim_cross (22 quads = 132 verts)
              // Quads 0..9 are chevron backings on tex1; Quads 10..21 are billboard background matrix screens on tex2
              if (urlLower.includes('cross') && (urlLower.includes('anim_cross') || childLower.includes('anim_cross')) && count === 132 && rawUvs.tex1 && rawUvs.tex2) {
                const hybrid = new Float32Array(132 * 2);
                for (let k = 0; k < 10 * 6; k++) {
                  hybrid[k * 2] = rawUvs.tex1[k * 2];
                  hybrid[k * 2 + 1] = rawUvs.tex1[k * 2 + 1];
                }
                for (let k = 10 * 6; k < 132; k++) {
                  hybrid[k * 2] = rawUvs.tex2[k * 2];
                  hybrid[k * 2 + 1] = rawUvs.tex2[k * 2 + 1];
                }
                child.geometry.setAttribute('uv', new THREE.BufferAttribute(hybrid, 2));
              }
            }
          });
          attachSceneBillboardSwitch(collada.scene);
          return collada.scene;
        }
      }
    } catch (_) {
      // Fallback to standard loader
    }
    return new Promise((resolve, reject) => {
      host.colladaLoader.load(
        url,
        (collada) => { restoreAuthoredVertexColors(collada.scene); resolve(collada.scene); },
        undefined,
        (err) => reject(err)
      );
    });
  })();
  host.colladaCache.set(url, loadPromise);
  return loadPromise;
}
