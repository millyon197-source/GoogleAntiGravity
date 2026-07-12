import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { createProceduralModule, getModuleCategory } from './modules.js';

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
    this.plotBounds = null;

    this.animationFrameId = null;
    this.clock = new THREE.Clock();

    // Configuration settings
    this.showGrid = true;
    this.wireframeMode = false;
    this.ghostMode = false;
    this.hiddenMacros = new Set();
    this.currentPlan = null;
    this.currentBuildProgressPercentage = 100;
    this.highlightHelpers = [];
    this.colladaLoader = new ColladaLoader();

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814); // Deep space blue/black
    this.scene.fog = new THREE.FogExp2(0x060814, 0.00015); // Subtle space fog

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
    this.controls.maxDistance = 10000;
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

    // 10. Start Animation Loop
    this.animate();
  }

  setupLighting() {
    // Ambient fill light (cool nebula glow) - High Ambient
    const ambientLight = new THREE.AmbientLight(0x22294A, 5.0);
    this.scene.add(ambientLight);

    // Planetary blue-indigo glow from below - Brightened
    const hemisphereLight = new THREE.HemisphereLight(0x3B4E8C, 0x060814, 2.0);
    this.scene.add(hemisphereLight);

    // Primary solar key light (intense white-orange star light) - Brightened
    const sunLight = new THREE.DirectionalLight(0xFFEADB, 3.8);
    sunLight.position.set(1000, 800, 1000);
    sunLight.castShadow = true;
    
    // Configure shadow map size for high quality
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 5000;
    
    const d = 1000;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;

    this.scene.add(sunLight);

    // Opposing fill light to brighten the dark shadow sides of the modules
    const fillLight = new THREE.DirectionalLight(0x6B7DFF, 4.0);
    fillLight.position.set(-1000, -800, -1000);
    this.scene.add(fillLight);
  }


  createGridAndBounds() {
    this.rebuildGridAndBounds(3000, 3000, 3000, 0, 0, 0, -50);
  }

  rebuildGridAndBounds(sizeX, sizeZ, sizeY, centerX, centerY, centerZ, gridY) {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
    }
    if (this.plotBounds) {
      this.scene.remove(this.plotBounds);
      this.plotBounds.geometry.dispose();
      if (Array.isArray(this.plotBounds.material)) {
        this.plotBounds.material.forEach(m => m.dispose());
      } else {
        this.plotBounds.material.dispose();
      }
    }

    // 1. Grid Helper
    const gridSize = Math.max(sizeX, sizeZ, 80);
    const gridDivisions = Math.max(10, Math.floor(gridSize / 100));
    this.gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x3B4E8C, 0x1A204C);
    this.gridHelper.position.set(centerX, gridY, centerZ);
    this.scene.add(this.gridHelper);

    // 2. Plot Bounds
    const boundsGeo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const edges = new THREE.EdgesGeometry(boundsGeo);
    this.plotBounds = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x1E295D, transparent: true, opacity: 0.15 })
    );
    this.plotBounds.position.set(centerX, centerY, centerZ);
    this.scene.add(this.plotBounds);
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

    const loadPromises = planData.modules.map(async (mod) => {
      let moduleGroup = await this.loadModuleMesh(mod);
      if (!moduleGroup) {
        // Fallback to procedural module representation
        moduleGroup = createProceduralModule(mod.macro, THREE);
      }

      // Position coordinates (convert standard X4 coordinates if needed)
      moduleGroup.position.set(mod.position.x, mod.position.y, mod.position.z);

      // Rotations are in degrees: yaw (Y), pitch (X), roll (Z)
      // Apply correct rotation order 'YXZ' which corresponds to X4's rotation sequence
      moduleGroup.rotation.order = 'YXZ';
      moduleGroup.rotation.y = mod.rotation.yaw * Math.PI / 180;
      moduleGroup.rotation.x = mod.rotation.pitch * Math.PI / 180;
      moduleGroup.rotation.z = mod.rotation.roll * Math.PI / 180;

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

      return moduleGroup;
    });

    const loadedGroups = await Promise.all(loadPromises);
    loadedGroups.forEach(group => {
      this.modulesGroup.add(group);
    });

    // Auto-center camera to fit the loaded station bounds
    this.fitCameraToStation();
    this.restoreFullPlanGrid();
  }

  async loadModuleMesh(mod) {
    const baseName = mod.macro.replace('_macro', '');
    const category = getModuleCategory(mod.macro);
    
    // Subfolder mappings based on standard game file structure
    let subfolders = [];
    if (category === 'docks') subfolders.push('dock');
    else if (category === 'production') subfolders.push('production');
    else if (category === 'storage') subfolders.push('storage');
    else if (category === 'habitation') subfolders.push('habitation');
    else if (category === 'defense') subfolders.push('defense');
    else if (category === 'structure') subfolders.push('connection', 'structures');
    
    subfolders.push(category);

    const urls = [];
    for (const sf of subfolders) {
      let lodFound = false;
      for (let lod = 0; lod <= 4; lod++) {
        const checkUrl = `/assets/structures/${sf}/${baseName}_data/part_main-lod${lod}.dae`;
        try {
          const response = await fetch(checkUrl, { method: 'HEAD' });
          const contentType = response.headers.get('Content-Type');
          if (response.ok && (!contentType || !contentType.includes('text/html'))) {
            urls.push(checkUrl);
            lodFound = true;
            break; // Found the lowest available LOD, skip checking higher LODs
          }
        } catch (e) {
          // Ignore fetch errors
        }
      }

      let upLodFound = false;
      for (let lod = 0; lod <= 3; lod++) {
        const checkUrl = `/assets/structures/${sf}/${baseName}_data/part_main_up-lod${lod}.dae`;
        try {
          const response = await fetch(checkUrl, { method: 'HEAD' });
          const contentType = response.headers.get('Content-Type');
          if (response.ok && (!contentType || !contentType.includes('text/html'))) {
            urls.push(checkUrl);
            upLodFound = true;
            break; // Found the lowest available LOD, skip checking higher LODs
          }
        } catch (e) {
          // Ignore fetch errors
        }
      }

      let xrLodFound = false;
      for (let lod = 4; lod >= 0; lod--) {
        const checkUrl = `/assets/structures/${sf}/${baseName}_data/part_main_xr-lod${lod}.dae`;
        try {
          const response = await fetch(checkUrl, { method: 'HEAD' });
          const contentType = response.headers.get('Content-Type');
          if (response.ok && (!contentType || !contentType.includes('text/html'))) {
            urls.push(checkUrl);
            xrLodFound = true;
            break; // Found the first available LOD, checking descending
          }
        } catch (e) {
          // Ignore fetch errors
        }
      }

      if (lodFound || upLodFound || xrLodFound) {
        break;
      }
    }

    if (urls.length === 0) {
      for (const sf of subfolders) {
        const checkUrl = `/assets/structures/${sf}/${baseName}_data/detail_s_main-lod0.dae`;
        try {
          const response = await fetch(checkUrl, { method: 'HEAD' });
          const contentType = response.headers.get('Content-Type');
          if (response.ok && (!contentType || !contentType.includes('text/html'))) {
            urls.push(checkUrl);
            break;
          }
        } catch (e) {
          // Ignore fetch errors
        }
      }
    }

    const loadedScenes = [];
    for (const url of urls) {
      try {
        const scene = await this.loadColladaModel(url);
        if (scene) {
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

              // Process materials (handles both single material and array of materials)
              const processMaterial = (mat) => {
                if (!mat) {
                  const fallbackMat = new THREE.MeshBasicMaterial({
                    color: 0x8D99AE,
                    side: THREE.DoubleSide
                  });
                  fallbackMat.emissive = new THREE.Color(0x000000);
                  fallbackMat.emissiveIntensity = 0.0;
                  return fallbackMat;
                }
                
                // Check if the original color is black or too dark
                const baseColor = new THREE.Color(0x8D99AE); // default metal grey
                if (mat.color) {
                  // If the color is not pure black or extremely dark, preserve it
                  if (mat.color.r > 0.02 || mat.color.g > 0.02 || mat.color.b > 0.02) {
                    baseColor.copy(mat.color);
                  }
                }
                
                // Force convert any material type to MeshBasicMaterial to guarantee lighting response
                const newMat = new THREE.MeshBasicMaterial({
                  color: baseColor,
                  map: mat.map || null,
                  opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
                  transparent: mat.transparent || false,
                  side: THREE.DoubleSide
                });
                newMat.emissive = new THREE.Color(0x080a12); // subtle dark-nebula emission
                newMat.emissiveIntensity = 1.0;

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

  loadColladaModel(url) {
    return new Promise((resolve, reject) => {
      this.colladaLoader.load(
        url,
        (collada) => resolve(collada.scene),
        undefined,
        (err) => reject(err)
      );
    });
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
        helper.material.linewidth = 2;
        helper.material.depthTest = false;
        helper.material.transparent = true;
        helper.material.opacity = 0.8;
        this.scene.add(helper);
        this.highlightHelpers.push(helper);
      }
    });
  }

  fitCameraToStation() {
    if (this.modulesGroup.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Update controls target to center of station
    this.controls.target.copy(center);

    // Calculate dynamic distance to fit bounding sphere
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.35; // Add pad offset factor

    // Keep distance within reasonable boundaries
    cameraZ = Math.max(120, Math.min(cameraZ, 8000));

    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    this.controls.update();
  }

  fitCameraToSelection(categoryFilter, macroFilter = null) {
    if (!this.currentPlan) return;

    // Find all meshes matching category and/or macro
    const matchingMeshes = [];
    this.modulesGroup.traverse(child => {
      if (child.isMesh && child.visible) {
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
    cameraDist = Math.max(100, Math.min(cameraDist, 8000));

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
    const compBox = new THREE.Box3().setFromObject(targetModule);
    return compBox.getSize(new THREE.Vector3());
  }

  selectModuleByIndex(index) {
    this.deselect();

    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    // Create a bounding box selection helper
    const selectionBox = new THREE.BoxHelper(targetModule, 0xFFFF00);
    selectionBox.name = 'selection_helper';
    
    // Enhance selection helper visual thickness/style
    selectionBox.material.linewidth = 2; // (Note: linewidth > 1 depends on browser support, but good default)
    selectionBox.material.depthTest = false; // Always render on top
    selectionBox.material.transparent = true;
    selectionBox.material.opacity = 0.95;

    this.scene.add(selectionBox);
    this.selectionHelper = selectionBox;

    // Pulse selection helper visual indicator
    this.selectionHelperPulseDirection = 1;

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
  }

  deselect() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.dispose();
      this.selectionHelper = null;
    }
    this.resetCameraTarget();
    this.restoreFullPlanGrid();
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
    cameraDist = Math.max(100, Math.min(cameraDist, 8000)); // clamp safety

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
    const endCam = focusCameraPosition ? center.clone().add(direction.multiplyScalar(cameraDist)) : startCam;

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
    this.gridHelper.visible = enabled;
    this.plotBounds.visible = enabled;
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
