import * as THREE from 'three';

/**
 * Manages 3D Dimension lines, measurement labels, and bounding box indicators.
 * Follows SRP by isolating text-sprite creation and coordinate dimension visualization.
 */
export class DimensionOverlayManager {
  /**
   * @param {object} params
   * @param {THREE.Scene} params.scene
   */
  constructor({ scene }) {
    this.scene = scene;
    this.overlayGroup = new THREE.Group();
    this.overlayGroup.name = 'DimensionOverlayGroup';
    this.scene.add(this.overlayGroup);
    this.isEnabled = false;
  }

  /**
   * Generates a canvas-backed Sprite containing crisp text.
   * @param {string} text
   * @param {string} [colorStr='#00e5ff']
   * @param {number} [scale=1]
   * @returns {THREE.Sprite}
   */
  createDimensionLabelSprite(text, colorStr = '#00e5ff', scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 8);
    ctx.fill();

    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 2;
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 8);
    ctx.stroke();

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = colorStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(60 * scale, 15 * scale, 1);
    return sprite;
  }

  /**
   * Clears any active dimension overlay lines and sprites.
   */
  clear() {
    while (this.overlayGroup.children.length > 0) {
      const child = this.overlayGroup.children[0];
      if (child.geometry) child.geometry.dispose();
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
      this.overlayGroup.remove(child);
    }
  }

  /**
   * Builds 3D dimension lines and labels around a target module's bounding box.
   * @param {THREE.Object3D} targetModule
   * @param {(mod: THREE.Object3D) => THREE.Box3} [getBoundsFn]
   */
  buildOverlay(targetModule, getBoundsFn = null) {
    this.clear();
    if (!targetModule || !this.isEnabled) return;

    const box = getBoundsFn ? getBoundsFn(targetModule) : new THREE.Box3().setFromObject(targetModule);
    if (!box || box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const min = box.min;
    const max = box.max;

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
      depthTest: false
    });

    // X Dimension line
    const xGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(min.x, min.y, max.z + 5),
      new THREE.Vector3(max.x, min.y, max.z + 5)
    ]);
    this.overlayGroup.add(new THREE.Line(xGeo, lineMat));
    const xLabel = this.createDimensionLabelSprite(`X: ${Math.round(size.x)}m`, '#00e5ff', 0.8);
    xLabel.position.set((min.x + max.x) / 2, min.y - 10, max.z + 5);
    this.overlayGroup.add(xLabel);

    // Y Dimension line
    const yGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(max.x + 5, min.y, max.z),
      new THREE.Vector3(max.x + 5, max.y, max.z)
    ]);
    this.overlayGroup.add(new THREE.Line(yGeo, lineMat));
    const yLabel = this.createDimensionLabelSprite(`Y: ${Math.round(size.y)}m`, '#00e5ff', 0.8);
    yLabel.position.set(max.x + 15, (min.y + max.y) / 2, max.z);
    this.overlayGroup.add(yLabel);

    // Z Dimension line
    const zGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(max.x + 5, min.y, min.z),
      new THREE.Vector3(max.x + 5, min.y, max.z)
    ]);
    this.overlayGroup.add(new THREE.Line(zGeo, lineMat));
    const zLabel = this.createDimensionLabelSprite(`Z: ${Math.round(size.z)}m`, '#00e5ff', 0.8);
    zLabel.position.set(max.x + 5, min.y - 10, (min.z + max.z) / 2);
    this.overlayGroup.add(zLabel);
  }

  /**
   * Toggles dimension overlay visibility.
   * @param {boolean} enabled
   * @param {THREE.Object3D|null} [activeModule]
   * @param {(mod: THREE.Object3D) => THREE.Box3} [getBoundsFn]
   */
  toggle(enabled, activeModule = null, getBoundsFn = null) {
    this.isEnabled = !!enabled;
    this.overlayGroup.visible = this.isEnabled;
    if (this.isEnabled && activeModule) {
      this.buildOverlay(activeModule, getBoundsFn);
    } else if (!this.isEnabled) {
      this.clear();
    }
  }
}
