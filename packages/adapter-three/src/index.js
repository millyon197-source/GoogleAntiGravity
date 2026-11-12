/**
 * Adapter Three Layer Public API
 * Hexagonal 3D Viewport & Interaction Adapters for Three.js.
 */
export { ThreeRenderEngine } from './engine/three-render-engine.js';
export { CameraController } from './camera/camera-controller.js';
export { TransformGizmoCoordinator } from './gizmos/transform-gizmo-coordinator.js';
export { DimensionOverlayManager } from './overlays/dimension-overlay-manager.js';
export { PlotBoundsManager } from './plot/plot-bounds-manager.js';
export { SelectionManager } from './selection/selection-manager.js';
export { MeshLoader } from './mesh/mesh-loader.js';
export { ThreeCoordinator } from './mesh/three-coordinator.js';
export { computeModuleGroupRotation, computeX4RotationFromModuleGroup } from './math/rotation-math.js';
export { resolveTextureForModel } from './textures/texture-resolver.js';
export { getRaceGlowColor, getRaceHullColor } from './textures/race-colors.js';
export { loadDdsTexture, releaseTextureData, isTextureDataReleased } from './textures/dds-texture-loader.js';
export { loadBinaryModel } from './models/binary-model-loader.js';
export { loadColladaModel } from './models/collada-model-loader.js';
export { loadCachedScene, loadSceneCacheManifest, SceneCacheDecoder } from './models/scene-cache.js';
export { applyTexturesToMeshGroup } from './materials/mesh-group-materials.js';
export { shareModuleMaterials, ownModuleMaterials, castsShadow, isSharedMaterial } from './materials/material-sharing.js';
export { loadPartUvAnimations, applyUvTrack, sampleTrack, parseComponentUvAnimations } from './materials/uv-animations.js';
export { parseAni, sampleChannel, choosePartAnimation, sampleSegments, createPartAnimator, aniUrlsForFolder, loadModuleAniClips } from './models/ani-animations.js';
export { loadModuleMesh, disposeModuleGeometry, releaseUnusedTemplates, applyArrowMasks, applyArrowReveal, CRANE_HOLDER_KEYFRAMES, CRANE_ARM_KEYFRAMES, interpolateKeyframes } from './models/module-mesh-loader.js';
export { adaptTransformControls, getTransformControlsHelper } from './gizmos/transform-controls-compat.js';
export { restoreAuthoredVertexColors } from './models/collada-model-loader.js';
export { X4DDSLoader, detectX4BlockFormat } from './textures/x4-dds-loader.js';
export { decodeBC4Block, decodeBC4ToRGBA, decodeBC5NormalToRGBA, bcLevelByteLength } from './textures/bc-decoder.js';
