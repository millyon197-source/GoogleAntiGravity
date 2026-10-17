import * as THREE from 'three';

/**
 * Manages Pointer Raycasting, Drag-box Multi-selection, and Active Selection Sets.
 * Isolates screen-space coordinate projections from 3D scene mutations (SRP).
 */
export class SelectionManager {
  /**
   * @param {object} params
   * @param {THREE.PerspectiveCamera} params.camera
   * @param {THREE.Scene} params.scene
   * @param {THREE.Group} params.modulesGroup
   * @param {HTMLElement} [params.domContainer]
   */
  constructor({ camera, scene, modulesGroup, domContainer = null }) {
    this.camera = camera;
    this.scene = scene;
    this.modulesGroup = modulesGroup;
    this.domContainer = domContainer;

    this.selectedModule = null;
    this.multiSelectedModules = [];
    this.selectionBoxElement = null;
    this.isSelecting = false;
  }

  /**
   * Raycasts a screen pointer event against modules in modulesGroup.
   * @param {MouseEvent|PointerEvent} event
   * @param {(mesh: THREE.Object3D) => boolean} [isSelectableFn]
   * @returns {THREE.Object3D|null}
   */
  raycastModuleAtPointer(event, isSelectableFn = null) {
    if (!this.modulesGroup || this.modulesGroup.children.length === 0) return null;
    const rect = this.domContainer ? this.domContainer.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const intersects = raycaster.intersectObjects(this.modulesGroup.children, true);
    for (const hit of intersects) {
      if (isSelectableFn && !isSelectableFn(hit.object)) continue;

      let topMod = hit.object;
      while (topMod && topMod.parent !== this.modulesGroup) {
        topMod = topMod.parent;
      }
      if (topMod && topMod.userData && topMod.userData.index !== undefined) {
        return topMod;
      }
    }
    return null;
  }

  /**
   * Clears multi-selected modules list.
   */
  clearMultiSelection() {
    this.multiSelectedModules = [];
  }

  /**
   * Computes which modules fall inside a screen-space 2D rectangle.
   * @param {number} minX
   * @param {number} maxX
   * @param {number} minY
   * @param {number} maxY
   * @returns {THREE.Object3D[]}
   */
  getModulesInScreenBox(minX, maxX, minY, maxY) {
    if (!this.modulesGroup) return [];
    const rect = this.domContainer ? this.domContainer.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const matching = [];

    this.camera.updateMatrixWorld(true);

    for (const mod of this.modulesGroup.children) {
      if (!mod.visible) continue;
      const worldPos = new THREE.Vector3();
      mod.getWorldPosition(worldPos);

      const screenPos = worldPos.clone().project(this.camera);
      // Only keep objects in front of camera
      if (screenPos.z > 1) continue;

      const px = ((screenPos.x + 1) * rect.width) / 2 + rect.left;
      const py = ((-screenPos.y + 1) * rect.height) / 2 + rect.top;

      if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
        matching.push(mod);
      }
    }
    return matching;
  }
}
