/**
 * three-coordinator.js - Main Thread Three.js Coordinator
 *
 * Coordinates non-blocking background mesh loading with the Three.js render loop.
 * Operates at 60/120 FPS by delegating network fetching, parsing, and buffer
 * creation to mesh-worker.js, receiving zero-copy transferred TypedArrays,
 * and binding them directly into THREE.InterleavedBuffer / THREE.BufferGeometry.
 */

import * as THREE from 'three';
import { MeshLoader } from './mesh-loader.js';

/**
 * Coordinates worker-based mesh loading and Three.js object creation.
 */
export class ThreeCoordinator {
  /**
   * @param {THREE.Scene|THREE.Group} targetContainer - Three.js scene or group to attach loaded meshes.
   * @param {Object} [options]
   * @param {string} [options.workerPath] - Custom path to mesh-worker.js
   * @param {THREE.Material} [options.defaultMaterial] - Material to use for loaded meshes
   */
  constructor(targetContainer, options = {}) {
    this.container = targetContainer;
    this.loader = new MeshLoader(options.workerPath);
    this.defaultMaterial = options.defaultMaterial || new THREE.MeshStandardMaterial({
      color: 0x88aaee,
      roughness: 0.4,
      metalness: 0.6,
      side: THREE.DoubleSide
    });

    this.loadedMeshes = new Map();
    this.fpsCounter = {
      fps: 60,
      frames: 0,
      lastTime: performance.now()
    };
  }

  /**
   * Non-blocking mesh loader.
   * Fetches, parses, and constructs a THREE.Mesh in zero-copy fashion.
   *
   * @param {string} binUrl - Path to the Vulkan-aligned .bin file
   * @param {string} [jsonUrl] - Path to the .json sidecar metadata
   * @param {Object} [meshOptions] - Options (name, position, scale, material)
   * @returns {Promise<THREE.Mesh>} Resolves directly to the created THREE.Mesh
   */
  async loadMesh(binUrl, jsonUrl = null, meshOptions = {}) {
    // 1. Worker handles network fetch, parsing, and pointer transfer in background
    const meshData = await this.loader.loadMesh(binUrl, jsonUrl);

    // 2. Main thread receives transferred Float32Array & Uint16Array/Uint32Array
    const geometry = this.createInterleavedGeometry(meshData);

    // 3. Create Three.js Mesh
    const material = meshOptions.material || this.defaultMaterial;
    const mesh = new THREE.Mesh(geometry, material);

    if (meshOptions.name) mesh.name = meshOptions.name;
    if (meshOptions.position) mesh.position.copy(meshOptions.position);
    if (meshOptions.rotation) mesh.rotation.copy(meshOptions.rotation);
    if (meshOptions.scale) mesh.scale.copy(meshOptions.scale);

    mesh.userData = {
      binUrl,
      jsonUrl,
      metadata: meshData.metadata,
      vertexCount: meshData.vertexCount,
      indexCount: meshData.indexCount
    };

    // 4. Add to Three.js container
    this.container.add(mesh);
    this.loadedMeshes.set(binUrl, mesh);

    return mesh;
  }

  /**
   * Converts transferred TypedArrays into a THREE.BufferGeometry using THREE.InterleavedBuffer.
   * Zero-copy: Buffer Memory is handed directly to GPU VBOs.
   *
   * @param {Object} meshData - Payload returned from mesh-worker
   * @returns {THREE.BufferGeometry}
   */
  createInterleavedGeometry(meshData) {
    const geometry = new THREE.BufferGeometry();

    // 32-byte stride = 8 Float32 elements per vertex
    const strideFloats = 8;
    const interleavedBuffer = new THREE.InterleavedBuffer(meshData.vertexBuffer, strideFloats);

    // Interleaved Attribute Mappings:
    // Position (3 floats at offset 0)
    geometry.setAttribute(
      'position',
      new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0, false)
    );

    // Normal (3 floats at offset 3)
    geometry.setAttribute(
      'normal',
      new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 3, false)
    );

    // UV (2 floats at offset 6)
    geometry.setAttribute(
      'uv',
      new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 6, false)
    );

    // Index Buffer (Uint16Array or Uint32Array)
    geometry.setIndex(new THREE.BufferAttribute(meshData.indexBuffer, 1));

    // Calculate or apply bounding box
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

    return geometry;
  }

  /**
   * Batch load multiple meshes in parallel background threads.
   * @param {Array<{binUrl: string, jsonUrl?: string, position?: THREE.Vector3}>} items
   * @returns {Promise<THREE.Mesh[]>}
   */
  async loadBatch(items) {
    const promises = items.map(item =>
      this.loadMesh(item.binUrl, item.jsonUrl, item)
    );
    return Promise.all(promises);
  }

  /**
   * Track FPS on the main thread loop to verify zero jank.
   */
  updateFramePerformance() {
    this.fpsCounter.frames++;
    const now = performance.now();
    const elapsed = now - this.fpsCounter.lastTime;
    if (elapsed >= 1000) {
      this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / elapsed);
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = now;
    }
    return this.fpsCounter.fps;
  }

  /**
   * Clean up resources.
   */
  dispose() {
    this.loader.dispose();
    this.loadedMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.loadedMeshes.clear();
  }
}
