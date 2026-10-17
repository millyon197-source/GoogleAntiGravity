import * as THREE from 'three';

/**
 * Controller responsible solely for 3D Camera manipulation, Orbit transitions,
 * viewpoint framing, and visibility queries.
 * Adheres to SRP and operates at a single level of abstraction (SLAP).
 */
export class CameraController {
  /**
   * @param {object} params
   * @param {THREE.PerspectiveCamera} params.camera
   * @param {object} params.controls - OrbitControls instance
   * @param {THREE.Scene} params.scene
   * @param {THREE.Group} params.modulesGroup
   */
  constructor({ camera, controls, scene, modulesGroup }) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
    this.modulesGroup = modulesGroup;
    this.transitionAnimId = null;
  }

  /**
   * Smoothly resets the camera orbit target to the geometric center of all station modules.
   * @param {number} [duration=600] Duration in milliseconds
   */
  resetTarget(duration = 600) {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(this.modulesGroup);
    const center = box.getCenter(new THREE.Vector3());

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

  /**
   * Adjusts camera position and zoom distance to fit all station modules and plot within the viewport.
   * @param {object} [plotBox] Optional plot bounding box { minX, minY, minZ, maxX, maxY, maxZ }
   * @param {(mesh: THREE.Mesh) => boolean} [isTextureOrEffectFn] Filter for effect meshes
   */
  fitToStation(plotBox = null, isTextureOrEffectFn = null) {
    let box = new THREE.Box3();
    let hasContent = false;

    if (this.modulesGroup && this.modulesGroup.children.length > 0) {
      this.modulesGroup.traverse(child => {
        if (child.isMesh && (!isTextureOrEffectFn || !isTextureOrEffectFn(child))) {
          box.expandByObject(child);
          hasContent = true;
        }
      });
      if (!hasContent) {
        box.setFromObject(this.modulesGroup);
        hasContent = !box.isEmpty();
      }
    }

    if (!hasContent && plotBox) {
      box.min.set(plotBox.minX, plotBox.minY, plotBox.minZ);
      box.max.set(plotBox.maxX, plotBox.maxY, plotBox.maxZ);
      hasContent = true;
    }

    if (!hasContent) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.35; // Add pad offset factor

    this.controls.maxDistance = Math.max(50000, cameraZ * 4);
    cameraZ = Math.max(120, cameraZ);

    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    this.controls.update();
  }

  /**
   * Fits the camera around a specific category or macro filter selection.
   * @param {string} categoryFilter
   * @param {string|null} macroFilter
   */
  fitToSelection(categoryFilter, macroFilter = null) {
    let box = new THREE.Box3();
    let hasMatching = false;

    if (this.modulesGroup && this.modulesGroup.children.length > 0) {
      this.modulesGroup.traverse(child => {
        if (child.isMesh && child.parent) {
          let mod = child;
          while (mod && mod.parent !== this.modulesGroup) {
            mod = mod.parent;
          }
          if (mod && mod.userData) {
            const matchesCat = !categoryFilter || mod.userData.category === categoryFilter;
            const matchesMacro = !macroFilter || mod.userData.macro === macroFilter;
            if (matchesCat && matchesMacro) {
              box.expandByObject(child);
              hasMatching = true;
            }
          }
        }
      });
    }

    if (!hasMatching) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.45;
    cameraZ = Math.max(100, cameraZ);

    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    this.controls.update();
  }

  /**
   * Checks whether a module is currently inside the camera's viewing frustum.
   * @param {number} index
   * @param {Set<string>} [hiddenMacros]
   * @returns {boolean}
   */
  isModuleVisibleInViewport(index, hiddenMacros = null) {
    if (!this.camera || !this.modulesGroup) return false;
    const targetModule = this.modulesGroup.children.find(child => child.userData.index === index);
    if (!targetModule || !targetModule.visible) return false;

    let cur = targetModule.parent;
    while (cur && cur !== this.scene) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }

    if (targetModule.userData.macro && hiddenMacros && hiddenMacros.has(targetModule.userData.macro)) {
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

  /**
   * Sets camera to a canonical orthographic/perspective angle preset.
   * @param {string} angleName 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'isometric'
   */
  setViewAngle(angleName) {
    const target = this.controls.target.clone();
    const currentDist = this.camera.position.distanceTo(target) || 500;

    switch ((angleName || '').toLowerCase()) {
      case 'top':
        this.camera.position.set(target.x, target.y + currentDist, target.z + 0.0001);
        break;
      case 'bottom':
        this.camera.position.set(target.x, target.y - currentDist, target.z + 0.0001);
        break;
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + currentDist);
        break;
      case 'back':
        this.camera.position.set(target.x, target.y, target.z - currentDist);
        break;
      case 'left':
        this.camera.position.set(target.x - currentDist, target.y, target.z);
        break;
      case 'right':
        this.camera.position.set(target.x + currentDist, target.y, target.z);
        break;
      case 'isometric':
      default: {
        const factor = currentDist / Math.sqrt(3);
        this.camera.position.set(target.x + factor, target.y + factor, target.z + factor);
        break;
      }
    }

    this.camera.lookAt(target);
    this.controls.update();
  }
}
