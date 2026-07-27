/**
 * mesh-loader.js - Main Thread Manager for MeshWorker
 *
 * Provides a Promise-based API for asynchronously loading and parsing
 * Vulkan-aligned .bin meshes via a Web Worker with zero-copy transfer.
 */

export class MeshLoader {
  constructor(workerPath = './mesh-worker.js') {
    this.worker = new Worker(workerPath);
    this.callbacks = new Map();
    this.nextTaskId = 1;

    this.worker.onmessage = (event) => {
      const { id, status, payload, error } = event.data;
      if (this.callbacks.has(id)) {
        const { resolve, reject } = this.callbacks.get(id);
        this.callbacks.delete(id);

        if (status === 'success') {
          resolve(payload);
        } else {
          reject(new Error(error || 'Worker error'));
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('MeshWorker Unhandled Error:', err);
    };
  }

  /**
   * Load a single .bin (and optional .json) mesh file.
   * @param {string} binUrl - URL to the .bin file
   * @param {string} [jsonUrl] - Optional URL to the .json sidecar
   * @returns {Promise<Object>} Promise resolving to { vertexBuffer, indexBuffer, vertexCount, indexCount, ... }
   */
  loadMesh(binUrl, jsonUrl = null) {
    return new Promise((resolve, reject) => {
      const id = this.nextTaskId++;
      this.callbacks.set(id, { resolve, reject });

      this.worker.postMessage({
        id,
        action: 'LOAD_MESH',
        binUrl,
        jsonUrl
      });
    });
  }

  /**
   * Terminate the worker instance.
   */
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.callbacks.clear();
  }
}
