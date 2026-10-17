import * as THREE from 'three';

/**
 * Manages the Station Plot Bounding Box, Multi-layer Grid, and Corner Resize Gizmos.
 * Follows SRP by encapsulating plot grid geometries, corner dragging, and violation coloring.
 */
export class PlotBoundsManager {
  /**
   * @param {object} params
   * @param {THREE.Scene} params.scene
   */
  constructor({ scene }) {
    this.scene = scene;
    this.stationPlotGroup = new THREE.Group();
    this.stationPlotGroup.name = 'StationPlotGroup';
    this.scene.add(this.stationPlotGroup);

    this.plotCornersGroup = new THREE.Group();
    this.plotCornersGroup.name = 'PlotCornersGroup';
    this.scene.add(this.plotCornersGroup);

    this.majorGridSize = 1000;
    this.isGridVisible = true;
    this.currentPlotConfig = null;
  }

  /**
   * Creates a compass direction label sprite (e.g. +X, -X, +Z, -Z).
   * @param {string} text
   * @param {string} [colorStr='#38bdf8']
   * @returns {THREE.Sprite}
   */
  createDirectionLabelSprite(text, colorStr = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 36px monospace';
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
    sprite.scale.set(40, 40, 1);
    return sprite;
  }

  /**
   * Sets plot corner resize dots visibility.
   * @param {boolean} visible
   */
  setPlotCornersVisible(visible) {
    this.plotCornersGroup.visible = !!visible;
  }

  /**
   * Toggles grid visibility.
   * @param {boolean} enabled
   */
  toggleGrid(enabled) {
    this.isGridVisible = !!enabled;
    this.stationPlotGroup.visible = this.isGridVisible;
  }

  /**
   * Clears plot group children and disposes their geometries.
   */
  clear() {
    while (this.stationPlotGroup.children.length > 0) {
      const child = this.stationPlotGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      this.stationPlotGroup.remove(child);
    }
  }
}
