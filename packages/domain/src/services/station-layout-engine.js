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

  /**
   * @param {PlotBounds|object|null} plotBounds
   * @returns {PlotBounds}
   */
  static toPlotBounds(plotBounds) {
    if (plotBounds instanceof PlotBounds) return plotBounds;
    return plotBounds ? new PlotBounds(plotBounds) : PlotBounds.defaultBounds();
  }

  /**
   * Stable-sorts items into category buckets following `categoryOrder`; items whose
   * category is not in the order keep their relative order and go last.
   *
   * @template T
   * @param {T[]} items
   * @param {string[]} categoryOrder - e.g. ['docks', 'storage', 'production', 'habitation', 'defense', 'structure']
   * @param {(item: T) => string} getCategory
   * @returns {T[]}
   */
  static sortByCategoryOrder(items, categoryOrder, getCategory) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const buckets = {};
    categoryOrder.forEach(cat => {
      buckets[cat] = [];
    });
    const unclassified = [];

    items.forEach(item => {
      const cat = getCategory(item);
      if (buckets[cat]) {
        buckets[cat].push(item);
      } else {
        unclassified.push(item);
      }
    });

    const sorted = [];
    categoryOrder.forEach(cat => {
      if (buckets[cat]) sorted.push(...buckets[cat]);
    });
    sorted.push(...unclassified);
    return sorted;
  }

  /**
   * Normalises an alignment-anchor selection to lower-case behaviour keys.
   * Accepts active entries ([{ behaviorKey|id|name }]), a '+'-joined key string, or a
   * config object ({ activeEntries } or { key|behaviorKey|name }). Anything else yields
   * `defaultKeys` (the caller's current UI selection).
   *
   * @param {Array|string|object|null} alignmentAnchor
   * @param {string[]} [defaultKeys=[]]
   * @returns {string[]}
   */
  static parseAlignmentAnchorKeys(alignmentAnchor, defaultKeys = []) {
    if (Array.isArray(alignmentAnchor)) {
      return alignmentAnchor.map(e => (e.behaviorKey || e.id || e.name || '').toLowerCase());
    } else if (typeof alignmentAnchor === 'string') {
      return alignmentAnchor.toLowerCase().split('+').map(k => k.trim());
    } else if (alignmentAnchor && typeof alignmentAnchor === 'object') {
      if (Array.isArray(alignmentAnchor.activeEntries)) {
        return alignmentAnchor.activeEntries.map(e => (e.behaviorKey || e.id || e.name || '').toLowerCase());
      }
      return [alignmentAnchor.key || alignmentAnchor.behaviorKey || alignmentAnchor.name || ''].map(k => k.toLowerCase());
    }
    return defaultKeys;
  }

  /**
   * Layer-by-layer component placement:
   * 1. Alignment anchor keys define the start corner/centre of placement.
   * 2. Modules are placed one at a time in category order, honouring bounding-box sizes.
   * 3. Rows fill along X, rows advance along Z, and a full layer starts a new layer in Y.
   * 4. Positions are clamped to the plot; centre/compact anchors recentre horizontally.
   * 5. Remaining bounding-box overlaps are resolved with ensureNoBoundingBoxOverlaps.
   *
   * @param {Array} modules - Module objects or Three.js meshes.
   * @param {object} options
   * @param {PlotBounds|object|null} [options.plotBounds] - Plot boundaries (default plot when null).
   * @param {string[]} options.categoryOrder - Category placement order.
   * @param {(module: any) => string} options.getCategory - Category of a module.
   * @param {(module: any) => {x: number, y: number, z: number}} options.getModuleSize - Bounding-box size.
   * @param {Array|string|object|null} [options.alignmentAnchor] - See parseAlignmentAnchorKeys.
   * @param {string[]} [options.defaultAlignmentKeys] - Keys used when no anchor is given.
   * @param {number} [options.gap=35] - Gap between modules (m).
   * @param {boolean} [options.applyToObjects] - Also write positions to module.position.
   * @returns {Array<{ module: any, macro: string, position: {x: number, y: number, z: number}, initialSize: object, layerIndex: number, rowIndex: number }>}
   */
  static calculateLayeredPlacement(modules, options) {
    if (!Array.isArray(modules) || modules.length === 0) return [];

    const bounds = StationLayoutEngine.toPlotBounds(options.plotBounds);
    const sortedModules = StationLayoutEngine.sortByCategoryOrder(modules, options.categoryOrder, options.getCategory);
    const { minX, maxX, minY, maxY, minZ, maxZ, centerX, centerY, centerZ } = bounds;

    const activeKeys = StationLayoutEngine.parseAlignmentAnchorKeys(options.alignmentAnchor, options.defaultAlignmentKeys || []);

    const hasGround = activeKeys.some(k => k.includes('ground') || k.includes('floor') || k.includes('lowest'));
    const hasTop = activeKeys.some(k => k.includes('ceiling') || k.includes('top') || k.includes('highest'));
    const hasOrigin = activeKeys.some(k => k.includes('origin') || k.includes('0,0,0'));
    const hasCenter = activeKeys.some(k => k.includes('center') || k.includes('middle'));
    const hasXMirror = activeKeys.some(k => k.includes('x-mirror') || k.includes('reflection') || k.includes('min-x') || k.includes('left'));
    const hasRight = activeKeys.some(k => k.includes('max-x') || k.includes('right'));
    const hasFront = activeKeys.some(k => k.includes('min-z') || k.includes('front'));
    const hasBack = activeKeys.some(k => k.includes('max-z') || k.includes('back'));
    const hasCompact = activeKeys.some(k => k.includes('compact') || k.includes('core'));

    // Vertical start (Y): ground floor is the lowest Y of the plot
    let startFloorY;
    if (hasGround) {
      startFloorY = minY;
    } else if (hasTop) {
      startFloorY = maxY;
    } else if (hasOrigin && !hasCenter) {
      startFloorY = Math.max(minY, Math.min(maxY, 0));
    } else if (hasCenter) {
      startFloorY = centerY;
    } else {
      startFloorY = minY; // Default to ground floor
    }

    // Horizontal start (X)
    let startX;
    if (hasXMirror) {
      startX = minX;
    } else if (hasRight) {
      startX = maxX;
    } else if (hasOrigin && !hasCenter && !hasXMirror) {
      startX = Math.max(minX, Math.min(maxX, 0));
    } else if (hasCenter || hasCompact) {
      startX = centerX;
    } else {
      startX = minX;
    }

    // Depth start (Z)
    let startZ;
    if (hasFront) {
      startZ = maxZ;
    } else if (hasBack) {
      startZ = minZ;
    } else if (hasOrigin && !hasCenter && !hasFront && !hasBack) {
      startZ = Math.max(minZ, Math.min(maxZ, 0));
    } else if (hasCenter || hasCompact) {
      startZ = centerZ;
    } else {
      startZ = minZ;
    }

    const gap = typeof options.gap === 'number' ? options.gap : 35;
    const getSize = options.getModuleSize;

    const dirX = hasRight ? -1 : 1;
    const dirZ = hasFront ? -1 : 1;
    const dirY = hasTop ? -1 : 1;

    let currentLayer = 0;
    let currentFloorY = startFloorY;
    let currentLayerMaxH = 0;

    let currentRowZ = startZ;
    let currentRowMaxD = 0;

    let currentCursorX = startX;
    let modulesInRow = 0;
    let rowsInLayer = 0;

    const placedResults = [];

    sortedModules.forEach((mod) => {
      const s = getSize(mod);
      const halfX = (s.x || 100) / 2;
      const halfY = (s.y || 100) / 2;
      const halfZ = (s.z || 100) / 2;

      let candX;
      if (modulesInRow === 0) {
        candX = currentCursorX + dirX * halfX;
      } else {
        candX = currentCursorX + dirX * (gap + halfX);
      }

      const exceedsX = (dirX > 0)
        ? (candX + halfX > maxX + 0.1)
        : (candX - halfX < minX - 0.1);

      // Would the candidate collide with an already placed module's bounding box?
      const candPos = { x: candX, y: currentFloorY + dirY * halfY, z: currentRowZ + dirZ * halfZ };
      const collides = placedResults.some(p => StationLayoutEngine.doBoxesOverlap(candPos, s, p.position, p.initialSize, 0));

      if ((exceedsX || collides) && modulesInRow > 0) {
        // Row full: advance to the next row along Z in the current layer
        const candRowZ = currentRowZ + dirZ * (currentRowMaxD + gap);
        const candEdgeZ = candRowZ + dirZ * (2 * halfZ);
        const exceedsZ = (dirZ > 0)
          ? (candEdgeZ > maxZ + 0.1)
          : (candEdgeZ < minZ - 0.1);

        const candRowPos = { x: startX + dirX * halfX, y: currentFloorY + dirY * halfY, z: candRowZ + dirZ * halfZ };
        const rowCollides = placedResults.some(p => StationLayoutEngine.doBoxesOverlap(candRowPos, s, p.position, p.initialSize, 0));

        if ((exceedsZ || rowCollides) && rowsInLayer > 0) {
          // Layer full: start a new layer and continue placing
          currentLayer++;
          currentFloorY = currentFloorY + dirY * (currentLayerMaxH + gap);
          currentLayerMaxH = s.y || 100;
          if (dirY > 0 && currentFloorY + 2 * halfY > maxY + 0.1) {
            currentFloorY = minY; // Wrap within vertical plot limits
          } else if (dirY < 0 && currentFloorY - 2 * halfY < minY - 0.1) {
            currentFloorY = maxY - (s.y || 100);
          }

          currentRowZ = startZ;
          currentRowMaxD = s.z || 100;
          rowsInLayer = 1;

          currentCursorX = startX;
          candX = currentCursorX + dirX * halfX;
          modulesInRow = 1;
        } else {
          currentRowZ = candRowZ;
          currentRowMaxD = s.z || 100;
          rowsInLayer++;

          currentCursorX = startX;
          candX = currentCursorX + dirX * halfX;
          modulesInRow = 1;
        }
      } else {
        modulesInRow++;
        if (rowsInLayer === 0) rowsInLayer = 1;
      }

      const posX = candX;
      const posY = currentFloorY + dirY * halfY;
      const posZ = currentRowZ + dirZ * halfZ;

      currentCursorX = candX + dirX * halfX;
      currentRowMaxD = Math.max(currentRowMaxD, s.z || 100);
      currentLayerMaxH = Math.max(currentLayerMaxH, s.y || 100);

      const pos = { x: posX, y: posY, z: posZ };
      StationLayoutEngine.clampModulePositionToPlot(pos, s, bounds);

      if (options.applyToObjects) {
        if (typeof mod.position?.set === 'function') {
          mod.position.set(pos.x, pos.y, pos.z);
        } else if (mod.position) {
          mod.position.x = pos.x;
          mod.position.y = pos.y;
          mod.position.z = pos.z;
        }
      }

      placedResults.push({
        module: mod,
        macro: mod.userData?.macro || mod.macro || '',
        position: pos,
        initialSize: s,
        layerIndex: currentLayer,
        rowIndex: rowsInLayer - 1
      });
    });

    // Bounding Center / Compact Core: centre the placed set horizontally within the plot
    if (hasCenter || hasCompact) {
      let pMinX = Infinity, pMaxX = -Infinity, pMinZ = Infinity, pMaxZ = -Infinity;
      placedResults.forEach(r => {
        pMinX = Math.min(pMinX, r.position.x - r.initialSize.x / 2);
        pMaxX = Math.max(pMaxX, r.position.x + r.initialSize.x / 2);
        pMinZ = Math.min(pMinZ, r.position.z - r.initialSize.z / 2);
        pMaxZ = Math.max(pMaxZ, r.position.z + r.initialSize.z / 2);
      });

      if (isFinite(pMinX) && isFinite(pMaxX)) {
        const curCenterX = (pMinX + pMaxX) / 2;
        const curCenterZ = (pMinZ + pMaxZ) / 2;
        const shiftX = centerX - curCenterX;
        const shiftZ = centerZ - curCenterZ;

        placedResults.forEach(r => {
          r.position.x += shiftX;
          r.position.z += shiftZ;
          StationLayoutEngine.clampModulePositionToPlot(r.position, r.initialSize, bounds);
          if (options.applyToObjects) {
            if (typeof r.module.position?.set === 'function') {
              r.module.position.set(r.position.x, r.position.y, r.position.z);
            } else if (r.module.position) {
              r.module.position.x = r.position.x;
              r.module.position.z = r.position.z;
            }
          }
        });
      }
    }

    StationLayoutEngine.ensureNoBoundingBoxOverlaps(placedResults, bounds, {
      gap: Math.max(10, gap * 0.5),
      getModuleSize: (m) => m.initialSize,
      applyToObjects: options.applyToObjects
    });

    return placedResults;
  }

  /**
   * Simple layout modes along one or two dimensions, centred in the plot:
   * blueprint order (keep original positions), height stack (Y), 2D grid (x-z / x-y / y-z),
   * or a planar row along X (default) or Z. Results are clamped to the plot and
   * de-overlapped.
   *
   * @param {Array} modules - Modules with macro / userData.macro, optional index and position.
   * @param {object} options
   * @param {PlotBounds|object|null} [options.plotBounds]
   * @param {string[]} options.categoryOrder
   * @param {(item: {macro: string}) => string} options.getCategory - Category of a module data item.
   * @param {(macro: string) => {x: number, y: number, z: number}} options.getInitialSize - Size for a macro.
   * @param {string} [options.mode='planar'] - 'planar' | 'grid' | 'height' | 'blueprint' ...
   * @param {string} [options.dimension='x'] - 'x' | 'y' | 'z' | 'x-z' | 'x-y' | 'y-z'
   * @param {number} [options.gap=50]
   * @param {boolean} [options.useBlueprintOrder=false] - Keep original positions (blueprint layout order).
   * @returns {Array<{ index: number, macro: string, position: object, initialSize: object, origPos: object }>}
   */
  static calculateLayoutPlacement(modules, options) {
    if (!Array.isArray(modules) || modules.length === 0) return [];

    const mode = (options.mode || 'planar').toLowerCase();
    const dimension = (options.dimension || 'x').toLowerCase();
    const gap = typeof options.gap === 'number' ? options.gap : 50;

    const moduleData = modules.map((m, idx) => {
      const macro = m.macro || m.userData?.macro || m.key || '';
      const initialSize = options.getInitialSize(macro);
      return {
        index: m.index !== undefined ? m.index : (m.userData?.index !== undefined ? m.userData.index : idx),
        macro,
        initialSize,
        origPos: m.position ? { x: m.position.x, y: m.position.y, z: m.position.z } : { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 }
      };
    });

    const sortedModuleData = StationLayoutEngine.sortByCategoryOrder(moduleData, options.categoryOrder, options.getCategory);
    const bounds = StationLayoutEngine.toPlotBounds(options.plotBounds);
    const bb = bounds;

    if (mode.includes('blueprint') || options.useBlueprintOrder) {
      sortedModuleData.forEach(m => {
        m.position = { ...m.origPos };
      });
      return sortedModuleData;
    } else if (mode.includes('height') || dimension === 'y') {
      let currentY = 0;
      sortedModuleData.forEach((m, i) => {
        const h = m.initialSize.y;
        if (i > 0) currentY += h / 2;
        m.position = { x: bb.centerX, y: currentY, z: bb.centerZ };
        currentY += h / 2 + gap;
      });
      const totalSpan = currentY - gap;
      sortedModuleData.forEach(m => { m.position.y = bb.centerY + (m.position.y - totalSpan / 2); });
    } else if (mode.includes('grid')) {
      let dim1 = 'x', dim2 = 'z', dimOther = 'y';
      if (dimension.includes('x-y')) { dim1 = 'x'; dim2 = 'y'; dimOther = 'z'; }
      else if (dimension.includes('y-z')) { dim1 = 'y'; dim2 = 'z'; dimOther = 'x'; }

      const n = sortedModuleData.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);

      const colWidths = new Array(cols).fill(0);
      const rowDepths = new Array(rows).fill(0);

      sortedModuleData.forEach((m, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        if (m.initialSize[dim1] > colWidths[c]) colWidths[c] = m.initialSize[dim1];
        if (m.initialSize[dim2] > rowDepths[r]) rowDepths[r] = m.initialSize[dim2];
      });

      const colPos = new Array(cols).fill(0);
      const rowPos = new Array(rows).fill(0);

      let cur1 = 0;
      for (let c = 0; c < cols; c++) {
        if (c === 0) { colPos[c] = colWidths[c] / 2; cur1 = colWidths[c]; }
        else { colPos[c] = cur1 + gap + colWidths[c] / 2; cur1 += gap + colWidths[c]; }
      }
      let cur2 = 0;
      for (let r = 0; r < rows; r++) {
        if (r === 0) { rowPos[r] = rowDepths[r] / 2; cur2 = rowDepths[r]; }
        else { rowPos[r] = cur2 + gap + rowDepths[r] / 2; cur2 += gap + rowDepths[r]; }
      }

      const centerOf = (d) => bb[d === 'x' ? 'centerX' : d === 'y' ? 'centerY' : 'centerZ'];
      sortedModuleData.forEach((m, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        m.position[dim1] = centerOf(dim1) + (colPos[c] - cur1 / 2);
        m.position[dim2] = centerOf(dim2) + (rowPos[r] - cur2 / 2);
        m.position[dimOther] = centerOf(dimOther);
      });
    } else {
      // Planar row along X (default) or Z
      const dim = dimension === 'z' ? 'z' : 'x';
      let currentOffset = 0;
      sortedModuleData.forEach((m, i) => {
        const s = m.initialSize[dim];
        if (i > 0) currentOffset += s / 2;
        m.position = { x: bb.centerX, y: bb.centerY, z: bb.centerZ };
        m.position[dim] = currentOffset;
        currentOffset += s / 2 + gap;
      });
      const totalSpan = currentOffset - gap;
      sortedModuleData.forEach(m => {
        m.position[dim] = bb[dim === 'x' ? 'centerX' : 'centerZ'] + (m.position[dim] - totalSpan / 2);
      });
    }

    sortedModuleData.forEach(m => {
      StationLayoutEngine.clampModulePositionToPlot(m.position, m.initialSize, bounds);
    });

    StationLayoutEngine.ensureNoBoundingBoxOverlaps(sortedModuleData, bounds, {
      gap: Math.max(10, gap * 0.5),
      getModuleSize: (m) => m.initialSize
    });

    return sortedModuleData;
  }
}
