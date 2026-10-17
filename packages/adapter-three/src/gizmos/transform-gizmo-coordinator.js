import * as THREE from 'three';

/**
 * Coordinates TransformControls (Translation & Rotation Gizmos),
 * ensuring active gizmos remain within the visible viewport during zoom
 * without displacing the station module itself (SRP).
 */
export class TransformGizmoCoordinator {
  /**
   * @param {object} params
   * @param {THREE.PerspectiveCamera} params.camera
   * @param {object} [params.transformControls]
   * @param {object} [params.transformControlsRotate]
   */
  constructor({ camera, transformControls = null, transformControlsRotate = null }) {
    this.camera = camera;
    this.transformControls = transformControls;
    this.transformControlsRotate = transformControlsRotate;

    this.gizmoWorldOffset = new THREE.Vector3();
    this.isGizmoDraggingFlag = false;
    this.isEnsuringGizmoVisible = false;
  }

  /**
   * Calculates the appropriate gizmo scale based on camera distance.
   * @param {number} distance
   * @returns {number}
   */
  getAppropriateGizmoSize(distance) {
    if (!distance || isNaN(distance)) return 0.85;
    if (distance < 150) {
      return Math.max(0.68, Math.min(0.85, 0.68 + (distance / 150) * 0.17));
    } else if (distance > 2000) {
      return Math.min(1.10, 0.85 + ((distance - 2000) / 8000) * 0.25);
    }
    return 0.85;
  }

  /**
   * Returns true if either translation or rotation gizmo is actively being dragged.
   * @returns {boolean}
   */
  isGizmoDragging() {
    const isTransDragging = !!(this.transformControls && this.transformControls.dragging);
    const isRotDragging = !!(this.transformControlsRotate && this.transformControlsRotate.dragging);
    return isTransDragging || isRotDragging || this.isGizmoDraggingFlag;
  }

  /**
   * Returns true if a module is attached to either transform control.
   * @returns {boolean}
   */
  isGizmoAttached() {
    return !!(
      (this.transformControls && this.transformControls.object) ||
      (this.transformControlsRotate && this.transformControlsRotate.object)
    );
  }

  /**
   * Computes the 3D location on the target module at the zoomed camera location.
   * @param {THREE.Object3D} targetModule
   * @param {THREE.Vector2} [mouseNdc]
   * @param {(mod: THREE.Object3D) => THREE.Box3} [getBoundsFn]
   * @returns {THREE.Vector3|null}
   */
  getModuleZoomedLocation(targetModule, mouseNdc = null, getBoundsFn = null) {
    if (!targetModule) return null;

    const pointerNdc = (mouseNdc && typeof mouseNdc.x === 'number' && !isNaN(mouseNdc.x))
      ? mouseNdc
      : new THREE.Vector2(0, 0);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerNdc, this.camera);

    const minSafeDist = Math.max(15, (this.camera.near || 1) + 5);

    // 1. Raycast against meshes belonging to targetModule
    const intersects = raycaster.intersectObjects([targetModule], true);
    if (intersects && intersects.length > 0) {
      const hit = intersects[0].point.clone();
      const hitCamSpace = hit.clone().applyMatrix4(this.camera.matrixWorldInverse);
      if (-hitCamSpace.z >= minSafeDist) {
        return hit;
      }
    }

    // 2. Raycast against world bounding box
    const box = getBoundsFn ? getBoundsFn(targetModule) : new THREE.Box3().setFromObject(targetModule);
    if (box && !box.isEmpty()) {
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectBox(box, hitPoint)) {
        const hitCamSpace = hitPoint.clone().applyMatrix4(this.camera.matrixWorldInverse);
        if (-hitCamSpace.z >= minSafeDist) {
          return hitPoint;
        }
      }

      const center = box.getCenter(new THREE.Vector3());
      const camSpaceCenter = center.clone().applyMatrix4(this.camera.matrixWorldInverse);
      const safeDepth = Math.max(25, -camSpaceCenter.z > 0 ? -camSpaceCenter.z : 100);

      const fovRad = THREE.MathUtils.degToRad(this.camera.fov || 60);
      const halfH = safeDepth * Math.tan(fovRad / 2);
      const halfW = halfH * (this.camera.aspect || 1);

      const maxMargin = 0.75;
      const targetCamSpace = new THREE.Vector3(
        Math.max(-halfW * maxMargin, Math.min(halfW * maxMargin, camSpaceCenter.x)),
        Math.max(-halfH * maxMargin, Math.min(halfH * maxMargin, camSpaceCenter.y)),
        -safeDepth
      );

      return targetCamSpace.applyMatrix4(this.camera.matrixWorld);
    }

    return new THREE.Vector3(0, 0, -100).applyMatrix4(this.camera.matrixWorld);
  }

  /**
   * Ensures that when zoomed in on a module and the gizmo is active,
   * if the gizmo appears outside the visible display, it is moved to the zoomed location
   * on the module and sized appropriately, leaving the module and camera positions undisturbed.
   * @param {object} [options]
   * @param {boolean} [options.isZooming]
   * @param {boolean} [options.force]
   * @param {THREE.Vector2} [mouseNdc]
   * @param {(mod: THREE.Object3D) => THREE.Box3} [getBoundsFn]
   */
  ensureActiveGizmoVisible(options = {}, mouseNdc = null, getBoundsFn = null) {
    if (!this.isGizmoAttached()) return;
    if (this.isGizmoDragging()) return;
    if (this.isEnsuringGizmoVisible) return;

    const isZooming = options.isZooming || options.force;
    if (!isZooming) return;

    const activeTarget = this.transformControls?.object || this.transformControlsRotate?.object;
    if (!activeTarget) return;

    this.isEnsuringGizmoVisible = true;
    try {
      const gizmoPos = new THREE.Vector3();
      activeTarget.getWorldPosition(gizmoPos);

      this.camera.updateMatrixWorld(true);

      const camSpace = gizmoPos.clone().applyMatrix4(this.camera.matrixWorldInverse);
      const zDist = -camSpace.z;

      const minSafeDist = Math.max(15, (this.camera.near || 1) + 5);
      const fovRad = THREE.MathUtils.degToRad(this.camera.fov || 60);
      const halfH = Math.max(0.001, zDist * Math.tan(fovRad / 2));
      const halfW = halfH * (this.camera.aspect || 1);

      const ndcX = camSpace.x / halfW;
      const ndcY = camSpace.y / halfH;

      const isBehindCamera = zDist < minSafeDist;
      const maxDisplayMargin = 0.85;
      const isOutsideViewport = isBehindCamera || Math.abs(ndcX) > maxDisplayMargin || Math.abs(ndcY) > maxDisplayMargin;

      if (isOutsideViewport) {
        const zoomedLoc = this.getModuleZoomedLocation(activeTarget, mouseNdc, getBoundsFn);
        if (zoomedLoc) {
          this.gizmoWorldOffset.subVectors(zoomedLoc, gizmoPos);
        }
      } else {
        this.gizmoWorldOffset.set(0, 0, 0);
      }

      const currentGizmoPos = gizmoPos.clone();
      if (this.gizmoWorldOffset.lengthSq() > 0.0001) {
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
      this.isEnsuringGizmoVisible = false;
    }
  }

  /**
   * Detaches both translation and rotation gizmos and resets offsets.
   */
  detach() {
    if (this.transformControls && typeof this.transformControls.detach === 'function') {
      this.transformControls.detach();
    }
    if (this.transformControlsRotate && typeof this.transformControlsRotate.detach === 'function') {
      this.transformControlsRotate.detach();
    }
    this.gizmoWorldOffset.set(0, 0, 0);
  }
}
