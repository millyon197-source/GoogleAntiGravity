import { Vector3D } from '../value-objects/vector3d.js';
import { PlotBounds } from '../value-objects/plot-bounds.js';
import { BoundingBox3D } from '../value-objects/bounding-box-3d.js';

/**
 * Pure domain service containing station layout calculation algorithms:
 * - 3D AABB overlap detection
 * - Plot boundary clamping
 * - Multi-axis collision resolution and stacking
 * - Planar row alignment
 */
export class StationLayoutEngine {
  /**
   * Test whether two 3D bounding boxes overlap, accounting for an optional safety margin.
   *
   * @param {{x: number, y: number, z: number}} posA - Center of Box A
   * @param {{x: number, y: number, z: number}|number[]} sizeA - Dimensions of Box A
   * @param {{x: number, y: number, z: number}} posB - Center of Box B
   * @param {{x: number, y: number, z: number}|number[]} sizeB - Dimensions of Box B
   * @param {number} [margin=0] - Additional separation gap
   * @returns {boolean} True if bounding boxes overlap across all 3 axes
   */
  static doBoxesOverlap(posA, sizeA, posB, sizeB, margin = 0) {
    if (!posA || !sizeA || !posB || !sizeB) return false;
    const halfXA = ((sizeA.x ?? sizeA[0]) || 0) / 2;
    const halfYA = ((sizeA.y ?? sizeA[1]) || 0) / 2;
    const halfZA = ((sizeA.z ?? sizeA[2]) || 0) / 2;

    const halfXB = ((sizeB.x ?? sizeB[0]) || 0) / 2;
    const halfYB = ((sizeB.y ?? sizeB[1]) || 0) / 2;
    const halfZB = ((sizeB.z ?? sizeB[2]) || 0) / 2;

    const distX = Math.abs(posA.x - posB.x);
    const distY = Math.abs(posA.y - posB.y);
    const distZ = Math.abs(posA.z - posB.z);

    const overlapX = distX < (halfXA + halfXB + margin - 0.05);
    const overlapY = distY < (halfYA + halfYB + margin - 0.05);
    const overlapZ = distZ < (halfZA + halfZB + margin - 0.05);

    return overlapX && overlapY && overlapZ;
  }

  /**
   * Clamp a 3D module position strictly within plot boundaries,
   * honoring the module's bounding box size so no part of the module
   * is outside the plot size.
   *
   * @param {{x: number, y: number, z: number}} pos - Mutated in place or updated
   * @param {{x: number, y: number, z: number}|number[]} size
   * @param {PlotBounds|object} [plotBounds]
   * @returns {{x: number, y: number, z: number}}
   */
  static clampModulePositionToPlot(pos, size, plotBounds = null) {
    if (!pos) return pos;
    const bounds = plotBounds instanceof PlotBounds
      ? plotBounds
      : (plotBounds ? new PlotBounds(plotBounds) : PlotBounds.defaultBounds());

    const clamped = bounds.clampPosition(pos, size);
    pos.x = clamped.x;
    pos.y = clamped.y;
    pos.z = clamped.z;
    return pos;
  }

  /**
   * For any component placement, ensure no bounding box overlaps another component's BB.
   * Checks all module bounding boxes pairwise. If any overlap is detected, resolves it
   * by shifting along the best axis (X, Z, or Y) and stacking layers if needed,
   * while keeping all components strictly within current plot size.
   *
   * @param {Array} modules - Array of placed modules (objects or Three.js meshes)
   * @param {PlotBounds|object} [plotBounds] - Current plot boundaries
   * @param {object} [options] - Options { gap, getModuleSize, applyToObjects }
   * @returns {number} Number of overlaps resolved
   */
  static ensureNoBoundingBoxOverlaps(modules, plotBounds = null, options = {}) {
    if (!Array.isArray(modules) || modules.length < 2) return 0;

    const bounds = plotBounds instanceof PlotBounds
      ? plotBounds
      : (plotBounds ? new PlotBounds(plotBounds) : PlotBounds.defaultBounds());

    const gap = typeof options.gap === 'number' ? options.gap : 15;
    const getSize = options.getModuleSize || ((m) => {
      if (m.initialSize) return m.initialSize;
      if (m.userData?.initialSize) return m.userData.initialSize;
      return { x: 100, y: 100, z: 100 };
    });

    const getPos = (m) => {
      if (m.position && typeof m.position.x === 'number') return m.position;
      if (typeof m.x === 'number') return m;
      return { x: 0, y: 0, z: 0 };
    };

    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;

    let totalResolved = 0;
    let iterations = 0;
    const maxIterations = 40;

    while (iterations++ < maxIterations) {
      let hadOverlapInPass = false;

      for (let i = 0; i < modules.length; i++) {
        const modA = modules[i];
        const posA = getPos(modA);
        const sizeA = getSize(modA);
        const halfXA = (sizeA.x || 100) / 2;
        const halfYA = (sizeA.y || 100) / 2;
        const halfZA = (sizeA.z || 100) / 2;

        for (let j = i + 1; j < modules.length; j++) {
          const modB = modules[j];
          const posB = getPos(modB);
          const sizeB = getSize(modB);
          const halfXB = (sizeB.x || 100) / 2;
          const halfYB = (sizeB.y || 100) / 2;
          const halfZB = (sizeB.z || 100) / 2;

          if (StationLayoutEngine.doBoxesOverlap(posA, sizeA, posB, sizeB, gap)) {
            hadOverlapInPass = true;
            totalResolved++;

            const dx = (halfXA + halfXB + gap) - Math.abs(posA.x - posB.x);
            const dy = (halfYA + halfYB + gap) - Math.abs(posA.y - posB.y);
            const dz = (halfZA + halfZB + gap) - Math.abs(posA.z - posB.z);

            const signX = posB.x >= posA.x ? 1 : -1;
            const signZ = posB.z >= posA.z ? 1 : -1;
            const signY = posB.y >= posA.y ? 1 : -1;

            let resolved = false;

            // Try 1: Separate along X
            const targetXB = posB.x + signX * dx;
            if (targetXB + halfXB <= maxX && targetXB - halfXB >= minX) {
              posB.x = targetXB;
              resolved = true;
            } else {
              const targetXA = posA.x - signX * dx;
              if (targetXA + halfXA <= maxX && targetXA - halfXA >= minX) {
                posA.x = targetXA;
                resolved = true;
              }
            }

            // Try 2: If X cannot accommodate without exceeding plot, separate along Z
            if (!resolved) {
              const targetZB = posB.z + signZ * dz;
              if (targetZB + halfZB <= maxZ && targetZB - halfZB >= minZ) {
                posB.z = targetZB;
                resolved = true;
              } else {
                const targetZA = posA.z - signZ * dz;
                if (targetZA + halfZA <= maxZ && targetZA - halfZA >= minZ) {
                  posA.z = targetZA;
                  resolved = true;
                }
              }
            }

            // Try 3: If Z cannot accommodate, separate along Y (new layer)
            if (!resolved) {
              const targetYB = posB.y + (signY || 1) * dy;
              if (targetYB + halfYB <= maxY && targetYB - halfYB >= minY) {
                posB.y = targetYB;
                resolved = true;
              } else {
                const targetYA = posA.y - (signY || 1) * dy;
                if (targetYA + halfYA <= maxY && targetYA - halfYA >= minY) {
                  posA.y = targetYA;
                  resolved = true;
                }
              }
            }

            // Try 4: Fallback upward in Y
            if (!resolved) {
              posB.y = Math.min(maxY - halfYB, posB.y + dy);
            }

            StationLayoutEngine.clampModulePositionToPlot(posA, sizeA, bounds);
            StationLayoutEngine.clampModulePositionToPlot(posB, sizeB, bounds);

            if (options.applyToObjects) {
              const targetA = modA.module || modA;
              const targetB = modB.module || modB;
              if (typeof targetA.position?.set === 'function') targetA.position.set(posA.x, posA.y, posA.z);
              else if (targetA.position) { targetA.position.x = posA.x; targetA.position.y = posA.y; targetA.position.z = posA.z; }
              if (typeof targetB.position?.set === 'function') targetB.position.set(posB.x, posB.y, posB.z);
              else if (targetB.position) { targetB.position.x = posB.x; targetB.position.y = posB.y; targetB.position.z = posB.z; }
            }
          }
        }
      }

      if (!hadOverlapInPass) break;
    }

    return totalResolved;
  }
}
