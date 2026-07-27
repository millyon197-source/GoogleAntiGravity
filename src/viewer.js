import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { MeshLoader } from './mesh-loader.js';
import { createProceduralModule, getModuleCategory, getFriendlyName, CATEGORY_COLORS } from './modules.js';
import DAE_HASH_TABLE from '../dae_hash_table.json';
import { MACRO_TO_NAME_DB } from './modules-cost-db.js';

function sendLogToVSC(msg, type = 'log') {
  if (type === 'warn') {
    console.warn(msg);
  } else if (type === 'error') {
    console.error(msg);
  } else {
    console.log(msg);
  }
  fetch(`/api/log?msg=${encodeURIComponent(msg)}&type=${type}`).catch(() => {});
}

// Pure JS MurmurHash3_x86_32 implementation
function murmur3_32(key, seed = 0) {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  let c1 = 0xcc9e2d51;
  let c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (((h1 * 5) + 0xe6546b64)) & 0xffffffff;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);

      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function lookupDaeUrls(key) {
  const hashVal = murmur3_32(key);
  const bucketIndex = hashVal % 1223;
  const bucket = DAE_HASH_TABLE[bucketIndex] || [];
  const entry = bucket.find(item => item.key === key);
  if (!entry) return [];
  return entry.files.map(file => `${entry.folder_path}/${file}`);
}

export class StationViewer {
  constructor(containerElement, onModuleSelectedCallback) {
    this.container = containerElement;
    this.onModuleSelected = onModuleSelectedCallback;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.modulesGroup = new THREE.Group();
    this.selectionHelper = null;
    this.starfield = null;
    this.gridHelper = null;
    this.majorGridHelper = null;
    this.plotBounds = null;
    this.orientationHelper = null;

    this.animationFrameId = null;
    this.clock = new THREE.Clock();

    // Configuration settings
    this.showGrid = true;
    this.showOrientation = false;
    this.wireframeMode = false;
    this.ghostMode = false;
    this.hiddenMacros = new Set();
    this.currentPlan = null;
    this.currentBuildProgressPercentage = 100;
    this.highlightHelpers = [];
    this.isColorized = true;
    this.colladaLoader = new ColladaLoader();
    this.meshLoader = new MeshLoader('./src/mesh-worker.js');
    this.colladaCache = new Map();

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814); // Deep space blue/black

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 30000);
    this.camera.position.set(400, 300, 600);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Clear container and append canvas
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 2000000;
    this.controls.minDistance = 10;

    // 5. Lighting
    this.setupLighting();

    // 7. Grid & Plot Boundaries
    this.createGridAndBounds();

    // 8. Add Modules Group
    this.scene.add(this.modulesGroup);

    // 9. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('[!] WebGL context lost. Attempting restore...');
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('[*] WebGL context restored.');
      if (this.currentPlan) {
        this.loadStationPlan(this.currentPlan);
      }
    });

    // 10. Start Animation Loop
    this.animate();
  }

  setupLighting() {
    // Ambient fill light (cool nebula glow) - High Ambient
    const ambientLight = new THREE.AmbientLight(0x22294A, 5.0);
    this.scene.add(ambientLight);

    // Camera headlight (directional light attached to camera with zero distance falloff)
    const cameraLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.camera.add(cameraLight);
    this.scene.add(this.camera);

    // Planetary blue-indigo glow from below - Brightened
    const hemisphereLight = new THREE.HemisphereLight(0x3B4E8C, 0x060814, 2.0);
    this.scene.add(hemisphereLight);

    // Primary solar key light (intense white-orange star light) - Brightened
    const sunLight = new THREE.DirectionalLight(0xFFEADB, 3.8);
    sunLight.position.set(100000, 80000, 100000);
    sunLight.castShadow = true;
    
    // Configure shadow map size for high quality
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 500000;
    
    const d = 50000;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;

    this.scene.add(sunLight);

    // Opposing fill light to brighten the dark shadow sides of the modules
    const fillLight = new THREE.DirectionalLight(0x6B7DFF, 4.0);
    fillLight.position.set(-100000, -80000, -100000);
    this.scene.add(fillLight);
  }


  setMajorGridSize(sizeVal, isExplicit = true) {
    this.majorGridSize = parseInt(sizeVal, 10);
    this.isUserGridSizeExplicit = isExplicit;
    this.showGrid = (this.majorGridSize > 0);
    this.restoreFullPlanGrid();
  }

  createGridLayer(gridSize, step, color, opacity, yOffset, renderOrder, centerX, gridY, centerZ) {
    const divisions = Math.round(gridSize / step);
    const grid = new THREE.GridHelper(gridSize, divisions, color, color);
    grid.position.set(centerX, gridY + yOffset, centerZ);
    grid.visible = this.showGrid;
    grid.renderOrder = renderOrder;

    const configureMaterial = (mat) => {
      mat.depthWrite = false;
      mat.transparent = true;
      mat.opacity = opacity;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -renderOrder;
      mat.polygonOffsetUnits = -renderOrder * 2;
    };

    if (Array.isArray(grid.material)) {
      grid.material.forEach(configureMaterial);
    } else {
      configureMaterial(grid.material);
    }

    this.scene.add(grid);
    if (!this.gridLayers) this.gridLayers = [];
    this.gridLayers.push(grid);
    return grid;
  }

  createGridAndBounds() {
    this.rebuildGridAndBounds(3000, 3000, 3000, 0, 0, 0, -50);
  }

  rebuildGridAndBounds(sizeX, sizeZ, sizeY, centerX, centerY, centerZ, gridY) {
    // Clean up previous grid layers
    if (this.gridLayers) {
      this.gridLayers.forEach(grid => {
        this.scene.remove(grid);
        grid.geometry.dispose();
        if (Array.isArray(grid.material)) {
          grid.material.forEach(m => m.dispose());
        } else {
          grid.material.dispose();
        }
      });
    }
    this.gridLayers = [];

    if (this.plotBounds) {
      this.scene.remove(this.plotBounds);
      this.plotBounds.geometry.dispose();
      if (Array.isArray(this.plotBounds.material)) {
        this.plotBounds.material.forEach(m => m.dispose());
      } else {
        this.plotBounds.material.dispose();
      }
      this.plotBounds = null;
    }

    // Evaluate estimated bounding envelope if user hasn't explicitly locked grid size
    if (!this.isUserGridSizeExplicit && this.majorGridSize !== 0) {
      const maxDim = Math.max(sizeX, sizeZ, sizeY);
      if (sizeX > 10000 || sizeY > 10000 || sizeZ > 10000) {
        this.majorGridSize = 5000;
      } else if (maxDim > 5000) {
        this.majorGridSize = 1000;
      } else {
        this.majorGridSize = 500;
      }

      // Sync UI selector element
      if (typeof document !== 'undefined') {
        const gridSizeSelector = document.getElementById('grid-size-selector');
        if (gridSizeSelector) {
          gridSizeSelector.value = this.majorGridSize.toString();
        }
      }
    }

    if (this.majorGridSize === undefined) {
      this.majorGridSize = 500;
    }

    if (this.majorGridSize === 0 || !this.showGrid) {
      return;
    }

    const selectedStep = this.majorGridSize || 500;
    const maxDim = Math.max(sizeX, sizeZ, selectedStep * 2, 1000);
    const gridSize = Math.ceil(maxDim / selectedStep) * selectedStep;

    if (selectedStep === 5000) {
      // 5000m Major (Selected Boldest)
      this.createGridLayer(gridSize, 5000, 0x00F5FF, 0.85, 0.40, 4, centerX, gridY, centerZ);
      // 1000m Sub-Grid (Less intense)
      this.createGridLayer(gridSize, 1000, 0x3B6FA5, 0.55, 0.25, 3, centerX, gridY, centerZ);
      // 500m Sub-Grid (Lower intensity)
      this.createGridLayer(gridSize, 500, 0x2E4070, 0.40, 0.10, 2, centerX, gridY, centerZ);
      // 100m Minor Grid (Least value)
      this.createGridLayer(gridSize, 100, 0x1E2F56, 0.25, 0.00, 1, centerX, gridY, centerZ);
    } else if (selectedStep === 1000) {
      // 1000m Major (Selected Boldest)
      this.createGridLayer(gridSize, 1000, 0x00F5FF, 0.85, 0.30, 3, centerX, gridY, centerZ);
      // 500m Sub-Grid (Less intense)
      this.createGridLayer(gridSize, 500, 0x3B6FA5, 0.55, 0.15, 2, centerX, gridY, centerZ);
      // 100m Minor Grid (Least value)
      this.createGridLayer(gridSize, 100, 0x1E2F56, 0.30, 0.00, 1, centerX, gridY, centerZ);
    } else {
      // 500m Major (Selected Boldest)
      this.createGridLayer(gridSize, 500, 0x00F5FF, 0.85, 0.20, 2, centerX, gridY, centerZ);
      // 100m Minor Grid (Least value)
      this.createGridLayer(gridSize, 100, 0x2E4070, 0.45, 0.00, 1, centerX, gridY, centerZ);
    }

    if (this.orientationHelper) {
      this.scene.remove(this.orientationHelper);
      this.orientationHelper.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.orientationHelper = null;
    }

    // 3. Plot Bounds Box
    const boundsGeo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const edges = new THREE.EdgesGeometry(boundsGeo);
    const boundsMat = new THREE.LineBasicMaterial({
      color: 0x00F5FF,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    this.plotBounds = new THREE.LineSegments(edges, boundsMat);
    this.plotBounds.position.set(centerX, centerY, centerZ);
    this.plotBounds.visible = this.showGrid;
    this.plotBounds.renderOrder = 5;
    this.scene.add(this.plotBounds);

    // 4. Doubled 3-Axis 3D Orientation Helper just outside the Front-Right Bounding Box Corner
    // Doubled scale (min 1000m, max 3600m)
    const maxBoundDim = Math.max(sizeX, sizeZ, sizeY);
    const arrowLen = Math.min(3600, Math.max(1000, maxBoundDim * 0.30));

    const cornerX = centerX + sizeX / 2 + arrowLen * 0.40;
    const cornerZ = centerZ + sizeZ / 2 + arrowLen * 0.40;
    const cornerY = gridY + 15;

    this.orientationHelper = new THREE.Group();
    this.orientationHelper.position.set(cornerX, cornerY, cornerZ);

    const setupArrowMat = (arrow) => {
      if (arrow.line && arrow.line.material) {
        arrow.line.material.depthWrite = false;
        arrow.line.material.transparent = true;
      }
      if (arrow.cone && arrow.cone.material) {
        arrow.cone.material.depthWrite = false;
        arrow.cone.material.transparent = true;
      }
      arrow.renderOrder = 6;
    };

    // 1) Forward Direction Arrow (+Z) - Bold Cyan
    const fwdDir = new THREE.Vector3(0, 0, 1);
    const fwdArrow = new THREE.ArrowHelper(
      fwdDir,
      new THREE.Vector3(0, 0, 0),
      arrowLen,
      0x00F5FF,
      arrowLen * 0.30,
      arrowLen * 0.15
    );
    setupArrowMat(fwdArrow);
    this.orientationHelper.add(fwdArrow);

    const fwdLabel = this.createDirectionLabelSprite('+Z (FORWARD)', '#00F5FF');
    fwdLabel.position.set(0, arrowLen * 0.30, arrowLen * 1.20);
    fwdLabel.scale.set(arrowLen * 1.0, arrowLen * 0.35, 1);
    fwdLabel.renderOrder = 7;
    this.orientationHelper.add(fwdLabel);

    // 2) Right Direction Arrow (+X) - Vibrant Amber/Orange
    const rightDir = new THREE.Vector3(1, 0, 0);
    const rightArrow = new THREE.ArrowHelper(
      rightDir,
      new THREE.Vector3(0, 0, 0),
      arrowLen,
      0xFF9F1C,
      arrowLen * 0.30,
      arrowLen * 0.15
    );
    setupArrowMat(rightArrow);
    this.orientationHelper.add(rightArrow);

    const rightLabel = this.createDirectionLabelSprite('+X (RIGHT)', '#FF9F1C');
    rightLabel.position.set(arrowLen * 1.20, arrowLen * 0.30, 0);
    rightLabel.scale.set(arrowLen * 1.0, arrowLen * 0.35, 1);
    rightLabel.renderOrder = 7;
    this.orientationHelper.add(rightLabel);

    // 3) Up Direction Arrow (+Y) - Emerald Green
    const upDir = new THREE.Vector3(0, 1, 0);
    const upArrow = new THREE.ArrowHelper(
      upDir,
      new THREE.Vector3(0, 0, 0),
      arrowLen,
      0x00FF88,
      arrowLen * 0.30,
      arrowLen * 0.15
    );
    setupArrowMat(upArrow);
    this.orientationHelper.add(upArrow);

    const upLabel = this.createDirectionLabelSprite('+Y (UP)', '#00FF88');
    upLabel.position.set(0, arrowLen * 1.20, 0);
    upLabel.scale.set(arrowLen * 1.0, arrowLen * 0.35, 1);
    upLabel.renderOrder = 7;
    this.orientationHelper.add(upLabel);

    // Ground Anchor Ring & Center Node
    const ringGeo = new THREE.RingGeometry(arrowLen * 0.12, arrowLen * 0.20, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00F5FF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.renderOrder = 6;
    this.orientationHelper.add(ringMesh);

    const nodeGeo = new THREE.SphereGeometry(arrowLen * 0.09, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.95, depthWrite: false });
    const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
    nodeMesh.renderOrder = 6;
    this.orientationHelper.add(nodeMesh);

    this.orientationHelper.visible = this.showGrid && this.showOrientation;
    this.scene.add(this.orientationHelper);
  }

  createDirectionLabelSprite(text, colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(4, 8, 20, 0.92)';
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 8;
    ctx.fillRect(8, 8, 496, 112);
    ctx.strokeRect(8, 8, 496, 112);
    ctx.font = 'Bold 46px monospace';
    ctx.fillStyle = colorStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    return sprite;
  }

  restoreFullPlanGrid() {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) {
      this.rebuildGridAndBounds(3000, 3000, 3000, 0, 0, 0, -50);
      return;
    }

    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const pad = 1.2;
    const sizeX = Math.max(size.x * pad, 3000);
    const sizeY = Math.max(size.y * pad, 3000);
    const sizeZ = Math.max(size.z * pad, 3000);
    const gridY = box.min.y - 10;

    this.rebuildGridAndBounds(sizeX, sizeZ, sizeY, center.x, center.y, center.z, gridY);
  }

  async loadStationPlan(planData) {
    this.clear();
    this.currentPlan = planData;
    this.hiddenMacros.clear();
    this.currentBuildProgressPercentage = 100;
    this.clearFilterHighlights();

    if (!planData.modules || planData.modules.length === 0) return;

    console.log(`[*] Loading ${planData.modules.length} station modules...`);

    // Display the loader banner
    const loaderBanner = document.getElementById('model-loader-status');
    const loaderText = document.getElementById('model-loader-text');
    if (loaderBanner && loaderText) {
      loaderBanner.style.display = 'flex';
      loaderText.textContent = `Preparing to load ${planData.modules.length} modules...`;
    }

    const total = planData.modules.length;
    let completed = 0;

    for (const mod of planData.modules) {
      const friendlyName = getFriendlyName(mod.macro);
      
      // Update loading text when module loading starts or progresses
      if (loaderText) {
        loaderText.textContent = `Loading: ${friendlyName} (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      let moduleGroup = await this.loadModuleMesh(mod);
      let isDae = false;
      if (!moduleGroup) {
        sendLogToVSC(`[!]Loading: ${friendlyName} DAE files not found/loaded for ${mod.macro}. Falling back to procedural representation.`, 'warn');
        moduleGroup = createProceduralModule(mod.macro, THREE);
        const baseFriendlyName = MACRO_TO_NAME_DB[mod.macro] || friendlyName;
        if (!baseFriendlyName.endsWith(' (Procedural)')) {
          MACRO_TO_NAME_DB[mod.macro] = baseFriendlyName + ' (Procedural)';
        }
      } else {
        isDae = true;
      }

      // Position coordinates (convert standard X4 coordinates if needed)
      moduleGroup.position.set(mod.position.x, mod.position.y, -mod.position.z);

      // Rotations are in degrees: yaw (Y), pitch (X), roll (Z)
      // Apply correct rotation order 'YXZ' which corresponds to X4's rotation sequence
      moduleGroup.rotation.order = 'YXZ';
      moduleGroup.rotation.y = mod.rotation.yaw * Math.PI / 180;
      moduleGroup.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
      moduleGroup.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;

      // Save references in mesh userData
      moduleGroup.userData.index = mod.index;
      moduleGroup.userData.macro = mod.macro;
      moduleGroup.userData.connection = mod.connection;

      // Enable casting/receiving shadow on child meshes
      moduleGroup.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.moduleIndex = mod.index; // For raycasting target identification
        }
      });

      this.modulesGroup.add(moduleGroup);

      completed++;
      if (loaderText) {
        const typeStr = isDae ? 'DAE' : 'Procedural';
        if(!isDae)
          loaderText.textContent = `Loaded: ${friendlyName} (${typeStr}) (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Increase visual depth to maximum depth (far clipping plane) to avoid clipping large station plans
    this.camera.far = 1000000;
    this.camera.updateProjectionMatrix();

    // Hide the loader banner
    if (loaderBanner) {
      loaderBanner.style.display = 'none';
    }

    // Auto-center camera to fit the loaded station bounds
    this.fitCameraToStation();
    this.restoreFullPlanGrid();

    if (this.isColorized) {
      this.setColorized(true);
    }
  }

  async loadModuleMesh(mod) {
    let baseName = mod.macro.replace('_macro', '').toLowerCase();
    const origBaseName = baseName;

    // Replace buildmodule_gen_equip_* and buildmodule_gen_ships_* with _arg_ key lookups
    if (baseName.startsWith('buildmodule_gen_equip_') || baseName.startsWith('buildmodule_gen_ships_')) {
      baseName = baseName.replace('buildmodule_gen_', 'buildmodule_arg_');
    }

    let urls = lookupDaeUrls(baseName);

    if (urls.length === 0) {
      const prefixes = ['prod_', 'buildmodule_', 'landmarks_'];
      let foundGen = false;
      for (const pref of prefixes) {
        if (foundGen) break;
        if (baseName.startsWith(pref)) {
          const factions = ['arg', 'par', 'tel', 'spl', 'ter', 'bor', 'xen', 'kha', 'pir'];
          for (const fac of factions) {
            const prefix = `${pref}${fac}_`;
            if (baseName.startsWith(prefix)) {
              const candidateNames = [
                baseName.replace(prefix, `${pref}gen_`),
                baseName.replace(prefix, `${pref}arg_`)
              ];
              for (const candName of candidateNames) {
                const candUrls = lookupDaeUrls(candName);
                if (candUrls.length > 0) {
                  baseName = candName;
                  urls = candUrls;
                  foundGen = true;
                  break;
                }
              }
            }
          }
        }
      }
    }
    const uniqueUrls = [];
    for (const url of urls) {
      const fileName = url.substring(url.lastIndexOf('/') + 1).toLowerCase();
        uniqueUrls.push(url);
    }

 //   sendLogToVSC(`[*] DAE urls for ${mod.macro} (baseName: ${baseName}): found ${urls.length} URLs )`, 'log');

    if (uniqueUrls.length === 0) {
      return null;
    }

    const loadedScenes = [];
    for (const url of uniqueUrls) {
      try {
        let sceneTemplate = null;
        const binUrl = url.replace(/\.dae$/i, '.bin');
        const jsonUrl = url.replace(/\.dae$/i, '.json');

        try {
          // Fast-path: Load Vulkan-aligned binary blob via MeshWorker
          sceneTemplate = await this.loadBinaryModel(binUrl, jsonUrl);
        } catch (binErr) {
          // Fallback to ColladaLoader using .dae files
          sendLogToVSC(`[*] Falling back to ColladaLoader for ${url}`, 'log');
          sceneTemplate = await this.loadColladaModel(url);
        }

        if (sceneTemplate) {
          const scene = sceneTemplate.clone();
          scene.scale.set(1, 1, 1);
          scene.traverse(child => {
            if (child.isMesh) {
              // Ensure geometry has proper normals for lighting
              if (child.geometry) {
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
              const isBBox = childName.includes('bbox') || 
                             childName.includes('boundingbox') || 
                             childName.includes('bounding_box') || 
                             childName.includes('collision') ||
                             childName.includes('collision_box') ||
                             childName.includes('collisionbox') ||
                             parentName.includes('bbox') ||
                             parentName.includes('boundingbox') ||
                             parentName.includes('bounding_box') ||
                             parentName.includes('collision');

              if (isBBox) {
                child.visible = false;    
              }

              // Process materials (handles both single material and array of materials)
              const processMaterial = (mat) => {
                if (!mat) {
                  return new THREE.MeshStandardMaterial({
                    color: isBBox ? 0x00F5FF : 0x8D99AE,
                    roughness: isBBox ? 0.8 : 0.6,
                    metalness: isBBox ? 0.1 : 0.2,
                    opacity: isBBox ? 0.15 : 1.0,
                    transparent: isBBox ? true : false,
                    wireframe: isBBox ? true : false,
                    side: THREE.DoubleSide
                  });
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
                const newMat = new THREE.MeshStandardMaterial({
                  color: isBBox ? 0x00F5FF : baseColor,
                  map: isBBox ? null : (mat.map || null),
                  normalMap: isBBox ? null : (mat.normalMap || null),
                  bumpMap: isBBox ? null : (mat.bumpMap || null),
                  roughness: isBBox ? 0.8 : 0.6,
                  metalness: isBBox ? 0.1 : 0.2,
                  opacity: isBBox ? 0.15 : (mat.opacity !== undefined ? mat.opacity : 1.0),
                  transparent: isBBox ? true : (mat.transparent || false),
                  wireframe: isBBox ? true : false,
                  side: THREE.DoubleSide,
                  emissive: isBBox ? new THREE.Color(0x002233) : new THREE.Color(0x080a12) // subtle dark-nebula emission so it is never pitch-black
                });

                // If old material had vertex colors enabled, only keep it if geometry actually supports it
                if (mat.vertexColors && child.geometry && child.geometry.attributes.color) {
                  newMat.vertexColors = true;
                } else {
                  newMat.vertexColors = false;
                }

                newMat.name = mat.name || '';

                // Clean up old material reference
                if (typeof mat.dispose === 'function') {
                  mat.dispose();
                }

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
        }
      } catch (e) {
        sendLogToVSC(`  [-] Failed to load ${url}: ${e.message || e}`, 'warn');
        // Ignore and check next path
      }
    }

    if (loadedScenes.length === 0) {
      return null;
    }
    if (loadedScenes.length === 1) {
      return loadedScenes[0];
    }

    const group = new THREE.Group();
    for (const scene of loadedScenes) {
      group.add(scene);
    }
    return group;
  }

  loadBinaryModel(binUrl, jsonUrl) {
    if (this.colladaCache.has(binUrl)) {
      return this.colladaCache.get(binUrl);
    }
    const loadPromise = (async () => {
      const meshData = await this.meshLoader.loadMesh(binUrl, jsonUrl);

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

      const material = new THREE.MeshStandardMaterial({
        color: 0x8D99AE,
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const group = new THREE.Group();
      group.add(mesh);
      return group;
    })();

    this.colladaCache.set(binUrl, loadPromise);
    return loadPromise;
  }

  loadColladaModel(url) {
    if (this.colladaCache.has(url)) {
      return this.colladaCache.get(url);
    }
    const loadPromise = new Promise((resolve, reject) => {
      this.colladaLoader.load(
        url,
        (collada) => resolve(collada.scene),
        undefined,
        (err) => reject(err)
      );
    });
    this.colladaCache.set(url, loadPromise);
    return loadPromise;
  }

  clear() {
    // Clear selection
    this.deselect();
    this.clearFilterHighlights();

    // Remove all modules
    while (this.modulesGroup.children.length > 0) {
      const child = this.modulesGroup.children[0];
      this.modulesGroup.remove(child);
    }
  }

  clearFilterHighlights() {
    if (this.highlightHelpers) {
      this.highlightHelpers.forEach(helper => {
        this.scene.remove(helper);
        helper.dispose();
      });
      this.highlightHelpers = [];
    }
  }

  highlightModulesByFilter(categoryFilter, macroFilter) {
    this.clearFilterHighlights();

    if (categoryFilter === 'all' && !macroFilter) return;

    this.modulesGroup.children.forEach(child => {
      if (!child.visible) return;

      const macro = child.userData.macro;
      const category = getModuleCategory(macro);
      let matches = false;

      if (macroFilter) {
        matches = (macro === macroFilter);
      } else if (categoryFilter && categoryFilter !== 'all') {
        matches = (category === categoryFilter);
      }

      if (matches) {
        const helper = new THREE.BoxHelper(child, 0x00F5FF);
        helper.material = new THREE.LineBasicMaterial({
          color: 0x00F5FF,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          linewidth: 2
        });
        this.scene.add(helper);
        this.highlightHelpers.push(helper);
      }
    });
  }

  fitCameraToStation() {
    if (this.modulesGroup.children.length === 0) return;

    const box = new THREE.Box3();
    let hasStructuralMesh = false;
    this.modulesGroup.traverse(child => {
      if (child.isMesh && !isTextureOrEffectMesh(child)) {
        box.expandByObject(child);
        hasStructuralMesh = true;
      }
    });

    if (!hasStructuralMesh) {
      box.setFromObject(this.modulesGroup);
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Update controls target to center of station
    this.controls.target.copy(center);

    // Calculate dynamic distance to fit bounding sphere
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.35; // Add pad offset factor

    // Dynamically adjust controls maxDistance so the user can zoom out as far as needed
    this.controls.maxDistance = Math.max(50000, cameraZ * 4);

    // Keep distance within reasonable boundaries
    cameraZ = Math.max(120, cameraZ);

    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    this.controls.update();
  }

  getStationMeasurements() {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return null;
    const box = new THREE.Box3();
    let hasStructuralMesh = false;
    this.modulesGroup.traverse(child => {
      if (child.isMesh && !isTextureOrEffectMesh(child)) {
        box.expandByObject(child);
        hasStructuralMesh = true;
      }
    });

    if (!hasStructuralMesh) {
      box.setFromObject(this.modulesGroup);
    }

    return box.getSize(new THREE.Vector3());
  }

  setColorized(enabled) {
    this.isColorized = !!enabled;
    if (!this.modulesGroup) return;

    if (!this.categoryMaterials) {
      this.categoryMaterials = {};
      for (const cat in CATEGORY_COLORS) {
        this.categoryMaterials[cat] = new THREE.MeshStandardMaterial({
          color: new THREE.Color(CATEGORY_COLORS[cat]),
          roughness: 0.4,
          metalness: 0.2
        });
      }
    }

    this.modulesGroup.children.forEach(group => {
      const macro = group.userData.macro;
      const category = getModuleCategory(macro);
      const coloredMat = this.categoryMaterials[category] || this.categoryMaterials['structure'];

      group.traverse(child => {
        if (child.isMesh) {
          if (this.isColorized) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            child.material = coloredMat;
          } else {
            if (child.userData.originalMaterial) {
              child.material = child.userData.originalMaterial;
            }
          }
        }
      });
    });
  }

  fitCameraToSelection(categoryFilter, macroFilter = null) {
    if (!this.currentPlan) return;

    // Find all meshes matching category and/or macro
    const matchingMeshes = [];
    this.modulesGroup.traverse(child => {
      if (child.isMesh && child.visible && !isTextureOrEffectMesh(child)) {
        // Find top level module object index
        let hitObj = child;
        let moduleIdx = hitObj.userData.moduleIndex;
        while (hitObj && moduleIdx === undefined) {
          hitObj = hitObj.parent;
          if (hitObj) moduleIdx = hitObj.userData.index;
        }

        if (moduleIdx !== undefined) {
          const mod = this.currentPlan.modules.find(m => m.index === moduleIdx);
          if (mod) {
            const cat = getModuleCategory(mod.macro);
            const matchesCat = (categoryFilter === 'all' || cat === categoryFilter);
            const matchesMacro = (!macroFilter || mod.macro === macroFilter);
            if (matchesCat && matchesMacro) {
              matchingMeshes.push(child);
            }
          }
        }
      }
    });

    if (matchingMeshes.length === 0) return;

    // Calculate bounding box of matching meshes
    const box = new THREE.Box3();
    matchingMeshes.forEach(mesh => {
      box.expandByObject(mesh);
    });

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Fit camera
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDist *= 1.35; // pad factor
    cameraDist = Math.max(100, cameraDist);

    // Smoothly transition camera position and controls target
    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const endTar = center.clone();
    const endCam = center.clone().add(direction.multiplyScalar(cameraDist));

    const duration = 800; // ms
    const startCam = this.camera.position.clone();
    const startTar = this.controls.target.clone();
    const startTime = performance.now();

    const animateTransition = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress * (2 - progress);

      this.camera.position.lerpVectors(startCam, endCam, ease);
      this.controls.target.lerpVectors(startTar, endTar, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateTransition);
      }
    };
    requestAnimationFrame(animateTransition);
  }

  getModuleDimensions(index) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;
    
    const box = new THREE.Box3();
    let hasStructuralMesh = false;

    targetModule.updateMatrixWorld(true);
    const invWorldMatrix = new THREE.Matrix4().copy(targetModule.matrixWorld).invert();

    targetModule.traverse(child => {
      if (child.isMesh && !isTextureOrEffectMesh(child)) {
        if (child.geometry) {
          if (!child.geometry.boundingBox) {
            child.geometry.computeBoundingBox();
          }
          const geomBox = child.geometry.boundingBox.clone();
          const localMat = child.matrixWorld.clone().premultiply(invWorldMatrix);
          geomBox.applyMatrix4(localMat);
          box.union(geomBox);
          hasStructuralMesh = true;
        }
      }
    });

    if (!hasStructuralMesh) {
      // Fallback
      const fallbackBox = new THREE.Box3().setFromObject(targetModule);
      return fallbackBox.getSize(new THREE.Vector3());
    }

    return box.getSize(new THREE.Vector3());
  }

  getModuleCalculatedRotation(index) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;

    const yawDeg = Math.round(targetModule.rotation.y * 180 / Math.PI);
    const pitchDeg = Math.round(targetModule.rotation.x * 180 / Math.PI);
    const rollDeg = Math.round(targetModule.rotation.z * 180 / Math.PI);

    return { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg };
  }

  selectModuleByIndex(index, resizeGridAndBounds = false) {
    this.deselect(false);
    this.clearFilterHighlights();

    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    // Create a bounding box selection helper
    const selectionBox = new THREE.BoxHelper(targetModule, 0xFFFF00);
    selectionBox.name = 'selection_helper';
    
    // Enhance selection helper visual thickness/style
    selectionBox.material = new THREE.LineBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      linewidth: 2
    });

    this.scene.add(selectionBox);
    this.selectionHelper = selectionBox;

    // Pulse selection helper visual indicator
    this.selectionHelperPulseDirection = 1;

    if (resizeGridAndBounds) {
      // Update plot grid matching the component size, and move grid Y directly under the component
      const compBox = new THREE.Box3().setFromObject(targetModule);
      const compSize = compBox.getSize(new THREE.Vector3());
      const compCenter = compBox.getCenter(new THREE.Vector3());

      const pad = 1.3;
      const sizeX = Math.max(compSize.x * pad, 80);
      const sizeZ = Math.max(compSize.z * pad, 80);
      const sizeY = Math.max(compSize.y * pad, 80);
      const gridY = compBox.min.y; // Move Z axis (Y ground plane) directly under the component

      this.rebuildGridAndBounds(sizeX, sizeZ, sizeY, compCenter.x, compCenter.y, compCenter.z, gridY);
    } else {
      // Keep boundaries at full station scale
      this.restoreFullPlanGrid();
    }
  }

  deselect(restoreGrid = true) {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.dispose();
      this.selectionHelper = null;
    }
    if (restoreGrid) {
      this.restoreFullPlanGrid();
    }
  }

  resetCameraTarget() {
    if (this.modulesGroup.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const center = box.getCenter(new THREE.Vector3());

    const duration = 600; // ms
    const startTar = this.controls.target.clone();
    const endTar = center.clone();

    const startTime = performance.now();

    const animateTransition = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress * (2 - progress);

      this.controls.target.lerpVectors(startTar, endTar, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateTransition);
      }
    };

    requestAnimationFrame(animateTransition);
  }

  focusCameraOnModule(index, focusCameraPosition = true) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    // Calculate bounding box of this module
    const box = new THREE.Box3().setFromObject(targetModule);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Calculate appropriate camera distance to fit this component's size
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDist *= 1.35; // pad factor
    cameraDist = Math.max(100, cameraDist); // clamp safety

    const duration = 800; // ms
    const startCam = this.camera.position.clone();
    const startTar = this.controls.target.clone();

    // Target positions
    const endTar = center.clone();
    
    // Retain camera viewing direction relative to target
    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (direction.lengthSq() < 0.01) {
      direction.set(0.7, 0.5, 0.7).normalize();
    }
    
    // Helper to check if a camera position is blocked by other visible meshes
    const checkBlocked = (camPos) => {
      const dir = new THREE.Vector3().subVectors(center, camPos).normalize();
      const raycaster = new THREE.Raycaster(camPos, dir);
      const intersects = raycaster.intersectObjects(this.modulesGroup.children, true);
      
      for (const hit of intersects) {
        let hitObj = hit.object;
        while (hitObj && hitObj.parent !== this.modulesGroup) {
          hitObj = hitObj.parent;
        }
        if (hitObj) {
          if (hitObj === targetModule) {
            return false; // Hit our target module first! LOS is clear!
          } else {
            return true; // Hit another module first! Blocked!
          }
        }
      }
      return false;
    };

    let finalEndCam = focusCameraPosition ? center.clone().add(direction.multiplyScalar(cameraDist)) : startCam;

    if (focusCameraPosition) {
      const defaultBlocked = checkBlocked(finalEndCam);
      if (defaultBlocked) {
        // Standard ISO direction test
        const isoDirections = [
          new THREE.Vector3(1, 0.8, 1).normalize(),
          new THREE.Vector3(-1, 0.8, 1).normalize(),
          new THREE.Vector3(1, 0.8, -1).normalize(),
          new THREE.Vector3(-1, 0.8, -1).normalize(),
          new THREE.Vector3(1, -0.8, 1).normalize(),
          new THREE.Vector3(-1, -0.8, 1).normalize(),
          new THREE.Vector3(1, -0.8, -1).normalize(),
          new THREE.Vector3(-1, -0.8, -1).normalize()
        ];
        
        let foundClear = false;
        for (const testDir of isoDirections) {
          const testPos = center.clone().add(testDir.clone().multiplyScalar(cameraDist));
          if (!checkBlocked(testPos)) {
            finalEndCam = testPos;
            foundClear = true;
            break;
          }
        }
        
        if (!foundClear) {
          // Fall back to first ISO preset
          finalEndCam = center.clone().add(isoDirections[0].clone().multiplyScalar(cameraDist));
        }
      }
    }

    const endCam = finalEndCam;

    const startTime = performance.now();

    const animateTransition = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
      // Smooth step easing
      const ease = progress * (2 - progress);

      if (focusCameraPosition) {
        this.camera.position.lerpVectors(startCam, endCam, ease);
      }
      this.controls.target.lerpVectors(startTar, endTar, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateTransition);
      }
    };

    requestAnimationFrame(animateTransition);
  }

  setBuildProgress(progressPercentage) {
    this.currentBuildProgressPercentage = progressPercentage;
    const total = this.modulesGroup.children.length;
    if (total === 0) return;

    // Filter to get only visible children (sorted by index)
    const visibleChildren = this.modulesGroup.children.filter(child => {
      const macroName = child.userData.macro;
      return !this.hiddenMacros.has(macroName);
    });

    const visibleTotal = visibleChildren.length;

    // Create a Set of visible children that should be shown based on timeline progress
    const activeVisibleSet = new Set();
    if (visibleTotal > 0) {
      const visibleCountToShow = Math.ceil((progressPercentage / 100) * visibleTotal);
      for (let i = 0; i < visibleCountToShow; i++) {
        activeVisibleSet.add(visibleChildren[i]);
      }
    }

    this.modulesGroup.children.forEach(child => {
      const targetVisibility = activeVisibleSet.has(child);

      if (targetVisibility) {
        child.visible = true;
        
        // Add a nice rising reveal animation for newly appearing modules
        if (child.userData.lastVisibleState === false) {
          child.position.y -= 15;
          child.scale.set(0.01, 0.01, 0.01);
          
          let animT = 0;
          const initialPos = child.position.y + 15;
          const animateReveal = () => {
            if (animT >= 1.0) {
              child.position.y = initialPos;
              child.scale.set(1, 1, 1);
              return;
            }
            animT += 0.08;
            child.scale.setScalar(animT);
            child.position.y = initialPos - 15 * (1 - animT);
            requestAnimationFrame(animateReveal);
          };
          animateReveal();
        }
        child.userData.lastVisibleState = true;
      } else {
        child.visible = false;
        child.userData.lastVisibleState = false;
      }
    });

    // Update selection helper position in case it was on a hidden module
    if (this.selectionHelper) {
      this.selectionHelper.update();
    }
  }

  setMacroVisibility(macroName, isVisible) {
    if (isVisible) {
      this.hiddenMacros.delete(macroName);
    } else {
      this.hiddenMacros.add(macroName);
    }

    // Refresh build progress visibility filters
    this.setBuildProgress(this.currentBuildProgressPercentage);
  }

  toggleGrid(enabled) {
    this.showGrid = enabled;
    if (this.gridLayers) {
      this.gridLayers.forEach(grid => { grid.visible = enabled; });
    }
    if (this.plotBounds) this.plotBounds.visible = enabled;
    if (this.orientationHelper) this.orientationHelper.visible = enabled && this.showOrientation;
  }

  toggleOrientation(enabled) {
    this.showOrientation = enabled;
    if (this.orientationHelper) {
      this.orientationHelper.visible = enabled && this.showGrid;
    }
  }

  toggleAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 0.6;
  }

  toggleWireframe(enabled) {
    this.wireframeMode = enabled;
    this.modulesGroup.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.wireframe = enabled;
      }
    });
  }

  setViewAngle(angleName) {
    if (this.modulesGroup.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.9;

    this.controls.target.copy(center);

    switch (angleName) {
      case 'top':
        this.camera.position.set(center.x, center.y + radius * 1.5, center.z);
        break;
      case 'front':
        this.camera.position.set(center.x, center.y, center.z + radius * 1.5);
        break;
      case 'side':
        this.camera.position.set(center.x + radius * 1.5, center.y, center.z);
        break;
      case 'iso':
      default:
        this.camera.position.set(center.x + radius, center.y + radius * 0.8, center.z + radius);
        break;
    }
    this.controls.update();
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  onPointerDown(event) {
    // Raycasting to select modules on click
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Only check intersection with visible module meshes (accounting for parent visibility)
    const visibleObjects = [];
    this.modulesGroup.traverse(child => {
      if (child.isMesh) {
        let isVisible = true;
        let current = child;
        while (current && current !== this.modulesGroup) {
          if (current.visible === false) {
            isVisible = false;
            break;
          }
          current = current.parent;
        }
        if (isVisible) {
          visibleObjects.push(child);
        }
      }
    });

    const intersects = this.raycaster.intersectObjects(visibleObjects);

    if (intersects.length > 0) {
      // Find the top-level group for the intersected module
      let hitObj = intersects[0].object;
      let moduleIdx = hitObj.userData.moduleIndex;

      // Bubble up if needed to find the index
      while (hitObj && moduleIdx === undefined) {
        hitObj = hitObj.parent;
        if (hitObj) moduleIdx = hitObj.userData.index;
      }

      if (moduleIdx !== undefined && this.onModuleSelected) {
        this.onModuleSelected(moduleIdx);
      }
    } else {
      if (this.onModuleSelected) {
        this.onModuleSelected(null);
      }
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const time = this.clock.getElapsedTime();

    // 1. Run animations inside procedural meshes (rotating rings, solar panels, etc.) - Stopped as requested
    /*
    this.modulesGroup.children.forEach(child => {
      if (child.visible && child.userData.update) {
        child.userData.update(time);
      }
    });
    */

    // 2. Pulse the selection helper outline so it stands out
    if (this.selectionHelper) {
      const helperMat = this.selectionHelper.material;
      if (helperMat) {
        if (!this.pulseVal) this.pulseVal = 0.5;
        if (!this.pulseDir) this.pulseDir = 1.0;

        this.pulseVal += 0.015 * this.pulseDir;
        if (this.pulseVal > 0.95 || this.pulseVal < 0.4) {
          this.pulseDir *= -1;
        }
        helperMat.opacity = this.pulseVal;
      }
      this.selectionHelper.update();
    }


    // 4. Update highlight helpers
    if (this.highlightHelpers) {
      this.highlightHelpers.forEach(helper => helper.update());
    }

    // 4. Update controls (Orbit damping, auto-rotation)
    this.controls.update();

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown.bind(this));
      this.renderer.dispose();
    }
    this.deselect();
  }
}

function isTextureOrEffectMesh(child) {
  if (!child || !child.isMesh) return false;
  
  const namesToCheck = [];
  if (child.name) namesToCheck.push(child.name.toLowerCase());
  if (child.parent && child.parent.name) namesToCheck.push(child.parent.name.toLowerCase());
  if (child.material) {
    if (Array.isArray(child.material)) {
      child.material.forEach(m => {
        if (m.name) namesToCheck.push(m.name.toLowerCase());
      });
    } else if (child.material.name) {
      namesToCheck.push(child.material.name.toLowerCase());
    }
  }

  const textureEffectKeywords = [
    'decal', 'fx_', 'light', 'exhaust', 'flare', 'glow', 
    'sprite', 'alpha', 'anim_', 'arrow', 'cross', 'elevator',
    'poslight', 'sign', 'billboard', 'lens', 'corona',
    'bbox', 'boundingbox', 'bounding_box', 'collision', 'collision_box', 'collisionbox'
  ];

  return namesToCheck.some(name => 
    textureEffectKeywords.some(keyword => name.includes(keyword))
  );
}
