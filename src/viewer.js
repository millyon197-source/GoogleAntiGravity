import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  MeshLoader,
  resolveTextureForModel,
  getRaceGlowColor,
  getRaceHullColor,
  loadDdsTexture,
  loadBinaryModel,
  loadColladaModel,
  computeModuleGroupRotation,
  computeX4RotationFromModuleGroup,
  CameraController,
  TransformGizmoCoordinator
} from '@x4/adapter-three';
import {
  createProceduralModule,
  getModuleCategory,
  getFriendlyName,
  CATEGORY_COLORS,
  MACRO_TO_NAME_DB,
  lookupModuleBounds,
  getInitialModuleSize,
  getInitialModuleDimensions,
  getInitialModuleBounds,
  getModuleSnapPoints,
  setCustomSnapPointEntry,
  getCustomSnapPointsTable,
  syncCustomSnapPoints,
  hasCustomSnapPointsForMacro
} from '@x4/catalog';
import DAE_HASH_TABLE from '../dae_hash_table.json' with { type: 'json' };
import {
  getCurrentPlotConfig,
  setPlotConfig,
  DEFAULT_PLOT_CONFIG,
  getPlotBoundingBox,
  isBlueprintModeActive,
  minimizePlotPill,
  getLayerPlacementCategoryOrder,
  sortModulesByLayerCategoryOrder,
  clampModulePositionToPlot,
  calculateLayeredPlacement,
  doBoxesOverlap,
  ensureNoBoundingBoxOverlaps
} from './module-display-panel.js';
import PART_MAIN_OFFSETS from './part-main-offsets.json' with { type: 'json' };
import COMPONENT_OFFSETS from './component-offsets.json' with { type: 'json' };


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

/**
 * Main Three.js station viewer and interaction controller.
 */
export class StationViewer {
  /**
   * @param {HTMLElement} containerElement DOM container where the WebGL canvas is mounted.
   * @param {(index: number|null) => void} onModuleSelectedCallback Callback fired when a module is selected.
   */
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
    this.dimensionOverlayGroup = null;
    this.selectedModuleIndex = null;
    this.transformControls = null;
    this.transformControlsRotate = null;
    this.onModuleMoved = null;
    this.onModuleRotated = null;
    this.onMoveCommitted = null;
    this.dragStartPosition = null;
    this.dragStartRotation = null;
    this._isGizmoDragging = false;
    this.hasGizmoMoved = false;
    this.gizmoActiveType = null;
    this.isCommittingMove = false;
    this.gizmoMode = 'combined';
    this.starfield = null;
    this.gridHelper = null;
    this.majorGridHelper = null;
    this.plotBounds = null;
    this.stationPlotGroup = null;
    this.orientationHelper = null;

    this.animationFrameId = null;
    this.clock = new THREE.Clock();

    // Configuration settings
    this.showGrid = true;
    this.showOrientation = false;
    this.showDimensions = true;
    this.showSnapPoints = true;
    this.snapDots = [];
    this.snapPointGeometry = new THREE.SphereGeometry(1, 14, 14);
    this.snapPointMaterial = new THREE.MeshBasicMaterial({
      color: 0xFF1744,
      depthTest: true,
      transparent: true,
      opacity: 0.95
    });
    this.wireframeMode = false;
    this.ghostMode = false;
    this.hiddenMacros = new Set();
    // Per-module component (asset file) selections: index -> { macro, files[] }
    this.moduleComponentSelections = new Map();
    this.currentPlan = null;
    this.currentBuildProgressPercentage = 100;
    this.highlightHelpers = [];
    this.isColorized = false;
    this.colladaLoader = new ColladaLoader();
    this.ddsLoader = new DDSLoader();
    this.composer = null;
    this.bloomPass = null;
    this.bloomEnabled = true;
    this.bloomStrength = 0.35;
    this.bloomRadius = 0.35;
    this.bloomThreshold = 0.85;
    this.glowingEmissiveIntensity = 2.2;
    this.textureCache = new Map();
    this.animatedTextures = [];
    this.animatedParts = [];
    this.haltedModuleAnimations = new Set();
    this.meshLoader = new MeshLoader();
    this.colladaCache = new Map();
    this.isGridAtComponentScale = false;
    this.cameraTransitionAnimId = null;
    this.plotCornerHandles = [];
    this.isPlotCornerDragging = false;
    this.plotDragDotData = null;
    this.plotDragStartConfig = null;
    this.plotDragStartWorldPos = null;
    this.plotDragPlane = null;
    this.plotDragHasChanged = false;
    this.hoveredCornerDot = null;
    this.floatingHudTimeout = null;
    this.arePlotCornersVisible = false;
    this.plotDragLockedAxis = null;
    this.gizmoTargetModuleIndex = null;
    this.isMiddleMouseSelecting = false;
    this.selectionBoxStart = null;
    this.selectionBoxEl = null;
    this.middlePointerId = null;
    this.selectedModules = [];
    this.selectedModuleIndices = [];
    this.multiSelectionHelpers = [];
    this.multiSelectPivot = null;
    this.pivotDragStart = null;
    this.pendingCenterAction = null;
    this.onMultiModulesSelected = null;
    this.onUndoHistoryCollapse = null;
    this.isLeftShiftDown = false;
    this.isRightShiftDown = false;
    this.isShiftDown = false;
    this.lastPointerDownEvent = null;
    this.shiftSnapApplied = false;
    this.dragStartCollectiveBox = null;
    this.pendingSingleModule = null;
    this.fefbModuleIndex = null;
    this.gizmoWorldOffset = new THREE.Vector3(0, 0, 0);
    this.gizmoCoordinator = null;
    this.cameraController = null;

    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      window.THREE = THREE;
    }
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Clear container and append canvas
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Setup Bloom Post-Processing (applies Gaussian blur filter over glowing lights keeping bloom smooth)
    this.initBloomComposer(width, height);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 2000000;
    this.controls.minDistance = 10;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 1.0;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: null,
      RIGHT: THREE.MOUSE.PAN
    };

    this.controls.addEventListener('change', () => {
      if (this.isGizmoAttached() && this._isZooming) {
        this.ensureActiveGizmoVisible({ isZooming: true });
      }
    });

    // Helper to start tracking a translation move
    const onTranslateStart = () => {
      const target = this.transformControls?.object;
      if (!target) return;
      if (this.transformControls.axis === 'XYZ') {
        this.transformControls.dragging = false;
        this._isGizmoDragging = false;
        this.controls.enabled = true;
        this.showCenterModulesModal();
        return;
      }
      if (this.cameraTransitionAnimId) {
        cancelAnimationFrame(this.cameraTransitionAnimId);
        this.cameraTransitionAnimId = null;
      }
      if (this._isGizmoDragging && this.gizmoActiveType === 'move') {
        return;
      }
      this._isGizmoDragging = true;
      this.gizmoActiveType = 'move';
      this.hasGizmoMoved = false;

      if (this.gizmoWorldOffset && this.gizmoWorldOffset.lengthSq() > 0.0001) {
        if (this.transformControls?.worldPositionStart) {
          this.transformControls.worldPositionStart.add(this.gizmoWorldOffset);
        }
        if (this.transformControls?.pointStart) {
          this.transformControls.pointStart.sub(this.gizmoWorldOffset);
        }
      }

      // Compute and record the collective bounding box at drag start
      const targetModules = (target === this.multiSelectPivot)
        ? this.selectedModules
        : [target];

      this.dragStartCollectiveBox = new THREE.Box3();
      targetModules.forEach(mod => {
        const b = this.getModuleWorldBoundingBox(mod);
        if (b && !b.isEmpty()) {
          this.dragStartCollectiveBox.union(b);
        } else {
          this.dragStartCollectiveBox.union(new THREE.Box3().setFromObject(mod));
        }
      });

      if (target === this.multiSelectPivot) {
        this.pivotDragStart = this.multiSelectPivot.position.clone();
        this.multiSelectPivot.userData.dragStartPos = this.multiSelectPivot.position.clone();
        this.selectedModules.forEach(mod => {
          mod.userData.multiDragStartPos = mod.position.clone();
        });
      } else {
        target.userData.multiDragStartPos = target.position.clone();
        const mod = this.currentPlan?.modules?.find(m => m.index === target.userData.index);
        this.dragStartPosition = mod && mod.position ? {
          x: Math.round(mod.position.x),
          y: Math.round(mod.position.y),
          z: Math.round(mod.position.z)
        } : {
          x: Math.round(target.position.x),
          y: Math.round(target.position.y),
          z: Math.round(-target.position.z)
        };
      }

      // If Left-Shift is depressed when an axis handle is selected/clicked
      if (this.isLeftShiftActive(this.lastPointerDownEvent)) {
        const dir = this.getGizmoSelectedDirection(this.lastPointerDownEvent);
        if (dir) {
          const delta = this.moveModulesFlushToPlotBBAxis(dir, false);
          if (delta && delta.lengthSq() > 0) {
            this.hasGizmoMoved = true;
            this.shiftSnapApplied = true;
            if (this.transformControls && this.transformControls.object) {
              this.transformControls._positionStart?.copy(this.transformControls.object.position);
              this.transformControls.worldPositionStart?.copy(this.transformControls.object.position);
            }
          }
        }
      }
    };

    // Helper to start tracking a rotation move
    const onRotateStart = () => {
      const target = this.transformControlsRotate?.object;
      if (!target) return;
      if (this.cameraTransitionAnimId) {
        cancelAnimationFrame(this.cameraTransitionAnimId);
        this.cameraTransitionAnimId = null;
      }
      if (this._isGizmoDragging && this.gizmoActiveType === 'rotate') {
        return;
      }
      this._isGizmoDragging = true;
      this.gizmoActiveType = 'rotate';
      this.hasGizmoMoved = false;

      if (this.gizmoWorldOffset && this.gizmoWorldOffset.lengthSq() > 0.0001) {
        if (this.transformControlsRotate?.worldPositionStart) {
          this.transformControlsRotate.worldPositionStart.add(this.gizmoWorldOffset);
        }
        if (this.transformControlsRotate?.pointStart) {
          this.transformControlsRotate.pointStart.sub(this.gizmoWorldOffset);
        }
      }

      const mod = this.currentPlan?.modules?.find(m => m.index === target.userData.index);
      this.dragStartRotation = mod && mod.rotation ? {
        yaw: mod.rotation.yaw,
        pitch: mod.rotation.pitch,
        roll: mod.rotation.roll
      } : this.getModuleCalculatedRotation(target.userData.index);
    };

    // 4.1 Transform Controls (3D Axis Translation Gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.size = 0.85;
    this.transformControls.space = 'world';
    this.setupTransformControlsOverride(this.transformControls);

    // Style center transform diamond (XYZ handle)
    const setupCenterDiamond = (tc) => {
      const gizmoTranslate = tc._gizmo?.gizmo?.['translate'];
      const pickerTranslate = tc._gizmo?.picker?.['translate'];
      if (gizmoTranslate && gizmoTranslate['XYZ']) {
        gizmoTranslate['XYZ'].forEach(child => {
          child.name = 'center_diamond_handle';
          if (child.material) {
            child.material.color.setHex(0x00F5FF);
            child.material.opacity = 0.95;
            child.material.transparent = true;
            child.material.depthTest = false;
          }
          child.scale.set(1.5, 1.5, 1.5);
        });
      }
      if (pickerTranslate && pickerTranslate['XYZ']) {
        pickerTranslate['XYZ'].forEach(child => {
          child.name = 'center_diamond_picker';
          child.scale.set(2.0, 2.0, 2.0);
        });
      }
    };
    setupCenterDiamond(this.transformControls);

    this.scene.add(this.transformControls);

    this.transformControls.addEventListener('mouseDown', onTranslateStart);
    this.transformControls.addEventListener('mouseUp', () => this.handleModuleDragEnd());
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
      if (this.transformControlsRotate) {
        this.transformControlsRotate.enabled = !event.value;
      }
      if (event.value) {
        onTranslateStart();
      } else {
        this.handleModuleDragEnd();
      }
    });

    this.transformControls.addEventListener('change', () => {
      if (this.transformControls.dragging && this.transformControls.object) {
        this.hasGizmoMoved = true;
        this.handleModuleDragging();
      }
    });
    this.transformControls.addEventListener('objectChange', () => {
      this.hasGizmoMoved = true;
      this.handleModuleDragging();
    });

    // 4.2 Transform Controls (3D Rotation Rings Gizmo: Yaw, Pitch, Roll)
    this.transformControlsRotate = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControlsRotate.setMode('rotate');
    this.transformControlsRotate.size = 0.85;
    this.transformControlsRotate.space = 'local';
    this.setupTransformControlsOverride(this.transformControlsRotate);

    // Hide outer screen-space trackball rings (E, XYZE) so only Yaw, Pitch, and Roll rings appear
    const hideOuterRings = (tc) => {
      const gizmoRotate = tc._gizmo?.gizmo?.['rotate'];
      const pickerRotate = tc._gizmo?.picker?.['rotate'];
      if (gizmoRotate) {
        gizmoRotate.traverse(child => {
          if (child.name === 'E' || child.name === 'XYZE') child.visible = false;
        });
      }
      if (pickerRotate) {
        pickerRotate.traverse(child => {
          if (child.name === 'E' || child.name === 'XYZE') child.visible = false;
        });
      }
    };
    hideOuterRings(this.transformControlsRotate);

    this.scene.add(this.transformControlsRotate);

    this.transformControlsRotate.addEventListener('mouseDown', onRotateStart);
    this.transformControlsRotate.addEventListener('mouseUp', () => this.handleModuleRotateEnd());
    this.transformControlsRotate.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
      if (this.transformControls) {
        this.transformControls.enabled = !event.value;
      }
      if (event.value) {
        onRotateStart();
      } else {
        this.handleModuleRotateEnd();
      }
    });

    this.transformControlsRotate.addEventListener('change', () => {
      if (this.transformControlsRotate.dragging && this.transformControlsRotate.object) {
        this.hasGizmoMoved = true;
        this.handleModuleRotating();
      }
    });
    this.transformControlsRotate.addEventListener('objectChange', () => {
      this.hasGizmoMoved = true;
      this.handleModuleRotating();
    });

    this.cameraController = new CameraController({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      modulesGroup: this.modulesGroup
    });

    this.gizmoCoordinator = new TransformGizmoCoordinator({
      camera: this.camera,
      transformControls: this.transformControls,
      transformControlsRotate: this.transformControlsRotate
    });

    // 5. Lighting
    this.setupLighting();

    // 7. Grid & Plot Boundaries
    this.createGridAndBounds();

    // 8. Add Modules Group
    this.scene.add(this.modulesGroup);

    // 9. Event Listeners
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.outline = 'none';
    this.renderer.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    this.renderer.domElement.addEventListener('auxclick', (event) => {
      if (event.button === 1) {
        event.preventDefault();
      }
    });

    // Zoom tracking to ensure active gizmo remains visible in viewport display while zooming
    this._isZooming = false;
    this._zoomTimeout = null;

    this.boundOnWheel = (event) => {
      if (this.controls) {
        // Shift+wheel provides a 5x slower, precision zoom increment
        this.controls.zoomSpeed = (event && event.shiftKey) ? 0.2 : 1.0;
      }
      this._isZooming = true;
      if (this._zoomTimeout) clearTimeout(this._zoomTimeout);
      this._zoomTimeout = setTimeout(() => {
        this._isZooming = false;
      }, 400);

      if (this.isGizmoAttached()) {
        this.ensureActiveGizmoVisible({ isZooming: true });
      }
    };
    this.renderer.domElement.addEventListener('wheel', this.boundOnWheel, { capture: true, passive: true });

    this.boundOnTouchMove = (event) => {
      if (event.touches && event.touches.length === 2) {
        this._isZooming = true;
        if (this._zoomTimeout) clearTimeout(this._zoomTimeout);
        this._zoomTimeout = setTimeout(() => {
          this._isZooming = false;
        }, 400);

        if (this.isGizmoAttached()) {
          this.ensureActiveGizmoVisible({ isZooming: true });
        }
      }
    };
    this.renderer.domElement.addEventListener('touchmove', this.boundOnTouchMove, { passive: true });
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);

    window.addEventListener('pointerdown', (e) => {
      this.lastPointerDownEvent = e;
      if (e.shiftKey) {
        this.isShiftDown = true;
        if (this.controls) this.controls.zoomSpeed = 0.2;
      }
      if (e.code === 'ShiftLeft') this.isLeftShiftDown = true;
      if (e.code === 'ShiftRight') this.isRightShiftDown = true;
    }, true);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft') {
        this.isLeftShiftDown = true;
      }
      if (e.code === 'ShiftRight') {
        this.isRightShiftDown = true;
      }
      if (e.shiftKey) {
        this.isShiftDown = true;
        if (this.controls) this.controls.zoomSpeed = 0.2;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft') {
        this.isLeftShiftDown = false;
        this.shiftSnapApplied = false;
      }
      if (e.code === 'ShiftRight') {
        this.isRightShiftDown = false;
      }
      if (!e.shiftKey) {
        this.isShiftDown = false;
        this.shiftSnapApplied = false;
        if (this.controls) this.controls.zoomSpeed = 1.0;
      }
    });

    window.addEventListener('blur', () => {
      this.isLeftShiftDown = false;
      this.isRightShiftDown = false;
      this.isShiftDown = false;
      this.shiftSnapApplied = false;
      if (this.controls) this.controls.zoomSpeed = 1.0;
    });

    this.renderer.domElement.addEventListener('blur', () => {
      if (!this.isGizmoDragging()) {
        this.detachGizmo();
      }
    });
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

  initBloomComposer(width, height) {
    try {
      if (!this.renderer || typeof document === 'undefined') return;
      this.composer = new EffectComposer(this.renderer);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      // UnrealBloomPass applies multi-stage progressive Gaussian blur filtering
      // across downsampled mip levels, keeping bloom halos around FX glowing lights smooth and natural
      const bloomResolution = new THREE.Vector2(width, height);
      this.bloomPass = new UnrealBloomPass(
        bloomResolution,
        this.bloomStrength ?? 0.35, // bloom strength: comfortable, natural radiance without blowing out the scene
        this.bloomRadius ?? 0.35,   // bloom radius: tight Gaussian dispersion hugging light sources
        this.bloomThreshold ?? 0.85 // luminance threshold: isolates glowing lights/emissives while preserving crisp hull metal
      );
      this.composer.addPass(this.bloomPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    } catch (e) {
      console.warn('[StationViewer] Bloom composer initialization skipped:', e.message);
      this.composer = null;
      this.bloomPass = null;
    }
  }

  setBloomEnabled(enabled) {
    this.bloomEnabled = !!enabled;
    if (this.bloomPass) {
      this.bloomPass.enabled = this.bloomEnabled;
    }
  }

  setBloomParams({ strength, radius, threshold } = {}) {
    if (strength !== undefined) {
      this.bloomStrength = strength;
      if (this.bloomPass) this.bloomPass.strength = strength;
    }
    if (radius !== undefined) {
      this.bloomRadius = radius;
      if (this.bloomPass) this.bloomPass.radius = radius;
    }
    if (threshold !== undefined) {
      this.bloomThreshold = threshold;
      if (this.bloomPass) this.bloomPass.threshold = threshold;
    }
  }

  getBloomStrength() {
    return this.bloomPass ? this.bloomPass.strength : (this.bloomStrength ?? 0.35);
  }

  getEmissiveIntensity() {
    return this.glowingEmissiveIntensity ?? 2.2;
  }

  setEmissiveIntensity(intensity, moduleIndex = null) {
    this.glowingEmissiveIntensity = Math.max(0, parseFloat(intensity) || 0);
    const target = (moduleIndex !== null && this.modulesGroup)
      ? this.modulesGroup.children.find(m => m.userData.index === moduleIndex)
      : this.modulesGroup;

    if (target) {
      target.traverse(child => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            if (mat.emissiveMap || (mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0))) {
              const mult = mat.blending === THREE.AdditiveBlending ? 1.5 : 1.0;
              mat.emissiveIntensity = this.glowingEmissiveIntensity * mult;
              mat.needsUpdate = true;
            }
          });
        }
        if (child.isLight && child.name === 'fx_point_light') {
          child.intensity = (this.glowingEmissiveIntensity / 2.2) * 1.8;
        }
      });
    }
    this.renderScene();
  }

  renderScene() {
    if (this.composer && this.bloomEnabled !== false) {
      this.composer.render();
    } else if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
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

    // BB for Grid removed: Plot size BB is the only BB used for module placement.
    this.plotBounds = null;

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
      const pCfg = this.currentPlotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
      if (pCfg && pCfg.enabled !== false) {
        const pBb = getPlotBoundingBox(pCfg);
        this.rebuildGridAndBounds(pBb.widthX, pBb.depthZ, pBb.heightY, pBb.centerX, pBb.centerY, pBb.centerZ, pBb.minY);
      } else {
        this.rebuildGridAndBounds(3000, 3000, 3000, 0, 0, 0, -50);
      }
      return;
    }

    this.modulesGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const pad = 1.2;
    let sizeX = Math.max(size.x * pad, 3000);
    let sizeY = Math.max(size.y * pad, 3000);
    let sizeZ = Math.max(size.z * pad, 3000);
    let gridY = box.min.y - 10;
    let centerX = center.x;
    let centerY = center.y;
    let centerZ = center.z;

    const pCfg = this.currentPlotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
    if (pCfg && pCfg.enabled !== false) {
      const pBb = getPlotBoundingBox(pCfg);
      sizeX = Math.max(sizeX, pBb.widthX);
      sizeZ = Math.max(sizeZ, pBb.depthZ);
      sizeY = Math.max(sizeY, pBb.heightY);
      gridY = Math.min(gridY, pBb.minY);
    }

    this.rebuildGridAndBounds(sizeX, sizeZ, sizeY, centerX, centerY, centerZ, gridY);
  }

  async loadStationPlan(planData) {
    this.clear();
    this.currentPlan = planData;
    this.hiddenMacros.clear();
    this.currentBuildProgressPercentage = 100;
    this.clearFilterHighlights();
    minimizePlotPill();

    // Ensure any custom-snap-points.json entries are synced and active for rendering
    try {
      await syncCustomSnapPoints();
    } catch (_) {}

    if (!planData.modules || planData.modules.length === 0) return;

    console.log(`[*] Loading ${planData.modules.length} station modules...`);

    // Display the loader banner
    const loaderBanner = document.getElementById('model-loader-status');
    const loaderText = document.getElementById('model-loader-text');
    const initialLoaderSubtext = document.getElementById('initial-loader-subtext');
    if (loaderBanner && loaderText) {
      loaderBanner.style.display = 'flex';
      loaderText.textContent = `Preparing to load ${planData.modules.length} modules...`;
    }
    if (initialLoaderSubtext) {
      initialLoaderSubtext.textContent = `Preparing to load ${planData.modules.length} modules...`;
    }

    const total = planData.modules.length;
    let completed = 0;

    // Consider the order of Layout, Layers to select which category of modules to place first
    const layerOrder = getLayerPlacementCategoryOrder();
    const sortedModules = sortModulesByLayerCategoryOrder(planData.modules, layerOrder);
    const plotConfig = this.currentPlotConfig || getCurrentPlotConfig();

    for (const mod of sortedModules) {
      const friendlyName = getFriendlyName(mod.macro);
      
      // Update loading text when module loading starts or progresses
      if (loaderText) {
        loaderText.textContent = `Loading: ${friendlyName} (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (initialLoaderSubtext) {
        initialLoaderSubtext.textContent = `Loading: ${friendlyName} (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
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
      // Apply unified rotation transformation corresponding to X4's rotation sequence
      moduleGroup.rotation.copy(computeModuleGroupRotation(mod.rotation?.yaw, mod.rotation?.pitch, mod.rotation?.roll));

      // Save references in mesh userData
      moduleGroup.userData.index = mod.index;
      moduleGroup.userData.macro = mod.macro;
      moduleGroup.userData.connection = mod.connection;
      moduleGroup.userData.originalPosition = new THREE.Vector3(mod.position.x, mod.position.y, -mod.position.z);
      moduleGroup.userData.originalRotation = {
        yaw: mod.rotation.yaw,
        pitch: mod.rotation.pitch,
        roll: mod.rotation.roll
      };
      const initialSizeArr = getInitialModuleSize(mod.macro);
      moduleGroup.userData.initialBounds = getInitialModuleBounds(mod.macro);
      moduleGroup.userData.initialSize = new THREE.Vector3(initialSizeArr[0], initialSizeArr[1], initialSizeArr[2]);

      // Honor the size of the component and do not place module outside current plot size (only if not in Blueprint mode)
      if (!isBlueprintModeActive()) {
        clampModulePositionToPlot(moduleGroup.position, moduleGroup.userData.initialSize, plotConfig);
      }

      // Enable casting/receiving shadow on child meshes
      moduleGroup.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.moduleIndex = mod.index; // For raycasting target identification
        }
      });

      this.modulesGroup.add(moduleGroup);
      this.buildModuleSnapPoints(moduleGroup, mod.macro);

      completed++;
      if (loaderText) {
        const typeStr = isDae ? 'DAE' : 'Procedural';
        if(!isDae)
          loaderText.textContent = `Loaded: ${friendlyName} (${typeStr}) (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (initialLoaderSubtext) {
        const typeStr = isDae ? 'DAE' : 'Procedural';
        initialLoaderSubtext.textContent = `Loaded: ${friendlyName} (${typeStr}) (${completed}/${total} - ${Math.round(completed / total * 100)}%)`;
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

    if (!isBlueprintModeActive()) {
      if (this.activeAlignmentBehavior) {
        this.applyAlignmentBehavior(this.activeAlignmentBehavior.key, this.activeAlignmentBehavior.name, this.activeAlignmentBehavior.activeEntries);
      } else if (this.lastLayoutArgs) {
        this.applyLayoutBehavior(this.lastLayoutArgs.key, this.lastLayoutArgs.name, this.lastLayoutArgs.activeEntries);
      }

      // Insure no bounding box overlaps another component's BB
      ensureNoBoundingBoxOverlaps(this.modulesGroup.children, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
    }

    if (this.isColorized) {
      this.setColorized(true);
    }
    if (this.wireframeMode) {
      this.toggleWireframe(true);
    }
    this.updatePlotBoxViolations();
  }

  /**
   * Resolves the DAE asset entry (hash-table key, folder path and default component files)
   * for a module macro, including faction → gen/arg fallbacks.
   * @param {string} macro
   * @returns {{ baseName: string, folderPath: string|null, defaultFiles: string[] }}
   */
  resolveModuleAssetEntry(macro) {
    let baseName = String(macro || '').replace('_macro', '').toLowerCase();

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

    if (urls.length === 0) {
      return { baseName, folderPath: null, defaultFiles: [] };
    }
    const folderPath = urls[0].substring(0, urls[0].lastIndexOf('/'));
    const defaultFiles = urls.map(u => u.substring(u.lastIndexOf('/') + 1));
    return { baseName, folderPath, defaultFiles };
  }

  /**
   * Returns the active component file list for a module: the user's selection if one
   * exists for this module index + macro, otherwise the default hash-table files.
   */
  getModuleActiveComponentFiles(index, macro) {
    const sel = this.moduleComponentSelections?.get(index);
    if (sel && sel.macro === macro) return [...sel.files];
    return this.resolveModuleAssetEntry(macro).defaultFiles;
  }

  /**
   * Lists every component (.dae) file available in the module's asset folder, flagged with
   * whether it is currently included in the render.
   * @param {number} index
   * @returns {Promise<{ folderPath: string|null, components: Array<{ file: string, checked: boolean, isDefault: boolean }> }>}
   */
  async getModuleComponentOptions(index) {
    const targetModule = this.modulesGroup?.children?.find(c => c.userData.index === index);
    const macro = targetModule?.userData?.macro;
    if (!macro) return { folderPath: null, components: [] };

    const { folderPath, defaultFiles } = this.resolveModuleAssetEntry(macro);
    if (!folderPath) return { folderPath: null, components: [] };

    let folderFiles = [];
    try {
      const resp = await fetch(`/api/module-asset-files?folder=${encodeURIComponent(folderPath)}`);
      if (resp.ok) {
        const data = await resp.json();
        folderFiles = Array.isArray(data.files) ? data.files : [];
      }
    } catch (_) { /* fall back to default list */ }

    const allFiles = [...new Set([...folderFiles, ...defaultFiles])].sort();
    const active = new Set(this.getModuleActiveComponentFiles(index, macro));
    const defaults = new Set(defaultFiles);
    return {
      folderPath,
      components: allFiles.map(file => ({ file, checked: active.has(file), isDefault: defaults.has(file) }))
    };
  }

  /**
   * Re-renders a single module's mesh using the given component files, preserving the
   * module's transform, snap points and selection state.
   * @param {number} index
   * @param {string[]} files
   */
  async setModuleComponentFiles(index, files) {
    const targetModule = this.modulesGroup.children.find(c => c.userData.index === index);
    if (!targetModule) return false;
    const macro = targetModule.userData.macro;

    if (!this.moduleComponentSelections) this.moduleComponentSelections = new Map();
    this.moduleComponentSelections.set(index, { macro, files: [...files] });

    const newRoot = files.length > 0 ? await this.loadModuleMesh({ index, macro }) : null;
    const newMeshGroup = newRoot ? newRoot.getObjectByName('module_mesh_group') : new THREE.Group();
    newMeshGroup.name = 'module_mesh_group';

    // Swap mesh groups inside the existing module group (transform & snaps untouched)
    const oldMeshGroup = targetModule.getObjectByName('module_mesh_group');
    if (oldMeshGroup) {
      if (this.animatedParts && this.animatedParts.length > 0) {
        this.animatedParts = this.animatedParts.filter(p => {
          if (!p.object) return false;
          let isDescendant = false;
          oldMeshGroup.traverse(child => {
            if (child === p.object) isDescendant = true;
          });
          return !isDescendant && p.object !== oldMeshGroup;
        });
      }
      targetModule.remove(oldMeshGroup);
    }
    targetModule.add(newMeshGroup);

    newMeshGroup.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.moduleIndex = index;
      }
    });

    if (this.wireframeMode) this.toggleWireframe(true);
    if (this.isColorized) this.setColorized(true);
    targetModule.updateMatrixWorld(true);

    if (this.selectedModuleIndex === index) {
      this.selectModuleByIndex(index, false);
    }
    return true;
  }

  setModuleAnimationHalted(index, halted) {
    if (!this.haltedModuleAnimations) this.haltedModuleAnimations = new Set();
    if (halted) {
      this.haltedModuleAnimations.add(index);
    } else {
      this.haltedModuleAnimations.delete(index);
    }
  }

  isModuleAnimationHalted(index) {
    return !!this.haltedModuleAnimations && this.haltedModuleAnimations.has(index);
  }

  setBillboardState(state, moduleIndex = null) {
    let matched = false;
    this.modulesGroup.traverse(obj => {
      if (obj.userData && typeof obj.userData.setBillboardState === 'function') {
        if (moduleIndex !== null && moduleIndex !== undefined) {
          let cur = obj;
          let modIdx = cur.userData ? cur.userData.moduleIndex : undefined;
          while (cur && modIdx === undefined && cur !== this.modulesGroup) {
            cur = cur.parent;
            if (cur && cur.userData && cur.userData.moduleIndex !== undefined) {
              modIdx = cur.userData.moduleIndex;
            }
          }
          if (modIdx !== moduleIndex) return;
        }
        obj.userData.setBillboardState(state, true);
        matched = true;
      }
    });
    if (this.animatedParts) {
      this.animatedParts.forEach(part => {
        if (part.object && part.object.userData && typeof part.object.userData.setBillboardState === 'function') {
          if (moduleIndex === null || moduleIndex === undefined || part.moduleIndex === moduleIndex) {
            part.object.userData.setBillboardState(state, true);
            matched = true;
          }
        }
      });
    }
    if (typeof this.renderScene === 'function') {
      this.renderScene();
    }
    return matched;
  }

  getBillboardState(moduleIndex = null) {
    let foundState = null;
    this.modulesGroup.traverse(obj => {
      if (foundState !== null) return;
      if (obj.userData && (obj.userData.manualBillboardState || obj.userData.currentBillboardState)) {
        if (moduleIndex !== null && moduleIndex !== undefined) {
          let cur = obj;
          let modIdx = cur.userData ? cur.userData.moduleIndex : undefined;
          while (cur && modIdx === undefined && cur !== this.modulesGroup) {
            cur = cur.parent;
            if (cur && cur.userData && cur.userData.moduleIndex !== undefined) {
              modIdx = cur.userData.moduleIndex;
            }
          }
          if (modIdx !== moduleIndex) return;
        }
        foundState = obj.userData.manualBillboardState || obj.userData.currentBillboardState || 'auto';
      }
    });
    return foundState || 'auto';
  }

  hasModuleBillboards(moduleIndex = null) {
    let hasBillboards = false;
    this.modulesGroup.traverse(obj => {
      if (hasBillboards) return;
      if (obj.userData && (obj.userData.isolatedBillboards || typeof obj.userData.setBillboardState === 'function' || obj.userData.billboardStateAUvs)) {
        if (moduleIndex !== null && moduleIndex !== undefined) {
          let cur = obj;
          let modIdx = cur.userData ? cur.userData.moduleIndex : undefined;
          while (cur && modIdx === undefined && cur !== this.modulesGroup) {
            cur = cur.parent;
            if (cur && cur.userData && cur.userData.moduleIndex !== undefined) {
              modIdx = cur.userData.moduleIndex;
            }
          }
          if (modIdx !== moduleIndex) return;
        }
        hasBillboards = true;
      }
    });
    return hasBillboards;
  }

  async loadModuleMesh(mod) {
    const { baseName, folderPath } = this.resolveModuleAssetEntry(mod.macro);
    const activeFiles = this.getModuleActiveComponentFiles(mod.index, mod.macro);
    const uniqueUrls = folderPath ? activeFiles.map(f => `${folderPath}/${f}`) : [];

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
        const partBase = url.split('/').pop().replace(/-lod\d+\.dae$/i, '').toLowerCase();

        try {
          const uLower = url.toLowerCase();
          if (
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
            (uLower.includes('part_main') && (uLower.includes('/production/') || uLower.includes('structures\\production')))
          ) {
            // fx*, anim*, billboards/signs, detail_m_main, detail_l_main, detail_s_main, simon, and production part_main components contain distinct subnodes (hull, fx, alpha, lightcones, foliage) requiring ColladaLoader
            throw new Error('Multi-material subnodes, FX, Anim, or Billboards require DAE');
          }
          // Fast-path: Load Vulkan-aligned binary blob via MeshWorker
          sceneTemplate = await this.loadBinaryModel(binUrl, jsonUrl);
        } catch (binErr) {
          // Fallback to ColladaLoader using .dae files
          sendLogToVSC(`[*] Falling back to ColladaLoader for ${url}`, 'log');
          sceneTemplate = await this.loadColladaModel(url);
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
            let off = COMPONENT_OFFSETS[baseName]?.[partBase];
            if (!off && urlLower.includes('hab_arg_l_01')) {
              off = COMPONENT_OFFSETS['hab_arg_l_01']?.[partBase];
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
          await this.applyTexturesToMeshGroup(scene, url, mod?.index);
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
                  emissive: isPoslight ? new THREE.Color(0xffffff) : (isLightConeOrVolumetric ? this.getRaceGlowColor(urlLower) : (mat.emissive || new THREE.Color(0x000000))),
                  emissiveIntensity: isHaze ? (this.glowingEmissiveIntensity || 2.2) * 0.8 : (isForcefield ? (this.glowingEmissiveIntensity || 2.2) * 1.5 : (isLightCone ? (this.glowingEmissiveIntensity || 2.2) * 1.5 : (isBubbles ? 4.5 : (mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : (mat.emissiveMap ? 1.0 : 0.0)))))
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
            this.animatedParts.push({
              object: scene,
              moduleIndex: mod?.index,
              update: (time) => {
                scene.position.z = Math.sin(time * 0.25) * 450;
              }
            });
          } else if (partBase.includes('anim_vent')) {
            this.animatedParts.push({
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
            this.animatedParts.push({
              object: scene,
              moduleIndex: mod?.index,
              update: (time) => {
                // Continuous industrial rotation (0.157 rad/s)
                scene.rotation.z = (time * (Math.PI * 2 / 40)) % (Math.PI * 2);
              }
            });
          } else if (url.toLowerCase().includes('anim_stomp') && partBase.startsWith('anim_stomp') && !partBase.includes('wheels')) {
            const basePosY = scene.position.y;
            this.animatedParts.push({
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
            this.animatedParts.push({
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
            this.animatedParts.push({
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
        sendLogToVSC(`  [-] Failed to load ${url}: ${e.message || e}`, 'warn');
        // Ignore and check next path
      }
    }

    if (loadedScenes.length === 0) {
      return null;
    }

    const offset = PART_MAIN_OFFSETS[baseName];

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
        const centOff = COMPONENT_OFFSETS['prod_gen_advancedelectronics']?.['anim_centrifuge'] || [110.487, 2.7689, 0.7379];
        centrifugeScene.position.set(centOff[0], centOff[1], centOff[2]);
        this.animatedParts.push({
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

  async applyTexturesToMeshGroup(group, url, moduleIndex) {
    if (!group) return;
    if (!this.animatedTextures) this.animatedTextures = [];
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
            const texUrls = this.resolveTextureForModel(url, matName);
            if (texUrls.diffuse) {
              const [diffuseTex, normalTex, roughnessTex, metalnessTex, emissiveTex] = await Promise.all([
                this.loadDdsTexture(texUrls.diffuse),
                texUrls.normal ? this.loadDdsTexture(texUrls.normal) : null,
                texUrls.roughness ? this.loadDdsTexture(texUrls.roughness) : null,
                texUrls.metalness ? this.loadDdsTexture(texUrls.metalness) : null,
                texUrls.emissive ? this.loadDdsTexture(texUrls.emissive) : null
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
                const isBillboardDisplay = (urlLower.includes('habitat') || urlLower.includes('hab_') || urlLower.includes('cross') || urlLower.includes('pier') || urlLower.includes('dock') || urlLower.includes('welfare') || urlLower.includes('venture') || urlLower.includes('landmark')) &&
                  (partBase.includes('anim_arrows') || matName.toLowerCase().includes('billboard')) && !isAnimCross;
                const isHabitatBillboard = (urlLower.includes('habitat') || urlLower.includes('hab_')) &&
                  (partBase.includes('anim_arrows') || matName.toLowerCase().includes('billboard')) && !isAnimCross;
                const isAdTrim = (partBase.includes('anim_arrows') || isAnimCross || matName.toLowerCase().includes('billboardtrims') || matName.toLowerCase().includes('billboard')) && !isBillboardDisplay;
                const isLiquidStorageTank = (urlLower.includes('storage') && urlLower.includes('liquid') && (matName.toLowerCase().includes('multimat') || (child.name || '').toLowerCase().includes('multimat')));
                const isGlowingLight = isLightConeOrGlow || isEscalator || isGenericFx || isDetailFx || isPartMainFx || isAdTrim || isBillboardDisplay || (isDecal && texUrls.emissive) || partBase.includes('poslight') || (child.name || '').toLowerCase().includes('poslight') || matName.toLowerCase().includes('poslight') ||
                                       (texUrls.emissive && partBase.includes('anim_arm'));

                const glowColor = this.getRaceGlowColor(url + ' ' + matName);
                const hullColor = this.getRaceHullColor(url + ' ' + matName);
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
                    ? (isAnimCross ? 1.2 : (isBillboardDisplay ? 1.0 : (isLava ? 3.5 : (isFire ? 2.8 : (isHexShield ? 3.5 : (isAdTrim ? 2.5 : (isSmoke ? 0.6 : (isLightCone ? 0.35 : (isBubbles ? 1.5 : (isHaze ? (this.glowingEmissiveIntensity || 2.2) * 0.8 : (isForcefield ? 2.0 : (isLightConeOrGlow ? (this.glowingEmissiveIntensity || 2.2) * 1.5 : (isGlowingLight ? (this.glowingEmissiveIntensity || 2.2) : 0.0)))))))))))))
                    : 0.0,
                  blending: (isLightConeOrGlow || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor) ? THREE.AdditiveBlending : THREE.NormalBlending,
                  toneMapped: (isLava || isFire) ? false : ((isLightCone || isBubbles || isSmoke || isVapor) ? true : (isHexShield ? false : (isGlowingLight ? false : true))),
                  transparent: isAlpha || isFoliage || isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor || isAnimCross || isBillboardDisplay,
                  opacity: isVapor ? 0.4 : (isFire ? 0.85 : (isSmoke ? 0.35 : (isLightCone ? 0.25 : (isHexShield ? 0.2 : (isBubbles ? 0.8 : (isHaze ? 0.35 : (isForcefield ? 0.65 : (isPoslight ? 0.9 : (isLightConeOrGlow ? 0.85 : (isWater ? 0.8 : (isAnimCross ? 0.95 : 1.0))))))))))),
                  alphaTest: isAnimCross ? 0.2 : (isBillboardDisplay ? 0.05 : (isDecal ? 0.1 : ((isAlpha || isFoliage) && !isLightConeOrGlow && !isSmoke && !isLava && !isFire && !isVapor ? 0.35 : 0.0))),
                  depthWrite: (isLightConeOrGlow || isDecal || isWater || isBubbles || isHexShield || isPoslight || isForcefield || isSmoke || isFire || isVapor || isAnimCross || isBillboardDisplay) ? false : true,
                  polygonOffset: isDecal || isAnimCross,
                  polygonOffsetFactor: (isDecal || isAnimCross) ? -1 : 0,
                  polygonOffsetUnits: (isDecal || isAnimCross) ? -1 : 0,
                  visible: !isFxGlow && !isDamageArea,
                  side: THREE.DoubleSide
                });

                if (isCrossAnimArrows && !child.userData.scanlineVOffset) {
                  child.userData.scanlineVOffset = { value: 0.0 };
                }

                if (hasVertexColors) {
                  newMat.onBeforeCompile = (shader) => {
                    shader.fragmentShader = shader.fragmentShader.replace(
                      '#include <emissivemap_fragment>',
                      `#include <emissivemap_fragment>
                      #if defined( USE_COLOR_ALPHA )
                        totalEmissiveRadiance *= vColor.rgb;
                      #elif defined( USE_COLOR )
                        totalEmissiveRadiance *= vColor.rgb;
                      #endif`
                    );
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
                  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
                    if (newMat[prop]) {
                      newMat[prop] = newMat[prop].clone();
                      newMat[prop].offset.set(0, 0);
                      newMat[prop].needsUpdate = true;
                    }
                  });
                }

                const registerAnimTex = (prop, speedX, speedY) => {
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
                  this.animatedTextures.push({
                    texture: animTex,
                    speedX,
                    speedY,
                    moduleIndex
                  });
                };

                if (isForcefield && !isLightCone && diffuseTex) {
                  registerAnimTex('map', 0.04, 0.015);
                }

                if (isBubbles && (diffuseTex || emissiveTex)) {
                  const texturesToAnimate = [diffuseTex, emissiveTex].filter(Boolean);
                  for (const tex of texturesToAnimate) {
                    if (!this.animatedTextures.some(a => a.texture === tex)) {
                      this.animatedTextures.push({
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

                const isAdTrimMesh = !isDamageArea && partBase.includes('anim_arrows') && !isBillboardDisplay;
                if (isAdTrimMesh && (diffuseTex || emissiveTex)) {
                  registerAnimTex('map', -0.25, 0.0);
                  registerAnimTex('emissiveMap', -0.25, 0.0);
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
                    this.loadDdsTexture('/assets1/textures/ad_signs/ads_bg_trims.dds').then(bgTex => {
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
                      this.animatedTextures.push({
                        texture: bgTex,
                        speedX: 0.0,
                        speedY: -0.35,
                        moduleIndex
                      });
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
                          if (kMod === 0 || kMod === 5) { subUv[j * 2] = uMax; subUv[j * 2 + 1] = vMin; }
                          else if (kMod === 1) { subUv[j * 2] = uMax; subUv[j * 2 + 1] = vMax; }
                          else if (kMod === 2 || kMod === 3) { subUv[j * 2] = uMin; subUv[j * 2 + 1] = vMax; }
                          else if (kMod === 4) { subUv[j * 2] = uMin; subUv[j * 2 + 1] = vMin; }
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
                        if (kMod === 0 || kMod === 5) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMin; }
                        else if (kMod === 1) { targetArr[k * 2] = uMax; targetArr[k * 2 + 1] = vMax; }
                        else if (kMod === 2 || kMod === 3) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMax; }
                        else if (kMod === 4) { targetArr[k * 2] = uMin; targetArr[k * 2 + 1] = vMin; }
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
                      if (typeof this.renderScene === 'function') {
                        this.renderScene();
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
                    if (!this.animatedParts) this.animatedParts = [];
                    this.animatedParts.push({
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

                      const bgMat = new THREE.MeshStandardMaterial({
                        vertexColors: Boolean(col),
                        color: 0xffffff,
                        map: bgTex || null,
                        emissiveMap: bgTex || null,
                        emissive: new THREE.Color(0xffffff),
                        emissiveIntensity: 1.0,
                        roughness: 0.5,
                        metalness: 0.1,
                        transparent: true,
                        opacity: 0.85,
                        side: THREE.DoubleSide,
                        depthWrite: false
                      });
                      bgMat.name = matName + '_cross_bg';
                      bgMat.onBeforeCompile = (shader) => {
                        shader.fragmentShader = shader.fragmentShader.replace(
                          '#include <emissivemap_fragment>',
                          '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;\n'
                        );
                      };

                      const bgDefs = [
                        { name: 'bg_cross', quads: [10, 11, 12] },
                        { name: 'bg_info', quads: [13, 14, 15] },
                        { name: 'bg_food', quads: [16, 17, 18] },
                        { name: 'bg_tools', quads: [19, 20, 21] }
                      ];

                      child.userData.isolatedBackgrounds = {};
                      for (const def of bgDefs) {
                        let bMesh = child.getObjectByName(def.name);
                        if (!bMesh || !bMesh.isMesh) {
                          if (bMesh) child.remove(bMesh);
                          const bGeom = createQuadGeom(def.quads);
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

                      // Continuous vertical scrolling animation matching mapchannel 3
                      if (bgTex && !this.animatedTextures.some(a => a.texture === bgTex && a.moduleIndex === moduleIndex)) {
                        this.animatedTextures.push({
                          texture: bgTex,
                          speedX: 0.0,
                          speedY: -0.35,
                          moduleIndex
                        });
                      }
                    };

                    promises.push(
                      this.loadDdsTexture('/assets1/textures/ad_signs/ads_bg_trims.dds')
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
                    const curIntensity = ((this.glowingEmissiveIntensity !== undefined ? this.glowingEmissiveIntensity : 2.2) / 2.2) * 1.8;
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

  getRaceGlowColor(contextStr = '') {
    return getRaceGlowColor(contextStr);
  }

  getRaceHullColor(contextStr = '') {
    return getRaceHullColor(contextStr);
  }

  /**
   * Resolves PBR texture URLs for a model component.
   * Delegates to the pure resolver in @x4/adapter-three.
   */
  resolveTextureForModel(modelUrl, materialName = '') {
    return resolveTextureForModel(modelUrl, materialName);
  }

  async loadDdsTexture(url) {
    return loadDdsTexture(this, url);
  }

  loadBinaryModel(binUrl, jsonUrl) {
    return loadBinaryModel(this, binUrl, jsonUrl);
  }

  loadColladaModel(url) {
    return loadColladaModel(this, url);
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
    this.snapDots = [];
    this.animatedTextures = [];
    this.animatedParts = [];
    this.haltedModuleAnimations = new Set();
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
    let box = new THREE.Box3();
    let hasContent = false;

    if (this.modulesGroup && this.modulesGroup.children.length > 0) {
      this.modulesGroup.traverse(child => {
        if (child.isMesh && !isTextureOrEffectMesh(child)) {
          box.expandByObject(child);
          hasContent = true;
        }
      });
      if (!hasContent) {
        box.setFromObject(this.modulesGroup);
        hasContent = !box.isEmpty();
      }
    }

    if (!hasContent) {
      if (this.stationPlotGroup) {
        const pConfig = this.currentPlotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
        const bb = getPlotBoundingBox(pConfig);
        box.min.set(bb.minX, bb.minY, bb.minZ);
        box.max.set(bb.maxX, bb.maxY, bb.maxZ);
        hasContent = true;
      }
    }

    if (!hasContent) return;

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

    if (!hasStructuralMesh || box.isEmpty()) {
      const initialBox = new THREE.Box3();
      this.modulesGroup.children.forEach(mod => {
        const size = this.getModuleInitialSize(mod);
        initialBox.expandByPoint(new THREE.Vector3(
          mod.position.x - size.x / 2,
          mod.position.y - size.y / 2,
          mod.position.z - size.z / 2
        ));
        initialBox.expandByPoint(new THREE.Vector3(
          mod.position.x + size.x / 2,
          mod.position.y + size.y / 2,
          mod.position.z + size.z / 2
        ));
      });
      return initialBox.getSize(new THREE.Vector3());
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
        if (child.isMesh && (!child.userData || !child.userData.isSnapPoint)) {
          if (this.isColorized) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            const origMat = child.userData.originalMaterial;
            const isEffect = isTextureOrEffectMesh(child) ||
              (origMat && (origMat.transparent || origMat.opacity < 0.95 || child.name?.toLowerCase().includes('water')));
            if (isEffect) {
              child.material = origMat;
            } else {
              child.material = coloredMat;
            }
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

  /**
   * Get the world-space bounding box for a module, incorporating rotation and scale.
   * Uses structural mesh geometry when available, with fallback to initial size.
   */
  getModuleWorldBoundingBox(targetModule) {
    if (!targetModule) return null;
    targetModule.updateMatrixWorld(true);

    const localBox = this.getModuleLocalBounds(targetModule);
    if (localBox && !localBox.isEmpty()) {
      const worldBox = localBox.clone();
      worldBox.applyMatrix4(targetModule.matrixWorld);
      return worldBox;
    }

    const initSize = this.getModuleInitialSize(targetModule);
    if (initSize) {
      const halfX = initSize.x / 2;
      const halfY = initSize.y / 2;
      const halfZ = initSize.z / 2;
      const min = new THREE.Vector3(-halfX, -halfY, -halfZ);
      const max = new THREE.Vector3(halfX, halfY, halfZ);
      const worldBox = new THREE.Box3(min, max);
      worldBox.applyMatrix4(targetModule.matrixWorld);
      return worldBox;
    }

    return new THREE.Box3().setFromObject(targetModule);
  }

  /**
   * Check if any placed module has any portion of its bounding box outside the current plot BB.
   * Returns true if there is a violation.
   */
  checkPlotBoundViolations() {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return false;
    const pCfg = this.currentPlotConfig;
    if (!pCfg || pCfg.enabled === false) return false;

    const plotBb = getPlotBoundingBox(pCfg);
    const EPS = 0.5; // Half-meter tolerance for floating point rounding

    for (const mod of this.modulesGroup.children) {
      if (!mod || !mod.visible) continue;
      const box = this.getModuleWorldBoundingBox(mod);
      if (!box || box.isEmpty()) continue;

      if (
        box.min.x < plotBb.minX - EPS ||
        box.max.x > plotBb.maxX + EPS ||
        box.min.y < plotBb.minY - EPS ||
        box.max.y > plotBb.maxY + EPS ||
        box.min.z < plotBb.minZ - EPS ||
        box.max.z > plotBb.maxZ + EPS
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Dynamically update the plot boundary box colors based on whether any module violates the plot BB.
   * If any module is outside the plot BB, color the plot BB red (0xFF0033).
   * Otherwise restore standard holographic cyan (0x00F5FF) and cyber green (0x39FF14).
   */
  updatePlotBoxViolations() {
    if (!this.stationPlotGroup) return;

    const isViolating = this.checkPlotBoundViolations();

    const boxColor = isViolating ? 0xFF0033 : 0x00F5FF;
    const cornerColor = isViolating ? 0xFF0033 : 0x39FF14;
    const floorColor = isViolating ? 0xFF0033 : 0x00F5FF;

    if (this.stationPlotGroup.userData?.isViolating === isViolating) {
      return;
    }
    this.stationPlotGroup.userData = this.stationPlotGroup.userData || {};
    this.stationPlotGroup.userData.isViolating = isViolating;

    const boxMesh = this.stationPlotGroup.getObjectByName('plot_box_mesh');
    if (boxMesh && boxMesh.material) {
      boxMesh.material.color.setHex(boxColor);
      boxMesh.material.opacity = isViolating ? 0.08 : 0.035;
    }

    const edgesLine = this.stationPlotGroup.getObjectByName('plot_edges_line');
    if (edgesLine && edgesLine.material) {
      edgesLine.material.color.setHex(boxColor);
    }

    const cornerLines = this.stationPlotGroup.getObjectByName('plot_corner_lines');
    if (cornerLines && cornerLines.material) {
      cornerLines.material.color.setHex(cornerColor);
    }

    const floorCross = this.stationPlotGroup.getObjectByName('plot_floor_cross');
    if (floorCross && floorCross.material) {
      floorCross.material.color.setHex(floorColor);
    }
  }

  getModuleLocalBounds(targetModule) {
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
      fallbackBox.applyMatrix4(invWorldMatrix);
      return fallbackBox;
    }

    return box;
  }

  getModuleInitialSize(macroOrModule) {
    if (!macroOrModule) return new THREE.Vector3(150, 100, 150);
    if (macroOrModule.userData && macroOrModule.userData.initialSize) {
      return macroOrModule.userData.initialSize.clone();
    }
    const macro = typeof macroOrModule === 'string'
      ? macroOrModule
      : (macroOrModule.userData?.macro || macroOrModule.macro);
    const size = getInitialModuleDimensions(macro);
    return new THREE.Vector3(size.x, size.y, size.z);
  }

  getModuleInitialBounds(macroOrModule) {
    const macro = typeof macroOrModule === 'string'
      ? macroOrModule
      : (macroOrModule?.userData?.macro || macroOrModule?.macro);
    return getInitialModuleBounds(macro);
  }

  getModuleDimensions(index) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;
    if (targetModule.userData && targetModule.userData.macro) {
      const initSize = this.getModuleInitialSize(targetModule);
      if (initSize) return initSize;
    }
    const box = this.getModuleLocalBounds(targetModule);
    return box ? box.getSize(new THREE.Vector3()) : null;
  }

  getModuleCalculatedRotation(index) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;
    return computeX4RotationFromModuleGroup(targetModule);
  }

  setModulePosition(index, pos) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;

    const roundX = Math.round(pos.x);
    const roundY = Math.round(pos.y);
    const roundZ = Math.round(pos.z);

    targetModule.position.set(roundX, roundY, -roundZ);
    targetModule.updateMatrixWorld(true);

    if (this.currentPlan && this.currentPlan.modules) {
      const mod = this.currentPlan.modules.find(m => m.index === index);
      if (mod) {
        if (!mod.position) mod.position = { x: 0, y: 0, z: 0 };
        mod.position.x = roundX;
        mod.position.y = roundY;
        mod.position.z = roundZ;
      }
    }

    if (this.selectionHelper && this.selectedModuleIndex === index) {
      this.selectionHelper.update();
    }

    if (this.dimensionOverlayGroup && this.selectedModuleIndex === index) {
      targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
      targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
      targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
    }

    this.updatePlotBoxViolations();
    return { x: roundX, y: roundY, z: roundZ };
  }

  setModuleRotation(index, rot) {
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return null;

    let yaw = typeof rot.yaw === 'number' && !isNaN(rot.yaw) ? rot.yaw : 0;
    let pitch = typeof rot.pitch === 'number' && !isNaN(rot.pitch) ? rot.pitch : 0;
    let roll = typeof rot.roll === 'number' && !isNaN(rot.roll) ? rot.roll : 0;

    let yawDeg = Math.round(yaw) % 360;
    if (yawDeg > 180) yawDeg -= 360;
    if (yawDeg <= -180) yawDeg += 360;

    let pitchDeg = Math.round(pitch) % 360;
    if (pitchDeg > 180) pitchDeg -= 360;
    if (pitchDeg <= -180) pitchDeg += 360;

    let rollDeg = Math.round(roll) % 360;
    if (rollDeg > 180) rollDeg -= 360;
    if (rollDeg <= -180) rollDeg += 360;

    targetModule.rotation.copy(computeModuleGroupRotation(yawDeg, pitchDeg, rollDeg));
    targetModule.updateMatrixWorld(true);

    if (this.currentPlan && this.currentPlan.modules) {
      const mod = this.currentPlan.modules.find(m => m.index === index);
      if (mod) {
        if (!mod.rotation) mod.rotation = { yaw: 0, pitch: 0, roll: 0 };
        mod.rotation.yaw = yawDeg;
        mod.rotation.pitch = pitchDeg;
        mod.rotation.roll = rollDeg;
      }
    }

    if (this.selectionHelper) {
      this.selectionHelper.update();
    }

    if (this.dimensionOverlayGroup) {
      targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
      targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
      targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
    }

    this.updatePlotBoxViolations();
    return { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg };
  }

  createDimensionLabelSprite(text, colorStr, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background with soft rounded cyber badge
    const x = 8, y = 8, w = 496, h = 112, r = 16;
    ctx.fillStyle = 'rgba(6, 12, 28, 0.94)';
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 6;
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle inner accent border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Metric text
    ctx.font = 'Bold 42px monospace';
    ctx.fillStyle = colorStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(scale.x, scale.y, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  buildDimensionOverlay(targetModule) {
    this.clearDimensionOverlay();
    if (!this.showSnapPoints && this.modulesGroup) {
      this.modulesGroup.traverse(child => {
        if (child.name === 'module_snaps_group') {
          child.visible = false;
        }
      });
    }
    if (!targetModule) return;

    const bounds = this.getModuleLocalBounds(targetModule);
    if (!bounds) return;

    const min = bounds.min;
    const max = bounds.max;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    if (size.x <= 0.01 || size.y <= 0.01 || size.z <= 0.01) return;

    const overlayGroup = new THREE.Group();
    overlayGroup.name = 'dimension_overlay_group';

    // 1. Oriented Wireframe Cage
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose(); // Immediately free the temporary BoxGeometry
    const boxMat = new THREE.LineBasicMaterial({
      color: 0x00F5FF,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      linewidth: 1
    });
    const boxWireframe = new THREE.LineSegments(edgesGeo, boxMat);
    boxWireframe.position.copy(center);
    boxWireframe.renderOrder = 9;
    overlayGroup.add(boxWireframe);

    // 2. Corner Bracket Highlights
    const cornerPts = [];
    const cornerSize = Math.max(Math.min(size.x, size.y, size.z) * 0.12, 10);
    const corners = [
      [min.x, min.y, min.z], [min.x, min.y, max.z],
      [min.x, max.y, min.z], [min.x, max.y, max.z],
      [max.x, min.y, min.z], [max.x, min.y, max.z],
      [max.x, max.y, min.z], [max.x, max.y, max.z]
    ];
    for (const [cx, cy, cz] of corners) {
      const dx = (cx === min.x ? 1 : -1) * cornerSize;
      const dy = (cy === min.y ? 1 : -1) * cornerSize;
      const dz = (cz === min.z ? 1 : -1) * cornerSize;
      cornerPts.push(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(cx + dx, cy, cz));
      cornerPts.push(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(cx, cy + dy, cz));
      cornerPts.push(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(cx, cy, cz + dz));
    }
    const cornerGeo = new THREE.BufferGeometry().setFromPoints(cornerPts);
    const cornerMat = new THREE.LineBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      linewidth: 2
    });
    const cornerSegments = new THREE.LineSegments(cornerGeo, cornerMat);
    cornerSegments.renderOrder = 10;
    overlayGroup.add(cornerSegments);

    // Offsets for dimension measurement lines
    const minDim = Math.min(size.x, size.y, size.z);
    const offset = Math.max(minDim * 0.1, 15);
    const tick = Math.max(offset * 0.45, 8);
    const maxDim = Math.max(size.x, size.y, size.z);
    const baseSpriteScale = Math.max(maxDim * 0.16, 25);
    const spriteScale = { x: baseSpriteScale * 2.2, y: baseSpriteScale * 0.55 };

    // 3. Width Dimension Line (X - Cyan #00F5FF)
    const xLineY = min.y - offset;
    const xLineZ = max.z + offset;
    const xPts = [
      new THREE.Vector3(min.x, xLineY, xLineZ),
      new THREE.Vector3(max.x, xLineY, xLineZ),
      new THREE.Vector3(min.x, xLineY - tick, xLineZ),
      new THREE.Vector3(min.x, xLineY + tick, xLineZ),
      new THREE.Vector3(max.x, xLineY - tick, xLineZ),
      new THREE.Vector3(max.x, xLineY + tick, xLineZ),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, xLineY, xLineZ),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, xLineY, xLineZ)
    ];
    const xGeo = new THREE.BufferGeometry().setFromPoints(xPts);
    const xMat = new THREE.LineBasicMaterial({ color: 0x00F5FF, transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 });
    const xLines = new THREE.LineSegments(xGeo, xMat);
    xLines.renderOrder = 10;
    overlayGroup.add(xLines);

    const xSprite = this.createDimensionLabelSprite(`↔ W: ${Math.round(size.x)}m`, '#00F5FF', spriteScale);
    xSprite.position.set(center.x, xLineY - spriteScale.y * 0.8, xLineZ);
    overlayGroup.add(xSprite);

    // 4. Height Dimension Line (Y - Emerald #00FF88)
    const yLineX = max.x + offset;
    const yLineZ = max.z + offset;
    const yPts = [
      new THREE.Vector3(yLineX, min.y, yLineZ),
      new THREE.Vector3(yLineX, max.y, yLineZ),
      new THREE.Vector3(yLineX - tick, min.y, yLineZ),
      new THREE.Vector3(yLineX + tick, min.y, yLineZ),
      new THREE.Vector3(yLineX - tick, max.y, yLineZ),
      new THREE.Vector3(yLineX + tick, max.y, yLineZ),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(yLineX, min.y, yLineZ),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(yLineX, max.y, yLineZ)
    ];
    const yGeo = new THREE.BufferGeometry().setFromPoints(yPts);
    const yMat = new THREE.LineBasicMaterial({ color: 0x00FF88, transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 });
    const yLines = new THREE.LineSegments(yGeo, yMat);
    yLines.renderOrder = 10;
    overlayGroup.add(yLines);

    const ySprite = this.createDimensionLabelSprite(`↕ H: ${Math.round(size.y)}m`, '#00FF88', spriteScale);
    ySprite.position.set(yLineX + spriteScale.x * 0.55, center.y, yLineZ);
    overlayGroup.add(ySprite);

    // 5. Depth Dimension Line (Z - Amber #FF9F1C)
    const zLineX = max.x + offset;
    const zLineY = min.y - offset;
    const zPts = [
      new THREE.Vector3(zLineX, zLineY, min.z),
      new THREE.Vector3(zLineX, zLineY, max.z),
      new THREE.Vector3(zLineX, zLineY - tick, min.z),
      new THREE.Vector3(zLineX, zLineY + tick, min.z),
      new THREE.Vector3(zLineX, zLineY - tick, max.z),
      new THREE.Vector3(zLineX, zLineY + tick, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(zLineX, zLineY, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(zLineX, zLineY, max.z)
    ];
    const zGeo = new THREE.BufferGeometry().setFromPoints(zPts);
    const zMat = new THREE.LineBasicMaterial({ color: 0xFF9F1C, transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 });
    const zLines = new THREE.LineSegments(zGeo, zMat);
    zLines.renderOrder = 10;
    overlayGroup.add(zLines);

    const zSprite = this.createDimensionLabelSprite(`⤢ D: ${Math.round(size.z)}m`, '#FF9F1C', spriteScale);
    zSprite.position.set(zLineX + spriteScale.x * 0.55, zLineY, center.z);
    overlayGroup.add(zSprite);

    // Align overlay with targetModule world transform
    targetModule.updateMatrixWorld(true);
    targetModule.getWorldPosition(overlayGroup.position);
    targetModule.getWorldQuaternion(overlayGroup.quaternion);
    targetModule.getWorldScale(overlayGroup.scale);

    overlayGroup.visible = this.showDimensions;
    this.scene.add(overlayGroup);
    this.dimensionOverlayGroup = overlayGroup;
  }

  clearDimensionOverlay() {
    if (this.dimensionOverlayGroup) {
      this.scene.remove(this.dimensionOverlayGroup);
      this.dimensionOverlayGroup.traverse(child => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
      this.dimensionOverlayGroup = null;
    }
  }

  selectModuleByIndex(index, resizeGridAndBounds = false, attachGizmo = null) {
    const priorGizmoTarget = this.gizmoTargetModuleIndex;
    this.deselect(false, false);
    this.clearFilterHighlights();

    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule) return;

    this.selectedModuleIndex = index;

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

    // Build 3D dimension overlay with OBB brackets and callout badges
    if (this.showDimensions) {
      this.buildDimensionOverlay(targetModule);
    }

    this.addSnapPointsToModule(targetModule);

    // Module selection does not present a gizmo; attach only if explicitly requested or right-clicked
    const shouldAttachGizmo = attachGizmo === true || (attachGizmo === null && priorGizmoTarget === index);
    if (shouldAttachGizmo) {
      this.attachGizmoToModule(targetModule);
    } else {
      this.detachGizmo();
    }

    const mod = this.currentPlan?.modules?.find(m => m.index === index);
    if (mod && mod.position) {
      this.dragStartPosition = { x: mod.position.x, y: mod.position.y, z: mod.position.z };
    } else {
      this.dragStartPosition = {
        x: Math.round(targetModule.position.x),
        y: Math.round(targetModule.position.y),
        z: Math.round(-targetModule.position.z)
      };
    }
    if (mod && mod.rotation) {
      this.dragStartRotation = { yaw: mod.rotation.yaw, pitch: mod.rotation.pitch, roll: mod.rotation.roll };
    } else {
      this.dragStartRotation = this.getModuleCalculatedRotation(index);
    }

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
      this.isGridAtComponentScale = true;
    } else if (this.isGridAtComponentScale) {
      // Keep boundaries at full station scale only if previously resized to component
      this.restoreFullPlanGrid();
      this.isGridAtComponentScale = false;
    }
  }

  handleModuleDragging() {
    if (!this.transformControls || !this.transformControls.object) return;
    const targetModule = this.transformControls.object;

    if (targetModule === this.multiSelectPivot) {
      const currentPivotPos = this.multiSelectPivot.position;
      const startPivotPos = this.pivotDragStart || this.multiSelectPivot.userData?.dragStartPos;
      if (!startPivotPos) return;

      const delta = new THREE.Vector3().subVectors(currentPivotPos, startPivotPos);

      if (this.isLeftShiftActive(this.lastPointerDownEvent)) {
        const axis = this.transformControls.axis;
        const dir = this.getDragDirectionFromDelta(axis, delta) || this.getGizmoSelectedDirection(this.lastPointerDownEvent);
        if (dir) {
          this.moveModulesFlushToPlotBBAxis(dir, false);
          if (this.multiSelectionHelpers) {
            this.multiSelectionHelpers.forEach(h => h.update());
          }
          this.updatePlotBoxViolations();
          return;
        }
      }

      this.selectedModules.forEach(mod => {
        const startPos = mod.userData.multiDragStartPos;
        if (startPos) {
          mod.position.copy(startPos).add(delta);
          mod.updateMatrixWorld(true);

          if (this.onModuleMoved) {
            const planPos = {
              x: Math.round(mod.position.x),
              y: Math.round(mod.position.y),
              z: Math.round(-mod.position.z)
            };
            this.onModuleMoved(mod.userData.index, planPos, false);
          }
        }
      });

      if (this.multiSelectionHelpers) {
        this.multiSelectionHelpers.forEach(h => h.update());
      }
      this.updatePlotBoxViolations();
      return;
    }

    if (this.isLeftShiftActive(this.lastPointerDownEvent)) {
      const startPos = targetModule.userData.multiDragStartPos || (this.dragStartPosition ? new THREE.Vector3(this.dragStartPosition.x, this.dragStartPosition.y, -this.dragStartPosition.z) : targetModule.position.clone());
      const delta = new THREE.Vector3().subVectors(targetModule.position, startPos);
      const axis = this.transformControls.axis;
      const dir = this.getDragDirectionFromDelta(axis, delta) || this.getGizmoSelectedDirection(this.lastPointerDownEvent);
      if (dir) {
        this.moveModulesFlushToPlotBBAxis(dir, false);
        this.updatePlotBoxViolations();
        return;
      }
    }

    if (this.selectionHelper) {
      this.selectionHelper.update();
    }
    if (this.dimensionOverlayGroup) {
      targetModule.updateMatrixWorld(true);
      targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
      targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
      targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
    }

    const planPos = {
      x: Math.round(targetModule.position.x),
      y: Math.round(targetModule.position.y),
      z: Math.round(-targetModule.position.z)
    };

    if (this.onModuleMoved) {
      this.onModuleMoved(targetModule.userData.index, planPos, false);
    }
    this.updatePlotBoxViolations();
  }

  handleModuleDragEnd() {
    if (this.isCommittingMove) return;
    if (!this.transformControls || !this.transformControls.object) {
      this._isGizmoDragging = false;
      this.hasGizmoMoved = false;
      this.gizmoActiveType = null;
      return;
    }

    if (this.transformControls.object === this.multiSelectPivot) {
      try {
        const currentPivotPos = this.multiSelectPivot.position;
        const startPivotPos = this.pivotDragStart || this.multiSelectPivot.userData?.dragStartPos;
        const delta = new THREE.Vector3().subVectors(currentPivotPos, startPivotPos);

        const moves = [];
        this.selectedModules.forEach(mod => {
          const modIndex = mod.userData.index;
          const planPos = {
            x: Math.round(mod.position.x),
            y: Math.round(mod.position.y),
            z: Math.round(-mod.position.z)
          };
          mod.position.set(planPos.x, planPos.y, -planPos.z);
          mod.updateMatrixWorld(true);

          const planMod = this.currentPlan?.modules?.find(m => m.index === modIndex);
          if (planMod) {
            planMod.position = { ...planPos };
          }

          if (this.onModuleMoved) {
            this.onModuleMoved(modIndex, planPos, true);
          }

          const fromPos = mod.userData.multiDragStartPos ? {
            x: Math.round(mod.userData.multiDragStartPos.x),
            y: Math.round(mod.userData.multiDragStartPos.y),
            z: Math.round(-mod.userData.multiDragStartPos.z)
          } : null;

          if (fromPos && (fromPos.x !== planPos.x || fromPos.y !== planPos.y || fromPos.z !== planPos.z)) {
            moves.push({
              moduleIndex: modIndex,
              macro: mod.userData.macro,
              from: fromPos,
              to: { ...planPos }
            });
          }

          mod.userData.multiDragStartPos = mod.position.clone();
        });

        // Commit multi-module move to undo history
        if (moves.length > 0 && this.onMoveCommitted) {
          if (moves.length === 1) {
            this.onMoveCommitted({
              type: 'move',
              ...moves[0],
              delta: {
                dx: moves[0].to.x - moves[0].from.x,
                dy: moves[0].to.y - moves[0].from.y,
                dz: moves[0].to.z - moves[0].from.z
              },
              timestamp: Date.now()
            });
          } else {
            this.onMoveCommitted({
              type: 'group_move',
              moves: moves,
              timestamp: Date.now()
            });
          }
        }
        this.restoreFullPlanGrid();

        this.pivotDragStart = this.multiSelectPivot.position.clone();
        if (this.multiSelectPivot.userData) {
          this.multiSelectPivot.userData.dragStartPos = this.multiSelectPivot.position.clone();
        }
        if (this.multiSelectionHelpers) {
          this.multiSelectionHelpers.forEach(h => h.update());
        }
        this.updatePlotBoxViolations();
      } catch (err) {
        console.error('Error in handleModuleDragEnd for multiSelectPivot:', err);
      } finally {
        this._isGizmoDragging = false;
        this.hasGizmoMoved = false;
        this.gizmoActiveType = null;
        this.shiftSnapApplied = false;
        this.dragStartCollectiveBox = null;
      }
      return;
    }

    try {
      const targetModule = this.transformControls.object;
      const modIndex = targetModule.userData.index;
      const mod = this.currentPlan?.modules?.find(m => m.index === modIndex);

      const planPos = {
        x: Math.round(targetModule.position.x),
        y: Math.round(targetModule.position.y),
        z: Math.round(-targetModule.position.z)
      };

      targetModule.position.set(planPos.x, planPos.y, -planPos.z);
      targetModule.updateMatrixWorld(true);

      const fromPos = this.dragStartPosition ? { ...this.dragStartPosition } : (mod && mod.position ? { ...mod.position } : null);

      if (mod) {
        if (!mod.position) mod.position = { x: 0, y: 0, z: 0 };
        mod.position.x = planPos.x;
        mod.position.y = planPos.y;
        mod.position.z = planPos.z;
      }

      if (this.selectionHelper) {
        this.selectionHelper.update();
      }
      if (this.dimensionOverlayGroup) {
        targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
        targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
        targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
      }

      if (this.onModuleMoved) {
        this.onModuleMoved(modIndex, planPos, true);
      }

      // Check if move should be committed
      const wasDragging = this.isGizmoDragging() || this.hasGizmoMoved;
      const hasCoordDiff = fromPos && (fromPos.x !== planPos.x || fromPos.y !== planPos.y || fromPos.z !== planPos.z);

      if (wasDragging && (hasCoordDiff || this.hasGizmoMoved)) {
        if (targetModule.userData?.selectedViaMiddleMouse) {
          targetModule.userData.selectedViaMiddleMouse = false;
        }
        const actualFrom = fromPos || { ...planPos };
        if (actualFrom.x !== planPos.x || actualFrom.y !== planPos.y || actualFrom.z !== planPos.z) {
          this.isCommittingMove = true;
          if (this.onMoveCommitted) {
            this.onMoveCommitted({
              type: 'move',
              moduleIndex: modIndex,
              macro: targetModule.userData.macro,
              from: actualFrom,
              to: { ...planPos },
              delta: {
                dx: planPos.x - actualFrom.x,
                dy: planPos.y - actualFrom.y,
                dz: planPos.z - actualFrom.z
              },
              timestamp: Date.now()
            });
          }
          this.restoreFullPlanGrid();
          setTimeout(() => { this.isCommittingMove = false; }, 80);
        }
      }

      this.updatePlotBoxViolations();
      this.dragStartPosition = { ...planPos };
    } catch (err) {
      console.error('Error in handleModuleDragEnd:', err);
    } finally {
      this._isGizmoDragging = false;
      this.hasGizmoMoved = false;
      this.gizmoActiveType = null;
      this.shiftSnapApplied = false;
      this.dragStartCollectiveBox = null;
    }
  }

  handleModuleRotating() {
    if (!this.transformControlsRotate || !this.transformControlsRotate.object) return;
    const targetModule = this.transformControlsRotate.object;

    if (this.selectionHelper) {
      this.selectionHelper.update();
    }
    if (this.dimensionOverlayGroup) {
      targetModule.updateMatrixWorld(true);
      targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
      targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
      targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
    }

    const calcRot = this.getModuleCalculatedRotation(targetModule.userData.index);

    if (this.onModuleRotated) {
      this.onModuleRotated(targetModule.userData.index, calcRot, false);
    }
    this.updatePlotBoxViolations();
  }

  handleModuleRotateEnd() {
    if (this.isCommittingMove) return;
    if (!this.transformControlsRotate || !this.transformControlsRotate.object) {
      this._isGizmoDragging = false;
      this.hasGizmoMoved = false;
      this.gizmoActiveType = null;
      return;
    }

    try {
      const targetModule = this.transformControlsRotate.object;
      const modIndex = targetModule.userData.index;
      const mod = this.currentPlan?.modules?.find(m => m.index === modIndex);

      targetModule.updateMatrixWorld(true);

      const calcRot = this.getModuleCalculatedRotation(modIndex);
      const fromRot = this.dragStartRotation ? { ...this.dragStartRotation } : (mod && mod.rotation ? { ...mod.rotation } : null);

      if (mod && calcRot) {
        if (!mod.rotation) mod.rotation = { yaw: 0, pitch: 0, roll: 0 };
        mod.rotation.yaw = calcRot.yaw;
        mod.rotation.pitch = calcRot.pitch;
        mod.rotation.roll = calcRot.roll;
      }

      if (this.selectionHelper) {
        this.selectionHelper.update();
      }
      if (this.dimensionOverlayGroup) {
        targetModule.getWorldPosition(this.dimensionOverlayGroup.position);
        targetModule.getWorldQuaternion(this.dimensionOverlayGroup.quaternion);
        targetModule.getWorldScale(this.dimensionOverlayGroup.scale);
      }

      if (this.onModuleRotated) {
        this.onModuleRotated(modIndex, calcRot, true);
      }

      const wasDragging = this.isGizmoDragging() || this.hasGizmoMoved;
      const hasRotDiff = fromRot && calcRot && (fromRot.yaw !== calcRot.yaw || fromRot.pitch !== calcRot.pitch || fromRot.roll !== calcRot.roll);

      if (calcRot && wasDragging && hasRotDiff) {
        const actualFromRot = fromRot || { ...calcRot };
        if (actualFromRot.yaw !== calcRot.yaw || actualFromRot.pitch !== calcRot.pitch || actualFromRot.roll !== calcRot.roll) {
          this.isCommittingMove = true;
          if (this.onMoveCommitted) {
            this.onMoveCommitted({
              type: 'rotate',
              moduleIndex: modIndex,
              macro: targetModule.userData.macro,
              fromRot: actualFromRot,
              toRot: { ...calcRot },
              delta: {
                dYaw: calcRot.yaw - actualFromRot.yaw,
                dPitch: calcRot.pitch - actualFromRot.pitch,
                dRoll: calcRot.roll - actualFromRot.roll
              },
              timestamp: Date.now()
            });
          }
          setTimeout(() => { this.isCommittingMove = false; }, 80);
        }
      }

      this.updatePlotBoxViolations();
      this.dragStartRotation = calcRot ? { ...calcRot } : null;
    } catch (err) {
      console.error('Error in handleModuleRotateEnd:', err);
    } finally {
      this._isGizmoDragging = false;
      this.hasGizmoMoved = false;
      this.gizmoActiveType = null;
    }
  }

  setGizmoMode(mode) {
    this.gizmoMode = mode; // 'combined', 'translate', 'rotate'
    const targetModule = this.selectedModuleIndex !== null 
      ? this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex)
      : null;

    const isAttached = this.isGizmoAttached();

    if (this.transformControls) {
      if ((mode === 'combined' || mode === 'translate') && isAttached && targetModule) {
        this.transformControls.attach(targetModule);
        this.transformControls.visible = true;
        this.transformControls.enabled = true;
      } else {
        this.transformControls.detach();
        this.transformControls.visible = false;
        this.transformControls.enabled = false;
      }
    }
    if (this.transformControlsRotate) {
      if ((mode === 'combined' || mode === 'rotate') && isAttached && targetModule) {
        this.transformControlsRotate.attach(targetModule);
        this.transformControlsRotate.visible = true;
        this.transformControlsRotate.enabled = true;
      } else {
        this.transformControlsRotate.detach();
        this.transformControlsRotate.visible = false;
        this.transformControlsRotate.enabled = false;
      }
    }
  }

  attachGizmoToModule(targetModule) {
    if (!targetModule) return;
    if (this.gizmoWorldOffset) {
      this.gizmoWorldOffset.set(0, 0, 0);
    }
    this.gizmoTargetModuleIndex = targetModule.userData?.index ?? null;
    if (this.transformControls && (this.gizmoMode === 'combined' || this.gizmoMode === 'translate')) {
      this.transformControls.attach(targetModule);
      this.transformControls.visible = true;
      this.transformControls.enabled = true;
    }
    if (this.transformControlsRotate && (this.gizmoMode === 'combined' || this.gizmoMode === 'rotate')) {
      if (!targetModule.userData?.isMultiSelectPivot) {
        this.transformControlsRotate.attach(targetModule);
        this.transformControlsRotate.visible = true;
        this.transformControlsRotate.enabled = true;
      } else {
        this.transformControlsRotate.detach();
        this.transformControlsRotate.visible = false;
        this.transformControlsRotate.enabled = false;
      }
    }
    if (this.isGizmoAttached()) {
      const gizmoPos = new THREE.Vector3();
      targetModule.getWorldPosition(gizmoPos);
      const camDist = this.camera.position.distanceTo(gizmoPos);
      if (camDist < 2500) {
        this.ensureActiveGizmoVisible({ force: true });
      }
    }
  }

  attachGizmoToSelectedModule() {
    if (this.selectedModuleIndex === null) return;
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex);
    if (targetModule) {
      this.attachGizmoToModule(targetModule);
    }
  }

  clearMultiSelection() {
    if (this.multiSelectionHelpers && this.multiSelectionHelpers.length > 0) {
      this.multiSelectionHelpers.forEach(helper => {
        this.scene.remove(helper);
        helper.dispose();
      });
      this.multiSelectionHelpers = [];
    }
    this.selectedModules = [];
    this.selectedModuleIndices = [];
    if (this.multiSelectPivot) {
      if (this.transformControls && this.transformControls.object === this.multiSelectPivot) {
        this.detachGizmo();
      }
    }
  }

  detachGizmo() {
    if (this.gizmoWorldOffset) {
      this.gizmoWorldOffset.set(0, 0, 0);
    }
    if (this.transformControls && this.transformControls.object) {
      this.transformControls.detach();
    }
    if (this.transformControlsRotate && this.transformControlsRotate.object) {
      this.transformControlsRotate.detach();
    }
  }

  /**
   * Overrides TransformControls.updateMatrixWorld to apply gizmoWorldOffset
   * to handles and interaction plane when the gizmo is visually relocated to visible viewport during zoom.
   */
  setupTransformControlsOverride(tc) {
    if (!tc) return;
    const scope = this;
    const origUpdate = tc.updateMatrixWorld ? tc.updateMatrixWorld.bind(tc) : null;
    tc.updateMatrixWorld = function(force) {
      if (origUpdate) {
        origUpdate(force);
      } else if (THREE.Object3D.prototype.updateMatrixWorld) {
        THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
      }
      if (scope.gizmoWorldOffset && scope.gizmoWorldOffset.lengthSq() > 0.0001) {
        if (this.worldPosition) {
          this.worldPosition.add(scope.gizmoWorldOffset);
        }
        if (this.camera && this.eye && this.cameraPosition && this.camera.isPerspectiveCamera && this.worldPosition) {
          this.eye.copy(this.cameraPosition).sub(this.worldPosition).normalize();
        }
        if (this._gizmo && this._gizmo.worldPosition) {
          this._gizmo.worldPosition.copy(this.worldPosition);
          this._gizmo.updateMatrixWorld(force);
        }
        if (this._plane && this._plane.worldPosition) {
          this._plane.worldPosition.copy(this.worldPosition);
          this._plane.updateMatrixWorld(force);
        }
      }
    };
  }

  isGizmoDragging() {
    if (this.gizmoCoordinator) {
      return this.gizmoCoordinator.isGizmoDragging() || !!this._isGizmoDragging;
    }
    const isTransDragging = !!(this.transformControls && this.transformControls.dragging);
    const isRotDragging = !!(this.transformControlsRotate && this.transformControlsRotate.dragging);
    return isTransDragging || isRotDragging || !!this._isGizmoDragging;
  }

  isGizmoAttached() {
    if (this.gizmoCoordinator) {
      return this.gizmoCoordinator.isGizmoAttached();
    }
    return !!(
      (this.transformControls && this.transformControls.object) ||
      (this.transformControlsRotate && this.transformControlsRotate.object)
    );
  }

  /**
   * Calculates the appropriate gizmo size based on camera distance to the gizmo location.
   */
  getAppropriateGizmoSize(distance) {
    if (this.gizmoCoordinator) {
      return this.gizmoCoordinator.getAppropriateGizmoSize(distance);
    }
    if (!distance || isNaN(distance)) return 0.85;
    if (distance < 150) {
      return Math.max(0.68, Math.min(0.85, 0.68 + (distance / 150) * 0.17));
    } else if (distance > 2000) {
      return Math.min(1.10, 0.85 + ((distance - 2000) / 8000) * 0.25);
    }
    return 0.85;
  }

  /**
   * Computes the 3D location on the target module at the zoomed camera location.
   * Uses raycasting from camera through pointer/viewport center against the module meshes or bounding box.
   */
  getModuleZoomedLocation(targetModule) {
    if (this.gizmoCoordinator) {
      return this.gizmoCoordinator.getModuleZoomedLocation(
        targetModule,
        this.mouse,
        (mod) => (this.getModuleWorldBoundingBox ? this.getModuleWorldBoundingBox(mod) : new THREE.Box3().setFromObject(mod))
      );
    }
    if (!targetModule) return null;

    const pointerNdc = (this.mouse && typeof this.mouse.x === 'number' && !isNaN(this.mouse.x))
      ? new THREE.Vector2(this.mouse.x, this.mouse.y)
      : new THREE.Vector2(0, 0);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerNdc, this.camera);

    const minSafeDist = Math.max(15, (this.camera.near || 1) + 5);

    // 1. First attempt: raycast against meshes belonging to this module
    const intersects = raycaster.intersectObjects([targetModule], true);
    if (intersects && intersects.length > 0) {
      const hit = intersects[0].point.clone();
      const hitCamSpace = hit.clone().applyMatrix4(this.camera.matrixWorldInverse);
      if (-hitCamSpace.z >= minSafeDist) {
        return hit;
      }
    }

    // 2. Second attempt: raycast against the module's world bounding box
    const box = this.getModuleWorldBoundingBox ? this.getModuleWorldBoundingBox(targetModule) : new THREE.Box3().setFromObject(targetModule);
    if (box && !box.isEmpty()) {
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectBox(box, hitPoint)) {
        const hitCamSpace = hitPoint.clone().applyMatrix4(this.camera.matrixWorldInverse);
        if (-hitCamSpace.z >= minSafeDist) {
          return hitPoint;
        }
      }
      
      // Determine safe depth in front of the camera
      const center = box.getCenter(new THREE.Vector3());
      const camSpaceCenter = center.clone().applyMatrix4(this.camera.matrixWorldInverse);
      const safeDepth = Math.max(25, -camSpaceCenter.z > 0 ? -camSpaceCenter.z : 100);

      // Viewport frustum extents at safeDepth
      const fovRad = THREE.MathUtils.degToRad(this.camera.fov || 60);
      const halfH = safeDepth * Math.tan(fovRad / 2);
      const halfW = halfH * (this.camera.aspect || 1);

      // Safe viewport margin limit (0.75 leaves room inside display)
      const maxMargin = 0.75;
      const targetCamSpace = new THREE.Vector3(
        Math.max(-halfW * maxMargin, Math.min(halfW * maxMargin, camSpaceCenter.x)),
        Math.max(-halfH * maxMargin, Math.min(halfH * maxMargin, camSpaceCenter.y)),
        -safeDepth
      );

      return targetCamSpace.applyMatrix4(this.camera.matrixWorld);
    }

    // Fallback: point directly in front of camera at safe viewing depth
    const fallbackDepth = 100;
    return new THREE.Vector3(0, 0, -fallbackDepth).applyMatrix4(this.camera.matrixWorld);
  }

  /**
   * Ensures that when zoomed in on a module and the gizmo is active,
   * if the gizmo appears outside the viewport display, it is moved to the zoomed location
   * on the module and sized appropriately, leaving the camera position and target undisturbed.
   */
  ensureActiveGizmoVisible(options = {}) {
    if (!this.isGizmoAttached()) return;
    if (this.isGizmoDragging()) return;
    if (this._isEnsuringGizmoVisible) return;

    if (this.gizmoCoordinator) {
      this.gizmoCoordinator.transformControls = this.transformControls;
      this.gizmoCoordinator.transformControlsRotate = this.transformControlsRotate;
      this.gizmoCoordinator.ensureActiveGizmoVisible(
        { isZooming: options.isZooming || this._isZooming, force: options.force },
        this.mouse,
        (mod) => (this.getModuleWorldBoundingBox ? this.getModuleWorldBoundingBox(mod) : new THREE.Box3().setFromObject(mod))
      );
      if (this.gizmoCoordinator.gizmoWorldOffset) {
        if (!this.gizmoWorldOffset) {
          this.gizmoWorldOffset = new THREE.Vector3();
        }
        this.gizmoWorldOffset.copy(this.gizmoCoordinator.gizmoWorldOffset);
      }
      return;
    }

    const isZooming = options.isZooming || this._isZooming || options.force;
    if (!isZooming) return;

    const activeTarget = this.transformControls?.object || this.transformControlsRotate?.object;
    if (!activeTarget) return;

    this._isEnsuringGizmoVisible = true;
    try {
      const gizmoPos = new THREE.Vector3();
      activeTarget.getWorldPosition(gizmoPos);

      this.camera.updateMatrixWorld(true);

      // Transform gizmo position into camera view space
      const camSpace = gizmoPos.clone().applyMatrix4(this.camera.matrixWorldInverse);
      const zDist = -camSpace.z;

      // Check if gizmo is behind the camera or outside the visible viewport
      const minSafeDist = Math.max(15, (this.camera.near || 1) + 5);
      const fovRad = THREE.MathUtils.degToRad(this.camera.fov || 60);
      const halfH = Math.max(0.001, zDist * Math.tan(fovRad / 2));
      const halfW = halfH * (this.camera.aspect || 1);

      const ndcX = camSpace.x / halfW;
      const ndcY = camSpace.y / halfH;

      const isBehindCamera = zDist < minSafeDist;
      const maxDisplayMargin = 0.85; // Outside visible display margin
      const isOutsideViewport = isBehindCamera || Math.abs(ndcX) > maxDisplayMargin || Math.abs(ndcY) > maxDisplayMargin;

      if (isOutsideViewport) {
        // Move ONLY the visual gizmo to the zoomed location on the active module without displacing the module
        const zoomedLoc = this.getModuleZoomedLocation(activeTarget);
        if (zoomedLoc) {
          if (!this.gizmoWorldOffset) {
            this.gizmoWorldOffset = new THREE.Vector3();
          }
          this.gizmoWorldOffset.subVectors(zoomedLoc, gizmoPos);
        }
      } else {
        if (this.gizmoWorldOffset) {
          this.gizmoWorldOffset.set(0, 0, 0);
        }
      }

      // Size gizmo appropriately based on distance from camera to the active gizmo location
      const currentGizmoPos = gizmoPos.clone();
      if (this.gizmoWorldOffset && this.gizmoWorldOffset.lengthSq() > 0.0001) {
        currentGizmoPos.add(this.gizmoWorldOffset);
      }
      const distToCamera = this.camera.position.distanceTo(currentGizmoPos);
      const appropriateSize = this.getAppropriateGizmoSize(distToCamera);

      if (this.transformControls) {
        this.transformControls.size = appropriateSize;
        if (typeof this.transformControls.updateMatrixWorld === 'function') {
          this.transformControls.updateMatrixWorld(true);
        }
      }
      if (this.transformControlsRotate) {
        this.transformControlsRotate.size = appropriateSize;
        if (typeof this.transformControlsRotate.updateMatrixWorld === 'function') {
          this.transformControlsRotate.updateMatrixWorld(true);
        }
      }
    } finally {
      this._isEnsuringGizmoVisible = false;
    }
  }

  deselect(restoreGrid = true, clearGizmoTarget = true) {
    if (this.gizmoWorldOffset) {
      this.gizmoWorldOffset.set(0, 0, 0);
    }
    this.selectedModuleIndex = null;
    this.clearMultiSelection();
    if (clearGizmoTarget) {
      this.gizmoTargetModuleIndex = null;
    }
    this.detachGizmo();
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.dispose();
      this.selectionHelper = null;
    }
    this.clearDimensionOverlay();
    if (!this.showSnapPoints && this.modulesGroup) {
      this.modulesGroup.traverse(child => {
        if (child.name === 'module_snaps_group') {
          child.visible = false;
        }
      });
    }
    if (restoreGrid && this.isGridAtComponentScale) {
      this.restoreFullPlanGrid();
      this.isGridAtComponentScale = false;
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

  isModuleVisibleInViewport(index) {
    if (!this.camera || !this.modulesGroup) return false;
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule || !targetModule.visible) return false;

    // Check parent visibility
    let cur = targetModule.parent;
    while (cur && cur !== this.scene) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }

    // Check if module macro is in hiddenMacros
    if (targetModule.userData.macro && this.hiddenMacros && this.hiddenMacros.has(targetModule.userData.macro)) {
      return false;
    }

    const box = new THREE.Box3().setFromObject(targetModule);
    if (box.isEmpty()) return false;

    this.camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    return frustum.intersectsBox(box);
  }

  focusCameraOnModule(index, focusCameraPosition = true) {
    if (this.cameraTransitionAnimId) {
      cancelAnimationFrame(this.cameraTransitionAnimId);
      this.cameraTransitionAnimId = null;
    }

    if (!focusCameraPosition) return;

    if (this.isModuleVisibleInViewport(index)) {
      // Component is already visible in the main display - do not force camera re-render / re-orientation
      return;
    }

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
      // First try to keep the current viewing direction; only branch out if line-of-sight is blocked.
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
        this.cameraTransitionAnimId = requestAnimationFrame(animateTransition);
      } else {
        this.cameraTransitionAnimId = null;
      }
    };

    this.cameraTransitionAnimId = requestAnimationFrame(animateTransition);
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
    if (this.selectedModuleIndex !== null) {
      const selectedModule = this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex);
      if (this.dimensionOverlayGroup) {
        this.dimensionOverlayGroup.visible = this.showDimensions && !!(selectedModule && selectedModule.visible);
      }
      if (selectedModule && !selectedModule.visible) {
        this.detachGizmo();
      }
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

  toggleDimensions(enabled) {
    this.showDimensions = enabled;
    if (this.dimensionOverlayGroup) {
      this.dimensionOverlayGroup.visible = enabled;
    } else if (enabled && this.selectedModuleIndex !== null) {
      const targetModule = this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex);
      if (targetModule) {
        this.buildDimensionOverlay(targetModule);
      }
    }
  }

  toggleSnapPoints(enabled) {
    this.showSnapPoints = enabled;
    this.modulesGroup.traverse(child => {
      if (child.name === 'module_snaps_group') {
        child.visible = enabled;
      }
    });
  }

  buildModuleSnapPoints(moduleGroup, macroName) {
    if (!moduleGroup) return;
    const existing = moduleGroup.getObjectByName('module_snaps_group');
    if (existing) {
      moduleGroup.remove(existing);
      this.snapDots = this.snapDots.filter(d => d.userData?.moduleIndex !== moduleGroup.userData?.index);
    }

    const localBounds = this.getModuleLocalBounds(moduleGroup);
    const snaps = getModuleSnapPoints(macroName, localBounds);
    if (!snaps || snaps.length === 0) return;

    const isCustom = hasCustomSnapPointsForMacro(macroName);
    moduleGroup.userData.hasCustomSnapPoints = isCustom;
    moduleGroup.userData.snapPoints = snaps;

    const snapsGroup = new THREE.Group();
    snapsGroup.name = 'module_snaps_group';
    snapsGroup.visible = this.showSnapPoints;

    for (const snap of snaps) {
      const dot = new THREE.Mesh(this.snapPointGeometry, this.snapPointMaterial);
      dot.name = `snap_dot_${snap.name}`;
      dot.userData = {
        isSnapPoint: true,
        isCustomSnapPoint: isCustom,
        snapName: snap.name,
        moduleIndex: moduleGroup.userData.index,
        localPos: [...snap.pos]
      };
      // Unified coordinate transformation:
      // Maps standard X4 component coordinates (x, y, z) into visualizer local space (-x, y, z)
      dot.position.set(-snap.pos[0], snap.pos[1], snap.pos[2]);
      dot.renderOrder = 50;

      snapsGroup.add(dot);
      this.snapDots.push(dot);
    }

    moduleGroup.add(snapsGroup);
  }

  addSnapPointsToModule(targetModule) {
    if (!targetModule) return;
    const macroName = targetModule.userData?.macro;
    let snapsGroup = targetModule.getObjectByName('module_snaps_group');
    if (!snapsGroup) {
      this.buildModuleSnapPoints(targetModule, macroName);
      snapsGroup = targetModule.getObjectByName('module_snaps_group');
    }
    if (snapsGroup) {
      snapsGroup.visible = true;
      snapsGroup.traverse(child => {
        if (child.isMesh && child.userData && child.userData.isSnapPoint) {
          child.visible = true;
        }
      });
    }
  }

  toggleAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 0.6;
  }

  toggleWireframe(enabled) {
    this.wireframeMode = enabled;
    this.modulesGroup.traverse(child => {
      if (child.isMesh && child.material && (!child.userData || !child.userData.isSnapPoint)) {
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
    if (this.composer) {
      this.composer.setSize(width, height);
      if (this.bloomPass && this.bloomPass.resolution) {
        this.bloomPass.resolution.set(width, height);
      }
    }
  }

  raycastModuleAtPointer(event) {
    if (!this.renderer || !this.camera || !this.modulesGroup) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

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
      let hitObj = intersects[0].object;
      let moduleIdx = hitObj.userData?.moduleIndex;

      while (hitObj && moduleIdx === undefined) {
        hitObj = hitObj.parent;
        if (hitObj && hitObj.userData) moduleIdx = hitObj.userData.index;
      }

      if (moduleIdx !== undefined) {
        const topModule = this.modulesGroup.children.find(child => child.userData && child.userData.index === moduleIdx);
        return { moduleIdx, moduleObject: topModule, intersection: intersects[0] };
      }
    }
    return null;
  }

  /**
   * Shrink (or grow) the plot BB on all three axes as tightly as possible around
   * all visible modules without any module violating the resulting plot BB.
   * Plot extents are whole kilometres anchored at the origin, so each side is
   * rounded up to the next km that still contains the modules.
   */
  fitPlotBBToModules() {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return;

    const oldCfg = JSON.parse(JSON.stringify(this.currentPlotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG));

    const box = new THREE.Box3();
    this.modulesGroup.children.forEach(mod => {
      if (!mod || !mod.visible) return;
      const b = this.getModuleWorldBoundingBox(mod);
      if (b && !b.isEmpty()) box.union(b);
    });
    if (box.isEmpty()) return;

    const EPS = 0.5; // matches violation tolerance (meters)
    const toKm = (meters) => Math.max(0, Math.ceil((meters - EPS) / 1000));

    const fitAxis = (plus, minus) => {
      plus = Math.min(20, plus);
      minus = Math.min(20, minus);
      if (plus + minus > 20) {
        console.warn('[Viewer] Modules exceed the 20 km plot limit on an axis; plot BB clamped.');
        minus = Math.max(0, 20 - plus);
      }
      if (plus + minus < 1) plus = 1;
      return { plus, minus };
    };

    // Three.js Z is inverted relative to plan Z: minZ = -plusZ*1000, maxZ = minusZ*1000
    const newCfg = {
      enabled: true,
      x: fitAxis(toKm(box.max.x), toKm(-box.min.x)),
      y: fitAxis(toKm(box.max.y), toKm(-box.min.y)),
      z: fitAxis(toKm(-box.min.z), toKm(box.max.z))
    };

    const isDifferent = (
      oldCfg.x.plus !== newCfg.x.plus ||
      oldCfg.x.minus !== newCfg.x.minus ||
      oldCfg.y.plus !== newCfg.y.plus ||
      oldCfg.y.minus !== newCfg.y.minus ||
      oldCfg.z.plus !== newCfg.z.plus ||
      oldCfg.z.minus !== newCfg.z.minus ||
      oldCfg.enabled !== newCfg.enabled
    );

    // Persists globally and for the active blueprint, refreshes pill UI and 3D plot box
    setPlotConfig(newCfg, true);
    this.restoreFullPlanGrid();
    this.updatePlotBoxViolations();

    const totX = newCfg.x.plus + newCfg.x.minus;
    const totY = newCfg.y.plus + newCfg.y.minus;
    const totZ = newCfg.z.plus + newCfg.z.minus;
    const ev = this.lastPointerDownEvent;
    this.showFloatingPlotSize(totX, totY, totZ, ev ? ev.clientX : null, ev ? ev.clientY : null);
    if (this.floatingHudTimeout) clearTimeout(this.floatingHudTimeout);
    this.floatingHudTimeout = setTimeout(() => this.hideFloatingPlotSize(), 1500);

    if (isDifferent && this.onMoveCommitted) {
      this.onMoveCommitted({
        type: 'plot_resize',
        operation: 'diamond_fit',
        description: 'Fit Plot to Blueprint',
        fromConfig: oldCfg,
        toConfig: newCfg,
        timestamp: Date.now()
      });
    }
  }

  onPointerDown(event) {
    this.lastPointerDownEvent = event;
    if (event.shiftKey) this.isShiftDown = true;
    if (event.code === 'ShiftLeft') this.isLeftShiftDown = true;
    if (event.code === 'ShiftRight') this.isRightShiftDown = true;

    // Cancel any running camera transition when clicking
    if (this.cameraTransitionAnimId) {
      cancelAnimationFrame(this.cameraTransitionAnimId);
      this.cameraTransitionAnimId = null;
    }

    // Middle mouse button depressed: initiate marquee selection box
    if (event.button === 1) {
      event.preventDefault();
      this.isMiddleMouseSelecting = true;
      this.middlePointerId = event.pointerId;
      try {
        this.renderer.domElement.setPointerCapture(event.pointerId);
      } catch (_) {}
      this.selectionBoxStart = { x: event.clientX, y: event.clientY };
      this.controls.enabled = false;
      this.initOrShowSelectionBox(event.clientX, event.clientY);
      return;
    }

    // Right-click on center diamond (XYZ handle): shrink plot BB on all three axes tightly around the modules
    if (event.button === 2 && this.isGizmoAttached() && (this.transformControls?.axis === 'XYZ' || this.isPointerOverCenterDiamond(event))) {
      event.preventDefault();
      if (this.transformControls) this.transformControls.dragging = false;
      this._isGizmoDragging = false;
      this.controls.enabled = true;
      this.fitPlotBBToModules();
      return;
    }

    // If clicking center diamond (XYZ handle) on transform gizmo, open center confirmation popup
    if (event.button === 0 && this.isGizmoAttached() && (this.transformControls?.axis === 'XYZ' || this.isPointerOverCenterDiamond(event))) {
      if (this.transformControls) this.transformControls.dragging = false;
      this._isGizmoDragging = false;
      this.controls.enabled = true;
      this.showCenterModulesModal();
      return;
    }

    // If clicking or dragging TransformControls gizmo arrows or rotation rings, do not raycast or change selection!
    const isTransActive = this.transformControls && (this.transformControls.axis !== null || this.transformControls.dragging);
    const isRotActive = this.transformControlsRotate && (this.transformControlsRotate.axis !== null || this.transformControlsRotate.dragging);
    if (isTransActive || isRotActive) {
      if (this.transformControls && this.transformControls.axis === 'XYZ') {
        this.transformControls.dragging = false;
        this._isGizmoDragging = false;
        this.controls.enabled = true;
        this.showCenterModulesModal();
      }
      return;
    }

    // Ensure canvas element acquires focus on user interaction
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.focus();
    }

    // Check if clicked on a BB corner with left click
    if (event.button === 0) {
      const hitCornerDot = this.findPlotCornerNearPointer(event);
      if (hitCornerDot) {
        this.setPlotCornersVisible(true);
        this.startPlotCornerDrag(hitCornerDot, event);
        return;
      }
    }

    // Right-click: right-clicking on a module presents the gizmo
    if (event.button === 2) {
      const hit = this.raycastModuleAtPointer(event);
      if (hit) {
        this.gizmoTargetModuleIndex = hit.moduleIdx;
        this.selectModuleByIndex(hit.moduleIdx, false, true);
        if (this.onModuleSelected) {
          this.onModuleSelected(hit.moduleIdx);
        }
        this.gizmoTargetModuleIndex = null;
      } else {
        this.gizmoTargetModuleIndex = null;
        this.detachGizmo();
      }
      return;
    }

    // Only respond to primary (left) mouse clicks for module selection/deselection
    if (event.button !== 0) {
      return;
    }

    // Left click: Module selection does NOT present a gizmo
    const hit = this.raycastModuleAtPointer(event);
    if (hit) {
      this.gizmoTargetModuleIndex = null;
      this.selectModuleByIndex(hit.moduleIdx, false, false);
      if (this.onModuleSelected) {
        this.onModuleSelected(hit.moduleIdx);
      }
    } else {
      this.gizmoTargetModuleIndex = null;
      this.deselect();
      if (this.onModuleSelected) {
        this.onModuleSelected(null);
      }
    }
  }

  setPlotCornersVisible(visible) {
    this.arePlotCornersVisible = !!visible;
    if (this.plotCornerHandles) {
      this.plotCornerHandles.forEach(dot => {
        dot.visible = this.arePlotCornersVisible;
      });
    }
  }

  findPlotCornerNearPointer(event) {
    if (!this.plotCornerHandles || this.plotCornerHandles.length === 0) return null;
    const rect = this.renderer?.domElement?.getBoundingClientRect();
    if (!rect) return null;

    const pointerX = event.clientX;
    const pointerY = event.clientY;

    const tempWorld = new THREE.Vector3();
    const tempScreen = new THREE.Vector3();

    let closestDot = null;
    let minDistanceSq = Infinity;
    const thresholdPixels = 32; // Click tolerance in screen space
    const thresholdSq = thresholdPixels * thresholdPixels;

    for (const dot of this.plotCornerHandles) {
      dot.getWorldPosition(tempWorld);
      tempScreen.copy(tempWorld).project(this.camera);

      // Check if corner is in front of camera (NDC z between -1 and 1)
      if (tempScreen.z > -1 && tempScreen.z < 1) {
        const sx = ((tempScreen.x + 1) / 2) * rect.width + rect.left;
        const sy = ((-tempScreen.y + 1) / 2) * rect.height + rect.top;
        const distSq = (pointerX - sx) * (pointerX - sx) + (pointerY - sy) * (pointerY - sy);

        if (distSq <= thresholdSq && distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestDot = dot;
        }
      }
    }

    // Fallback 3D ray distance check
    if (!closestDot) {
      let minRayDist = Infinity;
      for (const dot of this.plotCornerHandles) {
        dot.getWorldPosition(tempWorld);
        const rayDist = this.raycaster.ray.distanceToPoint(tempWorld);
        const camDist = this.camera.position.distanceTo(tempWorld);
        const allowedRayDist = Math.max(140, camDist * 0.04);
        if (rayDist <= allowedRayDist && rayDist < minRayDist) {
          minRayDist = rayDist;
          closestDot = dot;
        }
      }
    }

    return closestDot;
  }

  startPlotCornerDrag(dot, event) {
    this.isPlotCornerDragging = true;
    this.controls.enabled = false;
    this.setPlotCornersVisible(true);
    this.plotDragLockedAxis = null;

    this.plotDragDotData = { ...dot.userData };
    const currentCfg = this.currentPlotConfig || getCurrentPlotConfig() || DEFAULT_PLOT_CONFIG;
    this.plotDragStartConfig = JSON.parse(JSON.stringify(currentCfg));
    this.plotDragHasChanged = false;

    const dotWorldPos = new THREE.Vector3();
    dot.getWorldPosition(dotWorldPos);
    this.plotDragStartWorldPos = dotWorldPos.clone();

    const normal = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    this.plotDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, dotWorldPos);

    if (this.plotCornerHandles) {
      this.plotCornerHandles.forEach(d => {
        if (d.material) d.material.color.setHex(0xFF0033);
      });
    }
    if (dot.material) {
      dot.material.color.setHex(0xFFFF00);
    }
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.cursor = 'grabbing';
    }

    const totX = this.plotDragStartConfig.x.plus + this.plotDragStartConfig.x.minus;
    const totY = this.plotDragStartConfig.y.plus + this.plotDragStartConfig.y.minus;
    const totZ = this.plotDragStartConfig.z.plus + this.plotDragStartConfig.z.minus;
    this.showFloatingPlotSize(totX, totY, totZ, event.clientX, event.clientY);
  }

  onPointerMove(event) {
    if (this.isMiddleMouseSelecting) {
      this.updateSelectionBox(event.clientX, event.clientY);
      return;
    }

    const rect = this.renderer?.domElement?.getBoundingClientRect();
    if (!rect) return;

    const mX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.mouse.x = mX;
    this.mouse.y = mY;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.isPlotCornerDragging && this.plotDragPlane && this.plotDragStartWorldPos && this.plotDragDotData) {
      const intersectPt = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.plotDragPlane, intersectPt)) return;

      const deltaVec = intersectPt.clone().sub(this.plotDragStartWorldPos);
      const { sx, sy, sz } = this.plotDragDotData;

      // 1 unit = 1000m. Change in integer 1 unit increments/decrements.
      let deltaUnitsX = Math.round((sx * deltaVec.x) / 1000);
      let deltaUnitsY = Math.round((sy * deltaVec.y) / 1000);
      let deltaUnitsZ = Math.round((sz * deltaVec.z) / 1000);

      // Once a red dot is moved in a direction, lock the move to affect only that direction until released
      if (!this.plotDragLockedAxis) {
        const absX = Math.abs(deltaVec.x);
        const absY = Math.abs(deltaVec.y);
        const absZ = Math.abs(deltaVec.z);
        const maxDist = Math.max(absX, absY, absZ);

        if (maxDist >= 400 || Math.abs(deltaUnitsX) > 0 || Math.abs(deltaUnitsY) > 0 || Math.abs(deltaUnitsZ) > 0) {
          if (absX >= absY && absX >= absZ) {
            this.plotDragLockedAxis = 'x';
          } else if (absY >= absX && absY >= absZ) {
            this.plotDragLockedAxis = 'y';
          } else {
            this.plotDragLockedAxis = 'z';
          }
        }
      }

      // Constrain sizing strictly to the locked direction
      if (this.plotDragLockedAxis === 'x') {
        deltaUnitsY = 0;
        deltaUnitsZ = 0;
      } else if (this.plotDragLockedAxis === 'y') {
        deltaUnitsX = 0;
        deltaUnitsZ = 0;
      } else if (this.plotDragLockedAxis === 'z') {
        deltaUnitsX = 0;
        deltaUnitsY = 0;
      } else {
        deltaUnitsX = 0;
        deltaUnitsY = 0;
        deltaUnitsZ = 0;
      }

      const cfg = JSON.parse(JSON.stringify(this.plotDragStartConfig));

      const applyAxisDelta = (axisObj, isPositiveSide, delta) => {
        let p = axisObj.plus;
        let m = axisObj.minus;
        if (isPositiveSide) {
          p = Math.max(0, Math.min(20, p + delta));
          if (p + m > 20) {
            m = Math.max(0, 20 - p);
          }
          if (p + m < 1) {
            p = Math.max(p, 1 - m);
          }
        } else {
          m = Math.max(0, Math.min(20, m + delta));
          if (p + m > 20) {
            m = Math.max(0, 20 - m);
          }
          if (p + m < 1) {
            m = Math.max(p, 1 - m);
          }
        }
        return { plus: p, minus: m };
      };

      cfg.x = applyAxisDelta(this.plotDragStartConfig.x, sx === 1, deltaUnitsX);
      cfg.y = applyAxisDelta(this.plotDragStartConfig.y, sy === 1, deltaUnitsY);
      cfg.z = applyAxisDelta(this.plotDragStartConfig.z, sz === -1, deltaUnitsZ);

      const totX = cfg.x.plus + cfg.x.minus;
      const totY = cfg.y.plus + cfg.y.minus;
      const totZ = cfg.z.plus + cfg.z.minus;

      const changed = (
        cfg.x.plus !== this.currentPlotConfig.x.plus ||
        cfg.x.minus !== this.currentPlotConfig.x.minus ||
        cfg.y.plus !== this.currentPlotConfig.y.plus ||
        cfg.y.minus !== this.currentPlotConfig.y.minus ||
        cfg.z.plus !== this.currentPlotConfig.z.plus ||
        cfg.z.minus !== this.currentPlotConfig.z.minus
      );

      if (changed) {
        this.plotDragHasChanged = true;
        this.updatePlotBox(cfg);
        if (this.plotCornerHandles) {
          const activeDot = this.plotCornerHandles.find(d =>
            d.userData.sx === sx && d.userData.sy === sy && d.userData.sz === sz
          );
          if (activeDot && activeDot.material) {
            activeDot.material.color.setHex(0xFFFF00);
          }
        }
      }

      this.showFloatingPlotSize(totX, totY, totZ, event.clientX, event.clientY);
      return;
    }

    if (this.plotCornerHandles && this.plotCornerHandles.length > 0 && !this.isGizmoDragging()) {
      const nearCorner = this.findPlotCornerNearPointer(event);
      if (nearCorner) {
        if (this.renderer && this.renderer.domElement) {
          this.renderer.domElement.style.cursor = 'grab';
        }
        return;
      }
    }

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.style.cursor === 'grab') {
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  onPointerUp(event) {
    if (this.isMiddleMouseSelecting && (event.button === 1 || this.middlePointerId === event.pointerId)) {
      try {
        if (this.middlePointerId !== null) {
          this.renderer.domElement.releasePointerCapture(this.middlePointerId);
        }
      } catch (_) {}
      this.middlePointerId = null;
      this.handleMiddleMouseSelectionEnd(event);
      return;
    }
    if (this.isPlotCornerDragging) {
      this.handlePlotCornerDragEnd(event);
    }
    if (this.isGizmoDragging()) {
      const type = this.gizmoActiveType;
      this._isGizmoDragging = false;
      if (type === 'move') {
        this.handleModuleDragEnd();
      } else if (type === 'rotate') {
        this.handleModuleRotateEnd();
      }
    }
  }

  handlePlotCornerDragEnd(event) {
    this.isPlotCornerDragging = false;
    this.controls.enabled = true;
    this.plotDragLockedAxis = null;
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.cursor = 'default';
    }

    // Hide the red dots after release of the corner gizmo
    this.setPlotCornersVisible(false);

    if (this.plotCornerHandles) {
      this.plotCornerHandles.forEach(d => {
        if (d.material) d.material.color.setHex(0xFF0033);
      });
    }

    if (this.plotDragHasChanged) {
      setPlotConfig(this.currentPlotConfig, false);
      if (this.floatingHudTimeout) clearTimeout(this.floatingHudTimeout);
      this.floatingHudTimeout = setTimeout(() => {
        this.hideFloatingPlotSize();
      }, 1500);
    } else {
      this.hideFloatingPlotSize();
    }

    // Perform a FIT function after release of the corner gizmo
    this.fitCameraToStation();
  }

  initOrShowSelectionBox(clientX, clientY) {
    if (!this.selectionBoxEl) {
      this.selectionBoxEl = document.createElement('div');
      this.selectionBoxEl.id = 'viewport-marquee-box';
      this.selectionBoxEl.className = 'viewport-marquee-box';
      this.container.appendChild(this.selectionBoxEl);
    }
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    this.selectionBoxEl.style.left = `${x}px`;
    this.selectionBoxEl.style.top = `${y}px`;
    this.selectionBoxEl.style.width = '0px';
    this.selectionBoxEl.style.height = '0px';
    this.selectionBoxEl.style.display = 'block';
  }

  updateSelectionBox(clientX, clientY) {
    if (!this.selectionBoxEl || !this.selectionBoxStart) return;
    const rect = this.container.getBoundingClientRect();
    const startX = this.selectionBoxStart.x - rect.left;
    const startY = this.selectionBoxStart.y - rect.top;
    const curX = clientX - rect.left;
    const curY = clientY - rect.top;

    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    this.selectionBoxEl.style.left = `${left}px`;
    this.selectionBoxEl.style.top = `${top}px`;
    this.selectionBoxEl.style.width = `${width}px`;
    this.selectionBoxEl.style.height = `${height}px`;
  }

  hideSelectionBox() {
    if (this.selectionBoxEl) {
      this.selectionBoxEl.style.display = 'none';
    }
  }

  handleMiddleMouseSelectionEnd(event) {
    this.isMiddleMouseSelecting = false;
    this.controls.enabled = true;
    this.hideSelectionBox();

    if (!this.selectionBoxStart) return;

    const minX = Math.min(this.selectionBoxStart.x, event.clientX);
    const maxX = Math.max(this.selectionBoxStart.x, event.clientX);
    const minY = Math.min(this.selectionBoxStart.y, event.clientY);
    const maxY = Math.max(this.selectionBoxStart.y, event.clientY);
    this.selectionBoxStart = null;

    // Minimum drag threshold to prevent unintentional clicks from clearing selection
    if (maxX - minX < 4 && maxY - minY < 4) {
      return;
    }

    // Move grid centered
    this.restoreFullPlanGrid();

    const hitModules = this.getModulesInScreenBox(minX, maxX, minY, maxY);
    if (!hitModules || hitModules.length === 0) {
      this.deselect();
      if (this.onModuleSelected) {
        this.onModuleSelected(null);
      }
      return;
    }

    this.selectModulesGroup(hitModules);
  }

  getModulesInScreenBox(minX, maxX, minY, maxY) {
    const hits = [];
    if (!this.camera || !this.modulesGroup || !this.renderer) return hits;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const tempScreen = new THREE.Vector3();

    this.modulesGroup.children.forEach(mod => {
      if (!mod.visible) return;
      if (mod.userData?.macro && this.hiddenMacros?.has(mod.userData.macro)) return;

      let cur = mod.parent;
      let chainVisible = true;
      while (cur && cur !== this.scene) {
        if (cur.visible === false) { chainVisible = false; break; }
        cur = cur.parent;
      }
      if (!chainVisible) return;

      const box = new THREE.Box3().setFromObject(mod);
      if (box.isEmpty()) return;

      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
      ];

      let anyInFront = false;
      let minModX = Infinity, maxModX = -Infinity;
      let minModY = Infinity, maxModY = -Infinity;

      for (const corner of corners) {
        tempScreen.copy(corner).project(this.camera);
        if (tempScreen.z > -1 && tempScreen.z < 1) {
          anyInFront = true;
          const sx = ((tempScreen.x + 1) / 2) * rect.width + rect.left;
          const sy = ((-tempScreen.y + 1) / 2) * rect.height + rect.top;
          minModX = Math.min(minModX, sx);
          maxModX = Math.max(maxModX, sx);
          minModY = Math.min(minModY, sy);
          maxModY = Math.max(maxModY, sy);
        }
      }

      if (!anyInFront) return;

      const intersects = !(maxModX < minX || minModX > maxX || maxModY < minY || minModY > maxY);
      if (intersects) {
        hits.push(mod);
      }
    });

    return hits;
  }

  selectModulesGroup(modules) {
    this.deselect(false);
    this.clearFilterHighlights();

    if (!modules || modules.length === 0) return;

    if (modules.length === 1) {
      const targetModule = modules[0];
      targetModule.userData.selectedViaMiddleMouse = true;
      const index = targetModule.userData.index;
      this.selectedModules = [targetModule];
      this.selectedModuleIndices = [index];
      this.selectModuleByIndex(index, false, true);
      if (this.onModuleSelected) {
        this.onModuleSelected(index);
      }
      return;
    }

    // Multiple modules selected!
    modules.forEach(m => { m.userData.selectedViaMiddleMouse = true; });
    this.selectedModules = [...modules];
    this.selectedModuleIndices = modules.map(m => m.userData.index);
    this.selectedModuleIndex = modules[0].userData.index;

    // Highlight each module in the selection box with a BoxHelper
    this.multiSelectionHelpers = [];
    modules.forEach(mod => {
      const helper = new THREE.BoxHelper(mod, 0xFFFF00);
      helper.name = `multi_selection_helper_${mod.userData.index}`;
      helper.material = new THREE.LineBasicMaterial({
        color: 0xFFFF00,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        linewidth: 2
      });
      this.scene.add(helper);
      this.multiSelectionHelpers.push(helper);
    });

    // Compute collective bounding box and center
    const collectiveBox = new THREE.Box3();
    modules.forEach(m => collectiveBox.union(new THREE.Box3().setFromObject(m)));
    const collectiveCenter = collectiveBox.getCenter(new THREE.Vector3());

    // Setup multiSelectPivot at collective center
    if (!this.multiSelectPivot) {
      this.multiSelectPivot = new THREE.Group();
      this.multiSelectPivot.name = 'multi_select_pivot';
      this.scene.add(this.multiSelectPivot);
    }
    this.multiSelectPivot.position.copy(collectiveCenter);
    this.multiSelectPivot.userData = {
      isMultiSelectPivot: true,
      dragStartPos: collectiveCenter.clone()
    };
    this.pivotDragStart = collectiveCenter.clone();

    // Record each module's start position
    modules.forEach(m => {
      m.userData.multiDragStartPos = m.position.clone();
    });

    // Attach transform gizmo to multiSelectPivot
    this.attachGizmoToModule(this.multiSelectPivot);

    if (this.onMultiModulesSelected) {
      this.onMultiModulesSelected(this.selectedModuleIndices);
    } else if (this.onModuleSelected) {
      this.onModuleSelected(this.selectedModuleIndex);
    }
  }

  isPointerOverCenterDiamond(event) {
    if (!this.transformControls || !this.transformControls.object || !this.transformControls.visible) return false;
    const targets = [];
    const pickerXYZ = this.transformControls._gizmo?.picker?.['translate']?.['XYZ'];
    const gizmoXYZ = this.transformControls._gizmo?.gizmo?.['translate']?.['XYZ'];
    if (pickerXYZ) targets.push(...pickerXYZ);
    if (gizmoXYZ) targets.push(...gizmoXYZ);
    if (targets.length === 0) return false;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: mX, y: mY }, this.camera);
    const hits = ray.intersectObjects(targets, true);
    return hits.length > 0;
  }

  showCenterModulesModal() {
    let targetModules = [];
    if (this.selectedModules && this.selectedModules.length > 0) {
      targetModules = this.selectedModules;
    } else if (this.selectedModuleIndex !== null) {
      const mod = this.modulesGroup.children.find(m => m.userData?.index === this.selectedModuleIndex);
      if (mod) targetModules = [mod];
    }

    if (targetModules.length === 0) return;

    const modBox = new THREE.Box3();
    targetModules.forEach(m => modBox.union(new THREE.Box3().setFromObject(m)));
    const curCenter = modBox.getCenter(new THREE.Vector3());

    const plotBb = getPlotBoundingBox(this.currentPlotConfig);
    const targetCenter = new THREE.Vector3(plotBb.centerX, plotBb.centerY, plotBb.centerZ);

    const delta = new THREE.Vector3().subVectors(targetCenter, curCenter);
    delta.x = Math.round(delta.x);
    delta.y = Math.round(delta.y);
    delta.z = Math.round(delta.z);

    const modal = document.getElementById('center-modules-modal');
    const modCountEl = document.getElementById('center-modal-mod-count');
    const curCenterEl = document.getElementById('center-modal-cur-center');
    const targetCenterEl = document.getElementById('center-modal-target-center');
    const descEl = document.getElementById('center-modal-desc');

    if (modCountEl) modCountEl.textContent = `${targetModules.length} module${targetModules.length > 1 ? 's' : ''}`;
    if (curCenterEl) curCenterEl.textContent = `X: ${Math.round(curCenter.x)}m, Y: ${Math.round(curCenter.y)}m, Z: ${Math.round(-curCenter.z)}m`;
    if (targetCenterEl) targetCenterEl.textContent = `X: ${Math.round(targetCenter.x)}m, Y: ${Math.round(targetCenter.y)}m, Z: ${Math.round(-targetCenter.z)}m`;
    if (descEl) {
      descEl.textContent = targetModules.length > 1
        ? `Center all ${targetModules.length} selected modules within the Plot Bounding Box? (Offset: ΔX ${delta.x}m, ΔY ${delta.y}m, ΔZ ${-delta.z}m)`
        : `Center selected module within the Plot Bounding Box? (Offset: ΔX ${delta.x}m, ΔY ${delta.y}m, ΔZ ${-delta.z}m)`;
    }

    this.pendingCenterAction = () => {
      this.centerModulesToPlotBB(targetModules, delta);
    };

    const fefbWrap = document.getElementById('center-modal-fefb-wrap');
    if (fefbWrap) {
      if (targetModules.length === 1) {
        fefbWrap.style.display = 'block';
        this.pendingSingleModule = targetModules[0];
      } else {
        fefbWrap.style.display = 'none';
        this.pendingSingleModule = null;
      }
    }

    if (modal) {
      modal.classList.add('active');
    }
  }

  executePendingCenterAction() {
    if (typeof this.pendingCenterAction === 'function') {
      this.pendingCenterAction();
      this.pendingCenterAction = null;
    }
  }

  centerModulesToPlotBB(targetModules, delta) {
    if (!targetModules || targetModules.length === 0) return;

    const moves = [];

    targetModules.forEach(mod => {
      const modIndex = mod.userData.index;
      const fromPos = {
        x: Math.round(mod.position.x),
        y: Math.round(mod.position.y),
        z: Math.round(-mod.position.z)
      };

      mod.position.add(delta);
      mod.position.x = Math.round(mod.position.x);
      mod.position.y = Math.round(mod.position.y);
      mod.position.z = Math.round(mod.position.z);
      mod.updateMatrixWorld(true);

      const toPos = {
        x: Math.round(mod.position.x),
        y: Math.round(mod.position.y),
        z: Math.round(-mod.position.z)
      };

      const planMod = this.currentPlan?.modules?.find(m => m.index === modIndex);
      if (planMod) {
        planMod.position = { ...toPos };
      }

      if (this.onModuleMoved) {
        this.onModuleMoved(modIndex, toPos, true);
      }

      moves.push({
        moduleIndex: modIndex,
        macro: mod.userData.macro,
        from: fromPos,
        to: toPos
      });

      if (mod.userData.multiDragStartPos) {
        mod.userData.multiDragStartPos = mod.position.clone();
      }
    });

    if (moves.length > 0 && this.onMoveCommitted) {
      if (moves.length === 1) {
        this.onMoveCommitted({
          type: 'move',
          operation: 'diamond_center',
          ...moves[0],
          delta: {
            dx: moves[0].to.x - moves[0].from.x,
            dy: moves[0].to.y - moves[0].from.y,
            dz: moves[0].to.z - moves[0].from.z
          },
          timestamp: Date.now()
        });
      } else {
        this.onMoveCommitted({
          type: 'group_move',
          operation: 'diamond_center',
          moves: moves,
          timestamp: Date.now()
        });
      }
    }
    this.restoreFullPlanGrid();

    if (this.multiSelectPivot) {
      this.multiSelectPivot.position.add(delta);
      if (this.multiSelectPivot.userData) {
        this.multiSelectPivot.userData.dragStartPos = this.multiSelectPivot.position.clone();
      }
      this.pivotDragStart = this.multiSelectPivot.position.clone();
    }

    if (this.selectionHelper) {
      this.selectionHelper.update();
    }
    if (this.multiSelectionHelpers) {
      this.multiSelectionHelpers.forEach(h => h.update());
    }
    if (this.dimensionOverlayGroup && this.selectedModuleIndex !== null) {
      const selectedModule = this.modulesGroup.children.find(child => child.userData.index === this.selectedModuleIndex);
      if (selectedModule) {
        this.buildDimensionOverlay(selectedModule);
      }
    }

    this.updatePlotBoxViolations();
    this.renderScene();
  }

  /**
   * Returns whether Left-Shift is currently depressed.
   */
  isLeftShiftActive(event = null) {
    if (this.isLeftShiftDown) return true;
    if (event && event.code === 'ShiftLeft') return true;
    if (event && event.shiftKey && !this.isRightShiftDown) return true;
    return !!(this.isShiftDown && !this.isRightShiftDown);
  }

  /**
   * Determine which of the six directional axes (+X, -X, +Y, -Y, +Z, -Z)
   * was clicked/selected on the translation gizmo.
   */
  getGizmoSelectedDirection(event = null) {
    if (!this.transformControls || !this.transformControls.object) return null;
    const axis = this.transformControls.axis;
    if (axis !== 'X' && axis !== 'Y' && axis !== 'Z') return null;

    if (event && this.renderer && this.renderer.domElement) {
      const pickerMeshes = this.transformControls._gizmo?.picker?.['translate']?.[axis] || [];
      const gizmoMeshes = this.transformControls._gizmo?.gizmo?.['translate']?.[axis] || [];
      const targets = [...pickerMeshes, ...gizmoMeshes];

      if (targets.length > 0) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        const ray = new THREE.Raycaster();
        ray.setFromCamera({ x: mX, y: mY }, this.camera);
        const hits = ray.intersectObjects(targets, true);
        if (hits.length > 0) {
          const hitObj = hits[0].object;
          if (hitObj === pickerMeshes[0] || hitObj === gizmoMeshes[0]) {
            return `+${axis}`;
          }
          if (hitObj === pickerMeshes[1] || hitObj === gizmoMeshes[1]) {
            return `-${axis}`;
          }
          const gizmoPos = new THREE.Vector3();
          this.transformControls.object.getWorldPosition(gizmoPos);
          if (axis === 'X') {
            return hits[0].point.x >= gizmoPos.x ? '+X' : '-X';
          } else if (axis === 'Y') {
            return hits[0].point.y >= gizmoPos.y ? '+Y' : '-Y';
          } else if (axis === 'Z') {
            return hits[0].point.z >= gizmoPos.z ? '+Z' : '-Z';
          }
        }
      }
    }

    return `+${axis}`;
  }

  /**
   * Determine movement direction (+axis or -axis) from a translation delta vector.
   */
  getDragDirectionFromDelta(axis, delta) {
    if (!delta) return null;
    const EPS = 0.001;
    if (axis === 'X') {
      if (Math.abs(delta.x) > EPS) return delta.x > 0 ? '+X' : '-X';
    } else if (axis === 'Y') {
      if (Math.abs(delta.y) > EPS) return delta.y > 0 ? '+Y' : '-Y';
    } else if (axis === 'Z') {
      if (Math.abs(delta.z) > EPS) return delta.z > 0 ? '+Z' : '-Z';
    }
    return null;
  }

  /**
   * Move selected module(s) as close as possible to the plot BB without violating
   * in the specified direction (+X, -X, +Y, -Y, +Z, -Z).
   */
  moveModulesFlushToPlotBBAxis(direction, commitUndo = false) {
    if (!direction) return null;

    let targetModules = [];
    if (this.selectedModules && this.selectedModules.length > 0) {
      targetModules = this.selectedModules;
    } else if (this.transformControls?.object && this.transformControls.object !== this.multiSelectPivot) {
      targetModules = [this.transformControls.object];
    } else if (this.selectedModuleIndex !== null) {
      const mod = this.modulesGroup?.children?.find(m => m.userData?.index === this.selectedModuleIndex);
      if (mod) targetModules = [mod];
    }

    if (targetModules.length === 0) return null;

    // Use dragStartCollectiveBox if available, otherwise compute current bounds
    let baseBox = this.dragStartCollectiveBox;
    if (!baseBox || baseBox.isEmpty()) {
      baseBox = new THREE.Box3();
      targetModules.forEach(mod => {
        const b = this.getModuleWorldBoundingBox(mod);
        if (b && !b.isEmpty()) {
          baseBox.union(b);
        } else {
          baseBox.union(new THREE.Box3().setFromObject(mod));
        }
      });
      this.dragStartCollectiveBox = baseBox.clone();
    }

    if (baseBox.isEmpty()) return null;

    const plotBb = getPlotBoundingBox(this.currentPlotConfig);
    const totalOffset = new THREE.Vector3(0, 0, 0);

    if (direction === '+X') {
      totalOffset.x = Math.round(plotBb.maxX - baseBox.max.x);
    } else if (direction === '-X') {
      totalOffset.x = Math.round(plotBb.minX - baseBox.min.x);
    } else if (direction === '+Y') {
      totalOffset.y = Math.round(plotBb.maxY - baseBox.max.y);
    } else if (direction === '-Y') {
      totalOffset.y = Math.round(plotBb.minY - baseBox.min.y);
    } else if (direction === '+Z') {
      totalOffset.z = Math.round(plotBb.maxZ - baseBox.max.z);
    } else if (direction === '-Z') {
      totalOffset.z = Math.round(plotBb.minZ - baseBox.min.z);
    }

    // Apply offset relative to each module's start position
    const moves = [];
    targetModules.forEach(mod => {
      const modIndex = mod.userData.index;
      const startPos = mod.userData.multiDragStartPos || mod.position.clone();
      const fromPos = {
        x: Math.round(startPos.x),
        y: Math.round(startPos.y),
        z: Math.round(-startPos.z)
      };

      const newPos = startPos.clone().add(totalOffset);
      newPos.x = Math.round(newPos.x);
      newPos.y = Math.round(newPos.y);
      newPos.z = Math.round(newPos.z);

      mod.position.copy(newPos);
      mod.updateMatrixWorld(true);

      const toPos = {
        x: Math.round(mod.position.x),
        y: Math.round(mod.position.y),
        z: Math.round(-mod.position.z)
      };

      const planMod = this.currentPlan?.modules?.find(m => m.index === modIndex);
      if (planMod) {
        planMod.position = { ...toPos };
      }

      if (this.onModuleMoved) {
        this.onModuleMoved(modIndex, toPos, true);
      }

      moves.push({
        moduleIndex: modIndex,
        macro: mod.userData.macro,
        from: fromPos,
        to: toPos
      });
    });

    if (this.multiSelectPivot) {
      const startPivot = this.multiSelectPivot.userData?.dragStartPos || this.pivotDragStart || this.multiSelectPivot.position.clone();
      this.multiSelectPivot.position.copy(startPivot).add(totalOffset);
      this.multiSelectPivot.position.x = Math.round(this.multiSelectPivot.position.x);
      this.multiSelectPivot.position.y = Math.round(this.multiSelectPivot.position.y);
      this.multiSelectPivot.position.z = Math.round(this.multiSelectPivot.position.z);
    }

    if (this.selectionHelper) {
      this.selectionHelper.update();
    }
    if (this.multiSelectionHelpers) {
      this.multiSelectionHelpers.forEach(h => h.update());
    }
    if (this.dimensionOverlayGroup && this.selectedModuleIndex !== null) {
      const selMod = this.modulesGroup?.children?.find(child => child.userData?.index === this.selectedModuleIndex);
      if (selMod) {
        this.buildDimensionOverlay(selMod);
      }
    }

    this.updatePlotBoxViolations();

    if (commitUndo && moves.length > 0 && this.onMoveCommitted) {
      if (moves.length === 1) {
        this.onMoveCommitted({
          type: 'move',
          ...moves[0],
          delta: {
            dx: moves[0].to.x - moves[0].from.x,
            dy: moves[0].to.y - moves[0].from.y,
            dz: moves[0].to.z - moves[0].from.z
          },
          timestamp: Date.now()
        });
      } else {
        this.onMoveCommitted({
          type: 'group_move',
          moves: moves,
          timestamp: Date.now()
        });
      }
    }

    return totalOffset;
  }

  showFloatingPlotSize(totalX, totalY, totalZ, clientX = null, clientY = null) {
    let hud = document.getElementById('floating-plot-size-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'floating-plot-size-hud';
      hud.className = 'floating-plot-size-hud';
      document.body.appendChild(hud);
    }

    if (this.floatingHudTimeout) {
      clearTimeout(this.floatingHudTimeout);
      this.floatingHudTimeout = null;
    }

    hud.textContent = `X: ${totalX}, Y: ${totalY}, Z: ${totalZ}`;
    hud.style.display = 'block';
    hud.classList.remove('hidden');

    if (clientX !== null && clientY !== null) {
      const pad = 20;
      const x = Math.min(window.innerWidth - 180, Math.max(pad, clientX + 16));
      const y = Math.max(pad, clientY - 38);
      hud.style.left = `${x}px`;
      hud.style.top = `${y}px`;
      hud.style.transform = 'none';
    } else {
      hud.style.left = '50%';
      hud.style.top = '70px';
      hud.style.transform = 'translateX(-50%)';
    }
  }

  hideFloatingPlotSize() {
    const hud = document.getElementById('floating-plot-size-hud');
    if (hud) {
      hud.classList.add('hidden');
      setTimeout(() => {
        if (hud.classList.contains('hidden')) {
          hud.style.display = 'none';
        }
      }, 250);
    }
  }

  updateAnimatedParts(time, delta = 0.016) {
    if (!this.animatedParts || this.animatedParts.length === 0) return;
    for (const part of this.animatedParts) {
      if (part.object && part.update) {
        let modIdx = part.moduleIndex;
        if (modIdx === undefined && part.object) {
          let curr = part.object;
          while (curr && modIdx === undefined) {
            if (curr.userData && (curr.userData.moduleIndex !== undefined || curr.userData.index !== undefined)) {
              modIdx = curr.userData.moduleIndex !== undefined ? curr.userData.moduleIndex : curr.userData.index;
              break;
            }
            curr = curr.parent;
          }
        }
        if (modIdx !== undefined && this.haltedModuleAnimations && this.haltedModuleAnimations.has(modIdx)) {
          continue;
        }
        if (part.object && part.object.userData && part.object.userData.manualBillboardState) {
          continue;
        }
        part.update(time, delta);
      }
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Animate UV texture offsets (e.g. water flow in wheat module)
    if (this.animatedTextures && this.animatedTextures.length > 0) {
      for (const item of this.animatedTextures) {
        if (item.texture) {
          if (item.moduleIndex !== undefined && this.haltedModuleAnimations && this.haltedModuleAnimations.has(item.moduleIndex)) {
            continue;
          }
          item.texture.offset.x = (item.texture.offset.x + (item.speedX || 0) * delta) % 1.0;
          if (item.speedY) {
            item.texture.offset.y = (item.texture.offset.y + item.speedY * delta) % 1.0;
          }
        }
      }
    }

    // 2. Animate mechanical module parts (crane traversing over crop beds, vents, etc.)
    this.updateAnimatedParts(time, delta);

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


    // 3. Dynamically scale snap point red dots with zoom / camera distance
    if (this.showSnapPoints && this.snapDots.length > 0) {
      const camPos = this.camera.position;
      const tempVec = new THREE.Vector3();
      for (let i = 0; i < this.snapDots.length; i++) {
        const dot = this.snapDots[i];
        if (dot.parent && dot.parent.visible && dot.parent.parent && dot.parent.parent.visible) {
          dot.getWorldPosition(tempVec);
          const dist = camPos.distanceTo(tempVec);
          const scale = Math.max(2.5, dist * 0.0075);
          dot.scale.set(scale, scale, scale);
        }
      }
    }

    // 3.1 Dynamically scale plot corner red dots with zoom / camera distance
    if (this.plotCornerHandles && this.plotCornerHandles.length > 0) {
      const camPos = this.camera.position;
      const tempVec = new THREE.Vector3();
      for (let i = 0; i < this.plotCornerHandles.length; i++) {
        const dot = this.plotCornerHandles[i];
        if (dot.parent && dot.parent.visible) {
          dot.getWorldPosition(tempVec);
          const dist = camPos.distanceTo(tempVec);
          const scale = Math.max(100, dist * 0.016);
          dot.scale.set(scale, scale, scale);
        }
      }
    }

    // 4. Update highlight helpers
    if (this.highlightHelpers) {
      this.highlightHelpers.forEach(helper => helper.update());
    }

    // 5. Update controls (Orbit damping, auto-rotation)
    this.controls.update();

    if (this.isGizmoAttached() && this._isZooming) {
      this.ensureActiveGizmoVisible({ isZooming: true });
    }

    // 6. Render Scene (with smooth bloom blur on FX glowing lights)
    this.renderScene();
  }

  setGhostMode(enabled) {
    this.ghostMode = !!enabled;
    this.modulesGroup.traverse(child => {
      if (child.isMesh && child.material && !isTextureOrEffectMesh(child)) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          mat.transparent = this.ghostMode;
          mat.opacity = this.ghostMode ? 0.35 : 1.0;
          mat.depthWrite = !this.ghostMode;
        });
      }
    });
  }

  applyDisplayPlacementBehavior(valueId, behaviorKey, behaviorValue, activeEntries = null) {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return;

    console.log(`[StationViewer] Applying display & placement behavior: ${valueId} -> ${behaviorValue} (${behaviorKey})`);

    const key = (behaviorKey || '').toLowerCase();
    const val = (behaviorValue || '').toLowerCase();

    switch (valueId) {
      case 'order-of-layout':
        this.applyOrderOfLayoutBehavior(key, val, activeEntries);
        break;
      case 'layout-mode':
        this.applyLayoutBehavior(key, val, activeEntries);
        break;
      case 'layers':
        this.applyLayersBehavior(key, val, activeEntries);
        break;
      case 'spacing-offset':
        this.applySpacingBehavior(key, val);
        break;
      case 'alignment-anchor':
        this.applyAlignmentBehavior(key, val, activeEntries);
        break;
      case 'display-shading':
        this.applyShadingBehavior(key, val);
        break;
      case 'module-scope':
        this.applyScopeBehavior(key, val);
        break;
      default:
        this.applyCustomDisplayBehavior(valueId, key, val);
        break;
    }
  }

  applyOrderOfLayoutBehavior(key, name, activeEntries = null) {
    if (key.includes('blueprint') || name.includes('blueprint')) {
      this.applyLayoutBehavior('blueprint', 'Blueprint', activeEntries);
      return;
    }
    if (this.lastLayoutArgs && !this.lastLayoutArgs.key.includes('blueprint')) {
      this.applyLayoutBehavior(this.lastLayoutArgs.key, this.lastLayoutArgs.name, this.lastLayoutArgs.activeEntries);
    } else {
      this.applyLayoutBehavior('clusters', 'Category Clusters');
    }
  }

  applyLayoutBehavior(key, name, activeEntries = null) {
    const modules = this.modulesGroup.children;
    if (modules.length === 0) return;

    this.lastLayoutArgs = { key, name, activeEntries };

    // Normalize keys from activeEntries array or composite key
    let keys = [];
    if (Array.isArray(activeEntries) && activeEntries.length > 0) {
      keys = activeEntries.map(e => (e.behaviorKey || e.id || e.name || '').toLowerCase());
    } else {
      keys = (key || '').toLowerCase().split('+').map(k => k.trim());
    }

    const hasBlueprint = keys.some(k => k.includes('blueprint') || k.includes('default'));
    const hasClusters = keys.some(k => k.includes('cluster'));
    const hasPlanar = keys.some(k => k.includes('planar') || k.includes('row'));
    const hasGrid = keys.some(k => k.includes('grid') || k.includes('matrix'));
    const hasHeight = keys.some(k => k.includes('height') || k.includes('cascade'));

    const plotConfig = this.currentPlotConfig || getCurrentPlotConfig();
    const layerOrder = getLayerPlacementCategoryOrder();

    // If only blueprint is checked (or no multi-layout active): perform NO placement logic
    if (hasBlueprint && !hasClusters && !hasPlanar && !hasGrid && !hasHeight) {
      this.lastLayoutArgs = null;
      this.activeAlignmentBehavior = null;
      modules.forEach(mod => {
        if (mod.userData && mod.userData.originalPosition) {
          mod.position.copy(mod.userData.originalPosition);
        }
        if (mod.userData && mod.userData.originalRotation) {
          mod.rotation.copy(computeModuleGroupRotation(
            mod.userData.originalRotation.yaw,
            mod.userData.originalRotation.pitch,
            mod.userData.originalRotation.roll
          ));
        }
      });
      // Perform NO placement logic when Blueprint is checked
      return;
    }

    // 1. If Category Clusters is selected (either alone or combined with planar, grid, height, blueprint):
    if (hasClusters) {
      const categories = {};
      modules.forEach(mod => {
        const cat = getModuleCategory(mod.userData.macro) || 'structure';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(mod);
      });

      // Select which category of modules to place first using the order of Layout, Layers!
      const catKeys = [];
      layerOrder.forEach(cat => {
        if (categories[cat] && categories[cat].length > 0) {
          catKeys.push(cat);
        }
      });
      Object.keys(categories).forEach(cat => {
        if (!catKeys.includes(cat) && categories[cat].length > 0) {
          catKeys.push(cat);
        }
      });
      const catCount = catKeys.length;

      // Compute footprint radius for each category cluster using initial bounding box sizes
      const clusterRadii = {};
      let maxClusterRadius = 250;
      catKeys.forEach(cat => {
        const catMods = categories[cat];
        let totalFootprint = 0;
        catMods.forEach(m => {
          const s = this.getModuleInitialSize(m);
          totalFootprint += Math.max(s.x, s.z);
        });
        const r = Math.max(200, (totalFootprint / Math.PI) * 0.7);
        clusterRadii[cat] = r;
        if (r > maxClusterRadius) maxClusterRadius = r;
      });

      // Scale overall orbit radius so clusters stay strictly inside the current plot bounds
      const bb = getPlotBoundingBox(plotConfig);
      const minX = bb.minX;
      const maxX = bb.maxX;
      const minZ = bb.minZ;
      const maxZ = bb.maxZ;
      const maxHalfSpanX = Math.max(300, (maxX - minX) / 2 - maxClusterRadius);
      const maxHalfSpanZ = Math.max(300, (maxZ - minZ) / 2 - maxClusterRadius);
      const maxAllowedOrbit = Math.min(maxHalfSpanX, maxHalfSpanZ);
      const overallOrbitRadius = Math.min(maxAllowedOrbit, Math.max(300, maxClusterRadius * 2.0));

      const centerX = bb.centerX;
      const centerY = bb.centerY;
      const centerZ = bb.centerZ;

      catKeys.forEach((cat, catIdx) => {
        // Place each cluster in order of Layout, Layers
        const angle = (catIdx / catCount) * Math.PI * 2;
        const cx = centerX + Math.cos(angle) * overallOrbitRadius;
        const cz = centerZ + Math.sin(angle) * overallOrbitRadius;
        const catMods = categories[cat];

        if (hasPlanar) {
          // Sub-layout: arrange modules within each category cluster along a planar row
          let curX = 0;
          const gap = 40;
          catMods.forEach((mod, i) => {
            const s = this.getModuleInitialSize(mod);
            if (i > 0) curX += s.x / 2;
            let yPos = 0;
            if (hasHeight) yPos = i * (s.y * 0.25);
            mod.position.set(cx + curX, centerY + yPos, cz);
            curX += s.x / 2 + gap;
          });
          const totalSpan = curX - gap;
          catMods.forEach(mod => { mod.position.x -= totalSpan / 2; });
        } else if (hasGrid) {
          // Sub-layout: arrange modules within each category cluster in a 2D grid
          const n = catMods.length;
          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          const gap = 40;
          const colWidths = new Array(cols).fill(0);
          const rowDepths = new Array(rows).fill(0);

          catMods.forEach((mod, idx) => {
            const s = this.getModuleInitialSize(mod);
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            if (s.x > colWidths[c]) colWidths[c] = s.x;
            if (s.z > rowDepths[r]) rowDepths[r] = s.z;
          });

          const colPos1 = new Array(cols).fill(0);
          const rowPos2 = new Array(rows).fill(0);
          let curC = 0, curR = 0;
          for (let c = 0; c < cols; c++) {
            if (c === 0) colPos1[c] = colWidths[c] / 2;
            else colPos1[c] = curC + gap + colWidths[c] / 2;
            curC = colPos1[c] + colWidths[c] / 2;
          }
          for (let r = 0; r < rows; r++) {
            if (r === 0) rowPos2[r] = rowDepths[r] / 2;
            else rowPos2[r] = curR + gap + rowDepths[r] / 2;
            curR = rowPos2[r] + rowDepths[r] / 2;
          }

          catMods.forEach((mod, idx) => {
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            let yPos = 0;
            if (hasHeight) yPos = (c + r) * 30;
            mod.position.set(cx + colPos1[c] - curC / 2, centerY + yPos, cz + rowPos2[r] - curR / 2);
          });
        } else if (hasHeight) {
          // Sub-layout: arrange modules vertically in height cascade within each cluster
          let curY = 0;
          const gap = 30;
          catMods.forEach((mod, i) => {
            const s = this.getModuleInitialSize(mod);
            if (i > 0) curY += s.y / 2;
            mod.position.set(cx, centerY + curY, cz);
            curY += s.y / 2 + gap;
          });
          const totalH = curY - gap;
          catMods.forEach(mod => { mod.position.y -= totalH / 2; });
        } else if (hasBlueprint) {
          const center = new THREE.Vector3();
          catMods.forEach(m => {
            if (m.userData && m.userData.originalPosition) center.add(m.userData.originalPosition);
          });
          center.divideScalar(catMods.length || 1);
          catMods.forEach(mod => {
            if (mod.userData && mod.userData.originalPosition) {
              const rel = new THREE.Vector3().subVectors(mod.userData.originalPosition, center);
              mod.position.set(cx + rel.x, centerY + rel.y, cz + rel.z);
            } else {
              mod.position.set(cx, centerY, cz);
            }
          });
        } else {
          // Default orbital layout within cluster
          catMods.forEach((mod, modIdx) => {
            const s = this.getModuleInitialSize(mod);
            const modFootprint = Math.max(s.x, s.z);
            const subAngle = (modIdx / catMods.length) * Math.PI * 2;
            const subRad = 80 + Math.floor(modIdx / 4) * (modFootprint + 50);
            const yOffset = (modIdx % 3) * (s.y * 0.3);
            mod.position.set(cx + Math.cos(subAngle) * subRad, centerY + yOffset, cz + Math.sin(subAngle) * subRad);
          });
        }

        // Clamp each module in this category cluster to ensure it is not outside current plot size
        catMods.forEach(mod => {
          const s = this.getModuleInitialSize(mod);
          clampModulePositionToPlot(mod.position, s, plotConfig);
        });
      });

      ensureNoBoundingBoxOverlaps(modules, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
      return;
    }

    // 2. If Grid Matrix is selected (with or without Height Cascade):
    if (hasGrid) {
      // Sort modules by the order of Layout, Layers
      const sortedModules = sortModulesByLayerCategoryOrder(modules, layerOrder);
      const n = sortedModules.length;
      const initialSizes = sortedModules.map(m => this.getModuleInitialSize(m));
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const gap = 50;
      const bb = getPlotBoundingBox(plotConfig);

      const colWidths = new Array(cols).fill(0);
      const rowDepths = new Array(rows).fill(0);

      sortedModules.forEach((mod, idx) => {
        const s = initialSizes[idx];
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        if (s.x > colWidths[c]) colWidths[c] = s.x;
        if (s.z > rowDepths[r]) rowDepths[r] = s.z;
      });

      const colPos1 = new Array(cols).fill(0);
      const rowPos2 = new Array(rows).fill(0);

      let cur1 = 0;
      for (let c = 0; c < cols; c++) {
        if (c === 0) {
          colPos1[c] = colWidths[c] / 2;
          cur1 = colWidths[c];
        } else {
          colPos1[c] = cur1 + gap + colWidths[c] / 2;
          cur1 += gap + colWidths[c];
        }
      }
      const totalSpan1 = cur1;

      let cur2 = 0;
      for (let r = 0; r < rows; r++) {
        if (r === 0) {
          rowPos2[r] = rowDepths[r] / 2;
          cur2 = rowDepths[r];
        } else {
          rowPos2[r] = cur2 + gap + rowDepths[r] / 2;
          cur2 += gap + rowDepths[r];
        }
      }
      const totalSpan2 = cur2;

      sortedModules.forEach((mod, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const p1 = bb.centerX + (colPos1[c] - totalSpan1 / 2);
        const p2 = bb.centerZ + (rowPos2[r] - totalSpan2 / 2);
        let yPos = bb.centerY;
        if (hasHeight) {
          yPos = bb.centerY + (c + r) * 45;
        }
        mod.position.set(p1, yPos, p2);
        clampModulePositionToPlot(mod.position, initialSizes[idx], plotConfig);
      });

      ensureNoBoundingBoxOverlaps(modules, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
      return;
    }

    // 3. If Planar Row is selected (with or without Height Cascade):
    if (hasPlanar) {
      // Sort modules by the order of Layout, Layers
      const sortedModules = sortModulesByLayerCategoryOrder(modules, layerOrder);
      const initialSizes = sortedModules.map(m => this.getModuleInitialSize(m));
      const gap = 50;
      const bb = getPlotBoundingBox(plotConfig);

      let currentOffset = 0;
      sortedModules.forEach((mod, i) => {
        const s = initialSizes[i];
        if (i > 0) currentOffset += s.x / 2;
        let yPos = 0;
        if (hasHeight) {
          yPos = i * (s.y * 0.3);
        }
        mod.position.set(currentOffset, bb.centerY + yPos, bb.centerZ);
        currentOffset += s.x / 2 + gap;
      });

      const totalSpan = currentOffset - gap;
      sortedModules.forEach((mod, i) => {
        mod.position.x = bb.centerX + (mod.position.x - totalSpan / 2);
        clampModulePositionToPlot(mod.position, initialSizes[i], plotConfig);
      });

      ensureNoBoundingBoxOverlaps(modules, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
      return;
    }

    // 4. If Height Cascade alone is selected:
    if (hasHeight) {
      // Sort modules by the order of Layout, Layers
      const sortedModules = sortModulesByLayerCategoryOrder(modules, layerOrder);
      const initialSizes = sortedModules.map(m => this.getModuleInitialSize(m));
      const gap = 40;
      const bb = getPlotBoundingBox(plotConfig);

      let currentY = 0;
      sortedModules.forEach((mod, i) => {
        const h = initialSizes[i].y;
        if (i > 0) currentY += h / 2;
        mod.position.set(bb.centerX, currentY, bb.centerZ);
        currentY += h / 2 + gap;
      });

      const totalH = currentY - gap;
      sortedModules.forEach((mod, i) => {
        mod.position.y = bb.centerY + (mod.position.y - totalH / 2);
        clampModulePositionToPlot(mod.position, initialSizes[i], plotConfig);
      });

      ensureNoBoundingBoxOverlaps(modules, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
      return;
    }
  }

  applySpacingBehavior(key, name) {
    if (isBlueprintModeActive()) return;
    const modules = this.modulesGroup.children;
    if (modules.length === 0) return;

    // Calculate station center of mass
    const center = new THREE.Vector3();
    modules.forEach(m => center.add(m.position));
    center.divideScalar(modules.length);

    let factor = 1.0;
    let pad = 0;

    if (key.includes('25') || name.includes('25')) pad = 25;
    else if (key.includes('50') || name.includes('50')) pad = 50;
    else if (key.includes('100') || name.includes('100')) pad = 100;
    else if (key.includes('2x') || name.includes('2.0') || name.includes('scale')) factor = 2.0;

    modules.forEach(mod => {
      const orig = mod.userData.originalPosition || mod.position;
      const offset = new THREE.Vector3().subVectors(orig, center);
      const dist = offset.length();
      if (dist > 0.001) {
        offset.normalize();
        const initialSize = this.getModuleInitialSize(mod);
        const dimensionPadding = pad * (1 + (initialSize.length() / 500) * 0.15);
        mod.position.copy(center).addScaledVector(offset, dist * factor + dimensionPadding);
      }
    });
  }

  applyAlignmentBehavior(key, name, activeEntries = null) {
    if (isBlueprintModeActive()) return;
    const modules = this.modulesGroup.children;
    if (modules.length === 0) return;

    this.activeAlignmentBehavior = { key, name, activeEntries };
    const plotConfig = this.currentPlotConfig || getCurrentPlotConfig();
    const layerOrder = getLayerPlacementCategoryOrder();

    // Use multiple selections to define start of placement,
    // place components one at a time honoring bounding box,
    // and once a layer fills, start a new layer and continue placing
    calculateLayeredPlacement(modules, activeEntries || key, plotConfig, layerOrder, {
      getModuleSize: (mod) => this.getModuleInitialSize(mod),
      applyToObjects: true
    });
  }

  applyShadingBehavior(key, name) {
    if (key.includes('solid') || name.includes('solid')) {
      this.toggleWireframe(false);
      this.setGhostMode(false);
    } else if (key.includes('color') || name.includes('color')) {
      this.setColorized(true);
      this.toggleWireframe(false);
      this.setGhostMode(false);
    } else if (key.includes('wire') || name.includes('wire')) {
      this.toggleWireframe(true);
    } else if (key.includes('dims') || name.includes('dimension')) {
      this.setShowDimensions(true);
    } else if (key.includes('ghost') || name.includes('x-ray')) {
      this.setGhostMode(true);
    }
  }

  applyScopeBehavior(key, name) {
    const modules = this.modulesGroup.children;
    modules.forEach(mod => {
      const macro = mod.userData.macro || '';
      const cat = getModuleCategory(macro);

      if (key.includes('all') || name.includes('all')) {
        mod.visible = true;
      } else if (key.includes('prod') || name.includes('production')) {
        mod.visible = cat === 'production';
      } else if (key.includes('dock') || name.includes('pier')) {
        mod.visible = cat === 'dock' || cat === 'pier';
      } else if (key.includes('defense') || name.includes('defence')) {
        mod.visible = cat === 'defence';
      } else if (key.includes('hab') || key.includes('store') || name.includes('habitat') || name.includes('storage')) {
        mod.visible = cat === 'habitation' || cat === 'storage';
      }
    });
  }

  applyLayersBehavior(key, name) {
    console.log(`[StationViewer] Layers behavior: "${name}" (${key})`);
    const modules = this.modulesGroup.children;
    if (modules.length === 0) return;

    let targetCat = null;
    const lower = (name || key || '').toLowerCase();
    if (lower.includes('dock')) targetCat = 'docks';
    else if (lower.includes('storage')) targetCat = 'storage';
    else if (lower.includes('prod')) targetCat = 'production';
    else if (lower.includes('hab')) targetCat = 'habitation';
    else if (lower.includes('defense') || lower.includes('defence')) targetCat = 'defence';

    if (targetCat) {
      this.highlightModulesByFilter(targetCat);
    }

    // When Layers order or behavior changes, re-apply active layout to place modules in updated Layers category order
    if (this.lastLayoutArgs) {
      this.applyLayoutBehavior(this.lastLayoutArgs.key, this.lastLayoutArgs.name, this.lastLayoutArgs.activeEntries);
    }
  }

  applyCustomDisplayBehavior(valueId, key, name) {
    console.log(`[StationViewer] Custom display behavior activated: [${valueId}] "${name}" (${key})`);
  }

  /**
   * Update and redisplay the station plot boundary box in the main display.
   * Modifiable inputs X, Z and Y with each unit representing 1 km (1000m).
   * Displays a centered box according to + and - extents along X, Z, and Y.
   * 
   * @param {object} plotConfig - { x: { plus, minus }, z: { plus, minus }, y: { plus, minus }, enabled }
   */
  updatePlotBox(plotConfig) {
    if (!plotConfig) return;
    this.currentPlotConfig = plotConfig;

    if (this.stationPlotGroup) {
      this.scene.remove(this.stationPlotGroup);
      this.stationPlotGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.stationPlotGroup = null;
    }

    if (plotConfig.enabled === false) {
      this.renderScene();
      return;
    }

    const { widthX, heightY, depthZ, centerX, centerY, centerZ } = getPlotBoundingBox(plotConfig);

    this.stationPlotGroup = new THREE.Group();
    this.stationPlotGroup.name = 'stationPlotGroup';

    // 1. Holographic semi-transparent volumetric box
    const boxGeo = new THREE.BoxGeometry(widthX, heightY, depthZ);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x00F5FF,
      transparent: true,
      opacity: 0.035,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.name = 'plot_box_mesh';
    this.stationPlotGroup.add(boxMesh);

    // 2. High-contrast perimeter edges
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x00F5FF,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
      depthWrite: false
    });
    const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesLine.name = 'plot_edges_line';
    this.stationPlotGroup.add(edgesLine);

    // 3. Futuristic corner brackets
    const cornerSize = Math.min(widthX, depthZ, heightY) * 0.08;
    if (cornerSize > 30) {
      const cornerMat = new THREE.LineBasicMaterial({
        color: 0x39FF14, // Neon cyber green corner markers
        transparent: true,
        opacity: 0.95,
        linewidth: 2
      });
      const cornerGeo = new THREE.BufferGeometry();
      const cornerPts = [];
      const halfW = widthX / 2;
      const halfH = heightY / 2;
      const halfD = depthZ / 2;
      const signs = [-1, 1];

      for (const sx of signs) {
        for (const sy of signs) {
          for (const sz of signs) {
            const px = sx * halfW;
            const py = sy * halfH;
            const pz = sz * halfD;
            cornerPts.push(px, py, pz, px - sx * cornerSize, py, pz);
            cornerPts.push(px, py, pz, px, py - sy * cornerSize, pz);
            cornerPts.push(px, py, pz, px, py, pz - sz * cornerSize);
          }
        }
      }
      cornerGeo.setAttribute('position', new THREE.Float32BufferAttribute(cornerPts, 3));
      const cornerLines = new THREE.LineSegments(cornerGeo, cornerMat);
      cornerLines.name = 'plot_corner_lines';
      this.stationPlotGroup.add(cornerLines);
    }

    // 4. Base floor boundary crosslines
    const floorGridGeo = new THREE.BufferGeometry();
    const halfW = widthX / 2;
    const halfH = heightY / 2;
    const halfD = depthZ / 2;
    const floorPts = [
      -halfW, -halfH, 0,  halfW, -halfH, 0,
      0, -halfH, -halfD,  0, -halfH, halfD
    ];
    floorGridGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPts, 3));
    const floorGridMat = new THREE.LineBasicMaterial({
      color: 0x00F5FF,
      transparent: true,
      opacity: 0.35
    });
    const floorCross = new THREE.LineSegments(floorGridGeo, floorGridMat);
    floorCross.name = 'plot_floor_cross';
    this.stationPlotGroup.add(floorCross);

    // 5. Red corner dots at each of the 8 corners for interactive sizing gizmo
    this.plotCornerHandles = [];
    const cornerSphereGeo = new THREE.SphereGeometry(1, 16, 16);
    const cornerMat = new THREE.MeshBasicMaterial({
      color: 0xFF0033, // Vivid red
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });

    const baseScale = Math.max(100, Math.min(widthX, heightY, depthZ) * 0.025);

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const dot = new THREE.Mesh(cornerSphereGeo, cornerMat.clone());
          dot.name = `plot_corner_dot_${sx}_${sy}_${sz}`;
          dot.position.set(sx * halfW, sy * halfH, sz * halfD);
          dot.scale.set(baseScale, baseScale, baseScale);
          dot.renderOrder = 999;
          dot.visible = !!this.arePlotCornersVisible;
          dot.userData = {
            isPlotCorner: true,
            sx,
            sy,
            sz
          };
          this.stationPlotGroup.add(dot);
          this.plotCornerHandles.push(dot);
        }
      }
    }

    // Position centered box
    this.stationPlotGroup.position.set(centerX, centerY, centerZ);
    this.stationPlotGroup.renderOrder = 4;

    this.scene.add(this.stationPlotGroup);
    this.updatePlotBoxViolations();

    // In Blueprint mode, perform NO placement logic (no re-align, no re-layout, no clamping, no overlap shifts)
    if (isBlueprintModeActive()) {
      this.renderScene();
      return;
    }

    // If alignment anchor is active, re-align modules to the updated plot size
    if (this.activeAlignmentBehavior) {
      this.applyAlignmentBehavior(this.activeAlignmentBehavior.key, this.activeAlignmentBehavior.name, this.activeAlignmentBehavior.activeEntries);
    } else if (this.lastLayoutArgs) {
      // Re-apply active layout to keep modules constrained inside updated plot box
      this.applyLayoutBehavior(this.lastLayoutArgs.key, this.lastLayoutArgs.name, this.lastLayoutArgs.activeEntries);
    } else if (this.modulesGroup && this.modulesGroup.children.length > 0) {
      // Clamp all placed modules honoring their component size so none protrude outside plot boundaries
      this.modulesGroup.children.forEach(mod => {
        const s = this.getModuleInitialSize(mod);
        clampModulePositionToPlot(mod.position, s, plotConfig);
      });
      ensureNoBoundingBoxOverlaps(this.modulesGroup.children, plotConfig, {
        gap: 15,
        getModuleSize: (m) => this.getModuleInitialSize(m),
        applyToObjects: true
      });
    }

    // Immediately redisplay the main display
    this.renderScene();
  }

  findSnapDotNearPointer(event) {
    if (!this.snapDots || this.snapDots.length === 0) return null;
    const visibleDots = this.snapDots.filter(d => d.visible && d.parent?.visible);
    if (visibleDots.length === 0) return null;
    const rect = this.renderer?.domElement?.getBoundingClientRect();
    if (!rect) return null;

    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(visibleDots, false);
    if (intersects.length > 0) {
      return intersects[0].object;
    }

    const pointerX = event.clientX;
    const pointerY = event.clientY;
    const tempWorld = new THREE.Vector3();
    const tempScreen = new THREE.Vector3();
    let closestDot = null;
    let minDistanceSq = 16 * 16;

    for (const dot of visibleDots) {
      dot.getWorldPosition(tempWorld);
      tempScreen.copy(tempWorld).project(this.camera);
      if (tempScreen.z > -1 && tempScreen.z < 1) {
        const sx = ((tempScreen.x + 1) / 2) * rect.width + rect.left;
        const sy = ((-tempScreen.y + 1) / 2) * rect.height + rect.top;
        const distSq = (pointerX - sx) * (pointerX - sx) + (pointerY - sy) * (pointerY - sy);
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestDot = dot;
        }
      }
    }
    return closestDot;
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.boundOnPointerDown && this.renderer) {
      this.renderer.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    }
    if (this.boundOnPointerMove) {
      window.removeEventListener('pointermove', this.boundOnPointerMove);
    }
    if (this.boundOnPointerUp) {
      window.removeEventListener('pointerup', this.boundOnPointerUp);
    }
    if (this.boundOnWheel && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('wheel', this.boundOnWheel, { capture: true });
    }
    if (this.boundOnTouchMove && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('touchmove', this.boundOnTouchMove);
    }
    if (this._zoomTimeout) {
      clearTimeout(this._zoomTimeout);
      this._zoomTimeout = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.floatingHudTimeout) {
      clearTimeout(this.floatingHudTimeout);
      this.floatingHudTimeout = null;
    }
    const hud = document.getElementById('floating-plot-size-hud');
    if (hud) hud.remove();

    if (this.stationPlotGroup) {
      this.scene.remove(this.stationPlotGroup);
      this.stationPlotGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.stationPlotGroup = null;
    }
    this.plotCornerHandles = [];
    if (this.snapPointGeometry) this.snapPointGeometry.dispose();
    if (this.snapPointMaterial) this.snapPointMaterial.dispose();
    this.snapDots = [];
    this.animatedTextures = [];
    this.animatedParts = [];
    this.haltedModuleAnimations = new Set();
    if (this.transformControls) {
      this.transformControls.dispose();
      this.scene.remove(this.transformControls);
      this.transformControls = null;
    }
    if (this.transformControlsRotate) {
      this.transformControlsRotate.dispose();
      this.scene.remove(this.transformControlsRotate);
      this.transformControlsRotate = null;
    }
    if (this.selectionBoxEl) {
      this.selectionBoxEl.remove();
      this.selectionBoxEl = null;
    }
    if (this.multiSelectPivot) {
      this.scene.remove(this.multiSelectPivot);
      this.multiSelectPivot = null;
    }
    this.clearMultiSelection();
    this.deselect();
  }
}

function isTextureOrEffectMesh(child) {
  if (!child || !child.isMesh) return false;
  if (child.userData && child.userData.isSnapPoint) return true;
  
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
