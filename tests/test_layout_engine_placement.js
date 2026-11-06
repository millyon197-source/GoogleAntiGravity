/**
 * Verifies the placement algorithms in @x4/domain StationLayoutEngine directly
 * (no UI panel, no catalog): category ordering, alignment-anchor parsing, layered
 * placement (rows along X, rows along Z, then new layers in Y) and the simple layout modes.
 */
import assert from 'node:assert';
import { StationLayoutEngine, PlotBounds } from '@x4/domain';

console.log('[*] Testing StationLayoutEngine placement algorithms...');

const box = (x, y, z) => ({ x, y, z });
const mod = (id, cat, size) => ({ id, cat, size });
const opts = (extra = {}) => ({
  getCategory: (m) => m.cat,
  getModuleSize: (m) => m.size,
  categoryOrder: ['docks', 'storage', 'production', 'habitation', 'defense', 'structure'],
  ...extra
});
// 1 km cube plot centred on the origin: x/y/z in [-500, 500] m
const smallPlot = { enabled: true, x: { plus: 0.5, minus: 0.5 }, z: { plus: 0.5, minus: 0.5 }, y: { plus: 0.5, minus: 0.5 } };

function assertInsideAndSeparated(placed, bounds) {
  for (const p of placed) {
    const { x, y, z } = p.position, s = p.initialSize;
    assert.ok(x - s.x / 2 >= bounds.minX - 1e-6 && x + s.x / 2 <= bounds.maxX + 1e-6, `X inside plot for ${p.module.id}`);
    assert.ok(y - s.y / 2 >= bounds.minY - 1e-6 && y + s.y / 2 <= bounds.maxY + 1e-6, `Y inside plot for ${p.module.id}`);
    assert.ok(z - s.z / 2 >= bounds.minZ - 1e-6 && z + s.z / 2 <= bounds.maxZ + 1e-6, `Z inside plot for ${p.module.id}`);
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    assert.ok(!StationLayoutEngine.doBoxesOverlap(placed[i].position, placed[i].initialSize, placed[j].position, placed[j].initialSize, 0),
      `${placed[i].module.id} and ${placed[j].module.id} do not overlap`);
  }
}

// 1. sortByCategoryOrder: stable buckets, unknown categories last
{
  const items = [mod('a', 'storage'), mod('b', 'docks'), mod('c', 'alien'), mod('d', 'storage'), mod('e', 'docks')];
  const sorted = StationLayoutEngine.sortByCategoryOrder(items, ['docks', 'storage'], (m) => m.cat);
  assert.deepStrictEqual(sorted.map(m => m.id), ['b', 'e', 'a', 'd', 'c']);
  assert.deepStrictEqual(StationLayoutEngine.sortByCategoryOrder([], ['docks'], (m) => m.cat), []);
  console.log('  ✓ sortByCategoryOrder: stable category buckets, unclassified last');
}

// 2. parseAlignmentAnchorKeys: every accepted input form
{
  const p = StationLayoutEngine.parseAlignmentAnchorKeys;
  assert.deepStrictEqual(p('Align-Ground + Align-Center'), ['align-ground', 'align-center']);
  assert.deepStrictEqual(p([{ behaviorKey: 'A' }, { id: 'B' }, { name: 'C' }]), ['a', 'b', 'c']);
  assert.deepStrictEqual(p({ activeEntries: [{ behaviorKey: 'Top' }] }), ['top']);
  assert.deepStrictEqual(p({ key: 'Front' }), ['front']);
  assert.deepStrictEqual(p(null, ['from-ui']), ['from-ui'], 'no anchor -> caller defaults');
  assert.deepStrictEqual(p(''), [''], 'empty string is an explicit (empty) selection, not the default');
  console.log('  ✓ parseAlignmentAnchorKeys handles strings, entry arrays, config objects and defaults');
}

// 3. Layered placement: ground anchor fills a row along X, then rows along Z, then a new layer
{
  const mods = Array.from({ length: 12 }, (_, i) => mod(`m${i}`, 'storage', box(200, 100, 200)));
  const placed = StationLayoutEngine.calculateLayeredPlacement(mods, opts({ plotBounds: smallPlot, alignmentAnchor: 'align-ground', gap: 50 }));
  const bounds = new PlotBounds(smallPlot);
  assert.strictEqual(placed.length, 12);
  assert.strictEqual(placed[0].position.y, bounds.minY + 50, 'first module sits on the ground floor');
  assert.strictEqual(placed[0].position.x, bounds.minX + 100, 'first module starts at min X');
  // 1000 m wide plot, 200 m modules + 50 m gaps -> 4 per row; 4 rows per layer? depth also 1000 -> 4 rows
  assert.deepStrictEqual(placed.slice(0, 4).map(p => p.rowIndex), [0, 0, 0, 0], 'first four modules share row 0');
  assert.strictEqual(placed[4].rowIndex, 1, 'fifth module starts the next row');
  assert.ok(placed[4].position.z > placed[0].position.z, 'next row advances along +Z');
  assertInsideAndSeparated(placed, bounds);
  console.log('  ✓ layered placement: ground start, X rows, Z row advance, inside plot, no overlaps');
}
{
  // Enough modules to force a second layer in Y
  const mods = Array.from({ length: 20 }, (_, i) => mod(`m${i}`, 'production', box(200, 100, 200)));
  const placed = StationLayoutEngine.calculateLayeredPlacement(mods, opts({ plotBounds: smallPlot, alignmentAnchor: 'align-ground', gap: 50 }));
  const layers = new Set(placed.map(p => p.layerIndex));
  assert.ok(layers.size >= 2, `modules overflow into a new layer (layers: ${[...layers].join(',')})`);
  const l1 = placed.find(p => p.layerIndex === 1);
  assert.ok(l1.position.y > placed[0].position.y, 'new layer stacks upward');
  assertInsideAndSeparated(placed, new PlotBounds(smallPlot));
  console.log('  ✓ layered placement: full layer stacks a new layer in Y');
}
{
  // Centre anchor recentres the placed set; category order is honoured; applyToObjects writes positions
  const mods = [mod('s', 'storage', box(100, 100, 100)), mod('d', 'docks', box(100, 100, 100)), mod('p', 'production', box(100, 100, 100))];
  for (const m of mods) m.position = { x: 0, y: 0, z: 0 };
  const placed = StationLayoutEngine.calculateLayeredPlacement(mods, opts({ plotBounds: smallPlot, alignmentAnchor: [{ behaviorKey: 'align-center' }], applyToObjects: true }));
  assert.deepStrictEqual(placed.map(p => p.module.id), ['d', 's', 'p'], 'docks, storage, production order');
  const minX = Math.min(...placed.map(p => p.position.x - 50)), maxX = Math.max(...placed.map(p => p.position.x + 50));
  assert.ok(Math.abs((minX + maxX) / 2) < 1e-6, 'centre anchor recentres along X');
  assert.deepStrictEqual(mods[1].position, placed[0].position, 'applyToObjects writes back to module.position');
  console.log('  ✓ layered placement: category order, centre anchor recentring, applyToObjects');
}

// 4. Simple layout modes
{
  const mods = [{ macro: 'a', index: 0 }, { macro: 'b', index: 1 }, { macro: 'c', index: 2 }];
  const base = { plotBounds: smallPlot, categoryOrder: ['docks'], getCategory: () => 'docks', getInitialSize: () => box(100, 50, 100), gap: 20 };
  // Planar row / height stack: consecutive modules are size + gap apart. (Known issue, kept as-is
  // by the extraction: the row is off-centre by a quarter of the first module's size.)
  const row = StationLayoutEngine.calculateLayoutPlacement(mods, { ...base, mode: 'planar', dimension: 'x' });
  const xs = row.map(m => m.position.x);
  assert.deepStrictEqual([xs[1] - xs[0], xs[2] - xs[1]], [120, 120], 'planar X row spaced by size + gap');
  assert.ok(row.every(m => m.position.y === 0 && m.position.z === 0), 'planar row sits on the plot centre in Y/Z');
  const stack = StationLayoutEngine.calculateLayoutPlacement(mods, { ...base, mode: 'height' });
  const ys = stack.map(m => m.position.y);
  assert.deepStrictEqual([ys[1] - ys[0], ys[2] - ys[1]], [70, 70], 'height stack spaced by size + gap');
  const grid = StationLayoutEngine.calculateLayoutPlacement([...mods, { macro: 'd', index: 3 }], { ...base, mode: 'grid', dimension: 'x-z' });
  assert.deepStrictEqual(grid.map(m => [m.position.x, m.position.z]), [[-60, -60], [60, -60], [-60, 60], [60, 60]], '2x2 grid on X/Z');
  const moved = [{ macro: 'a', index: 0, position: { x: 7, y: 8, z: 9 } }];
  assert.deepStrictEqual(StationLayoutEngine.calculateLayoutPlacement(moved, { ...base, useBlueprintOrder: true })[0].position, { x: 7, y: 8, z: 9 }, 'blueprint order keeps positions');
  console.log('  ✓ layout modes: planar row, height stack, grid, blueprint order');
}

console.log('\n[PASS] test_layout_engine_placement');
