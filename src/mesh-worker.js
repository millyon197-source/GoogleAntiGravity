/**
 * mesh-worker.js - High-Performance Background Web Worker
 *
 * Responsibilities:
 * 1. Fetches.bin (and .json) binary blobs directly from network.
 * 2. Parses the 32-byte VKDA binary header in memory.
 * 3. Maps interleaved 32-byte (8x Float32) vertex & index buffers.
 * 4. Zero-copy transfers the ArrayBuffers/TypedArrays to the main thread.
 */

// Binary Header Constants
const MAGIC_BYTES_0 = 0x56; // 'V'
const MAGIC_BYTES_1 = 0x4B; // 'K'
const MAGIC_BYTES_2 = 0x44; // 'D'
const MAGIC_BYTES_3 = 0x41; // 'A'

const HEADER_SIZE_BYTES = 32;
const INDEX_TYPE_UINT16 = 0;
const INDEX_TYPE_UINT32 = 1;

/**
 * Message Handler
 */
self.onmessage = async (event) => {
  const { id, action, binUrl, jsonUrl } = event.data;

  if (action === 'LOAD_MESH') {
    try {
      const result = await loadAndParseMesh(binUrl, jsonUrl);
      
      // Transfer the underlying ArrayBuffers for zero-copy performance
      const transferables = [
        result.vertexBuffer.buffer,
        result.indexBuffer.buffer
      ];

      self.postMessage(
        {
          id,
          status: 'success',
          payload: result
        },
        transferables
      );
    } catch (error) {
      self.postMessage({
        id,
        status: 'error',
        error: error.message || 'Unknown error occurred while loading mesh'
      });
    }
  } else if (action === 'LOAD_BATCH') {
    const { tasks } = event.data; // Array of { id, binUrl, jsonUrl }
    for (const task of tasks) {
      try {
        const result = await loadAndParseMesh(task.binUrl, task.jsonUrl);
        self.postMessage(
          {
            id: task.id,
            status: 'success',
            payload: result
          },
          [result.vertexBuffer.buffer, result.indexBuffer.buffer]
        );
      } catch (error) {
        self.postMessage({
          id: task.id,
          status: 'error',
          error: error.message
        });
      }
    }
  }
};

/**
 * Fetches and parses a single Vulkan-aligned .bin mesh file.
 */
async function loadAndParseMesh(binUrl, jsonUrl) {
  // Fetch binary blob & optional JSON sidecar concurrently
  const fetchBinPromise = fetch(binUrl).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching binary: ${binUrl}`);
    return res.arrayBuffer();
  });

  let jsonMetadata = null;
  if (jsonUrl) {
    jsonMetadata = await fetch(jsonUrl)
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);
  }

  const arrayBuffer = await fetchBinPromise;
  if (arrayBuffer.byteLength < HEADER_SIZE_BYTES) {
    throw new Error(`Invalid file size (${arrayBuffer.byteLength} bytes). Expected at least 32-byte header.`);
  }

  const dataView = new DataView(arrayBuffer);

  // Parse 32-byte Header
  // Magic (4 bytes): "VKDA"
  const m0 = dataView.getUint8(0);
  const m1 = dataView.getUint8(1);
  const m2 = dataView.getUint8(2);
  const m3 = dataView.getUint8(3);

  if (m0 !== MAGIC_BYTES_0 || m1 !== MAGIC_BYTES_1 || m2 !== MAGIC_BYTES_2 || m3 !== MAGIC_BYTES_3) {
    throw new Error('Invalid magic header. Expected "VKDA".');
  }

  const version = dataView.getUint32(4, true);
  const vertexCount = dataView.getUint32(8, true);
  const vertexStride = dataView.getUint32(12, true);
  const indexCount = dataView.getUint32(16, true);
  const indexType = dataView.getUint32(20, true);
  const vertexOffset = dataView.getUint32(24, true);
  const indexOffset = dataView.getUint32(28, true);

  // Validate Vulkan 4-byte alignment
  if (vertexStride % 4 !== 0) {
    throw new Error(`Vertex stride (${vertexStride}) is not 4-byte aligned.`);
  }

  const indexElementSize = (indexType === INDEX_TYPE_UINT16) ? 2 : 4;
  const expectedVertexBytes = vertexCount * vertexStride;
  const expectedIndexBytes = indexCount * indexElementSize;

  if (arrayBuffer.byteLength < indexOffset + expectedIndexBytes) {
    throw new Error('Truncated file payload: Buffer smaller than indicated vertex/index offsets.');
  }

  // Slice/create views for Vertex Buffer & Index Buffer
  // We slice into new ArrayBuffers to allow clean zero-copy transfer without keeping dead header bytes attached
  const vertexArrayBuffer = arrayBuffer.slice(vertexOffset, vertexOffset + expectedVertexBytes);
  const indexArrayBuffer = arrayBuffer.slice(indexOffset, indexOffset + expectedIndexBytes);

  const vertexBuffer = new Float32Array(vertexArrayBuffer);
  const indexBuffer = (indexType === INDEX_TYPE_UINT16)
    ? new Uint16Array(indexArrayBuffer)
    : new Uint32Array(indexArrayBuffer);

  return {
    version,
    vertexCount,
    vertexStride,
    indexCount,
    indexType: indexType === INDEX_TYPE_UINT16 ? 'UINT16' : 'UINT32',
    indexElementSize,
    vertexBuffer, // Transferred
    indexBuffer,  // Transferred
    metadata: jsonMetadata,
    layout: {
      position: { offset: 0, count: 3, type: 'Float32' },
      normal:   { offset: 12, count: 3, type: 'Float32' },
      uv:       { offset: 24, count: 2, type: 'Float32' }
    }
  };
}
